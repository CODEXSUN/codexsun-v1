import { execFile, spawn } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { PathDeniedError, ValidationError } from "../../errors.js";
import { isPathInsideRoot, WorkspaceReader } from "./workspace.reader.js";
import {
  type CommandResult,
  type CommandRunnerOptions,
  type ExecuteCommandInput,
  ExecuteCommandInputSchema,
  type PermittedExecutable
} from "./workspace.command.types.js";

export const DEFAULT_COMMAND_TIMEOUT_MS = 30000; // 30 seconds
export const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB
export const TRUNCATION_NOTICE = "\n\n[TRUNCATED: Output exceeded quota]";

export const PERMITTED_EXECUTABLES = new Set<string>(["node", "npm", "git", "npx"]);

export const SAFE_SYSTEM_ENV_KEYS = new Set<string>([
  "PATH",
  "Path",
  "path",
  "SYSTEMROOT",
  "SystemRoot",
  "systemroot",
  "SYSTEMDRIVE",
  "SystemDrive",
  "TEMP",
  "TMP",
  "COMSPEC",
  "ComSpec",
  "comspec",
  "PATHEXT",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "PROCESSOR_IDENTIFIER",
  "PROCESSOR_LEVEL",
  "PROCESSOR_REVISION",
  "OS",
  "ALLUSERSPROFILE",
  "PROGRAMDATA",
  "ProgramData",
  "PROGRAMFILES",
  "ProgramFiles",
  "PROGRAMFILES(X86)",
  "ProgramFiles(x86)",
  "COMMONPROGRAMFILES",
  "CommonProgramFiles",
  "USERPROFILE",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "LANG",
  "LC_ALL",
  "TERM",
  "NODE",
  "NODE_PATH"
]);

/**
 * Checks whether an environment variable name matches sensitive credential patterns.
 */
export function isSensitiveEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    upper.endsWith("_KEY") ||
    upper.includes("_KEY_") ||
    upper.startsWith("KEY_") ||
    upper === "KEY" ||
    upper.endsWith("_SECRET") ||
    upper.includes("_SECRET_") ||
    upper.startsWith("SECRET_") ||
    upper === "SECRET" ||
    upper.endsWith("_TOKEN") ||
    upper.includes("_TOKEN_") ||
    upper.startsWith("TOKEN_") ||
    upper === "TOKEN" ||
    upper.endsWith("_PASSWORD") ||
    upper.includes("_PASSWORD_") ||
    upper.startsWith("PASSWORD_") ||
    upper === "PASSWORD" ||
    upper.startsWith("GEMINI_") ||
    upper.startsWith("AWS_") ||
    upper.startsWith("GITHUB_") ||
    upper.startsWith("CODEXSUN_") ||
    upper === "CODEXSUN_CODEIT_PAIRING_TOKEN"
  );
}

/**
 * Strips secret tokens and credentials from the environment, forwarding only safe system variables.
 */
export function scrubEnvironment(
  baseEnv: NodeJS.ProcessEnv = process.env,
  additionalEnv: Record<string, string> = {}
): Record<string, string> {
  const scrubbed: Record<string, string> = {};

  // 1. Filter base process environment
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value === undefined || value === null) continue;
    if (isSensitiveEnvKey(key)) continue;

    // Must be in safe system keys allowlist
    if (!SAFE_SYSTEM_ENV_KEYS.has(key)) {
      continue;
    }

    scrubbed[key] = String(value);
  }

  // 2. Filter optional additional overrides
  for (const [key, value] of Object.entries(additionalEnv)) {
    if (value === undefined || value === null) continue;
    if (isSensitiveEnvKey(key)) continue;
    scrubbed[key] = String(value);
  }

  // Non-interactive standard environment indicators
  scrubbed["CI"] = "true";
  scrubbed["NODE_ENV"] = "test";
  scrubbed["GIT_TERMINAL_PROMPT"] = "0";

  return scrubbed;
}

/**
 * Cleanly terminates a child process and its entire descendant process tree.
 * - On Windows: executes `taskkill /pid <PID> /T /F`.
 * - On POSIX: sends `SIGKILL` to the process group (`-PID`).
 */
export async function killProcessTree(pid: number): Promise<void> {
  if (!pid || pid <= 0) return;

  if (process.platform === "win32") {
    await new Promise<void>((resolvePromise) => {
      execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => {
        resolvePromise();
      });
    });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Child already terminated
      }
    }
  }
}

export class CommandRunner {
  constructor(
    public readonly defaultProjectRoot?: string,
    private readonly reader: WorkspaceReader = new WorkspaceReader()
  ) {}

