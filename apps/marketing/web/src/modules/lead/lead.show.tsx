import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Edit, PhoneCall } from "lucide-react";
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
import { getLead, leadActivity } from "./lead.services";
import type { LeadRecord, LeadStatus } from "./lead.types";

const statusToneMap: Record<LeadStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  new: "info",
  contacted: "neutral",
  qualified: "success",
  disqualified: "danger",
  deferred: "warning"
};

const statusLabelMap: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  disqualified: "Disqualified",
  deferred: "Deferred"
};

export function LeadShow({
  uuid,
  initialRecord,
  onBack,
  onEdit,
  onMarkContacted
}: {
  uuid: string;
  initialRecord?: LeadRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: LeadRecord) => void;
  onMarkContacted?: ((record: LeadRecord) => void) | undefined;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "lead-detail", uuid],
    queryFn: () => getLead(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "lead-activity", uuid, record?.updatedAt],
    queryFn: () => leadActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Lead…" technicalName="page.marketing.lead.show">
        <p className="p-4 text-sm text-muted-foreground">Loading marketing lead details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Lead Not Found" technicalName="page.marketing.lead.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested marketing lead could not be loaded."}
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
      description="Marketing lead profile, qualification status, and lifecycle progression."
      technicalName="page.marketing.lead.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          {record.status === "new" && onMarkContacted ? (
            <Button variant="outline" onClick={() => onMarkContacted(record)}>
              <PhoneCall className="mr-1 size-4" />
              Mark Contacted
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <a href={`/app/marketing/qualifications?form=new&leadUuid=${record.uuid}`}>
              <CheckCircle className="mr-1 size-4" />
              Evaluate Qualification
            </a>
          </Button>
          <Button onClick={() => onEdit(record)}>
            <Edit className="mr-1 size-4" />
            Edit
          </Button>
        </div>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Lead Details">
            <WorkspaceDetailTable
              rows={[
                ["Full Name", record.name],
                ["Company", record.companyName || "Not set"],
                ["Email", record.email || "Not set"],
                ["Phone", record.phone || "Not set"],
                ["Source", <span key="src" className="capitalize">{record.source}</span>],
                [
                  "Status",
                  <WorkspaceStatusBadge
                    key="status"
                    label={statusLabelMap[record.status] ?? record.status}
                    tone={statusToneMap[record.status] ?? "neutral"}
                  />
                ],
                ["Lead Score", record.score !== undefined ? String(record.score) : "Not scored"],
                ["Assigned To", record.assignedTo || "Unassigned"],
                ["Brand Reference", record.brandUuid || "None"],
                ["Campaign Reference", record.campaignUuid || "None"],
                ["Notes", record.notes || "None"],
                ["Reference ID", record.uuid],
                ["Created By", record.createdBy || "System"],
                ["Created At", formatDateTime(record.createdAt)],
                ["Last Updated By", record.updatedBy || "System"],
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
