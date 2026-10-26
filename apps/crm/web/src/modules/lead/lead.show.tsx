import { Button } from "@codexsun/ui/components/button";
import { WorkspaceDetailTable, WorkspaceShowCard } from "@codexsun/ui/workspace/show";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { formatCrmDateTime } from "../../crm-time";
import { useLeadActivity } from "./lead.hooks";
import { leadStatusLabels, type LeadRecord } from "./lead.types";
export function LeadShow({
  record,
  canEdit,
  canConvert,
  converting,
  error,
  onClose,
  onEdit,
  onConvert
}: {
  record: LeadRecord;
  canEdit: boolean;
  canConvert: boolean;
  converting: boolean;
  error: string;
  onClose: () => void;
  onEdit: () => void;
  onConvert: () => void;
}) {
  const history = useLeadActivity(record.uuid);
  return (
    <WorkspacePage
      title={record.name}
      variant="page"
      technicalName="page.crm.lead.show"
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          {canEdit && !record.enquiryId ? (
            <Button variant="outline" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {canConvert && !record.enquiryId && record.status !== "lost" ? (
            <Button disabled={converting} onClick={onConvert}>
              {converting ? "Converting…" : "Convert to enquiry"}
            </Button>
          ) : null}
          {record.enquiryId ? (
            <Button asChild>
              <a href={`/app/crm/enquiries/${record.enquiryId}`}>Open enquiry</a>
            </Button>
          ) : null}
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <WorkspaceShowCard title="Lead details">
        <WorkspaceDetailTable
          rows={[
            ["Contact", record.name],
            ["Mobile", record.phone || "—"],
            ["Email", record.email || "—"],
            [
              "Enquiry details",
              <span className="whitespace-pre-wrap break-words">{record.message}</span>
            ],
            ["Campaign", record.campaignLabel || "—"],
            ["Status", leadStatusLabels[record.status]],
            ["Assigned to", record.assignedTo],
            ["Created", formatCrmDateTime(record.createdAt)],
            ["Updated", formatCrmDateTime(record.updatedAt)],
            ["Source", record.source],
            ["Reference", record.uuid]
          ]}
        />
      </WorkspaceShowCard>
      <WorkspaceShowCard title="Activity">
        {history.error ? (
          <p role="alert" className="p-4 text-destructive">
            {history.error.message}
          </p>
        ) : null}
        {history.isLoading ? <p className="p-4">Loading activity…</p> : null}
        {history.data?.map((item, index) => (
          <div key={`${item.createdAt}-${index}`} className="border-b p-4 last:border-0">
            <p>{item.details}</p>
            <p className="text-xs text-muted-foreground">
              {item.actor} · {formatCrmDateTime(item.createdAt)}
            </p>
          </div>
        ))}
        {history.data?.length === 0 ? (
          <p className="p-4 text-muted-foreground">No activity recorded.</p>
        ) : null}
      </WorkspaceShowCard>
      {record.taskId ? (
        <Button variant="outline" asChild>
          <a href={`/app/crm/tasks/${record.taskId}`}>Open follow-up task</a>
        </Button>
      ) : null}
    </WorkspacePage>
  );
}
