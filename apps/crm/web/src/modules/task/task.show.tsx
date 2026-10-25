import { useCrmFrappeSyncEnabled } from "../frappe-sync/frappe-sync.hooks";
import { ClosurePendingBadge } from "../closure";
import { WorkChargesWorkspace, WorkReportWorkspace } from "../work-report/index";
import { TaskComments } from "./task.comments";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BellRing,
  CalendarClock,
  LogIn,
  MessageSquare,
  ReceiptText,
  Settings2,
  Timer
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceAnimatedTabs } from "@codexsun/ui/workspace/animated-tabs";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDate as formatWorkspaceDate, formatDateTime } from "@codexsun/ui/workspace/utils";
import { CrmColorLabel, CrmStatusBadge, statusRing } from "../../crm-colors";
import { useWorkReports } from "../work-report/work-report.hooks";
import { TaskPropertiesPanel } from "./task.properties";
import { TaskClosurePanel, TaskJobsPanel } from "./task.tab-panels";
import { ScheduleRecordList, useRecordSchedules } from "../scheduler";
import { useTaskOptions, taskQueryKey } from "./task.hooks";
import {
  addTaskComment,
  getTask,
  getTaskClosures,
  getTaskComments,
  getTaskJobs,
  requestTaskClosure,
  reviewTaskClosure,
  startTaskJob,
  stopTaskJob,
  updateTaskProperties
} from "./task.services";
import type { TaskRecord } from "./task.types";

type Tab =
  | "actions"
  | "comments"
  | "checkpoints"
  | "jobs"
  | "charges"
  | "properties"
  | "schedules"
  | "closure";

