import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  openSync,
  readSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync
} from "node:fs";
import { basename, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { NotFoundError, PathDeniedError, ValidationError } from "../../errors.js";
import type {
  WorkspaceDirectoryEntry,
  WorkspaceListDirectoryResult,
  WorkspaceReadFileOptions,
  WorkspaceReadFileResult
} from "./workspace.types.js";

const DEFAULT_MAX_READ_BYTES = 500 * 1024; // 500KB

/**
 * Checks if a canonical target path is strictly contained within a canonical root.
 */
export function isPathInsideRoot(targetCanonical: string, rootCanonical: string): boolean {
  const isWindows = process.platform === "win32";
  const normTarget = normalize(targetCanonical);
  const normRoot = normalize(rootCanonical);
  const rel = relative(normRoot, normTarget);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    return false;
  }

  if (isWindows) {
    const t = normTarget.toLowerCase();
    const r = normRoot.toLowerCase();
    return t === r || t.startsWith(r + "\\") || t.startsWith(r + "/");
  }

  return normTarget === normRoot || normTarget.startsWith(normRoot + "/");
}

/**
 * Unconditionally blocks access to secrets, credentials, certificates, keys, and git internals.
 */
export function isSecretOrProtected(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);

  // 1. Git internals
  if (segments.some((seg) => seg === ".git" || seg === ".gitattributes" || seg === ".gitmodules")) {
    return true;
  }

  // 2. Check each segment for secret directories (e.g. .env folders)
  for (const seg of segments) {
    const lowerSeg = seg.toLowerCase();
    if (lowerSeg === ".env" || lowerSeg.startsWith(".env.")) {
      return true;
    }
  }

  const filename = basename(normalized).toLowerCase();

  // 3. Environment files
  if (filename === ".env" || filename.startsWith(".env.") || filename.startsWith(".env")) {
    return true;
  }

  // 4. Certificates and key files
  if (/\.(key|pem|crt|pfx|p12|keystore)$/i.test(filename)) {
    return true;
  }

  // 5. SSH key files
  if (/^id_(rsa|dsa|ecdsa|ed25519)/i.test(filename)) {
    return true;
  }

  // 6. Credentials files and tokens
  if (
    filename === "credentials" ||
    filename === "credentials.json" ||
    filename.includes("credentials") ||
    filename.includes("token") ||
    filename === "secrets.json" ||
    filename === "secret.json"
  ) {
    return true;
  }

  return false;
}

export class WorkspaceReader {
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
   * Validates target path against canonical root.
   * Throws PathDeniedError on traversal, symlink/junction escape, or secret file.
   */
  public resolveAndValidatePath(
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

    // Secret and protected file filter (fail closed before filesystem touch)
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

    // If target exists, resolve symlinks / junctions to canonical physical target
    let canonicalTarget: string | null = null;
    if (existsSync(resolvedTarget)) {
      try {
        canonicalTarget = realpathSync(resolvedTarget);
      } catch {
        throw new PathDeniedError(`Failed to resolve canonical path for: ${relativePath}`);
      }

      // Check that the canonical target (after following symlinks/junctions) remains inside canonicalRoot
      if (!isPathInsideRoot(canonicalTarget, canonicalRoot)) {
        throw new PathDeniedError(
          `Symlink or junction escapes canonical workspace root: ${relativePath}`,
          { path: relativePath, resolved: canonicalTarget }
        );
      }

      // Double-check secret patterns on canonical physical path target
      const targetRel = relative(canonicalRoot, canonicalTarget);
      if (isSecretOrProtected(targetRel)) {
        throw new PathDeniedError(
          `Access to secret or protected file denied via symlink: ${relativePath}`,
          { path: relativePath }
        );
      }
    }

    return { canonicalRoot, resolvedTarget, canonicalTarget };
  }

  /**
   * Reads a scoped file from the workspace within the canonical root.
   * Enforces truncation bounds and secret exclusions.
   */
  public readFile(
    rootPath: string,
    relativePath: string,
    options: WorkspaceReadFileOptions = {}
  ): WorkspaceReadFileResult {
    const { canonicalTarget } = this.resolveAndValidatePath(rootPath, relativePath);

    if (!canonicalTarget || !existsSync(canonicalTarget)) {
      throw new NotFoundError(`File not found: ${relativePath}`, { path: relativePath });
    }

    const stat = statSync(canonicalTarget);
    if (stat.isDirectory()) {
      throw new ValidationError(`Target path is a directory, not a file: ${relativePath}`, {
        path: relativePath
      });
    }

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_READ_BYTES;
    const byteSize = stat.size;

    if (byteSize > maxBytes) {
      // Bounded output truncation
      const fd = openSync(canonicalTarget, "r");
      const buf = Buffer.alloc(maxBytes);
      const bytesRead = readSync(fd, buf, 0, maxBytes, 0);
      closeSync(fd);

      const truncatedSlice = buf.subarray(0, bytesRead).toString("utf8");
      const indicator = `\n\n[TRUNCATED: File exceeds max size of ${maxBytes} bytes. Showing first ${maxBytes} bytes.]`;
      const finalContent = truncatedSlice + indicator;
      const hash = createHash("sha256").update(finalContent).digest("hex");

      return {
        content: finalContent,
        hash,
        byte_size: byteSize,
        truncated: true
      };
    }

    const buf = readFileSync(canonicalTarget);
    const content = buf.toString("utf8");
    const hash = createHash("sha256").update(content).digest("hex");

    return {
      content,
      hash,
      byte_size: byteSize,
      truncated: false
    };
  }

  /**
   * Scoped directory listing within canonical project root.
   * Filters out secrets and git internals; bounds entries.
   */
  public listDirectory(
    rootPath: string,
    relativeDir = "",
    options: { maxEntries?: number; recursive?: boolean } = {}
  ): WorkspaceListDirectoryResult {
    const { canonicalTarget, canonicalRoot } = this.resolveAndValidatePath(
      rootPath,
      relativeDir || "."
    );

    const dirPath = canonicalTarget ?? canonicalRoot;
    if (!existsSync(dirPath)) {
      throw new NotFoundError(`Directory not found: ${relativeDir}`, { path: relativeDir });
    }

    const maxEntries = options.maxEntries ?? 1000;
    const recursive = options.recursive ?? true;
    const entries: WorkspaceDirectoryEntry[] = [];
    let truncated = false;

    const traverse = (currentDir: string, currentRel: string) => {
      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }

      let dirents;
      try {
        dirents = readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const dirent of dirents) {
        if (entries.length >= maxEntries) {
          truncated = true;
          break;
        }

        const name = dirent.name;
        // Skip ignored directories
        if (name === ".git" || name === "node_modules" || name === ".codeit") {
          continue;
        }

        const itemRel = currentRel ? `${currentRel}/${name}` : name;

        // Skip secrets
        if (isSecretOrProtected(itemRel)) {
          continue;
        }

        const fullPath = join(currentDir, name);

        if (dirent.isDirectory()) {
          entries.push({
            name,
            path: itemRel,
            type: "directory"
          });
          if (recursive) {
            traverse(fullPath, itemRel);
          }
        } else if (dirent.isFile() || dirent.isSymbolicLink()) {
          let size: number | undefined;
          try {
            size = statSync(fullPath).size;
          } catch {
            size = undefined;
          }
          entries.push({
            name,
            path: itemRel,
            type: "file",
            size
          });
        }
      }
    };

    traverse(dirPath, relativeDir === "." ? "" : relativeDir);

    return {
      entries,
      total: entries.length,
      truncated
    };
  }
}
