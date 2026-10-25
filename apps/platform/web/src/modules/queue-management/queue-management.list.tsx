import { formatDateTime } from "@codexsun/ui/workspace";
import { Fragment, useState } from "react";
import {
  BanIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  Clock3Icon,
  PlayIcon,
  RotateCcwIcon,
  TriangleAlertIcon
} from "lucide-react";
import { StatusBadge } from "@codexsun/ui";
import { Button } from "@codexsun/ui/components/button";
import type { QueueJobRecord, QueueRuntimeSettings } from "./queue-management.types";

export function QueueManagementList({
  busy,
  filtersActive,
  jobs,
  settings,
  onCancel,
  onResetFilters,
  onRetry,
  onRun
}: {
  busy: boolean;
  filtersActive: boolean;
  jobs: QueueJobRecord[];
  settings: QueueRuntimeSettings | undefined;
  onCancel: (id: number) => void;
  onResetFilters: () => void;
  onRetry: (id: number) => void;
  onRun: (id: number) => void;
}) {
  const pending = settings?.pending ?? jobs.filter((job) => job.status === "pending").length;
  const running = settings?.running ?? jobs.filter((job) => job.status === "running").length;
  const failed = settings?.failed ?? jobs.filter((job) => job.status === "failed").length;
  const completed = settings?.completed ?? jobs.filter((job) => job.status === "completed").length;
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Clock3Icon} label="Pending" value={String(pending)} />
        <MetricCard icon={PlayIcon} label="Running" value={String(running)} />
        <MetricCard
          icon={TriangleAlertIcon}
          label="Failed"
          value={String(failed)}
          {...(failed > 0 ? { tone: "red" as const } : {})}
        />
        <MetricCard
          icon={CheckCircle2Icon}
          label="Completed"
          value={String(completed)}
          tone="green"
        />
      </div>
      <div className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Jobs</h2>
          <p className="text-xs text-muted-foreground">
            Run pending work, retry failures, cancel queued jobs, or inspect masked payload details.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Job</th>
                <th className="px-4 py-3 text-left font-semibold">Queue</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Attempts</th>
                <th className="px-4 py-3 text-left font-semibold">Tenant</th>
                <th className="px-4 py-3 text-left font-semibold">Correlation</th>
                <th className="px-4 py-3 text-left font-semibold">Updated</th>
                <th className="px-4 py-3 text-right font-semibold">Controls</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <Fragment key={job.uuid}>
                  <tr className="border-t align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{job.jobName}</div>
                      <div className="text-muted-foreground">{job.sourceModule}</div>
                      {job.status === "pending" && job.result.held === true ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Waiting: {String(job.result.holdReason ?? "Frappe is unavailable")}
                          <br />
                          Next check: {formatDateTime(job.availableAt)}
                        </p>
                      ) : null}
                      {job.errorMessage ? (
                        <div className="mt-1 text-xs text-destructive">{job.errorMessage}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{job.queueName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={statusTone(job.status)}>
                        {job.status === "pending" && job.result.held === true
                          ? "waiting"
                          : job.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {job.tenantId ?? "platform"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{job.correlationId ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(job.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedJobId((current) => (current === job.id ? null : job.id))
                          }
                        >
                          {expandedJobId === job.id ? (
                            <ChevronUpIcon className="size-4" />
                          ) : (
                            <ChevronDownIcon className="size-4" />
                          )}
                          Details
                        </Button>
                        <Button
                          disabled={busy || job.status !== "pending"}
                          size="sm"
                          onClick={() => onRun(job.id)}
                        >
                          <PlayIcon className="size-4" />
                          Run
                        </Button>
                        <Button
                          disabled={busy || (job.status !== "failed" && job.status !== "cancelled")}
                          size="sm"
                          variant="outline"
                          onClick={() => onRetry(job.id)}
                        >
                          <RotateCcwIcon className="size-4" />
                          Retry
                        </Button>
                        <Button
                          disabled={busy || (job.status !== "pending" && job.status !== "failed")}
                          size="sm"
                          variant="outline"
                          onClick={() => onCancel(job.id)}
                        >
                          <BanIcon className="size-4" />
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedJobId === job.id ? (
                    <tr className="border-t bg-muted/20 align-top">
                      <td className="px-4 py-3 text-xs text-muted-foreground" colSpan={8}>
                        <div className="grid gap-3 md:grid-cols-2">
                          <pre className="max-h-40 overflow-auto rounded-md border bg-background p-3">
                            <span className="mb-2 block font-medium text-foreground">Payload</span>
                            {JSON.stringify(maskDetails(job.payload), null, 2)}
                          </pre>
                          <pre className="max-h-40 overflow-auto rounded-md border bg-background p-3">
                            <span className="mb-2 block font-medium text-foreground">Result</span>
                            {JSON.stringify(maskDetails(job.result), null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 ? (
          <div className="space-y-3 px-4 py-10 text-center text-sm text-muted-foreground">
            <p>
              {filtersActive
                ? "No jobs match the current filters."
                : "No queue jobs yet. New background work will appear here."}
            </p>
            {filtersActive ? (
              <Button size="sm" variant="outline" onClick={onResetFilters}>
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function maskDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskDetails);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /password|secret|token|key/i.test(key) ? "***" : maskDetails(entry)
    ])
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: typeof Clock3Icon;
  label: string;
  tone?: "green" | "red" | undefined;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-card p-5 shadow-sm">
      <Icon className="size-5 text-muted-foreground" />
      <div className="mt-5 text-xl font-semibold">
        {tone ? <StatusBadge tone={tone}>{value}</StatusBadge> : value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function statusTone(status: QueueJobRecord["status"]) {
  if (status === "completed") return "green";
  if (status === "failed" || status === "cancelled") return "red";
  if (status === "pending") return "amber";
  return "blue";
}
