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
import { connectionActivity, getConnection } from "./connection.services";
import { ConnectionAuthorizationPanel } from "./connection.authorization";
import type { ConnectionRecord } from "./connection.types";

export function ConnectionShow({
  uuid,
  initialRecord,
  onBack,
  onEdit,
  onToggleStatus
}: {
  uuid: string;
  initialRecord?: ConnectionRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: ConnectionRecord) => void;
  onToggleStatus?: ((record: ConnectionRecord) => void) | undefined;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "connection-detail", uuid],
    queryFn: () => getConnection(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "connection-activity", uuid, record?.updatedAt],
    queryFn: () => connectionActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Connection…" technicalName="page.marketing.connection.show">
        <p className="p-4 text-sm text-muted-foreground">Loading connection details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Connection not found" technicalName="page.marketing.connection.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested connection could not be loaded."}
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
      description="Connection parameters, OAuth authorization, capability health, and event log."
      technicalName="page.marketing.connection.show"
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
          <WorkspaceShowCard title="Connection Details">
            <WorkspaceDetailTable
              rows={[
                ["Connection Name", record.name],
                ["Brand Reference", record.brandUuid],
                ["Provider", <span key="provider" className="capitalize">{record.provider}</span>],
                ["External Account ID", record.externalAccountId || "Not set"],
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

          <WorkspaceShowCard title="Authorization & Scopes">
            <ConnectionAuthorizationPanel record={record} />
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
