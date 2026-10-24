import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { CodeitError, InvalidStateError, PathDeniedError, ValidationError } from "../../errors.js";
import { isPathInsideRoot, isSecretOrProtected } from "./workspace.reader.js";
import {
  type ApplyPatchInput,
  ApplyPatchInputSchema,
  type DiffHunk,
  type FileDiff,
  type PatchResult
} from "./workspace.patch.types.js";

/**
 * Conflict error thrown when file content hash does not match expected_hash,
 * or when a patch cannot be applied cleanly (HTTP 409).
 */
export class PatchConflictError extends CodeitError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("CODEIT_INVALID_STATE", message, 409, false, details);
    this.name = "PatchConflictError";
  }
}

export type RunStatusLookup = (runUuid: string) =>
  | {
      state: string;
      cancellation_generation: number;
    }
  | null
  | undefined;

export interface ArtifactCreationInput {
  run_uuid: string | null;
  artifact_type: "diff";
  content: string;
  media_type: string;
  provenance: Record<string, unknown>;
}

export type ArtifactCreationCallback = (input: ArtifactCreationInput) => { uuid: string };

export interface WorkspacePatcherOptions {
  runLookup?: RunStatusLookup | undefined;
  artifactCallback?: ArtifactCreationCallback | undefined;
}

function splitLines(content: string): string[] {
  if (content === "") return [];
  const normalized = content.endsWith("\r\n")
    ? content.slice(0, -2)
    : content.endsWith("\n")
      ? content.slice(0, -1)
      : content;
  return normalized === "" ? [] : normalized.split(/\r?\n/);
}

/**
 * Computes standard unified diff between oldContent and newContent.
 */
