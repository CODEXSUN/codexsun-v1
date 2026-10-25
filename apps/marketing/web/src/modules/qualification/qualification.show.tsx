import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Edit, TrendingUp } from "lucide-react";
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
import { getQualification, qualificationActivity } from "./qualification.services";
import type { QualificationRecord, QualificationDecision } from "./qualification.types";

const decisionToneMap: Record<QualificationDecision, "success" | "danger" | "warning"> = {
  qualified: "success",
  disqualified: "danger",
  deferred: "warning"
};

const decisionLabelMap: Record<QualificationDecision, string> = {
  qualified: "Qualified",
  disqualified: "Disqualified",
  deferred: "Deferred"
};

export function QualificationShow({
  uuid,
  initialRecord,
  onBack,
  onEdit
}: {
  uuid: string;
  initialRecord?: QualificationRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: QualificationRecord) => void;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "qualification-detail", uuid],
    queryFn: () => getQualification(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "qualification-activity", uuid, record?.updatedAt],
    queryFn: () => qualificationActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Qualification…" technicalName="page.marketing.qualification.show">
        <p className="p-4 text-sm text-muted-foreground">Loading qualification details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Qualification Not Found" technicalName="page.marketing.qualification.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested qualification evaluation could not be loaded."}
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
      title={`Qualification: Lead #${record.leadUuid.slice(0, 8)}`}
      description="Evaluation criteria, decision rationale, reviewer signature, and revision evidence."
      technicalName="page.marketing.qualification.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          {record.decision === "qualified" ? (
            <Button variant="outline" asChild>
              <a href={`/app/marketing/conversions?form=new&leadUuid=${record.leadUuid}&qualificationUuid=${record.uuid}`}>
                <TrendingUp className="mr-1 size-4" />
                Convert to Sales
              </a>
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
          <WorkspaceShowCard title="Evaluation Details">
            <WorkspaceDetailTable
              rows={[
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
                [
                  "Decision",
                  <WorkspaceStatusBadge
                    key="decision"
                    label={decisionLabelMap[record.decision] ?? record.decision}
                    tone={decisionToneMap[record.decision] ?? "neutral"}
                  />
                ],
                ["Evaluation Criteria", record.criteria],
                ["Reasoning / Justification", record.reason],
                ["Qualification Score", record.score !== undefined ? String(record.score) : "Not scored"],
                ["Reviewer", record.reviewer],
                ["Notes", record.notes || "None"],
                ["Reference ID", record.uuid],
                ["Created By", record.createdBy || "System"],
                ["Evaluated At", formatDateTime(record.createdAt)],
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
