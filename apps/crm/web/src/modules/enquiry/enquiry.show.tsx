import { useCrmFrappeSyncEnabled } from "../frappe-sync/frappe-sync.hooks";
import { EnquiryWhatsAppWorkspace } from "../enquiry-whatsapp";
import { useWhatsAppMessages } from "../enquiry-whatsapp/enquiry-whatsapp.hooks";
import { WorkChargesWorkspace, WorkReportWorkspace } from "../work-report/index";
import { useWorkReports } from "../work-report/work-report.hooks";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BellRing,
  CalendarClock,
  CloudUpload,
  LogIn,
  MessageSquare,
  ReceiptText,
  Settings2,
  Timer,
  UserRound
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { WorkspaceAnimatedTabs } from "@codexsun/ui/workspace/animated-tabs";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDate, formatDateTime as formatWorkspaceDateTime } from "@codexsun/ui/workspace";
import { CrmColorLabel, CrmStatusBadge, statusRing } from "../../crm-colors";
import { ClosurePendingBadge, useEnquiryClosureState, EnquiryClosureCard } from "../closure";
import { EnquiryComments } from "./enquiry.comments";
import { EnquiryEstimates } from "./enquiry.estimates";
import {
  enquiryActivityQueryKey,
  enquiryCommentsQueryKey,
  enquiryDetailQueryKey,
  enquiriesQueryKey,
  enquiryJobsQueryKey,
  useEnquiryComments,
  useEnquiryDetail,
  useEnquiryEstimates,
  useEnquiryJobs,
  useEnquiryFrappeSync
} from "./enquiry.hooks";
import { EnquiryJobs } from "./enquiry.jobs";
import { EnquiryProperties } from "./enquiry.properties";
import { EnquiryCustomer } from "./enquiry.customer";
import { ScheduleRecordList, useRecordSchedules } from "../scheduler";
import { createEnquiryComment, startEnquiryJob, stopEnquiryJob } from "./enquiry.services";
import { enquiryTableText } from "./enquiry.table-text";
import { EnquiryFrappeSyncWorkspace } from "./enquiry.frappe-sync";
import { EnquiryFrappeSource } from "./enquiry.frappe-source";
import type { EnquiryLookup, EnquiryMasterLookup, EnquiryRecord } from "./enquiry.types";

type EnquiryTab =
  | "comments"
  | "jobs"
  | "estimate"
  | "actions"
  | "checkpoints"
  | "charges"
  | "properties"
  | "closure"
  | "customer"
  | "whatsapp"
  | "schedules"
  | "frappe-sync";

