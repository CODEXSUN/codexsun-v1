import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import {
  WorkspaceDetailTable,
  WorkspaceShowCard,
  WorkspaceShowLayout
} from "@codexsun/ui/workspace/show";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import { useMarketingTransport } from "../../transport";
import { captureActivity, getCapture } from "./capture.services";
import { CapturePublication } from "./capture.publication";
import type { CaptureRecord } from "./capture.types";

export function CaptureShow({
  uuid,
  initialRecord,
  onBack,
  onEdit,
  onToggleStatus
}: {
  uuid: string;
  initialRecord?: CaptureRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: CaptureRecord) => void;
  onToggleStatus?: ((record: CaptureRecord) => void) | undefined;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-detail", uuid],
    queryFn: () => getCapture(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-activity", uuid, record?.updatedAt],
    queryFn: () => captureActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Capture…" technicalName="page.marketing.capture.show">
        <p className="p-4 text-sm text-muted-foreground">Loading capture details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Capture not found" technicalName="page.marketing.capture.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested capture form could not be loaded."}
          </p>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back to list
          </Button>
        </div>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage
      title={record.name}
      description="Capture definition, origin security, consent notice, and website binding."
      technicalName="page.marketing.capture.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          {onToggleStatus ? (
            <Button variant="outline" onClick={() => onToggleStatus(record)}>
              {record.status === "active" ? "Deactivate" : "Restore"}
            </Button>
          ) : null}
          <Button onClick={() => onEdit(record)}>
            <Edit className="mr-1 size-4" />
            Edit
          </Button>
        </div>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Capture Details">
            <WorkspaceDetailTable
              rows={[
                ["Capture Name", record.name],
                ["Brand Reference", record.brandUuid],
                ["Campaign Reference", record.campaignUuid],
                ["Allowed Origin", record.allowedOrigin],
                ["Notice Version", record.noticeVersion],
                ["Consent Notice", record.consentNotice],
                [
                  "Status",
                  <WorkspaceStatusBadge
                    key="status"
                    label={record.status === "active" ? "Active" : "Inactive"}
                    tone={record.status === "active" ? "success" : "neutral"}
                  />
                ],
                ["Reference ID", record.uuid],
                ["Created By", record.createdBy || "System"],
                ["Created At", formatDateTime(record.createdAt)],
                ["Last Updated By", record.updatedBy || "System"],
                ["Last Updated At", formatDateTime(record.updatedAt)]
              ]}
            />
          </WorkspaceShowCard>

          <WorkspaceShowCard title="Publication & Integration">
            <CapturePublication record={record} />
          </WorkspaceShowCard>
        </div>

        <div className="space-y-4">
          <WorkspaceShowCard title="Activity">
            {activity.error ? (
              <p role="alert" className="p-4 text-xs text-destructive">
                {activity.error.message}
              </p>
            ) : null}
            <WorkspaceDetailTable
              rows={
                (activity.data ?? []).length > 0
                  ? (activity.data ?? []).map((item, index) => [
                      formatDateTime(item.occurredAt) + " #" + (index + 1),
                      `${item.action} by ${item.actor}`
                    ])
                  : [["Activity", <span key="empty" className="text-muted-foreground">No recent activity recorded</span>]]
              }
            />
          </WorkspaceShowCard>
        </div>
      </WorkspaceShowLayout>
    </WorkspacePage>
  );
}
