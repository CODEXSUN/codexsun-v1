import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceShowCard } from "@codexsun/ui/workspace/show";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import type { PromptRun } from "./prompt-manager.types";

export function PromptManagerRuns({
  runs,
  busy,
  onDecide
}: {
  runs: PromptRun[];
  busy: boolean;
  onDecide: (run: PromptRun, decision: "accept" | "decline") => void;
}) {
  const [selected, setSelected] = useState("");
  const run = runs.find((run) => run.id === selected) ?? runs[0];
  return (
    <WorkspaceShowCard title="Run history & response">
      {!run ? (
        <p className="p-4 text-sm text-muted-foreground">
          No runs yet. Choose a chat and send this prompt to see its result here.
        </p>
      ) : (
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            {runs.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => setSelected(entry.id)}
                aria-pressed={entry.id === run.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${entry.id === run.id ? "border-primary/40 bg-primary/5" : "border-border/60"}`}
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{entry.threadName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.startedAt).toLocaleString()}
                  </span>
                </span>
                <RunStatus status={entry.status} />
              </button>
            ))}
          </div>
          {run.approval && (
            <div className="grid gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <h3 className="text-sm font-semibold">Codex needs your approval</h3>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                {run.approval.description}
              </pre>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => onDecide(run, "accept")}>
                  Approve this action
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => onDecide(run, "decline")}>
                  Decline
                </Button>
              </div>
            </div>
          )}
          {run.error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {run.error}
            </p>
          )}
          <div
            aria-live="polite"
            className="min-h-20 whitespace-pre-wrap break-words text-sm leading-6"
          >
            {run.response ||
              (run.status === "running"
                ? "Codex is working. The response will appear here when available."
                : run.status === "awaiting-approval"
                  ? "Waiting for your approval."
                  : "No text response was returned.")}
          </div>
          <details className="border-t border-border pt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Sent prompt</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6">
              {run.content}
            </pre>
            <p className="mt-3 break-all text-xs text-muted-foreground">
              Chat {run.threadId}
              {run.turnId ? ` · Turn ${run.turnId}` : ""}
            </p>
          </details>
        </div>
      )}
    </WorkspaceShowCard>
  );
}

function RunStatus({ status }: { status: PromptRun["status"] }) {
  const labels = {
    running: "Working",
    "awaiting-approval": "Approval needed",
    completed: "Completed",
    failed: "Failed",
    interrupted: "Interrupted"
  };
  return (
    <WorkspaceStatusBadge
      label={labels[status]}
      tone={
        status === "completed"
          ? "success"
          : status === "failed"
            ? "danger"
            : status === "interrupted"
              ? "neutral"
              : "warning"
      }
    />
  );
}