export function computeUnifiedDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
  contextSize = 3
): FileDiff {
  const normPath = filePath.replace(/\\/g, "/");
  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);

  const prevHash = createHash("sha256").update(Buffer.from(oldContent, "utf8")).digest("hex");
  const newHash = createHash("sha256").update(Buffer.from(newContent, "utf8")).digest("hex");

  if (oldContent === newContent) {
    return {
      path: normPath,
      previous_hash: prevHash,
      new_hash: newHash,
      lines_added: 0,
      lines_deleted: 0,
      unified_diff: "",
      hunks: []
    };
  }

  // 1. Strip common prefix
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++;
  }

  // 2. Strip common suffix
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const midOld = oldLines.slice(prefix, oldLines.length - suffix);
  const midNew = newLines.slice(prefix, newLines.length - suffix);

  // 3. LCS DP on middle
  const dp: number[][] = Array.from({ length: midOld.length + 1 }, () =>
    new Array<number>(midNew.length + 1).fill(0)
  );

  for (let i = 1; i <= midOld.length; i++) {
    const row = dp[i]!;
    const prevRow = dp[i - 1]!;
    const oldVal = midOld[i - 1];
    for (let j = 1; j <= midNew.length; j++) {
      const newVal = midNew[j - 1];
      if (oldVal === newVal) {
        row[j] = prevRow[j - 1]! + 1;
      } else {
        row[j] = Math.max(prevRow[j]!, row[j - 1]!);
      }
    }
  }

  // 4. Backtrack edit script
  let i = midOld.length;
  let j = midNew.length;
  const midEdits: Array<{ type: "equal" | "delete" | "add"; line: string }> = [];

  while (i > 0 || j > 0) {
    const oldVal = i > 0 ? midOld[i - 1] : undefined;
    const newVal = j > 0 ? midNew[j - 1] : undefined;
    const currentRow = dp[i]!;
    const prevRow = i > 0 ? dp[i - 1]! : undefined;

    if (i > 0 && j > 0 && oldVal === newVal && oldVal !== undefined) {
      midEdits.push({ type: "equal", line: oldVal });
      i--;
      j--;
    } else if (
      j > 0 &&
      newVal !== undefined &&
      (i === 0 || currentRow[j - 1]! >= (prevRow ? prevRow[j]! : 0))
    ) {
      midEdits.push({ type: "add", line: newVal });
      j--;
    } else if (i > 0 && oldVal !== undefined) {
      midEdits.push({ type: "delete", line: oldVal });
      i--;
    }
  }
  midEdits.reverse();

  // 5. Combine all edits
  interface EditItem {
    type: "equal" | "delete" | "add";
    line: string;
    oldIdx: number;
    newIdx: number;
  }

  const allEdits: EditItem[] = [];
  let curOld = 1;
  let curNew = 1;

  for (let k = 0; k < prefix; k++) {
    const line = oldLines[k] ?? "";
    allEdits.push({ type: "equal", line, oldIdx: curOld++, newIdx: curNew++ });
  }
  for (const edit of midEdits) {
    if (edit.type === "equal") {
      allEdits.push({ type: "equal", line: edit.line, oldIdx: curOld++, newIdx: curNew++ });
    } else if (edit.type === "delete") {
      allEdits.push({ type: "delete", line: edit.line, oldIdx: curOld++, newIdx: curNew });
    } else {
      allEdits.push({ type: "add", line: edit.line, oldIdx: curOld, newIdx: curNew++ });
    }
  }
  for (let k = oldLines.length - suffix; k < oldLines.length; k++) {
    const line = oldLines[k] ?? "";
    allEdits.push({ type: "equal", line, oldIdx: curOld++, newIdx: curNew++ });
  }

  // 6. Identify changed indices
  const changedIndices: number[] = [];
  let linesAdded = 0;
  let linesDeleted = 0;

  for (let idx = 0; idx < allEdits.length; idx++) {
    const edit = allEdits[idx]!;
    if (edit.type === "add") {
      changedIndices.push(idx);
      linesAdded++;
    } else if (edit.type === "delete") {
      changedIndices.push(idx);
      linesDeleted++;
    }
  }

  // 7. Group into hunks with context
  const hunks: DiffHunk[] = [];
  const groups: Array<{ start: number; end: number }> = [];

  let currentGroup: { start: number; end: number } | null = null;
  for (const idx of changedIndices) {
    if (!currentGroup) {
      currentGroup = { start: idx, end: idx };
    } else if (idx - currentGroup.end <= contextSize * 2) {
      currentGroup.end = idx;
    } else {
      groups.push(currentGroup);
      currentGroup = { start: idx, end: idx };
    }
  }
  if (currentGroup) {
    groups.push(currentGroup);
  }

  const diffOutputLines: string[] = [`--- a/${normPath}`, `+++ b/${normPath}`];

  for (const group of groups) {
    const hunkStart = Math.max(0, group.start - contextSize);
    const hunkEnd = Math.min(allEdits.length - 1, group.end + contextSize);

    const hunkEdits = allEdits.slice(hunkStart, hunkEnd + 1);
    if (hunkEdits.length === 0) continue;

    let oldLinesCount = 0;
    let newLinesCount = 0;
    const hunkLines: string[] = [];

    for (const edit of hunkEdits) {
      if (edit.type === "equal") {
        oldLinesCount++;
        newLinesCount++;
        hunkLines.push(` ${edit.line}`);
      } else if (edit.type === "delete") {
        oldLinesCount++;
        hunkLines.push(`-${edit.line}`);
      } else if (edit.type === "add") {
        newLinesCount++;
        hunkLines.push(`+${edit.line}`);
      }
    }

    const firstEdit = hunkEdits[0]!;
    const oldStart = firstEdit.oldIdx;
    const newStart = firstEdit.newIdx;
    const header = `@@ -${oldStart},${oldLinesCount} +${newStart},${newLinesCount} @@`;

    hunks.push({
      oldStart,
      oldLines: oldLinesCount,
      newStart,
      newLines: newLinesCount,
      header,
      lines: hunkLines
    });

    diffOutputLines.push(header);
    diffOutputLines.push(...hunkLines);
  }

  return {
    path: normPath,
    previous_hash: prevHash,
    new_hash: newHash,
    lines_added: linesAdded,
    lines_deleted: linesDeleted,
    unified_diff: diffOutputLines.join("\n"),
    hunks
  };
}

/**
 * Parses unified diff string and applies hunks to originalContent.
 * Throws PatchConflictError if context lines fail to match.
 */
