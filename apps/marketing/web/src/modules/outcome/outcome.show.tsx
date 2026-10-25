import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, RotateCcw } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import {
  WorkspaceDetailTable,
  WorkspaceShowCard,
  WorkspaceShowLayout
} from "@codexsun/ui/workspace/show";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDate, formatDateTime, formatMoney } from "@codexsun/ui/workspace/utils";
import { useMarketingTransport } from "../../transport";
import { getOutcome, outcomeActivity } from "./outcome.services";
import type { OutcomeRecord, OutcomeStatus } from "./outcome.types";

const statusToneMap: Record<OutcomeStatus, "success" | "danger" | "warning" | "neutral"> = {
  won: "success",
  lost: "danger",
  nurture: "warning",
  unresponsive: "neutral",
  withdrawn: "neutral"
};

const statusLabelMap: Record<OutcomeStatus, string> = {
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
  unresponsive: "Unresponsive",
  withdrawn: "Withdrawn"
};

export function OutcomeShow({
  uuid,
  initialRecord,
  onBack,
  onEdit
}: {
  uuid: string;
  initialRecord?: OutcomeRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: OutcomeRecord) => void;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "outcome-detail", uuid],
    queryFn: () => getOutcome(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "outcome-activity", uuid, record?.updatedAt],
    queryFn: () => outcomeActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Outcome…" technicalName="page.marketing.outcome.show">
        <p className="p-4 text-sm text-muted-foreground">Loading terminal outcome details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Outcome Not Found" technicalName="page.marketing.outcome.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested terminal outcome could not be loaded."}
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
      title={`Outcome: Lead #${record.leadUuid.slice(0, 8)}`}
      description="Definitive terminal outcome, attribution reason, and historical correction chain."
      technicalName="page.marketing.outcome.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          <Button variant="outline" asChild>
            <a href={`/app/marketing/outcomes?form=new&leadUuid=${record.leadUuid}&previousOutcomeUuid=${record.uuid}`}>
              <RotateCcw className="mr-1 size-4" />
              Reopen / Correct Outcome
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
          <WorkspaceShowCard title="Outcome Disposition">
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
                  "Terminal Disposition",
                  <WorkspaceStatusBadge
                    key="status"
                    label={statusLabelMap[record.status] ?? record.status}
                    tone={statusToneMap[record.status] ?? "neutral"}
                  />
                ],
                ["Reasoning / Explanation", record.reason],
                [
                  "Declared Value",
                  record.declaredValue !== undefined
                    ? formatMoney(record.declaredValue, record.currency || "INR")
                    : "Not specified"
                ],
                ["Effective Date", formatDate(record.effectiveDate)],
                ["Conversion Reference", record.conversionUuid || "None linked"],
                ["Previous Outcome Superseded", record.previousOutcomeUuid || "None (original outcome)"],
                ["Notes", record.notes || "None"],
                ["Reference ID", record.uuid],
                ["Recorded By", record.createdBy || "System"],
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
