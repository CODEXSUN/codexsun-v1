import { Button } from "@codexsun/ui/components/button";
import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkReportForm } from "./work-report.form";
import { WorkReportList } from "./work-report.list";
import { useWorkReports, workReportKey } from "./work-report.hooks";
import { createWorkReport, getWorkCheckpoint } from "./work-report.services";
import { commentBodySchema } from "./work-report.schema";
import type { WorkReportPayload, WorkReportTarget } from "./work-report.types";
export function WorkReportWorkspace({
  enquiryId = null,
  taskId = null,
  onComment,
  onJob,
  onWhatsApp,
  afterWhatsApp,
  onRequestClosure,
  jobRunning,
  jobPending,
  actionFilter,
  active = true
}: {
  active?: boolean;
  actionFilter?: "check-in" | "check-out" | "checkpoints";
  enquiryId?: number | null;
  taskId?: number | null;
  onComment?:
    ((body: string, parentId: number | null, requestId: string) => Promise<unknown>) | undefined;
  onJob?: (() => void) | undefined;
  onWhatsApp?: (() => void) | undefined;
  afterWhatsApp?: React.ReactNode;
  onRequestClosure?: (() => void) | undefined;
  jobRunning?: boolean | undefined;
  jobPending?: boolean | undefined;
}) {
  const target: WorkReportTarget = { enquiryId, taskId };
  const [body, setBody] = useState("");
  const retry = useRef<WorkReportPayload | null>(null);
  const commentRetry = useRef<{ body: string; id: string } | null>(null);
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const reports = useWorkReports(
    target,
    page,
    actionFilter === "checkpoints" ? "checkpoints" : "all",
    active
  );
  const checkpoint = useQuery({
    queryKey: [...workReportKey(target), "checkpoint"],
    queryFn: () => getWorkCheckpoint(target),
    enabled: active,
    refetchInterval: active ? 10000 : false
  });
  const save = useMutation({
    mutationFn: async (action: "check-in" | "check-out") => {
      if (retry.current?.action !== action || retry.current.body !== body) retry.current = null;
      if (!retry.current) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Location is unavailable on this device."));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => reject(new Error(error.message)),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
          );
        });
        retry.current = {
          ...target,
          action,
          body,
          amount: null,
          requestId: crypto.randomUUID(),
          latitude: position?.coords.latitude ?? null,
          longitude: position?.coords.longitude ?? null,
          accuracyMeters: position?.coords.accuracy ?? null,
          capturedAt: position ? new Date(position.timestamp).toISOString() : null
        };
      }
      return createWorkReport(retry.current);
    },
    onSuccess: async () => {
      retry.current = null;
      setBody("");
      setPage(1);
      await client.invalidateQueries({ queryKey: workReportKey(target) });
      toast.success("Action sent");
    },
    onError: (error) => toast.error("Could not send action", { description: error.message })
  });
  const comment = useMutation({
    mutationFn: async () => {
      commentBodySchema.parse(
        new DOMParser().parseFromString(body, "text/html").body.textContent ?? ""
      );
      if (commentRetry.current?.body !== body)
        commentRetry.current = { body, id: crypto.randomUUID() };
      return onComment?.(body, null, commentRetry.current.id);
    },
    onSuccess: async () => {
      setBody("");
      setPage(1);
      retry.current = null;
      await client.invalidateQueries({ queryKey: workReportKey(target) });
      commentRetry.current = null;
      toast.success("Comment added");
    },
    onError: (error) => toast.error("Could not add comment", { description: error.message })
  });
  return (
    <section className="space-y-4 bg-card p-4">
      {checkpoint.error ? (
        <p role="alert" className="text-sm text-destructive">
          {checkpoint.error.message}
        </p>
      ) : null}
      {reports.error ? (
        <p role="alert" className="text-sm text-destructive">
          {reports.error.message}
        </p>
      ) : null}
      {reports.isLoading ? (
        <p>Loading actions…</p>
      ) : (
        <>
          {actionFilter === "checkpoints" ? (
            <div className="flex items-center justify-between gap-3">
              {checkpoint.data?.checkedIn ? (
                <p className="text-sm text-muted-foreground">
                  Checked in. Check out when finished.
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant={checkpoint.data?.checkedIn ? "default" : "outline"}
                  aria-pressed={checkpoint.data?.checkedIn ?? false}
                  disabled={save.isPending || checkpoint.isLoading || checkpoint.isError}
                  onClick={() => save.mutate(checkpoint.data?.checkedIn ? "check-out" : "check-in")}
                >
                  {checkpoint.data?.checkedIn ? "Check out" : "Check in"}
                </Button>
                <Button
                  variant="outline"
                  className="size-8 p-0"
                  aria-label="Refresh checkpoints"
                  title="Refresh checkpoints"
                  onClick={() => {
                    void checkpoint.refetch();
                    void reports.refetch();
                  }}
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
          {!actionFilter ? (
            <WorkReportForm
              active={active}
              body={body}
              onChange={setBody}
              onSubmit={(action) => save.mutate(action)}
              pending={save.isPending || comment.isPending}
              checkedIn={checkpoint.data?.checkedIn ?? false}
              checkpointPending={checkpoint.isLoading || checkpoint.isError}
              onComment={onComment ? () => comment.mutate() : undefined}
              onJob={onJob}
              onWhatsApp={onWhatsApp}
              afterWhatsApp={afterWhatsApp}
              onRequestClosure={onRequestClosure}
              jobRunning={jobRunning}
              jobPending={jobPending}
              onRefresh={() => {
                void reports.refetch();
                void checkpoint.refetch();
              }}
            />
          ) : null}
          <WorkReportList
            items={reports.data?.items ?? []}
            total={reports.data?.total}
            offset={(page - 1) * 100}
          />
          {(reports.data?.total ?? 0) > 100 ? (
            <div className="flex items-center justify-end gap-3 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.ceil((reports.data?.total ?? 0) / 100)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 100 >= (reports.data?.total ?? 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