export function applyUnifiedDiff(originalContent: string, unifiedDiff: string): string {
  const origLines = splitLines(originalContent);
  const diffLines = unifiedDiff.split(/\r?\n/);
  const hadTrailingNewline = originalContent.endsWith("\n");

  interface ParsedHunk {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    header: string;
    lines: string[];
  }

  const hunks: ParsedHunk[] = [];
  let currentHunk: ParsedHunk | null = null;

  for (const line of diffLines) {
    const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkHeaderMatch && hunkHeaderMatch[1] && hunkHeaderMatch[3]) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        oldStart: Number.parseInt(hunkHeaderMatch[1], 10),
        oldCount: hunkHeaderMatch[2] !== undefined ? Number.parseInt(hunkHeaderMatch[2], 10) : 1,
        newStart: Number.parseInt(hunkHeaderMatch[3], 10),
        newCount: hunkHeaderMatch[4] !== undefined ? Number.parseInt(hunkHeaderMatch[4], 10) : 1,
        header: line,
        lines: []
      };
      continue;
    }

    if (currentHunk) {
      if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
        currentHunk.lines.push(line);
      } else if (line.startsWith("\\ No newline at end of file")) {
        // Ignored
      }
    }
  }
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  if (hunks.length === 0) {
    return originalContent;
  }

  const resultLines: string[] = [];
  let origIndex = 0; // 0-based pointer into origLines

  for (const hunk of hunks) {
    const hunkTargetZeroBased = hunk.oldStart === 0 ? 0 : hunk.oldStart - 1;

    // Emit unchanged lines before hunk
    while (origIndex < hunkTargetZeroBased && origIndex < origLines.length) {
      const origLine = origLines[origIndex];
      if (origLine !== undefined) {
        resultLines.push(origLine);
      }
      origIndex++;
    }

    // Apply hunk lines
    for (const hunkLine of hunk.lines) {
      const marker = hunkLine[0];
      const content = hunkLine.slice(1);
      const currentOrigLine = origLines[origIndex];

      if (marker === " ") {
        if (origIndex >= origLines.length || currentOrigLine !== content) {
          throw new PatchConflictError(
            `Context mismatch in patch hunk at line ${origIndex + 1}: expected "${content}", got "${currentOrigLine ?? "<EOF>"}"`,
            { hunk: hunk.header, expected: content, actual: currentOrigLine ?? null }
          );
        }
        resultLines.push(currentOrigLine);
        origIndex++;
      } else if (marker === "-") {
        if (origIndex >= origLines.length || currentOrigLine !== content) {
          throw new PatchConflictError(
            `Deletion mismatch in patch hunk at line ${origIndex + 1}: expected "${content}", got "${currentOrigLine ?? "<EOF>"}"`,
            { hunk: hunk.header, expected: content, actual: currentOrigLine ?? null }
          );
        }
        origIndex++;
      } else if (marker === "+") {
        resultLines.push(content);
      }
    }
  }

  // Emit remaining lines after last hunk
  while (origIndex < origLines.length) {
    const remainingLine = origLines[origIndex];
    if (remainingLine !== undefined) {
      resultLines.push(remainingLine);
    }
    origIndex++;
  }

  const joined = resultLines.join("\n");
  return hadTrailingNewline ? joined + "\n" : joined;
}

export class WorkspacePatcher {
  private readonly runLookup?: RunStatusLookup | undefined;
  private readonly artifactCallback?: ArtifactCreationCallback | undefined;

  constructor(options: WorkspacePatcherOptions = {}) {
    this.runLookup = options.runLookup;
    this.artifactCallback = options.artifactCallback;
  }

  /**
   * Resolves and verifies canonical project root. Fails closed if non-existent or inaccessible.
   */
  public getCanonicalRoot(rootPath: string): string {
    if (!rootPath || typeof rootPath !== "string") {
      throw new PathDeniedError("Invalid project root path: must be a non-empty string");
    }

    try {
      if (!existsSync(rootPath)) {
        throw new PathDeniedError(`Project root path does not exist: ${rootPath}`);
      }
      return realpathSync(rootPath);
    } catch (err) {
      if (err instanceof PathDeniedError) throw err;
      throw new PathDeniedError(`Failed to resolve canonical project root: ${rootPath}`);
    }
  }