export function EnquiryShow({
  id,
  contacts,
  suppliers,
  users,
  listOptions,
  statuses,
  priorities
}: {
  id: string;
  contacts: EnquiryLookup[];
  suppliers: EnquiryLookup[];
  users: EnquiryLookup[];
  listOptions: EnquiryMasterLookup[];
  statuses: EnquiryMasterLookup[];
  priorities: EnquiryMasterLookup[];
}) {
  const client = useQueryClient();
  const [activeTab, setActiveTab] = useState<EnquiryTab>("actions");
  const enquiry = useEnquiryDetail(id);
  const closure = useEnquiryClosureState(id);
  const comments = useEnquiryComments(id);
  const jobs = useEnquiryJobs(id);
  const estimates = useEnquiryEstimates(id);
  const workTarget = { enquiryId: Number(id), taskId: null };
  const actions = useWorkReports(workTarget);
  const checkpoints = useWorkReports(workTarget, 1, "checkpoints");
  const charges = useWorkReports(workTarget, 1, "charges");
  const whatsApp = useWhatsAppMessages(Number(id));
  const schedules = useRecordSchedules("enquiry", Number(id));
  const record = enquiry.data;
  const frappeSyncEnabled = useCrmFrappeSyncEnabled();
  const frappeSync = useEnquiryFrappeSync(
    id,
    frappeSyncEnabled && record?.canViewFrappeSync === true
  );
  const contact = contacts.find((item) => item.id === record?.contactId);
  const mobile = contact?.primaryPhone || record?.capturedPhone || null;
  const error = enquiry.error ?? comments.error ?? jobs.error ?? estimates.error;
  const jobAction = useMutation({
    mutationFn: (jobId: string | null) => (jobId ? stopEnquiryJob(id, jobId) : startEnquiryJob(id)),
    onSuccess: async (job) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "work-reports", Number(id), null] }),
        client.invalidateQueries({ queryKey: enquiryJobsQueryKey(id) }),
        client.invalidateQueries({ queryKey: enquiryActivityQueryKey(id) })
      ]);
      toast.success(job.status === "running" ? "Job started" : "Job stopped");
    },
    onError: (failure) => toast.error("Unable to update job", { description: failure.message })
  });
  const tabs = [
    {
      value: "actions",
      label: (
        <TabLabel
          icon={<Activity className="size-4" />}
          label="Actions"
          count={actions.data?.total ?? 0}
        />
      ),
      content: (
        <WorkReportWorkspace
          enquiryId={Number(id)}
          active={activeTab === "actions"}
          onWhatsApp={() => setActiveTab("whatsapp")}
          onRequestClosure={() => setActiveTab("closure")}
          onComment={async (body, parentId, requestId) => {
            await createEnquiryComment(
              id,
              body,
              parentId === null ? null : String(parentId),
              "html",
              requestId
            );
            await Promise.all([
              client.invalidateQueries({ queryKey: enquiryCommentsQueryKey(id) }),
              client.invalidateQueries({ queryKey: enquiryActivityQueryKey(id) })
            ]);
          }}
          onJob={() =>
            jobAction.mutate(jobs.data?.find((job) => job.status === "running")?.id ?? null)
          }
          jobRunning={jobs.data?.some((job) => job.status === "running") ?? false}
          jobPending={jobAction.isPending || jobs.isLoading}
        />
      )
    },
    {
      value: "comments",
      label: (
        <TabLabel
          icon={<MessageSquare className="size-4" />}
          label="Comments"
          count={comments.data?.filter((item) => !item.parentId).length ?? 0}
        />
      ),
      content: (
        <EnquiryComments
          enquiryId={id}
          comments={comments.data ?? []}
          loading={comments.isLoading}
        />
      )
    },
    {
      value: "checkpoints",
      label: (
        <TabLabel
          icon={<LogIn className="size-4" />}
          label="Check in / out"
          count={checkpoints.data?.total ?? 0}
        />
      ),
      content: <WorkReportWorkspace enquiryId={Number(id)} actionFilter="checkpoints" />
    },
    {
      value: "jobs",
      label: (
        <TabLabel icon={<Timer className="size-4" />} label="Jobs" count={jobs.data?.length ?? 0} />
      ),
      content: (
        <EnquiryJobs
          enquiryId={id}
          jobs={jobs.data ?? []}
          users={users}
          loading={jobs.isLoading}
          jobLoading={jobAction.isPending}
          onStart={() => jobAction.mutate(null)}
          onStop={(jobId) => jobAction.mutate(jobId)}
        />
      )
    },
    {
      value: "charges",
      label: (
        <TabLabel
          icon={<ReceiptText className="size-4" />}
          label="Charges"
          count={charges.data?.total ?? 0}
          pending={Boolean(
            charges.data && charges.data.amounts.charges > charges.data.amounts.collections
          )}
        />
      ),
      content: <WorkChargesWorkspace target={{ enquiryId: Number(id), taskId: null }} />
    },
    {
      value: "properties",
      label: <TabLabel icon={<Settings2 className="size-4" />} label="Properties" />,
      content: record ? (
        <div className="p-4">
          <EnquiryProperties
            record={record}
            mobile={mobile}
            users={users}
            listOptions={listOptions}
            statuses={statuses}
            priorities={priorities}
          />
        </div>
      ) : null
    },
    {
      value: "estimate",
      label: (
        <TabLabel
          icon={<ReceiptText className="size-4" />}
          label="Estimate"
          count={estimates.data?.length ?? 0}
        />
      ),
      content: (
        <EnquiryEstimates
          enquiryId={id}
          estimates={estimates.data ?? []}
          contacts={suppliers.length ? suppliers : contacts}
          loading={estimates.isLoading}
        />
      )
    },
    {
      value: "customer",
      label: <TabLabel icon={<UserRound className="size-4" />} label="Customer" />,
      content: record ? <EnquiryCustomer record={record} mobile={mobile} /> : null
    },
    {
      value: "whatsapp",
      label: (
        <TabLabel icon={<WhatsAppIcon />} label="WhatsApp" count={whatsApp.data?.length ?? 0} />
      ),
      content: <EnquiryWhatsAppWorkspace id={Number(id)} mobile={mobile} />
    },
    {
      value: "schedules",
      label: (
        <TabLabel
          icon={<CalendarClock className="size-4" />}
          label="Schedules"
          count={schedules.data?.length ?? 0}
        />
      ),
      content: record ? (
        <ScheduleRecordList
          sourceType="enquiry"
          sourceId={Number(record.id)}
          sourceLabel={`Enquiry #${record.enquiryNo} · ${record.title}`}
        />
      ) : null
    },
    ...(frappeSyncEnabled && record?.canViewFrappeSync
      ? [
          {
            value: "frappe-sync" as const,
            label: (
              <TabLabel
                icon={<CloudUpload className="size-4" />}
                label="Frappe sync"
                count={frappeSync.data?.length ?? 0}
              />
            ),
            content: (
              <div className="space-y-4 p-3">
                <EnquiryFrappeSource key={record.id} enquiryId={Number(record.id)} />
                <EnquiryFrappeSyncWorkspace
                  events={frappeSync.data ?? []}
                  loading={frappeSync.isLoading}
                  error={frappeSync.error?.message ?? ""}
                />
              </div>
            )
          }
        ]
      : []),
    {
      value: "closure",
      label: (
        <TabLabel
          icon={<BellRing className="size-4" />}
          label="Closure approvals"
          count={closure.data?.item ? 1 : 0}
        />
      ),
      content: record ? (
        <EnquiryClosureCard
          enquiryId={id}
          enquiryStatus={record.status}
          onChanged={() =>
            Promise.all([
              client.invalidateQueries({ queryKey: ["crm", "work-reports", Number(id), null] }),
              client.invalidateQueries({ queryKey: enquiryDetailQueryKey(id) }),
              client.invalidateQueries({ queryKey: enquiryActivityQueryKey(id) }),
              client.invalidateQueries({ queryKey: enquiryCommentsQueryKey(id) }),
              client.invalidateQueries({ queryKey: enquiriesQueryKey })
            ])
          }
        />
      ) : null
    }
  ];
  if (!record && !error) {
    return <GlobalLoader className="min-h-[32rem]" fullScreen={false} />;
  }

  return (
    <WorkspacePage
      className="!w-full !max-w-none px-1 lg:px-2"
      technicalName="page.crm.enquiry.show"
      title=""
    >
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error.message}
          <Button
            className="ml-3"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              void enquiry.refetch();
              void comments.refetch();
              void jobs.refetch();
              void estimates.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : null}
      {record ? (
        <>
          <EnquirySummary
            record={record}
            users={users}
            mobile={mobile}
            closurePending={closure.data?.item?.status === "pending"}
          />
          {frappeSyncEnabled && record.canViewFrappeSync && record.frappeSyncError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              Frappe export error: {record.frappeSyncError}
            </p>
          ) : null}
          <WorkspaceAnimatedTabs
            keepMounted
            tabs={tabs}
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as EnquiryTab)}
            listClassName="justify-between border-b-0 bg-card px-1 shadow-none 2xl:px-2"
            triggerClassName="px-1 py-2 2xl:px-2"
            contentClassName="mt-0 rounded-t-none bg-card pb-0 [&>*]:border-t-0 [&>*]:rounded-t-none"
          />
        </>
      ) : null}
    </WorkspacePage>
  );
}

