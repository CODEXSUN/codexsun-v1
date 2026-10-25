import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { Card } from "@codexsun/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@codexsun/ui/components/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@codexsun/ui/components/tabs";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceSwitchCard } from "@codexsun/ui/workspace/status";
import { FrappeEnquirySyncQueuePanel } from "../enquiry-sync";
import { useFrappeConnectionSettings } from "../connection/connection.hooks";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import {
  getLiveSyncJobs,
  getLiveSyncSettings,
  resyncLiveKind,
  saveLiveSyncSettings
} from "./live-sync.services";
import type { LiveSyncJob, LiveSyncKind, LiveSyncSettings } from "./live-sync.types";

const labels: Record<LiveSyncKind, string> = {
  contacts: "Contacts",
  enquiries: "Enquiries",
  activities: "Activities",
  "call-logs": "Call logs"
};
const key = ["frappe", "live-sync"];

export function FrappeLiveSyncWorkspace() {
  const client = useQueryClient();
  const connection = useFrappeConnectionSettings();
  const settings = useQuery({ queryKey: [...key, "settings"], queryFn: getLiveSyncSettings });
  const [draft, setDraft] = useState<LiveSyncSettings | null>(null);
  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);
  const save = useMutation({
    mutationFn: saveLiveSyncSettings,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key });
      toast.success("Live sync settings saved");
    },
    onError: (error) => {
      if (settings.data) setDraft(settings.data);
      toast.error(error.message);
    }
  });
  if (!draft)
    return (
      <WorkspacePage
        title="Live sync"
        description="Scheduled enquiry sync between CRM and the connected Frappe site."
        technicalName="page.frappe.live-sync"
      >
        {settings.error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {settings.error.message}
            </p>
            <Button variant="outline" onClick={() => void settings.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading live sync…</p>
        )}
      </WorkspacePage>
    );
  const commit = (next: LiveSyncSettings) => {
    setDraft(next);
    save.mutate({
      enabled: next.enabled,
      paused: next.paused,
      direction: next.direction,
      scheduleMinutes: next.scheduleMinutes,
      modules: next.modules
    });
  };
  return (
    <WorkspacePage
      title="Live sync"
      description="Import Frappe enquiries into CRM, with optional scheduled enquiry exports."
      technicalName="page.frappe.live-sync"
    >
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Scheduled CRM and Frappe sync</h2>
            <p className="text-sm text-muted-foreground">
              The first successful run imports all enquiry history. Later runs check changes since
              the last successful import. Failed records keep the checkpoint unchanged.
            </p>
          </div>
          <WorkspaceSwitchCard
            label="Live sync enabled"
            description="Show CRM sync controls and allow Frappe transfers for this tenant."
            checked={draft.enabled}
            disabled={save.isPending}
            onCheckedChange={(enabled) => commit({ ...draft, enabled })}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Direction
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={draft.direction}
              disabled={save.isPending}
              onChange={(event) =>
                commit({ ...draft, direction: event.target.value as LiveSyncSettings["direction"] })
              }
            >
              <option value="inbound">Frappe → CRM only</option>
              <option value="bidirectional">Both directions (enquiries and contact mobiles)</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Schedule{" "}
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={draft.scheduleMinutes}
              disabled={save.isPending}
              onChange={(event) =>
                commit({
                  ...draft,
                  scheduleMinutes: Number(event.target.value) as 1 | 5 | 15 | 30 | 60
                })
              }
            >
              {[1, 5, 15, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  Every {minutes} {minutes === 1 ? "minute" : "minutes"}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            disabled={!draft.enabled || save.isPending}
            onClick={() => commit({ ...draft, paused: !draft.paused })}
          >
            {draft.paused ? <Play /> : <Pause />}
            {draft.paused ? "Resume" : "Pause"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {draft.paused
              ? "Paused"
              : !draft.enabled
                ? "Off"
                : draft.backgroundWorkerEnabled
                  ? "Scheduled"
                  : "Worker disabled"}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(draft.direction === "bidirectional"
            ? (["enquiries", "contacts"] as const)
            : (["enquiries"] as const)
          ).map((kind) => (
            <WorkspaceSwitchCard
              key={kind}
              label={labels[kind]}
              description={
                kind === "contacts"
                  ? "Export supported mobile links immediately after a CRM contact save."
                  : draft.direction === "inbound"
                    ? "Import Frappe enquiries and comments. Scheduled CRM exports are off."
                    : "Import Frappe enquiries and comments, and export approved CRM enquiry changes."
              }
              checked={draft.modules[kind]}
              disabled={save.isPending || !draft.enabled}
              onCheckedChange={(checked) =>
                commit({ ...draft, modules: { ...draft.modules, [kind]: checked } })
              }
            />
          ))}
        </div>
      </Card>
      {!connection.data?.usable ? (
        <p role="alert" className="text-sm text-amber-700">
          Verify and enable the Frappe connection before scheduled sync can run.
        </p>
      ) : null}
      {connection.data?.usable && !draft.backgroundWorkerEnabled ? (
        <p role="alert" className="text-sm text-amber-700">
          Background worker is disabled. Settings can be saved, but scheduled and manual jobs will
          not be queued.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Last successful import:{" "}
        {draft.inboundCheckpointAt && draft.inboundBaseUrl === connection.data?.baseUrl
          ? new Date(draft.inboundCheckpointAt).toLocaleString()
          : "History import pending"}
        . Last schedule:{" "}
        {draft.lastScheduledAt ? new Date(draft.lastScheduledAt).toLocaleString() : "Not run"}
      </p>
    </WorkspacePage>
  );
}

export function FrappeLiveSyncQueueWorkspace() {
  const client = useQueryClient();
  const connection = useFrappeConnectionSettings();
  const settings = useQuery({ queryKey: [...key, "settings"], queryFn: getLiveSyncSettings });
  const jobs = useQuery({
    queryKey: [...key, "jobs"],
    queryFn: getLiveSyncJobs,
    refetchInterval: 3000
  });
  const run = useMutation({
    mutationFn: resyncLiveKind,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...key, "jobs"] });
      toast.success("Live re-sync queued");
    },
    onError: (error) => toast.error(error.message)
  });
  const columns: ColumnDef<LiveSyncJob>[] = [
    { accessorKey: "id", header: "JOB" },
    { accessorKey: "kind", header: "MODULE", cell: ({ row }) => labels[row.original.kind] },
    {
      accessorKey: "direction",
      header: "DIRECTION",
      cell: ({ row }) => (row.original.direction === "inbound" ? "Frappe → CRM" : "CRM → Frappe")
    },
    {
      accessorKey: "status",
      header: "STATUS",
      cell: ({ row }) =>
        row.original.progress?.failed
          ? `${row.original.status} · needs attention`
          : row.original.status
    },
    {
      id: "result",
      header: "RESULT / ERROR",
      cell: ({ row }) => {
        const progress = row.original.progress;
        const summary = progress
          ? row.original.direction === "inbound"
            ? `${progress.created ?? 0} imported · ${progress.skipped ?? 0} unchanged · ${progress.failed} failed`
            : `${progress.exported ?? 0} sent · ${progress.failed} failed`
          : row.original.errorMessage || "Waiting";
        const failures = progress?.failures
          ? progress.failures.map((failure) => ({
              record: failure.name ?? (failure.id ? `#${failure.id}` : "Record"),
              message: failure.message
            }))
          : progress?.results
              ?.filter((item) => item.message)
              .map((item) => ({ record: `#${item.id}`, message: item.message! }));
        return (
          <div className="max-w-2xl space-y-1">
            <span className={progress?.failed ? "text-destructive" : undefined}>{summary}</span>
            {failures?.map((failure, index) => (
              <p key={`${failure.record}-${index}`} className="text-xs text-destructive">
                {failure.record}: {failure.message}
              </p>
            ))}
          </div>
        );
      }
    },
    {
      accessorKey: "createdAt",
      header: "QUEUED",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString()
    }
  ];
  return (
    <WorkspacePage
      title=""
      className="space-y-2 py-2 lg:py-2"
      technicalName="page.frappe.live-sync-queue"
    >
      <Tabs defaultValue="live-jobs" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList aria-label="Frappe sync queue views" className="mb-0">
            <TabsTrigger value="live-jobs">Live jobs</TabsTrigger>
            <TabsTrigger value="enquiry-history">Enquiry event history</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="live-jobs" className="mt-0 space-y-2">
          {connection.data && !connection.data.usable ? (
            <p role="alert" className="text-sm text-amber-700">
              Verify and enable the Frappe connection before requesting sync.
            </p>
          ) : null}
          {connection.data?.usable && !connection.data.backgroundWorkerEnabled ? (
            <p role="alert" className="text-sm text-amber-700">
              Background worker is disabled. Queued sync cannot run yet.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void jobs.refetch()}
              disabled={jobs.isFetching}
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    run.isPending ||
                    !settings.data?.enabled ||
                    settings.data.paused ||
                    !connection.data?.usable ||
                    !connection.data.backgroundWorkerEnabled
                  }
                >
                  <RefreshCw className="size-4" /> Re-sync <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(labels) as LiveSyncKind[])
                  .filter(
                    (kind) =>
                      kind === "enquiries" ||
                      (kind === "contacts" && settings.data?.direction === "bidirectional")
                  )
                  .map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      disabled={!settings.data?.modules[kind]}
                      onSelect={() => run.mutate(kind)}
                    >
                      {settings.data?.direction === "inbound"
                        ? "Import all enquiry history"
                        : `Export ${labels[kind]}`}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <WorkspaceTable columns={columns} data={jobs.data ?? []} isLoading={jobs.isLoading} />
          {jobs.error ? (
            <p role="alert" className="text-sm text-destructive">
              {jobs.error.message}
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="enquiry-history" className="mt-0">
          <FrappeEnquirySyncQueuePanel />
        </TabsContent>
      </Tabs>
    </WorkspacePage>
  );
}
