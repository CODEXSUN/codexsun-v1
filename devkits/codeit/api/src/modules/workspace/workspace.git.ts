import { execFile } from "node:child_process";
import { CodeitError } from "../../errors.js";
import { WorkspaceReader } from "./workspace.reader.js";
import type { GitDiffResult, GitStatusFile, GitStatusResult } from "./workspace.types.js";

const DEFAULT_GIT_TIMEOUT_MS = 10000; // 10 seconds
const MAX_DIFF_BYTES = 500 * 1024; // 500KB

/**
 * Returns a scrubbed, minimal environment dictionary containing only essential, safe OS variables.
 * Explicitly strips credentials, auth tokens, SSH socket variables, and user credentials.
 */
function getScrubbedEnv(): Record<string, string> {
  const safeEnvKeys = [
    "PATH",
    "Path",
    "SYSTEMROOT",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "HOMEDRIVE",
    "HOMEPATH",
    "COMSPEC"
  ];

  const scrubbed: Record<string, string> = {};
  for (const key of safeEnvKeys) {
    if (process.env[key] !== undefined) {
      scrubbed[key] = process.env[key]!;
    }
  }

  // Disable terminal prompts and background locking
  scrubbed["GIT_TERMINAL_PROMPT"] = "0";
  scrubbed["GIT_OPTIONAL_LOCKS"] = "0";
  scrubbed["LC_ALL"] = "C";

  return scrubbed;
}

export class WorkspaceGit {
  constructor(private readonly reader: WorkspaceReader = new WorkspaceReader()) {}

  /**
   * Executes a read-only git command in the canonical root with a scrubbed environment and timeout.
   */
  private runGitCommand(
    cwd: string,
    args: string[],
    timeoutMs = DEFAULT_GIT_TIMEOUT_MS
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const canonicalCwd = this.reader.getCanonicalRoot(cwd);

    return new Promise((resolvePromise, rejectPromise) => {
      execFile(
        "git",
        args,
        {
          cwd: canonicalCwd,
          timeout: timeoutMs,
          maxBuffer: 2 * 1024 * 1024, // 2MB max buffer
          env: getScrubbedEnv(),
          windowsHide: true
        },
        (error, stdout, stderr) => {
          if (error) {
            // Check for timeout
            if (
              error.killed ||
              error.signal === "SIGTERM" ||
              (error as NodeJS.ErrnoException).code === "ETIMEDOUT"
            ) {
              rejectPromise(
                new CodeitError(
                  "CODEIT_BUDGET_EXCEEDED",
                  `Git command timed out after ${timeoutMs}ms`,
                  408
                )
              );
              return;
            }

            const stderrStr = stderr ? stderr.toString() : "";
            const stdoutStr = stdout ? stdout.toString() : "";
            const stderrLower = stderrStr.toLowerCase();
            const stdoutLower = stdoutStr.toLowerCase();

            // Non-fatal if simply not a git repository
            if (
              stderrLower.includes("not a git repository") ||
              stdoutLower.includes("not a git repository")
            ) {
              resolvePromise({
                stdout: stdoutStr,
                stderr: stderrStr,
                exitCode: error.code ? Number(error.code) : 1
              });
              return;
            }

            rejectPromise(
              new CodeitError(
                "CODEIT_GIT_ERROR",
                `Git execution failed: ${stderrStr || error.message}`,
                400,
                false,
                { stderr: stderrStr, stdout: stdoutStr }
              )
            );
            return;
          }

          resolvePromise({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: 0
          });
        }
      );
    });
  }

  /**
   * Inspects repository status using `git status --porcelain=v1 -b`.
   */
  public async getStatus(
    cwd: string,
    timeoutMs = DEFAULT_GIT_TIMEOUT_MS
  ): Promise<GitStatusResult> {
    const result = await this.runGitCommand(cwd, ["status", "--porcelain=v1", "-b"], timeoutMs);

    if (
      result.stderr.toLowerCase().includes("not a git repository") ||
      result.stdout.toLowerCase().includes("not a git repository")
    ) {
      return {
        isGitRepo: false,
        branch: "",
        clean: true,
        files: [],
        raw: result.stderr.trim() || "fatal: not a git repository"
      };
    }

    const lines = result.stdout.split(/\r?\n/).filter(Boolean);
    let branch = "";
    const files: GitStatusFile[] = [];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        const branchHeader = line.slice(3).trim();
        // e.g. "main...origin/main" or "main"
        const branchMatch = branchHeader.match(/^([^\s.]+)/);
        branch = branchMatch ? branchMatch[1]! : branchHeader;
      } else if (line.length >= 3) {
        const indexStatus = line[0]!;
        const workTreeStatus = line[1]!;
        const pathPart = line.slice(3).trim();
        files.push({
          path: pathPart,
          indexStatus,
          workTreeStatus
        });
      }
    }

    return {
      isGitRepo: true,
      branch,
      clean: files.length === 0,
      files,
      raw: result.stdout
    };
  }

  /**
   * Inspects repository diff using `git diff`.
   */
  public async getDiff(
    cwd: string,
    options: { staged?: boolean; commit?: string; timeoutMs?: number } = {}
  ): Promise<GitDiffResult> {
    const args = ["diff"];
    if (options.staged) {
      args.push("--staged");
    }
    if (options.commit) {
      args.push(options.commit);
    }

    const result = await this.runGitCommand(cwd, args, options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS);

    if (
      result.stderr.toLowerCase().includes("not a git repository") ||
      result.stdout.toLowerCase().includes("not a git repository")
    ) {
      return {
        isGitRepo: false,
        diff: "",
        staged: options.staged ?? false,
        truncated: false
      };
    }

    let diffContent = result.stdout;
    let truncated = false;

    if (Buffer.byteLength(diffContent, "utf8") > MAX_DIFF_BYTES) {
      diffContent =
        diffContent.slice(0, MAX_DIFF_BYTES) +
        `\n\n[TRUNCATED: Diff exceeds maximum size of ${MAX_DIFF_BYTES} bytes.]`;
      truncated = true;
    }

    return {
      isGitRepo: true,
      diff: diffContent,
      staged: options.staged ?? false,
      truncated
    };
  }
}
