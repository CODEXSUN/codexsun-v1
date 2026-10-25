import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
import { checkConsentEligibility, getConsent } from "./consent.services";
import type { ConsentRecord } from "./consent.types";

const reasonLabels: Record<string, string> = {
  brand_inactive: "The brand is inactive.",
  consent_unavailable: "Consent evidence is unavailable.",
  consent_missing: "No promotional grant was recorded.",
  consent_withdrawn: "Promotional consent was withdrawn.",
  consent_expired: "Promotional consent expired.",
  consent_changed: "Consent changed during this check. Check again.",
  crm_unavailable: "CRM policy is unavailable or access is disabled.",
  mail_unavailable: "Mail safety is unavailable or access is disabled.",
  "crm:do_not_contact": "CRM has a do-not-contact restriction.",
  "crm:legacy_preference_requires_review": "CRM contact preferences require review.",
  "mail:complaint": "Mail recorded a complaint.",
  "mail:hard_bounce": "Mail recorded a hard bounce.",
  "mail:policy": "Mail delivery policy blocks this recipient."
};

export function ConsentShow({
  uuid,
  initialRecord,
  onBack
}: {
  uuid: string;
  initialRecord?: ConsentRecord | null | undefined;
  onBack: () => void;
}) {
  const api = useMarketingTransport();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "consent-detail", uuid],
    queryFn: () => getConsent(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const check = useMutation({
    mutationFn: () => (record ? checkConsentEligibility(api, record) : Promise.reject(new Error("No record")))
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Consent Evidence…" technicalName="page.marketing.consent.show">
        <p className="p-4 text-sm text-muted-foreground">Loading consent evidence details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Consent Evidence Not Found" technicalName="page.marketing.consent.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested consent record could not be loaded."}
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
      title={`Consent: ${record.recipient}`}
      description="Immutable promotional consent evidence record and live policy eligibility assessment."
      technicalName="page.marketing.consent.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          <Button onClick={() => check.mutate()} disabled={check.isPending}>
            <CheckCircle2 className="mr-1 size-4" />
            {check.isPending ? "Checking…" : "Check eligibility"}
          </Button>
        </div>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Evidence Record">
            <WorkspaceDetailTable
              rows={[
                ["Recipient Email", record.recipient],
                [
                  "Action Recorded",
                  <WorkspaceStatusBadge
                    key="action"
                    label={record.action === "grant" ? "Grant (Opt-in)" : "Withdraw (Opt-out)"}
                    tone={record.action === "grant" ? "success" : "neutral"}
                  />
                ],
                ["Brand Reference", record.brandUuid],
                ["Channel", record.channel],
                ["Purpose", record.purpose],
                ["Notice Version", record.noticeVersion],
                ["Source", record.source],
                ["Evidence Reference", record.evidence],
                ["Occurred At", formatDateTime(record.occurredAt)],
                ["Expiry", record.expiresAt ? formatDateTime(record.expiresAt) : "No expiry recorded"],
                ["Record Reference ID", record.uuid],
                ["Recorded By", record.createdBy || "System"],
                ["Recorded At", formatDateTime(record.createdAt)]
              ]}
            />
          </WorkspaceShowCard>
        </div>

        <div className="space-y-4">
          <WorkspaceShowCard title="Live Eligibility Check">
            <div className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">
                Assesses real-time promotional eligibility across Brand status, consent evidence,
                contact restrictions, and Mail safety suppressions.
              </p>
              {check.error ? (
                <p role="alert" className="text-xs text-destructive">
                  {check.error.message}
                </p>
              ) : null}
              {check.data && !check.isPending ? (
                <div role="status" className="space-y-2 rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <WorkspaceStatusBadge
                      label={check.data.eligible ? "Eligible at check time" : "Promotional email blocked"}
                      tone={check.data.eligible ? "success" : "danger"}
                    />
                  </div>
                  {check.data.reasons.length > 0 ? (
                    <ul className="list-disc pl-5 text-xs text-destructive space-y-1">
                      {check.data.reasons.map((reason) => (
                        <li key={reason}>
                          {reasonLabels[reason] ?? reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-xs text-muted-foreground pt-1">
                    Checked {formatDateTime(check.data.checkedAt)}.
                  </p>
                </div>
              ) : null}
            </div>
          </WorkspaceShowCard>
        </div>
      </WorkspaceShowLayout>
    </WorkspacePage>
  );
}
