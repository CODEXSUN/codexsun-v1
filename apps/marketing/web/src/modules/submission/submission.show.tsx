import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, UserCheck } from "lucide-react";
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
import { getSubmission } from "./submission.services";
import type { SubmissionRecord } from "./submission.types";

export function SubmissionShow({
  uuid,
  initialRecord,
  onBack,
  onRetry,
  retryPending
}: {
  uuid: string;
  initialRecord?: SubmissionRecord | null | undefined;
  onBack: () => void;
  onRetry: () => void;
  retryPending: boolean;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "submission-detail", uuid],
    queryFn: () => getSubmission(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Submission…" technicalName="page.marketing.submission.show">
        <p className="p-4 text-sm text-muted-foreground">Loading submission details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Submission not found" technicalName="page.marketing.submission.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested submission could not be loaded."}
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
      description="Original capture evidence, privacy consent, and Marketing lead handoff."
      technicalName="page.marketing.submission.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          {record.status === "pending" ? (
            <Button disabled={retryPending} onClick={onRetry}>
              <RefreshCw className="mr-1 size-4" />
              {retryPending ? "Creating lead…" : "Create lead"}
            </Button>
          ) : record.leadUuid ? (
            <Button variant="outline" asChild>
              <a href={"/app/marketing/leads?show=" + record.leadUuid}>
                <UserCheck className="mr-1 size-4" />
                Open Marketing Lead
              </a>
            </Button>
          ) : null}
        </div>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Submission Details">
            <WorkspaceDetailTable
              rows={[
                ["Reference ID", record.uuid],
                ["Contact Name", record.name],
                ["Email", record.email || "—"],
                ["Phone", record.phone || "—"],
                ["Campaign", record.campaignLabel || record.campaignUuid],
                ["Message", record.message || "—"],
                [
                  "Handoff Status",
                  <WorkspaceStatusBadge
                    key="status"
                    label={record.status === "delivered" ? "Delivered" : "Pending"}
                    tone={record.status === "delivered" ? "success" : "warning"}
                  />
                ],
                [
                  "Marketing Lead",
                  record.leadUuid ? (
                    <a
                      href={"/app/marketing/leads?show=" + record.leadUuid}
                      className="font-medium text-primary hover:underline"
                    >
                      View Lead ({record.leadUuid})
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Pending — select Create lead to process this submission.</span>
                  )
                ],
                ["Received At", formatDateTime(record.createdAt)],
                ["Recorded By", record.createdBy || "System"]
              ]}
            />
          </WorkspaceShowCard>
        </div>

        <div className="space-y-4">
          <WorkspaceShowCard title="Consent & Provenance">
            <WorkspaceDetailTable
              rows={[
                ["Capture Definition", record.captureUuid],
                ["Capture Notice Version", record.noticeVersion],
                ["Consent Notice Text", record.consentNotice],
                ["Original Source", record.sourceReference || "Direct"],
                ["Source Notice Version", record.sourceNoticeVersion],
                ["Source Consent Time", record.sourceConsentAt ? formatDateTime(record.sourceConsentAt) : "—"],
                ["Marketing Subscription", "Not granted by enquiry capture"]
              ]}
            />
          </WorkspaceShowCard>
        </div>
      </WorkspaceShowLayout>
    </WorkspacePage>
  );
}
