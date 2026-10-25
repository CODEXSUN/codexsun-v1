import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, Edit } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import {
  WorkspaceDetailTable,
  WorkspaceShowCard,
  WorkspaceShowLayout
} from "@codexsun/ui/workspace/show";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDateTime, formatMoney } from "@codexsun/ui/workspace/utils";
import { useMarketingTransport } from "../../transport";
import { conversionActivity, getConversion } from "./conversion.services";
import type { ConversionRecord, ConversionStatus } from "./conversion.types";

const statusToneMap: Record<ConversionStatus, "success" | "danger" | "warning"> = {
  converted: "success",
  cancelled: "danger",
  reversed: "warning"
};

const statusLabelMap: Record<ConversionStatus, string> = {
  converted: "Converted",
  cancelled: "Cancelled",
  reversed: "Reversed"
};

export function ConversionShow({
  uuid,
  initialRecord,
  onBack,
  onEdit
}: {
  uuid: string;
  initialRecord?: ConversionRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: ConversionRecord) => void;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "conversion-detail", uuid],
    queryFn: () => getConversion(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "conversion-activity", uuid, record?.updatedAt],
    queryFn: () => conversionActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Conversion…" technicalName="page.marketing.conversion.show">
        <p className="p-4 text-sm text-muted-foreground">Loading sales conversion details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Conversion Not Found" technicalName="page.marketing.conversion.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested conversion record could not be loaded."}
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
      title={`Conversion: Lead #${record.leadUuid.slice(0, 8)}`}
      description="Sales conversion record, declared commercial value, and terminal outcome handoff."
      technicalName="page.marketing.conversion.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          <Button variant="outline" asChild>
            <a href={`/app/marketing/outcomes?form=new&leadUuid=${record.leadUuid}&conversionUuid=${record.uuid}`}>
              <Award className="mr-1 size-4" />
              Record Outcome
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
          <WorkspaceShowCard title="Conversion Details">
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
                  "Declared Value",
                  <span key="val" className="font-semibold text-base">
                    {formatMoney(record.declaredValue, record.currency || "INR")}
                  </span>
                ],
                [
                  "Status",
                  <WorkspaceStatusBadge
                    key="status"
                    label={statusLabelMap[record.status] ?? record.status}
                    tone={statusToneMap[record.status] ?? "neutral"}
                  />
                ],
                ["Converted By", record.convertedBy],
                ["Converted At", formatDateTime(record.convertedAt)],
                ["Qualification Reference", record.qualificationUuid || "None linked"],
                ["Cancellation / Reversal Reason", record.cancellationReason || "None"],
                ["Notes", record.notes || "None"],
                ["Reference ID", record.uuid],
                ["Created By", record.createdBy || "System"],
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
