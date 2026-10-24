/**
 * Command Output Component
 * Accessible terminal / execution log viewer for bounded command runs.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  ArrowDownIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  Loader2Icon,
  SquareIcon,
  TerminalIcon,
  XCircleIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";

export interface CommandOutputProps {
  commandLine?: string | undefined;
  executable?: string | undefined;
  args?: string[] | undefined;
  cwd?: string | undefined;
  result?:
    | {
        exit_code?: number | null | undefined;
        stdout?: string | undefined;
        stderr?: string | undefined;
        duration_ms?: number | undefined;
        truncated?: boolean | undefined;
        timed_out?: boolean | undefined;
        error?: string | null | undefined;
      }
    | undefined;
  exitCode?: number | null | undefined;
  stdout?: string | undefined;
  stderr?: string | undefined;
  durationMs?: number | undefined;
  truncated?: boolean | undefined;
  timedOut?: boolean | undefined;
  error?: string | null | undefined;
  isRunning?: boolean | undefined;
  onCancel?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * Strips ANSI color codes and cursor escape sequences for clean accessible plain text rendering.
 */
function stripAnsi(text: string): string {
  const esc = String.fromCharCode(0x1b);
  const csi = String.fromCharCode(0x9b);
  const ansiPattern = new RegExp(
    `[${esc}${csi}][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`,
    "g"
  );
  return text.replace(ansiPattern, "");
}

export function CommandOutput({
  commandLine,
  executable = "node",
  args = [],
  cwd,
  result,
  exitCode,
  stdout,
  stderr,
  durationMs,
  truncated,
  timedOut,
  error,
  isRunning = false,
  onCancel,
  className = ""
}: CommandOutputProps) {
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Harmonize direct props vs embedded result object
  const effectiveExitCode = result?.exit_code !== undefined ? result.exit_code : exitCode;
  const effectiveStdout = stripAnsi(result?.stdout !== undefined ? result.stdout : (stdout ?? ""));
  const effectiveStderr = stripAnsi(result?.stderr !== undefined ? result.stderr : (stderr ?? ""));
  const effectiveDurationMs = result?.duration_ms !== undefined ? result.duration_ms : durationMs;
  const effectiveTruncated = result?.truncated !== undefined ? result.truncated : truncated;
  const effectiveTimedOut = result?.timed_out !== undefined ? result.timed_out : timedOut;
  const effectiveError = result?.error !== undefined ? result.error : error;

  const displayCommand =
    commandLine ?? (args.length > 0 ? `${executable} ${args.join(" ")}` : executable);

  // Auto-scroll on new output when enabled
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [effectiveStdout, effectiveStderr, autoScroll]);

  const handleCopy = () => {
    const combined = [
      `$ ${displayCommand}`,
      effectiveStdout ? `\n--- STDOUT ---\n${effectiveStdout}` : "",
      effectiveStderr ? `\n--- STDERR ---\n${effectiveStderr}` : "",
      effectiveError ? `\n--- ERROR ---\n${effectiveError}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(combined.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderStatusBadge = () => {
    if (isRunning) {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
        >
          <Loader2Icon className="size-3 animate-spin" />
          Running
        </Badge>
      );
    }

    if (effectiveTimedOut) {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <ClockIcon className="size-3" />
          Timed Out
        </Badge>
      );
    }

    if (effectiveExitCode !== null && effectiveExitCode !== undefined) {
      if (effectiveExitCode === 0) {
        return (
          <Badge
            variant="outline"
            className="gap-1 border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
          >
            <CheckCircle2Icon className="size-3" />
            exit: 0
          </Badge>
        );
      }
      return (
        <Badge
          variant="outline"
          className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
        >
          <XCircleIcon className="size-3" />
          exit: {effectiveExitCode}
        </Badge>
      );
    }

    return null;
  };

  const hasOutput = Boolean(effectiveStdout || effectiveStderr || effectiveError);

  return (
    <div
      className={`rounded-lg border border-border bg-card shadow-xs transition-colors ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 p-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
            <TerminalIcon className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
              <span className="select-none text-muted-foreground">$</span>
              <span className="truncate" title={displayCommand}>
                {displayCommand}
              </span>
            </div>
            {cwd ? (
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={cwd}>
                cwd: {cwd}
              </p>
            ) : null}
          </div>
        </div>

        {/* Status badges & action controls */}
        <div className="flex items-center gap-2">
          {effectiveDurationMs !== undefined ? (
            <span
              className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"
              title="Execution duration"
            >
              <ClockIcon className="size-3" />
              {effectiveDurationMs >= 1000
                ? `${(effectiveDurationMs / 1000).toFixed(2)}s`
                : `${effectiveDurationMs}ms`}
            </span>
          ) : null}

          {effectiveTruncated ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
            >
              Truncated
            </Badge>
          ) : null}

          {renderStatusBadge()}

          {isRunning && onCancel ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={onCancel}
              title="Cancel command"
              aria-label="Cancel command"
            >
              <SquareIcon className="size-2.5 fill-current" />
              Cancel
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copy command output"
            aria-label="Copy command output"
          >
            {copied ? (
              <CheckIcon className="size-3.5 text-green-500" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`size-7 p-0 ${autoScroll ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
            aria-label={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
          >
            <ArrowDownIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Terminal log output */}
      <div
        ref={terminalRef}
        role="log"
        aria-live="polite"
        aria-label="Command execution output"
        tabIndex={0}
        className="relative max-h-80 min-h-20 overflow-y-auto rounded-b-lg border-t border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100 shadow-inner focus:outline-hidden focus:ring-1 focus:ring-zinc-700 dark:bg-black"
      >
        {!hasOutput && isRunning ? (
          <div className="flex items-center gap-2 text-zinc-500 italic">
            <Loader2Icon className="size-3 animate-spin" />
            <span>Executing command...</span>
          </div>
        ) : null}

        {!hasOutput && !isRunning ? (
          <div className="text-zinc-500 italic">No output produced.</div>
        ) : null}

        {effectiveStdout ? (
          <pre className="whitespace-pre-wrap break-all text-zinc-100">{effectiveStdout}</pre>
        ) : null}

        {effectiveStderr ? (
          <pre className="mt-1 whitespace-pre-wrap break-all text-red-400">{effectiveStderr}</pre>
        ) : null}

        {effectiveError ? (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
            <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
            <span className="font-sans font-medium">{effectiveError}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
