import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, CloudUpload, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { crmRequest } from "../../crm-request";
import { toast } from "sonner";

export type FrappeSyncStatus = "pending" | "processing" | "failed" | "synced" | "unlinked" | null;
export type FrappeRecordState = { id: number; status: FrappeSyncStatus; message?: string | null };
type VerifyKind = "contacts" | "enquiries" | "call-logs";

type ExportJob = {
  status: string;
  progress: {
    results: Array<{
      id: number;
      outcome: "linked" | "matched" | "mismatch" | "new" | "blocked" | "exported";
    }>;
    failures: Array<{ id: number; message: string }>;
  } | null;
  errorMessage: string | null;
};

export function FrappeSyncIndicator({
  status,
  onVerify,
  error,
  unsupported = false,
  remoteName
}: {
  status: FrappeSyncStatus;
  error?: string | null | undefined;
  onVerify: () => Promise<FrappeSyncStatus>;
  unsupported?: boolean;
  remoteName?: string | null | undefined;
}) {
  const [checking, setChecking] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(error ? "failed" : status);
  useEffect(() => {
    setCurrentStatus(error ? "failed" : status);
  }, [status, error]);
  const Icon =
    currentStatus === "synced"
      ? CheckCircle2
      : currentStatus === "failed"
        ? CircleAlert
        : currentStatus === "processing"
          ? LoaderCircle
          : CloudUpload;
  const tone =
    currentStatus === "synced"
      ? "text-emerald-600"
      : currentStatus === "failed"
        ? "text-red-600"
        : "text-muted-foreground";
  const label = unsupported
    ? "Frappe sync is not supported for this record type"
    : currentStatus === "synced"
      ? "Confirmed in Frappe"
      : currentStatus === "failed"
        ? "Frappe sync or verification failed"
        : currentStatus === "processing"
          ? "Frappe sync is processing"
          : currentStatus === "unlinked"
            ? "Local only. No saved Frappe link."
            : currentStatus === "pending"
              ? "Waiting for Frappe sync confirmation"
              : "Not verified with Frappe";
  const failureLabel = /Cloudflare Tunnel|HTTP 530/u.test(error ?? "")
    ? "Frappe unavailable"
    : /Customer/u.test(error ?? "")
      ? "Customer mapping"
      : /assignee|Employee/u.test(error ?? "")
        ? "Employee mapping"
        : remoteName
          ? "Update failed"
          : "Export failed";

  async function verify() {
    if (checking || unsupported) return;
    setChecking(true);
    try {
      const verified = await onVerify();
      setCurrentStatus(error ? "failed" : verified);
    } catch (error) {
      setCurrentStatus("failed");
      toast.error("Frappe verification failed", {
        description: error instanceof Error ? error.message : "The record could not be verified."
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <span
      className="inline-flex flex-wrap items-center gap-1.5"
      title={[remoteName, error || label].filter(Boolean).join(" · ")}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon
        className={`size-4 ${tone} ${checking || currentStatus === "processing" ? "animate-spin" : ""}`}
        aria-label={label}
      />
      <span className="sr-only">{label}</span>
      {remoteName ? <span className="text-xs text-muted-foreground">{remoteName}</span> : null}
      {currentStatus === "unlinked" ? (
        <span className="text-xs text-muted-foreground">Local only</span>
      ) : null}
      {currentStatus === "failed" ? (
        <span
          role="status"
          className="whitespace-nowrap rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700"
        >
          {failureLabel}
          {error ? <span className="sr-only">: {error}</span> : null}
        </span>
      ) : null}
      <Button
        aria-label={unsupported ? label : `Verify ${label.toLowerCase()}`}
        className="h-7 px-2"
        disabled={checking || unsupported}
        onClick={() => void verify()}
        size="sm"
        title={unsupported ? label : "Verify with Frappe now"}
        type="button"
        variant="ghost"
      >
        {checking ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        <span className="sr-only">Verify</span>
      </Button>
    </span>
  );
}

export async function verifyFrappeRecord(kind: VerifyKind, id: number): Promise<FrappeSyncStatus> {
  const queued = await crmRequest<{ jobId: number }>(`/frappe/export/${kind}`, {
    method: "POST",
    body: JSON.stringify({ ids: [id], mode: "verify" })
  });
  const deadline = Date.now() + 30_000;
  let latestStatus: FrappeSyncStatus = "pending";
  while (Date.now() < deadline) {
    const job = await crmRequest<ExportJob>(`/frappe/export/jobs/${queued.jobId}`);
    if (job.status === "failed") return "failed";
    latestStatus = job.status === "running" ? "processing" : "pending";
    if (job.status === "completed") {
      const result = job.progress?.results.find((item) => item.id === id);
      if (result && ["linked", "matched", "exported"].includes(result.outcome)) return "synced";
      if (result && ["mismatch", "blocked"].includes(result.outcome)) return "failed";
      if (result?.outcome === "new") return "unlinked";
      if (job.progress?.failures.some((failure) => failure.id === id)) return "failed";
      return "pending";
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return latestStatus;
}

export async function getFrappeRecordStatuses(
  kind: VerifyKind,
  ids: number[]
): Promise<Record<number, FrappeSyncStatus>> {
  const states = await getFrappeRecordStates(kind, ids);
  return Object.fromEntries(Object.entries(states).map(([id, row]) => [id, row.status]));
}

export async function getFrappeRecordStates(
  kind: VerifyKind,
  ids: number[]
): Promise<Record<number, FrappeRecordState>> {
  const states: Record<number, FrappeRecordState> = {};
  for (let start = 0; start < ids.length; start += 100) {
    const response = await crmRequest<{ items: FrappeRecordState[] }>(
      `/frappe/export/${kind}/status`,
      {
        method: "POST",
        body: JSON.stringify({ ids: ids.slice(start, start + 100) })
      }
    );
    for (const row of response.items) states[row.id] = row;
  }
  return states;
}