  /**
   * Validates target write path against canonical root and security policies.
   * Throws PathDeniedError on traversal, symlink/junction escape, or secret file.
   */
  public resolveAndValidateTargetPath(
    rootPath: string,
    relativePath: string
  ): {
    canonicalRoot: string;
    resolvedTarget: string;
    canonicalTarget: string | null;
  } {
    const canonicalRoot = this.getCanonicalRoot(rootPath);

    if (!relativePath || typeof relativePath !== "string") {
      throw new PathDeniedError("Relative file path must be a non-empty string");
    }

    if (relativePath.includes("\0")) {
      throw new PathDeniedError("Null byte injection detected in path");
    }

    // Unconditional secret canary exclusion
    if (isSecretOrProtected(relativePath)) {
      throw new PathDeniedError(`Access to secret or protected file denied: ${relativePath}`, {
        path: relativePath
      });
    }

    // Resolve path relative to canonical root
    const resolvedTarget = resolve(canonicalRoot, relativePath);

    // Initial boundary check on unresolved path
    if (!isPathInsideRoot(resolvedTarget, canonicalRoot)) {
      throw new PathDeniedError(`Path escapes canonical workspace root: ${relativePath}`, {
        path: relativePath
      });
    }

    let canonicalTarget: string | null = null;
    if (existsSync(resolvedTarget)) {
      try {
        canonicalTarget = realpathSync(resolvedTarget);
      } catch {
        throw new PathDeniedError(`Failed to resolve canonical path for: ${relativePath}`);
      }

      if (!isPathInsideRoot(canonicalTarget, canonicalRoot)) {
        throw new PathDeniedError(
          `Symlink or junction escapes canonical workspace root: ${relativePath}`,
          { path: relativePath, resolved: canonicalTarget }
        );
      }

      const targetRel = relative(canonicalRoot, canonicalTarget);
      if (isSecretOrProtected(targetRel)) {
        throw new PathDeniedError(
          `Access to secret or protected file denied via symlink: ${relativePath}`,
          { path: relativePath }
        );
      }
    } else {
      // For non-existent files, verify parent directory boundary
      const targetDir = dirname(resolvedTarget);
      if (existsSync(targetDir)) {
        const canonicalDir = realpathSync(targetDir);
        if (!isPathInsideRoot(canonicalDir, canonicalRoot)) {
          throw new PathDeniedError(
            `Target directory escapes canonical workspace root: ${relativePath}`,
            { path: relativePath }
          );
        }
      }
    }

    return { canonicalRoot, resolvedTarget, canonicalTarget };
  }

