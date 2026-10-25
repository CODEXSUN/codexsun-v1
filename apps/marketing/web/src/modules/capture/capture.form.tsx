import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { Textarea } from "@codexsun/ui/components/textarea";
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
import { WorkspaceSwitchCard } from "@codexsun/ui/workspace/status";
import { captureSchema } from "./capture.schema";
import { useCaptureBrandOptions, useCaptureCampaignOptions } from "./capture.hooks";
import type { CaptureInput, CaptureRecord } from "./capture.types";

export function CaptureForm({
  record,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: CaptureRecord | null;
  onCancel: () => void;
  onSubmit: (input: CaptureInput) => void;
  pending: boolean;
  error: string;
}) {
  const brands = useCaptureBrandOptions();
  const campaigns = useCaptureCampaignOptions();

  const [value, setValue] = useState<CaptureInput>({
    brandUuid: record?.brandUuid ?? "",
    campaignUuid: record?.campaignUuid ?? "",
    name: record?.name ?? "",
    allowedOrigin: record?.allowedOrigin ?? "",
    consentNotice: record?.consentNotice ?? "",
    noticeVersion: record?.noticeVersion ?? "v1",
    status: record?.status ?? "active"
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = captureSchema.safeParse(value);
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
      title={record ? "Edit Capture Definition" : "New Capture Definition"}
      description="Define web capture forms, authorized origins, and legal consent notices."
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

              <WorkspaceFormField label="Campaign" required>
                <Select
                  value={value.campaignUuid}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, campaignUuid: val }));
                    if (issues.campaignUuid) setIssues((prev) => ({ ...prev, campaignUuid: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Campaign"
                    aria-invalid={Boolean(issues.campaignUuid)}
                    className={issues.campaignUuid ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select Campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {(campaigns.data ?? []).map((c) => (
                      <SelectItem key={c.uuid} value={c.uuid}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.campaignUuid ? (
                  <p className="text-xs text-destructive">{issues.campaignUuid}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Capture name" required>
                <Input
                  aria-label="Capture name"
                  value={value.name}
                  aria-invalid={Boolean(issues.name)}
                  className={issues.name ? "border-destructive" : ""}
                  placeholder="e.g. Website Contact Form"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, name: event.target.value }));
                    if (issues.name) setIssues((prev) => ({ ...prev, name: "" }));
                  }}
                />
                {issues.name ? <p className="text-xs text-destructive">{issues.name}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Allowed origin" required>
                <Input
                  aria-label="Allowed origin"
                  value={value.allowedOrigin}
                  aria-invalid={Boolean(issues.allowedOrigin)}
                  className={issues.allowedOrigin ? "border-destructive" : ""}
                  placeholder="https://example.com"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, allowedOrigin: event.target.value }));
                    if (issues.allowedOrigin) setIssues((prev) => ({ ...prev, allowedOrigin: "" }));
                  }}
                />
                {issues.allowedOrigin ? (
                  <p className="text-xs text-destructive">{issues.allowedOrigin}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Notice version" required>
                <Input
                  aria-label="Notice version"
                  value={value.noticeVersion}
                  aria-invalid={Boolean(issues.noticeVersion)}
                  className={issues.noticeVersion ? "border-destructive" : ""}
                  placeholder="e.g. v1 or 2026-10"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, noticeVersion: event.target.value }));
                    if (issues.noticeVersion) setIssues((prev) => ({ ...prev, noticeVersion: "" }));
                  }}
                />
                {issues.noticeVersion ? (
                  <p className="text-xs text-destructive">{issues.noticeVersion}</p>
                ) : null}
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Consent notice" required>
                  <Textarea
                    aria-label="Consent notice"
                    value={value.consentNotice}
                    aria-invalid={Boolean(issues.consentNotice)}
                    className={issues.consentNotice ? "border-destructive" : ""}
                    placeholder="Enter the privacy and data processing notice shown to users before submission..."
                    rows={4}
                    onChange={(event) => {
                      setValue((prev) => ({ ...prev, consentNotice: event.target.value }));
                      if (issues.consentNotice) setIssues((prev) => ({ ...prev, consentNotice: "" }));
                    }}
                  />
                  {issues.consentNotice ? (
                    <p className="text-xs text-destructive">{issues.consentNotice}</p>
                  ) : null}
                </WorkspaceFormField>
              </div>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Status">
                  <WorkspaceSwitchCard
                    fieldLabel="Status"
                    checked={value.status === "active"}
                    onCheckedChange={(checked) =>
                      setValue((prev) => ({ ...prev, status: checked ? "active" : "inactive" }))
                    }
                  />
                </WorkspaceFormField>
              </div>
            </WorkspaceFormGrid>
          </WorkspaceFormBody>

          <WorkspaceFormActions>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : record ? "Update" : "Save"}
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
