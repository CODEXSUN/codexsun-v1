import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Edit } from "lucide-react";
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
import { getFollowUp, followUpActivity } from "./follow-up.services";
import type { FollowUpRecord, FollowUpStatus } from "./follow-up.types";

const statusToneMap: Record<FollowUpStatus, "success" | "warning" | "danger" | "neutral"> = {
  completed: "success",
  pending: "warning",
  cancelled: "danger"
};

const statusLabelMap: Record<FollowUpStatus, string> = {
  completed: "Completed",
  pending: "Pending",
  cancelled: "Cancelled"
};

export function FollowUpShow({
  uuid,
  initialRecord,
  onBack,
  onEdit,
  onComplete
}: {
  uuid: string;
  initialRecord?: FollowUpRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: FollowUpRecord) => void;
  onComplete?: ((record: FollowUpRecord) => void) | undefined;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-up-detail", uuid],
    queryFn: () => getFollowUp(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-up-activity", uuid, record?.updatedAt],
    queryFn: () => followUpActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Task…" technicalName="page.marketing.follow-up.show">
        <p className="p-4 text-sm text-muted-foreground">Loading interaction task details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Task Not Found" technicalName="page.marketing.follow-up.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested follow-up interaction task could not be loaded."}
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
      title={`Task: ${record.title}`}
      description="Scheduled marketing interaction, due date tracking, and completion status."
      technicalName="page.marketing.follow-up.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          {record.status !== "completed" && onComplete ? (
            <Button variant="outline" onClick={() => onComplete(record)}>
              <CheckCircle2 className="mr-1 size-4 text-emerald-600" />
              Mark Complete
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
          <WorkspaceShowCard title="Interaction Details">
            <WorkspaceDetailTable
              rows={[
                ["Task Title", record.title],
                [
                  "Lead Reference",
                  <a
                    key="lead"
                    href={`/app/marketing/leads?show=${record.leadUuid}`}
                    className="font-medium text-primary hover:underline"
                  >
                    View Lead ({record.leadUuid})
                  </a>
                ],
                ["Interaction Type", record.type.toUpperCase()],
                [
                  "Status",
                  <WorkspaceStatusBadge
                    key="status"
                    label={statusLabelMap[record.status] ?? record.status}
                    tone={statusToneMap[record.status] ?? "neutral"}
                  />
                ],
                ["Scheduled At", formatDateTime(record.scheduledAt)],
                ["Due At", record.dueAt ? formatDateTime(record.dueAt) : "Not set"],
                ["Completed At", record.completedAt ? formatDateTime(record.completedAt) : "Pending"],
                ["Assigned To", record.assignedTo || "Unassigned"],
                ["Notes / Agenda", record.notes || "None"],
                ["Reference ID", record.uuid],
                ["Revision", String(record.revision)],
                ["Recorded At", formatDateTime(record.createdAt)],
                ["Last Updated At", formatDateTime(record.updatedAt)]
              ]}
            />
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