  /**
   * Applies an exact patch atomically within the canonical workspace root.
   */
  public applyPatch(
    rootPath: string,
    input: ApplyPatchInput,
    options: {
      runLookup?: RunStatusLookup | undefined;
      artifactCallback?: ArtifactCreationCallback | undefined;
    } = {}
  ): PatchResult {
    // 1. Validate payload schema
    const parsed = ApplyPatchInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Invalid patch input payload", {
        errors: parsed.error.issues
      });
    }

    const { run_uuid, path: relPath, expected_hash, patch, expected_generation } = parsed.data;

    // 2. Cancellation generation & run state check
    const runLookupFn = options.runLookup ?? this.runLookup;
    if (runLookupFn) {
      const run = runLookupFn(run_uuid);
      if (run) {
        if (run.state === "cancelling" || run.state === "cancelled") {
          throw new InvalidStateError(
            `Cannot apply patch: run ${run_uuid} is cancelled (${run.state})`,
            409,
            { run_uuid, state: run.state }
          );
        }
        if (
          expected_generation !== undefined &&
          run.cancellation_generation > expected_generation
        ) {
          throw new InvalidStateError(
            `Cannot apply patch: run ${run_uuid} cancellation generation has advanced (${run.cancellation_generation} > ${expected_generation})`,
            409,
            {
              run_uuid,
              cancellation_generation: run.cancellation_generation,
              expected_generation
            }
          );
        }
      }
    }

    // 3. Path boundary and secret validation
    const { resolvedTarget, canonicalTarget } = this.resolveAndValidateTargetPath(
      rootPath,
      relPath
    );

    const targetFile = canonicalTarget ?? resolvedTarget;

    // 4. Precondition check: verify target file exists and compute SHA-256 hash
    if (!existsSync(targetFile)) {
      throw new PatchConflictError(
        `Target file does not exist to match expected hash: ${relPath}`,
        { path: relPath, expected_hash }
      );
    }

    const stat = statSync(targetFile);
    if (stat.isDirectory()) {
      throw new ValidationError(`Target path is a directory, not a file: ${relPath}`, {
        path: relPath
      });
    }

    const currentContentBuf = readFileSync(targetFile);
    const currentContent = currentContentBuf.toString("utf8");
    const currentHash = createHash("sha256").update(currentContentBuf).digest("hex");

    if (currentHash !== expected_hash) {
      throw new PatchConflictError(
        `File content hash mismatch for ${relPath}: expected ${expected_hash}, got ${currentHash}`,
        {
          path: relPath,
          expected_hash,
          actual_hash: currentHash
        }
      );
    }

    // 5. Compute new file content
    let newContent: string;
    if (patch.includes("@@")) {
      newContent = applyUnifiedDiff(currentContent, patch);
    } else {
      newContent = patch;
    }

    const newContentBuf = Buffer.from(newContent, "utf8");
    const newHash = createHash("sha256").update(newContentBuf).digest("hex");

    // 6. Compute unified diff and hunk statistics
    const diffResult = computeUnifiedDiff(currentContent, newContent, relPath);

    // 7. Atomic file write with crash recovery
    const targetDir = dirname(targetFile);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const randomSuffix = randomBytes(8).toString("hex");
    const tempFileName = `.tmp.${process.pid}.${randomSuffix}`;
    const tempFilePath = join(targetDir, tempFileName);

    const backupFileName = `.bak.${process.pid}.${randomSuffix}`;
    const backupFilePath = join(targetDir, backupFileName);

    // Create backup of original content for recovery
    writeFileSync(backupFilePath, currentContentBuf);

    try {
      // Write to temp file and flush to disk
      const fd = openSync(tempFilePath, "w");
      try {
        writeSync(fd, newContentBuf);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }

      // Atomic rename
      renameSync(tempFilePath, targetFile);

      // Verify written content hash
      const verifiedBuf = readFileSync(targetFile);
      const verifiedHash = createHash("sha256").update(verifiedBuf).digest("hex");

      if (verifiedHash !== newHash) {
        // Rollback from backup immediately on verification mismatch
        writeFileSync(targetFile, currentContentBuf);
        throw new CodeitError(
          "CODEIT_INVALID_STATE",
          `Written content hash verification failed for ${relPath}`,
          500,
          false,
          { expected: newHash, actual: verifiedHash }
        );
      }

      // Cleanup temporary backup after successful application
      try {
        if (existsSync(backupFilePath)) {
          rmSync(backupFilePath, { force: true });
        }
      } catch {
        // Non-fatal
      }
    } catch (err) {
      // Clean up temp file on failure
      if (existsSync(tempFilePath)) {
        try {
          rmSync(tempFilePath, { force: true });
        } catch {
          // Non-fatal
        }
      }
      throw err;
    }

    // 8. Generate diff artifact if callback provided
    let diffArtifactUuid: string | null = null;
    const artifactCb = options.artifactCallback ?? this.artifactCallback;
    if (artifactCb && diffResult.unified_diff) {
      try {
        const artifact = artifactCb({
          run_uuid,
          artifact_type: "diff",
          content: diffResult.unified_diff,
          media_type: "text/x-diff",
          provenance: {
            creator: "WorkspacePatcher",
            path: relPath,
            previous_hash: currentHash,
            new_hash: newHash,
            lines_added: diffResult.lines_added,
            lines_deleted: diffResult.lines_deleted
          }
        });
        diffArtifactUuid = artifact.uuid;
      } catch {
        // Non-fatal if artifact creation fails
      }
    }

    return {
      applied: true,
      new_hash: newHash,
      path: relPath,
      previous_hash: currentHash,
      byte_size: newContentBuf.length,
      lines_added: diffResult.lines_added,
      lines_deleted: diffResult.lines_deleted,
      diff_artifact_uuid: diffArtifactUuid
    };
  }

  /**
   * Reverts a previously patched file using its original content or inverse patch.
   */
  public rollback(rootPath: string, relativePath: string, originalContent: string): PatchResult {
    const { resolvedTarget, canonicalTarget } = this.resolveAndValidateTargetPath(
      rootPath,
      relativePath
    );
    const targetFile = canonicalTarget ?? resolvedTarget;

    const currentContentBuf = readFileSync(targetFile);
    const currentHash = createHash("sha256").update(currentContentBuf).digest("hex");

    const originalBuf = Buffer.from(originalContent, "utf8");
    const targetHash = createHash("sha256").update(originalBuf).digest("hex");

    const targetDir = dirname(targetFile);
    const randomSuffix = randomBytes(8).toString("hex");
    const tempFilePath = join(targetDir, `.tmp.${process.pid}.${randomSuffix}`);

    const fd = openSync(tempFilePath, "w");
    try {
      writeSync(fd, originalBuf);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    renameSync(tempFilePath, targetFile);

    const diffResult = computeUnifiedDiff(
      currentContentBuf.toString("utf8"),
      originalContent,
      relativePath
    );

    return {
      applied: true,
      new_hash: targetHash,
      path: relativePath,
      previous_hash: currentHash,
      byte_size: originalBuf.length,
      lines_added: diffResult.lines_added,
      lines_deleted: diffResult.lines_deleted
    };
  }
}