  /**
   * Validates and resolves the executable command against the strict development allowlist.
   * Throws ValidationError (CODEIT_VALIDATION_ERROR) on unapproved executables.
   */
  public resolveExecutable(executable: string): {
    canonicalName: PermittedExecutable;
    spawnExecutable: string;
    spawnArgsPrefix: string[];
  } {
    if (!executable || typeof executable !== "string") {
      throw new ValidationError("Executable must be a non-empty string", { executable });
    }

    const trimmed = executable.trim();
    if (!trimmed) {
      throw new ValidationError("Executable cannot be blank", { executable });
    }

    // Direct shell interpreters and injection prevention
    if (/[\s;&|`$<>^]/.test(trimmed)) {
      throw new ValidationError(`Executable contains invalid shell characters: '${trimmed}'`, {
        executable: trimmed
      });
    }

    const base = basename(trimmed).toLowerCase();
    const canonicalName = base.replace(/\.(exe|cmd|bat)$/i, "") as PermittedExecutable;

    if (!PERMITTED_EXECUTABLES.has(canonicalName)) {
      throw new ValidationError(
        `Executable '${trimmed}' is not permitted. Only 'node', 'npm', 'git', and 'npx' are approved development commands.`,
        { executable: trimmed, canonicalName }
      );
    }

    // Windows batch resolution: invoke via node binary to avoid cmd.exe shell wrapper and injection vulnerabilities
    if (process.platform === "win32") {
      const nodeDir = dirname(process.execPath);
      if (canonicalName === "npm") {
        const npmCli = join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js");
        if (existsSync(npmCli)) {
          return {
            canonicalName,
            spawnExecutable: process.execPath,
            spawnArgsPrefix: [npmCli]
          };
        }
        return {
          canonicalName,
          spawnExecutable: "npm.cmd",
          spawnArgsPrefix: []
        };
      }

      if (canonicalName === "npx") {
        const npxCli = join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js");
        if (existsSync(npxCli)) {
          return {
            canonicalName,
            spawnExecutable: process.execPath,
            spawnArgsPrefix: [npxCli]
          };
        }
        return {
          canonicalName,
          spawnExecutable: "npx.cmd",
          spawnArgsPrefix: []
        };
      }

      if (canonicalName === "node") {
        return {
          canonicalName,
          spawnExecutable: process.execPath,
          spawnArgsPrefix: []
        };
      }
    }

    return {
      canonicalName,
      spawnExecutable: canonicalName,
      spawnArgsPrefix: []
    };
  }

  /**
   * Validates that working directory exists and is strictly contained within canonical project root.
   * Throws PathDeniedError (CODEIT_PATH_DENIED) on path traversal or outside escape.
   */
  public resolveAndValidateCwd(cwd: string, projectRoot?: string): string {
    const root = projectRoot ?? this.defaultProjectRoot;

    if (!cwd || typeof cwd !== "string") {
      throw new PathDeniedError("Working directory must be a non-empty string", { cwd });
    }

    if (cwd.includes("\0")) {
      throw new PathDeniedError("Null byte injection detected in working directory path", { cwd });
    }

    if (root) {
      const canonicalRoot = this.reader.getCanonicalRoot(root);
      const targetPath = isAbsolute(cwd) ? resolve(cwd) : resolve(canonicalRoot, cwd);

      if (!existsSync(targetPath)) {
        throw new PathDeniedError(`Working directory does not exist: ${cwd}`, { cwd, targetPath });
      }

      let canonicalTarget: string;
      try {
        canonicalTarget = realpathSync(targetPath);
      } catch {
        throw new PathDeniedError(
          `Failed to resolve canonical path for working directory: ${cwd}`,
          {
            cwd
          }
        );
      }

      if (!isPathInsideRoot(canonicalTarget, canonicalRoot)) {
        throw new PathDeniedError(`Working directory escapes canonical workspace root: ${cwd}`, {
          cwd,
          canonicalTarget,
          canonicalRoot
        });
      }

      const stat = statSync(canonicalTarget);
      if (!stat.isDirectory()) {
        throw new PathDeniedError(`Working directory path is not a directory: ${cwd}`, { cwd });
      }

      return canonicalTarget;
    }

    // If no projectRoot provided, validate cwd as an existing physical directory
    const resolvedPath = resolve(cwd);
    if (!existsSync(resolvedPath)) {
      throw new PathDeniedError(`Working directory does not exist: ${cwd}`, { cwd });
    }

    let canonicalTarget: string;
    try {
      canonicalTarget = realpathSync(resolvedPath);
    } catch {
      throw new PathDeniedError(`Failed to resolve canonical path for working directory: ${cwd}`, {
        cwd
      });
    }

    const stat = statSync(canonicalTarget);
    if (!stat.isDirectory()) {
      throw new PathDeniedError(`Working directory path is not a directory: ${cwd}`, { cwd });
    }

    return canonicalTarget;
  }

  /**
   * Executes a bounded development command with strict isolation, streamed output, and process-tree lifecycle.
   */
  public async execute(
    input: ExecuteCommandInput,
    options: CommandRunnerOptions = {}
  ): Promise<CommandResult> {
    const parsedInput = ExecuteCommandInputSchema.parse(input);

    const { spawnExecutable, spawnArgsPrefix } = this.resolveExecutable(parsedInput.executable);
    const finalCwd = this.resolveAndValidateCwd(parsedInput.cwd, options.projectRoot);

    const timeoutMs =
      parsedInput.timeout_ms ?? options.defaultTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const maxOutputBytes =
      parsedInput.max_output_bytes ?? options.defaultMaxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

    const scrubbedEnv = scrubEnvironment(process.env, options.env);
    const fullArgs = [...spawnArgsPrefix, ...parsedInput.args];

    const signal = options.signal;
    if (signal?.aborted) {
      return {
        exit_code: -1,
        stdout: "",
        stderr: "Command execution was cancelled before start",
        duration_ms: 0,
        truncated: false,
        timed_out: false,
        error: "Command execution was cancelled"
      };
    }

    const isPosix = process.platform !== "win32";
    const startTime = performance.now();

    let childPid: number | undefined;
    let timer: NodeJS.Timeout | null = null;
    let isFinished = false;
    let timedOut = false;
    let cancelled = false;
    let truncated = false;
    let totalOutputBytes = 0;
    let stdoutBuffer = "";
    let stderrBuffer = "";

    return new Promise<CommandResult>((resolvePromise) => {
      let child;
      try {
        child = spawn(spawnExecutable, fullArgs, {
          cwd: finalCwd,
          env: scrubbedEnv,
          windowsHide: true,
          detached: isPosix,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return resolvePromise({
          exit_code: -1,
          stdout: "",
          stderr: errorMsg,
          duration_ms: 0,
          truncated: false,
          timed_out: false,
          error: errorMsg
        });
      }

      childPid = child.pid;

      const finish = (result: CommandResult) => {
        if (isFinished) return;
        isFinished = true;

        if (timer) {
          clearTimeout(timer);
          timer = null;
        }

        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }

        resolvePromise(result);
      };

      // Timeout enforcement
      timer = setTimeout(async () => {
        if (isFinished) return;
        timedOut = true;
        if (childPid) {
          await killProcessTree(childPid);
        }
      }, timeoutMs);

      // AbortSignal cancellation listener
      const onAbort = async () => {
        if (isFinished) return;
        cancelled = true;
        if (childPid) {
          await killProcessTree(childPid);
        }
      };

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      const processChunk = (stream: "stdout" | "stderr", rawChunk: Buffer | string) => {
        if (truncated) return;

        const chunkStr = typeof rawChunk === "string" ? rawChunk : rawChunk.toString("utf8");
        const chunkByteLength = Buffer.byteLength(chunkStr, "utf8");

        if (totalOutputBytes + chunkByteLength > maxOutputBytes) {
          const allowedBytes = Math.max(0, maxOutputBytes - totalOutputBytes);
          const slicedChunk = chunkStr.slice(0, allowedBytes);

          if (stream === "stdout") {
            stdoutBuffer += slicedChunk + TRUNCATION_NOTICE;
          } else {
            stderrBuffer += slicedChunk + TRUNCATION_NOTICE;
          }

          truncated = true;
          totalOutputBytes = maxOutputBytes;

          if (options.onChunk) {
            options.onChunk({
              stream,
              chunk: slicedChunk + TRUNCATION_NOTICE,
              timestamp: new Date().toISOString()
            });
          }
          return;
        }

        totalOutputBytes += chunkByteLength;
        if (stream === "stdout") {
          stdoutBuffer += chunkStr;
        } else {
          stderrBuffer += chunkStr;
        }

        if (options.onChunk) {
          options.onChunk({
            stream,
            chunk: chunkStr,
            timestamp: new Date().toISOString()
          });
        }
      };

      child.stdout?.on("data", (chunk: Buffer | string) => processChunk("stdout", chunk));
      child.stderr?.on("data", (chunk: Buffer | string) => processChunk("stderr", chunk));

      child.on("error", (err: Error) => {
        const duration = performance.now() - startTime;
        finish({
          exit_code: -1,
          stdout: stdoutBuffer,
          stderr: (stderrBuffer ? stderrBuffer + "\n" : "") + err.message,
          duration_ms: Math.round(duration),
          truncated,
          timed_out: timedOut,
          error: err.message
        });
      });

      child.on("close", (code: number | null, signalStr: NodeJS.Signals | null) => {
        const duration = performance.now() - startTime;
        let finalExitCode = code !== null ? code : -1;
        let finalError: string | null = null;

        if (timedOut) {
          finalExitCode = -1;
          finalError = `CODEIT_BUDGET_EXCEEDED: Execution timed out after ${timeoutMs}ms`;
        } else if (cancelled) {
          finalExitCode = -1;
          finalError = "Command execution was cancelled";
        } else if (finalExitCode !== 0) {
          finalError = `Process exited with code ${finalExitCode}${signalStr ? ` (signal: ${signalStr})` : ""}`;
        }

        finish({
          exit_code: finalExitCode,
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          duration_ms: Math.round(duration),
          truncated,
          timed_out: timedOut,
          error: finalError
        });
      });
    });
  }

  public executeCommand(
    input: ExecuteCommandInput,
    options: CommandRunnerOptions = {}
  ): Promise<CommandResult> {
    return this.execute(input, options);
  }

  public static execute(
    input: ExecuteCommandInput,
    options: CommandRunnerOptions = {}
  ): Promise<CommandResult> {
    const runner = new CommandRunner(options.projectRoot);
    return runner.execute(input, options);
  }
}