function EnquirySummary({
  record,
  users,
  mobile,
  closurePending
}: {
  record: EnquiryRecord;
  users: EnquiryLookup[];
  mobile: string | null;
  closurePending: boolean;
}) {
  const creatorName =
    users.find((user) => user.email?.toLowerCase() === record.createdBy.toLowerCase())?.name ??
    record.createdBy;
  const assigneeName =
    record.assignedToName ??
    (record.assignedUserId === null
      ? null
      : (users.find((user) => String(user.id) === record.assignedUserId)?.name ??
        `User #${record.assignedUserId}`));
  const assignedTo = assigneeName ?? "Unassigned";
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const customer = record.contactName || record.capturedName || "No customer";
  const title = enquiryTableText(record.title);
  const description = enquiryTableText(record.description);
  return (
    <section
      className={`rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm ring-2 sm:rounded-md sm:px-4 sm:py-4 ${statusRing(record.status)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-lg font-semibold">
            #{record.enquiryNo} - {title || "Untitled enquiry"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkspaceStatusBadge
            label={`List in · ${record.listIn || "Unlisted"}`}
            tone="info"
            showIcon={false}
          />
          <CrmStatusBadge code={record.status} label={record.statusName} />
          <span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700">
            <CrmColorLabel kind="priority" code={record.priority} label={record.priorityName} />
          </span>
          {closurePending ? <ClosurePendingBadge /> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:hidden">
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Enquiry message</p>
          <p className="whitespace-pre-wrap break-words text-sm font-semibold [overflow-wrap:anywhere]">
            {description || title || "—"}
          </p>
          {description && title && description !== title ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {title}
            </p>
          ) : null}
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-2">
          <MobileSummaryField label="Customer" value={customer} />
          <MobileSummaryField label="Mobile" value={mobile || "—"} />
          <MobileSummaryField label="Assigned to" value={assignedTo} />
          <MobileSummaryField
            label="Due date"
            value={record.dueDate ? formatDate(record.dueDate) : "—"}
          />
          <MobileSummaryField label="Created by" value={creatorName} />
          <MobileSummaryField
            label="Created"
            value={
              <time dateTime={record.createdAt} title={formatCreatedAt(record.createdAt)}>
                {createdAge(record.createdAt, now)}
              </time>
            }
          />
        </dl>
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-md border border-border/60 sm:block">
        <table aria-label="Enquiry details" className="w-full table-fixed text-sm">
          <colgroup className="hidden sm:table-column-group">
            <col className="w-[12%]" />
            <col className="w-[38%]" />
            <col className="w-[12%]" />
            <col className="w-[38%]" />
          </colgroup>
          <tbody className="divide-y divide-border/60">
            <tr>
              <td colSpan={4} className="bg-muted/30 px-3 py-3 align-top">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Enquiry message</p>
                <p className="whitespace-pre-wrap break-words text-base font-semibold [overflow-wrap:anywhere]">
                  {description || title || "—"}
                </p>
                {description && title && description !== title ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {title}
                  </p>
                ) : null}
              </td>
            </tr>
            <SummaryDetail
              leftLabel="Customer"
              leftValue={customer}
              rightLabel="Mobile"
              rightValue={mobile || "—"}
            />
            <SummaryDetail
              leftLabel="Assigned to"
              leftValue={assignedTo}
              rightLabel="Due date"
              rightValue={record.dueDate ? formatDate(record.dueDate) : "—"}
            />
            <SummaryDetail
              leftLabel="Created by"
              leftValue={creatorName}
              rightLabel="Created"
              rightValue={
                <time dateTime={record.createdAt} title={formatCreatedAt(record.createdAt)}>
                  {createdAge(record.createdAt, now)}
                </time>
              }
            />
          </tbody>
        </table>
      </div>
    </section>
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

function SummaryDetail({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue
}: {
  leftLabel: string;
  leftValue: string;
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

function TabLabel({
  icon,
  label,
  count,
  pending = false
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  pending?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 2xl:gap-1.5"
      title={`${label}${count === undefined ? "" : ` · ${count}`}${pending ? " · Collection pending" : ""}`}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="sr-only 2xl:not-sr-only">{label}</span>
      {count !== undefined ? (
        <>
          <span
            aria-hidden="true"
            className="hidden rounded-full bg-muted px-1 text-xs text-foreground 2xl:inline-flex"
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

function createdAge(value: string, now: number) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return "Just now";
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  if (days) return `${days} d ${hours} h ago`;
  if (hours) return `${hours} h ${minutes % 60} m ago`;
  return `${minutes} m ago`;
}

function formatCreatedAt(value: string) {
  return formatWorkspaceDateTime(value);
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" className="size-4 fill-current" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.99c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
