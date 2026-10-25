import { useEffect, useMemo, useState } from "react";
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
import { emailCampaignSchema } from "./email-campaign.schema";
import {
  useEmailCampaignBrandOptions,
  useEmailCampaignCampaignOptions,
  useEmailCampaignSenderOptions
} from "./email-campaign.hooks";
import type { EmailCampaignInput, EmailCampaignRecord } from "./email-campaign.types";

const TEMPLATE_VARIABLES = [
  "{{contact.name}}",
  "{{contact.email}}",
  "{{brand.name}}",
  "{{campaign.name}}",
  "{{unsubscribe_url}}"
];

export function EmailCampaignForm({
  record,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: EmailCampaignRecord | null;
  onCancel: () => void;
  onSubmit: (input: EmailCampaignInput) => void;
  pending: boolean;
  error: string;
}) {
  const brands = useEmailCampaignBrandOptions();
  const campaigns = useEmailCampaignCampaignOptions();

  const initialValue: EmailCampaignInput = useMemo(
    () => ({
      brandUuid: record?.brandUuid ?? "",
      campaignUuid: record?.campaignUuid ?? null,
      senderUuid: record?.senderUuid ?? "",
      name: record?.name ?? "",
      subject: record?.subject ?? "",
      preheader: record?.preheader ?? "",
      bodyHtml: record?.bodyHtml ?? "",
      bodyText: record?.bodyText ?? "",
      scheduledAt: record?.scheduledAt ? record.scheduledAt.slice(0, 16) : null,
      ...(record?.revision ? { expectedRevision: record.revision } : {})
    }),
    [record]
  );

  const [value, setValue] = useState<EmailCampaignInput>(initialValue);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const senders = useEmailCampaignSenderOptions(value.brandUuid || undefined);

  const isDirty = useMemo(() => {
    return (
      value.brandUuid !== initialValue.brandUuid ||
      value.campaignUuid !== initialValue.campaignUuid ||
      value.senderUuid !== initialValue.senderUuid ||
      value.name !== initialValue.name ||
      value.subject !== initialValue.subject ||
      value.preheader !== initialValue.preheader ||
      value.bodyHtml !== initialValue.bodyHtml ||
      value.bodyText !== initialValue.bodyText ||
      value.scheduledAt !== initialValue.scheduledAt
    );
  }, [value, initialValue]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleCancel = () => {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    onCancel();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = emailCampaignSchema.safeParse(value);
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
    onSubmit({
      brandUuid: result.data.brandUuid,
      senderUuid: result.data.senderUuid,
      name: result.data.name,
      subject: result.data.subject,
      preheader: result.data.preheader ?? "",
      bodyHtml: result.data.bodyHtml,
      bodyText: result.data.bodyText,
      campaignUuid: result.data.campaignUuid ?? null,
      scheduledAt: result.data.scheduledAt || null,
      ...(result.data.expectedRevision !== undefined ? { expectedRevision: result.data.expectedRevision } : {})
    });
  };

  const hasErrors = hasSubmitted && (Boolean(error) || Object.keys(issues).length > 0);

  const insertVariable = (variable: string) => {
    setValue((prev) => ({
      ...prev,
      bodyHtml: prev.bodyHtml + variable,
      bodyText: prev.bodyText + variable
    }));
  };

  return (
    <WorkspaceUpsertPage
      title={record ? "Edit Email Campaign" : "New Email Campaign"}
      description="Configure email campaign templates, verified sender selection, variables, and schedules."
      onBack={handleCancel}
    >
      <form noValidate onSubmit={handleSubmit}>
        <WorkspaceFormSurface>
          <WorkspaceFormBody>
            {hasErrors ? (
              <WorkspaceFormBanner title="Unable to save email campaign" tone="error">
                {error || "Check the required fields below and correct errors before saving."}
              </WorkspaceFormBanner>
            ) : null}

            <WorkspaceFormGrid columns={2}>
              {/* Campaign Name */}
              <div className="md:col-span-2">
                <WorkspaceFormField label="Campaign Name" required>
                  <Input
                    aria-label="Campaign Name"
                    placeholder="e.g. October Product Launch"
                    value={value.name}
                    onChange={(e) => {
                      setValue((prev) => ({ ...prev, name: e.target.value }));
                      if (issues.name) setIssues((prev) => ({ ...prev, name: "" }));
                    }}
                    aria-invalid={hasSubmitted && Boolean(issues.name)}
                    className={hasSubmitted && issues.name ? "border-destructive" : ""}
                  />
                  {hasSubmitted && issues.name ? (
                    <p className="text-xs text-destructive mt-1">{issues.name}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Internal identifier for this email dispatch.</p>
                  )}
                </WorkspaceFormField>
              </div>

              {/* Brand Selection */}
              <WorkspaceFormField label="Brand" required>
                <Select
                  value={value.brandUuid}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, brandUuid: val, senderUuid: "" }));
                    if (issues.brandUuid) setIssues((prev) => ({ ...prev, brandUuid: "" }));
                  }}
                >
                  <SelectTrigger aria-label="Brand" aria-invalid={hasSubmitted && Boolean(issues.brandUuid)}>
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
                {hasSubmitted && issues.brandUuid ? (
                  <p className="text-xs text-destructive mt-1">{issues.brandUuid}</p>
                ) : null}
              </WorkspaceFormField>

              {/* Verified Sender Selection */}
              <WorkspaceFormField label="Verified Sender" required>
                <Select
                  value={value.senderUuid}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, senderUuid: val }));
                    if (issues.senderUuid) setIssues((prev) => ({ ...prev, senderUuid: "" }));
                  }}
                  disabled={!value.brandUuid || (senders.data ?? []).length === 0}
                >
                  <SelectTrigger aria-label="Verified Sender" aria-invalid={hasSubmitted && Boolean(issues.senderUuid)}>
                    <SelectValue
                      placeholder={
                        !value.brandUuid
                          ? "Select a Brand first"
                          : (senders.data ?? []).length === 0
                          ? "No verified senders for brand"
                          : "Select Verified Sender"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(senders.data ?? []).map((s) => (
                      <SelectItem key={s.uuid} value={s.uuid}>
                        {s.name} ({s.email}) — {s.spfStatus}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasSubmitted && issues.senderUuid ? (
                  <p className="text-xs text-destructive mt-1">{issues.senderUuid}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Only senders with verified domain ownership are permitted.</p>
                )}
              </WorkspaceFormField>

              {/* Marketing Campaign Association (Optional) */}
              <WorkspaceFormField label="Marketing Campaign (Optional)">
                <Select
                  value={value.campaignUuid ?? ""}
                  onValueChange={(val) => setValue((prev) => ({ ...prev, campaignUuid: val || null }))}
                >
                  <SelectTrigger aria-label="Marketing Campaign">
                    <SelectValue placeholder="Select associated campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No associated campaign</SelectItem>
                    {(campaigns.data ?? [])
                      .filter((c) => !value.brandUuid || c.brandUuid === value.brandUuid)
                      .map((c) => (
                        <SelectItem key={c.uuid} value={c.uuid}>
                          {c.name} ({c.channel})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </WorkspaceFormField>

              {/* Subject Line */}
              <WorkspaceFormField label="Subject Line" required>
                <Input
                  aria-label="Subject Line"
                  placeholder="e.g. Exclusive Invitation from {{brand.name}}"
                  value={value.subject}
                  onChange={(e) => {
                    setValue((prev) => ({ ...prev, subject: e.target.value }));
                    if (issues.subject) setIssues((prev) => ({ ...prev, subject: "" }));
                  }}
                  aria-invalid={hasSubmitted && Boolean(issues.subject)}
                  className={hasSubmitted && issues.subject ? "border-destructive" : ""}
                />
                {hasSubmitted && issues.subject ? (
                  <p className="text-xs text-destructive mt-1">{issues.subject}</p>
                ) : null}
              </WorkspaceFormField>

              {/* Preheader Preview Text */}
              <WorkspaceFormField label="Preheader Preview Text">
                <Input
                  aria-label="Preheader Preview Text"
                  placeholder="e.g. Open to see your personalized offer..."
                  value={value.preheader ?? ""}
                  onChange={(e) => setValue((prev) => ({ ...prev, preheader: e.target.value }))}
                />
              </WorkspaceFormField>

              {/* Scheduled Dispatch Date/Time */}
              <WorkspaceFormField label="Scheduled Date & Time (Optional)">
                <Input
                  aria-label="Scheduled Date & Time"
                  type="datetime-local"
                  value={value.scheduledAt ?? ""}
                  onChange={(e) => setValue((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                />
              </WorkspaceFormField>
            </WorkspaceFormGrid>

            {/* Template Variables Helper Toolbar */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-medium text-muted-foreground">
                Click to insert supported personalization variables:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* HTML Body */}
            <WorkspaceFormField label="HTML Body Content" required>
              <Textarea
                aria-label="HTML Body Content"
                rows={8}
                placeholder="<p>Hello {{contact.name}},</p><p>Welcome to our promotion!</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>"
                value={value.bodyHtml}
                onChange={(e) => {
                  setValue((prev) => ({ ...prev, bodyHtml: e.target.value }));
                  if (issues.bodyHtml) setIssues((prev) => ({ ...prev, bodyHtml: "" }));
                }}
                className={`font-mono text-xs ${hasSubmitted && issues.bodyHtml ? "border-destructive" : ""}`}
                aria-invalid={hasSubmitted && Boolean(issues.bodyHtml)}
              />
              {hasSubmitted && issues.bodyHtml ? (
                <p className="text-xs text-destructive mt-1">{issues.bodyHtml}</p>
              ) : null}
            </WorkspaceFormField>

            {/* Plain Text Body */}
            <WorkspaceFormField label="Plain Text Fallback Content" required>
              <Textarea
                aria-label="Plain Text Fallback Content"
                rows={5}
                placeholder="Hello {{contact.name}},\n\nWelcome to our promotion!\n\nUnsubscribe: {{unsubscribe_url}}"
                value={value.bodyText}
                onChange={(e) => {
                  setValue((prev) => ({ ...prev, bodyText: e.target.value }));
                  if (issues.bodyText) setIssues((prev) => ({ ...prev, bodyText: "" }));
                }}
                className={`font-mono text-xs ${hasSubmitted && issues.bodyText ? "border-destructive" : ""}`}
                aria-invalid={hasSubmitted && Boolean(issues.bodyText)}
              />
              {hasSubmitted && issues.bodyText ? (
                <p className="text-xs text-destructive mt-1">{issues.bodyText}</p>
              ) : null}
            </WorkspaceFormField>
          </WorkspaceFormBody>

          <WorkspaceFormActions>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : record ? "Save Changes" : "Save Draft"}
            </Button>
          </WorkspaceFormActions>
        </WorkspaceFormSurface>
      </form>
    </WorkspaceUpsertPage>
  );
}
