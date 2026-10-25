import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@codexsun/ui/components/select";
import {
  WorkspaceFormActions,
  WorkspaceFormBanner,
  WorkspaceFormBody,
  WorkspaceFormField,
  WorkspaceFormGrid,
  WorkspaceFormSurface,
  WorkspaceUpsertPage
} from "@codexsun/ui/workspace/upsert";
import { consentSchema } from "./consent.schema";
import { useConsentBrandOptions } from "./consent.hooks";
import type { ConsentInput } from "./consent.types";

export function ConsentForm({
  pending,
  error,
  onSubmit,
  onCancel
}: {
  pending: boolean;
  error: string;
  onSubmit: (value: ConsentInput) => void;
  onCancel: () => void;
}) {
  const brands = useConsentBrandOptions();
  const [value, setValue] = useState<ConsentInput>({
    brandUuid: "",
    recipient: "",
    channel: "email",
    purpose: "promotional",
    action: "grant",
    noticeVersion: "v1",
    evidence: "",
    source: "explicit_consent_form",
    occurredAt: new Date().toISOString(),
    expiresAt: null,
    requestKey: crypto.randomUUID()
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = consentSchema.safeParse(value);
    if (!result.success) {
      const nextIssues: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!nextIssues[field]) {
          nextIssues[field] = issue.message;
        }
      }
      setIssues(nextIssues);
      return;
    }
    setIssues({});
    onSubmit(result.data);
  };

  const hasErrors = hasSubmitted && (Boolean(error) || Object.keys(issues).length > 0);

  return (
    <WorkspaceUpsertPage
      title="Record Consent Evidence"
      description="Record explicit promotional email evidence. Consent evidence is append-only and cannot be altered once stored."
      onBack={onCancel}
    >
      <form noValidate onSubmit={handleSubmit}>
        <WorkspaceFormSurface>
          <WorkspaceFormBody>
            {hasErrors ? (
              <WorkspaceFormBanner title="Unable to save" tone="error">
                {error || "Check the required fields below and try again."}
              </WorkspaceFormBanner>
            ) : null}

            <WorkspaceFormGrid columns={2}>
              <WorkspaceFormField label="Brand" required>
                <Select
                  value={value.brandUuid}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, brandUuid: val }));
                    if (issues.brandUuid) setIssues((prev) => ({ ...prev, brandUuid: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Brand"
                    aria-invalid={Boolean(issues.brandUuid)}
                    className={issues.brandUuid ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {(brands.data ?? []).map((b) => (
                      <SelectItem key={b.uuid} value={b.uuid}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.brandUuid ? (
                  <p className="text-xs text-destructive">{issues.brandUuid}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Evidence action" required>
                <Select
                  value={value.action}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, action: val as "grant" | "withdraw" }));
                    if (issues.action) setIssues((prev) => ({ ...prev, action: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Evidence action"
                    aria-invalid={Boolean(issues.action)}
                    className={issues.action ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant">Grant (Opt-in)</SelectItem>
                    <SelectItem value="withdraw">Withdraw (Opt-out)</SelectItem>
                  </SelectContent>
                </Select>
                {issues.action ? (
                  <p className="text-xs text-destructive">{issues.action}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Recipient email" required>
                <Input
                  type="email"
                  aria-label="Recipient email"
                  value={value.recipient}
                  aria-invalid={Boolean(issues.recipient)}
                  className={issues.recipient ? "border-destructive" : ""}
                  placeholder="subscriber@example.com"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, recipient: event.target.value }));
                    if (issues.recipient) setIssues((prev) => ({ ...prev, recipient: "" }));
                  }}
                />
                {issues.recipient ? (
                  <p className="text-xs text-destructive">{issues.recipient}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Notice version" required>
                <Input
                  aria-label="Notice version"
                  value={value.noticeVersion}
                  aria-invalid={Boolean(issues.noticeVersion)}
                  className={issues.noticeVersion ? "border-destructive" : ""}
                  placeholder="e.g. 2026-v1"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, noticeVersion: event.target.value }));
                    if (issues.noticeVersion) setIssues((prev) => ({ ...prev, noticeVersion: "" }));
                  }}
                />
                {issues.noticeVersion ? (
                  <p className="text-xs text-destructive">{issues.noticeVersion}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Source description" required>
                <Input
                  aria-label="Source description"
                  value={value.source}
                  aria-invalid={Boolean(issues.source)}
                  className={issues.source ? "border-destructive" : ""}
                  placeholder="e.g. newsletter_signup_form"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, source: event.target.value }));
                    if (issues.source) setIssues((prev) => ({ ...prev, source: "" }));
                  }}
                />
                {issues.source ? (
                  <p className="text-xs text-destructive">{issues.source}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Evidence reference" required>
                <Input
                  aria-label="Evidence reference"
                  value={value.evidence}
                  aria-invalid={Boolean(issues.evidence)}
                  className={issues.evidence ? "border-destructive" : ""}
                  placeholder="e.g. audit-log-id or signed-token-hash"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, evidence: event.target.value }));
                    if (issues.evidence) setIssues((prev) => ({ ...prev, evidence: "" }));
                  }}
                />
                {issues.evidence ? (
                  <p className="text-xs text-destructive">{issues.evidence}</p>
                ) : null}
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Immutable Evidence Notice</p>
                  <p className="mt-0.5">
                    Consent records are strictly append-only. Submitting records an immutable audit entry
                    with explicit timestamp and unique request key.
                  </p>
                </div>
              </div>
            </WorkspaceFormGrid>
          </WorkspaceFormBody>

          <WorkspaceFormActions>
            <Button type="submit" disabled={pending}>
              {pending ? "Recording..." : "Save consent evidence"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          </WorkspaceFormActions>
        </WorkspaceFormSurface>
      </form>
    </WorkspaceUpsertPage>
  );
}