export function TaskShow({
  id,
  onEdit,
  onEditActionChange
}: {
  id: string;
  onEdit: (row: TaskRecord) => void;
  onEditActionChange?: (action: { run: () => void } | null) => void;
}) {
  const frappeSyncEnabled = useCrmFrappeSyncEnabled();
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>("actions");
  const [reason, setReason] = useState("");
  const task = useQuery({
    queryKey: [...taskQueryKey, "detail", id],
    queryFn: () => getTask(Number(id)),
    refetchInterval: 10000,
    enabled: Boolean(id)
  });
  const options = useTaskOptions();
  const key = Number(id);
  const workTarget = { enquiryId: null, taskId: key };
  const actions = useWorkReports(workTarget);
  const checkpoints = useWorkReports(workTarget, 1, "checkpoints");
  const charges = useWorkReports(workTarget, 1, "charges");
  const schedules = useRecordSchedules("task", key);
  const comments = useQuery({
    queryKey: ["crm", "tasks", key, "comments"],
    queryFn: () => getTaskComments(key),
    refetchInterval: 10000,
    enabled: Boolean(task.data)
  });
  const jobs = useQuery({
    queryKey: ["crm", "tasks", key, "jobs"],
    queryFn: () => getTaskJobs(key),
    refetchInterval: 10000,
    enabled: Boolean(task.data)
  });
  const closures = useQuery({
    queryKey: ["crm", "tasks", key, "closures"],
    queryFn: () => getTaskClosures(key),
    refetchInterval: 10000,
    enabled: Boolean(task.data)
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["crm", "work-reports", null, key] }),
      client.invalidateQueries({ queryKey: taskQueryKey }),
      client.invalidateQueries({ queryKey: [...taskQueryKey, "detail", id] }),
      client.invalidateQueries({ queryKey: ["crm", "tasks", key, "comments"] }),
      client.invalidateQueries({ queryKey: ["crm", "tasks", key, "jobs"] }),
      client.invalidateQueries({ queryKey: ["crm", "tasks", key, "closures"] }),
      client.invalidateQueries({ queryKey: ["crm", "tasks", key, "activity"] })
    ]);
  };
  const jobMutation = useMutation({
    mutationFn: async (running: boolean) => {
      if (running) {
        await stopTaskJob(key);
        return null;
      }
      return startTaskJob(key);
    },
    onSuccess: refresh,
    onError: (error) => toast.error("Unable to update job", { description: error.message })
  });
  const closureMutation = useMutation({
    mutationFn: () => requestTaskClosure(key, reason),
    onSuccess: async () => {
      setReason("");
      await refresh();
      toast.success("Closure request sent");
    },
    onError: (error) => toast.error("Unable to request closure", { description: error.message })
  });
  const reviewMutation = useMutation({
    mutationFn: ({
      requestId,
      decision
    }: {
      requestId: number;
      decision: "approved" | "rejected";
    }) => reviewTaskClosure(requestId, decision),
    onSuccess: async () => {
      await refresh();
      toast.success("Closure request reviewed");
    },
    onError: (error) =>
      toast.error("Unable to review closure request", { description: error.message })
  });
  const propertyMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateTaskProperties>[1]) =>
      updateTaskProperties(key, patch),
    onSuccess: refresh,
    onError: (error) => toast.error("Unable to update task", { description: error.message })
  });
  const activeJob = useMemo(() => jobs.data?.find((item) => !item.stoppedAt), [jobs.data]);
  const row = task.data;
  const canEdit = Boolean(options.data?.capabilities.update);
  useEffect(() => {
    if (canEdit && row) onEditActionChange?.({ run: () => onEdit(row) });
    else onEditActionChange?.(null);
    return () => onEditActionChange?.(null);
  }, [canEdit, onEdit, onEditActionChange, row]);

  if (!row && !task.error)
    return (
      <WorkspacePage title="Task">
        <p className="text-sm text-muted-foreground">Loading task…</p>
      </WorkspacePage>
    );
  if (!row)
    return (
      <WorkspacePage title="Task">
        <p role="alert" className="text-sm text-destructive">
          {task.error?.message ?? "Task not found."}
        </p>
      </WorkspacePage>
    );
  const canRespond = Boolean(options.data?.capabilities.respond);
  const tabs = [
    {
      value: "actions",
      label: (
        <Label
          icon={<Activity className="size-4" />}
          text="Actions"
          count={actions.data?.total ?? 0}
        />
      ),
      content: (
        <WorkReportWorkspace
          taskId={key}
          active={tab === "actions"}
          onComment={
            canRespond
              ? async (body) => {
                  await addTaskComment(
                    key,
                    new DOMParser()
                      .parseFromString(body.replace(/<\/(p|li|div)>/giu, "</$1>\n"), "text/html")
                      .body.textContent?.trim() ?? ""
                  );
                  await refresh();
                }
              : undefined
          }
          onJob={
            options.data?.capabilities.work
              ? () => jobMutation.mutate(Boolean(activeJob))
              : undefined
          }
          onRequestClosure={canRespond ? () => setTab("closure") : undefined}
          jobRunning={Boolean(activeJob)}
          jobPending={jobMutation.isPending || jobs.isLoading}
        />
      )
    },
    {
      value: "comments",
      label: (
        <Label
          icon={<MessageSquare className="size-4" />}
          text="Comments"
          count={comments.data?.filter((item) => item.parentId === null).length ?? 0}
        />
      ),
      content: (
        <TaskComments
          comments={comments.data ?? []}
          loading={comments.isLoading}
          error={comments.error?.message}
          canRespond={canRespond}
          onAdd={async (body, parentId) => {
            const text =
              new DOMParser()
                .parseFromString(body.replace(/<\/(p|li|div)>/giu, "</$1>\n"), "text/html")
                .body.textContent?.trim() ?? "";
            await addTaskComment(key, text, parentId);
            await refresh();
          }}
        />
      )
    },
    {
      value: "checkpoints",
      label: (
        <Label
          icon={<LogIn className="size-4" />}
          text="Check in / out"
          count={checkpoints.data?.total ?? 0}
        />
      ),
      content: <WorkReportWorkspace taskId={key} actionFilter="checkpoints" />
    },
    {
      value: "jobs",
      label: (
        <Label icon={<Timer className="size-4" />} text="Jobs" count={jobs.data?.length ?? 0} />
      ),
      content: (
        <TaskJobsPanel
          jobs={jobs.data ?? []}
          loading={jobs.isLoading}
          canWork={Boolean(options.data?.capabilities.work)}
          pending={jobMutation.isPending || Boolean(activeJob && !activeJob.canStop)}
          running={Boolean(activeJob)}
          onToggle={() => jobMutation.mutate(Boolean(activeJob))}
        />
      )
    },
    {
      value: "charges",
      label: (
        <Label
          icon={<ReceiptText className="size-4" />}
          text="Charges"
          count={charges.data?.total ?? 0}
          pending={Boolean(
            charges.data && charges.data.amounts.charges > charges.data.amounts.collections
          )}
        />
      ),
      content: <WorkChargesWorkspace target={{ enquiryId: null, taskId: key }} />
    },
    {
      value: "schedules",
      label: (
        <Label
          icon={<CalendarClock className="size-4" />}
          text="Schedules"
          count={schedules.data?.length ?? 0}
        />
      ),
      content: (
        <ScheduleRecordList
          sourceType="task"
          sourceId={key}
          sourceLabel={`Task #${row.id} · ${row.title}`}
        />
      )
    },
    {
      value: "properties",
      label: <Label icon={<Settings2 className="size-4" />} text="Properties" />,
      content: (
        <div>
          <TaskPropertiesPanel
            record={row}
            options={options.data}
            canEdit={Boolean(options.data?.capabilities.respond)}
            loading={propertyMutation.isPending}
            onChange={async (patch) => {
              await propertyMutation.mutateAsync(patch);
            }}
          />
        </div>
      )
    },
    {
      value: "closure",
      label: (
        <Label
          icon={<BellRing className="size-4" />}
          text="Closure approvals"
          count={closures.data?.length ?? 0}
        />
      ),
      content: (
        <TaskClosurePanel
          requests={closures.data ?? []}
          loading={closures.isLoading}
          canRespond={canRespond}
          canReview={Boolean(options.data?.capabilities.reviewClosure)}
          reason={reason}
          pending={closureMutation.isPending || reviewMutation.isPending}
          requestBlocked={row.closurePending}
          onReasonChange={setReason}
          onRequest={() => closureMutation.mutate()}
          onReview={(requestId, decision) => reviewMutation.mutate({ requestId, decision })}
        />
      )
    }
  ];
  return (
    <WorkspacePage title="" technicalName="page.crm.tasks.show">
      {frappeSyncEnabled ? (
        <p className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Frappe sync: Not configured
        </p>
      ) : null}
      <section
        className={`rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm ring-2 sm:rounded-md sm:px-4 sm:py-4 ${statusRing(row.status)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 break-words text-lg font-semibold">
            #{row.id} - {row.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceStatusBadge
              label={`List in · ${row.listIn || "Unlisted"}`}
              tone="info"
              showIcon={false}
            />
            <CrmStatusBadge code={row.status} label={row.statusName} />
            <span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700">
              <CrmColorLabel kind="priority" code={row.priority} label={row.priorityName} />
            </span>
            {row.closurePending ? <ClosurePendingBadge /> : null}
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:hidden">
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Task details</p>
            <p className="whitespace-pre-wrap break-words text-sm font-semibold [overflow-wrap:anywhere]">
              {row.description || row.title || "—"}
            </p>
            {row.description && row.title && row.description !== row.title ? (
              <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {row.title}
              </p>
            ) : null}
          </div>
          <dl className="grid min-w-0 grid-cols-2 gap-2">
            <MobileSummaryField
              label="Contact"
              value={
                row.contactId ? (
                  <a
                    className="font-medium text-primary hover:underline"
                    href={`/app/crm/contacts/${row.contactId}/show`}
                  >
                    {row.contactName || "Open contact"}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <MobileSummaryField label="Mobile" value={row.contactPhone || "—"} />
            <MobileSummaryField label="Assigned to" value={row.assignedTo || "Unassigned"} />
            <MobileSummaryField
              label="Due date"
              value={row.dueDate ? formatWorkspaceDate(row.dueDate) : "—"}
            />
            <MobileSummaryField label="Created by" value={row.creatorName || row.createdBy} />
            <MobileSummaryField label="Created" value={<CreatedAge value={row.createdAt} />} />
          </dl>
        </div>
        <div className="mt-4 hidden overflow-hidden rounded-md border border-border/60 sm:block">
          <table aria-label="Task details" className="w-full table-fixed text-sm">
            <colgroup className="hidden sm:table-column-group">
              <col className="w-[12%]" />
              <col className="w-[38%]" />
              <col className="w-[12%]" />
              <col className="w-[38%]" />
            </colgroup>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td colSpan={4} className="bg-muted/30 px-3 py-3 align-top">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Task details</p>
                  <p className="whitespace-pre-wrap break-words text-base font-semibold [overflow-wrap:anywhere]">
                    {row.description || row.title || "—"}
                  </p>
                  {row.description && row.title && row.description !== row.title ? (
                    <p className="mt-1 break-words text-sm text-muted-foreground">{row.title}</p>
                  ) : null}
                </td>
              </tr>
              <SummaryDetail
                leftLabel="Contact"
                leftValue={
                  row.contactId ? (
                    <a
                      className="font-medium text-primary hover:underline"
                      href={`/app/crm/contacts/${row.contactId}/show`}
                    >
                      {row.contactName || "Open contact"}
                    </a>
                  ) : (
                    "—"
                  )
                }
                rightLabel="Mobile"
                rightValue={row.contactPhone || "—"}
              />
              <SummaryDetail
                leftLabel="Assigned to"
                leftValue={row.assignedTo || "Unassigned"}
                rightLabel="Due date"
                rightValue={row.dueDate ? formatWorkspaceDate(row.dueDate) : "—"}
              />
              <SummaryDetail
                leftLabel="Created by"
                leftValue={row.creatorName || row.createdBy}
                rightLabel="Created"
                rightValue={<CreatedAge value={row.createdAt} />}
              />
            </tbody>
          </table>
        </div>
      </section>
      <WorkspaceAnimatedTabs
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        keepMounted
        tabs={tabs}
        listClassName="justify-between border-b-0 bg-card px-1 shadow-none 2xl:px-2"
        triggerClassName="px-1 py-2 2xl:px-2"
        contentClassName="mt-0 rounded-t-none bg-card pb-0 [&>*]:border-t-0 [&>*]:rounded-t-none"
      />
    </WorkspacePage>
  );
}

function MobileSummaryField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function Label({
  icon,
  text,
  count,
  pending = false
}: {
  icon: ReactNode;
  text: string;
  count?: number;
  pending?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 2xl:gap-1.5"
      title={`${text}${count === undefined ? "" : ` · ${count}`}${pending ? " · Collection pending" : ""}`}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="sr-only 2xl:not-sr-only">{text}</span>
      {count !== undefined ? (
        <>
          <span
            aria-hidden="true"
            className="hidden rounded-full bg-muted px-1 text-xs 2xl:inline-flex"
          >
            {count}
          </span>
          <span className="sr-only">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </>
      ) : null}
      {pending ? (
        <span className="rounded-full border border-violet-300 bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-800 dark:border-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
          <span className="2xl:hidden" aria-hidden="true">
            !
          </span>
          <span className="sr-only 2xl:not-sr-only">Pending</span>
        </span>
      ) : null}
    </span>
  );
}
function SummaryDetail({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue
}: {
  leftLabel: string;
  leftValue: ReactNode;
  rightLabel: string;
  rightValue: ReactNode;
}) {
  return (
    <tr className="grid min-w-0 grid-cols-[minmax(6rem,0.85fr)_minmax(0,1.55fr)] sm:table-row">
      <th
        scope="row"
        className="min-w-0 break-words border-r border-border/60 bg-muted/40 px-3 py-2 text-left align-top font-medium text-muted-foreground [overflow-wrap:anywhere]"
      >
        {leftLabel}
      </th>
      <td className="min-w-0 break-words bg-muted/30 px-3 py-2 align-top text-muted-foreground [overflow-wrap:anywhere]">
        {leftValue}
      </td>
      <th
        scope="row"
        className="min-w-0 break-words border-t border-r border-border/60 bg-muted/40 px-3 py-2 text-left align-top font-medium text-muted-foreground [overflow-wrap:anywhere] sm:border-t-0 sm:border-l"
      >
        {rightLabel}
      </th>
      <td className="min-w-0 break-words border-t border-border/60 bg-muted/30 px-3 py-2 align-top text-muted-foreground [overflow-wrap:anywhere] sm:border-t-0">
        {rightValue}
      </td>
    </tr>
  );
}
function CreatedAge({ value }: { value: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return <>—</>;
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const text =
    minutes < 1
      ? "Just now"
      : days
        ? `${days} d ${hours} h ago`
        : hours
          ? `${hours} h ${minutes % 60} m ago`
          : `${minutes} m ago`;
  return (
    <time dateTime={value} title={formatDateTime(value)}>
      {text}
    </time>
  );
}
