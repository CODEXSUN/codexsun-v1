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
import { campaignSchema } from "./campaign.schema";
import { useCampaignBrandOptions } from "./campaign.hooks";
import type { CampaignInput, CampaignRecord } from "./campaign.types";

const channelOptions = [
  { value: "website", label: "Website" },
  { value: "email", label: "Email" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "google-ads", label: "Google Ads" },
  { value: "google-business", label: "Google Business" },
  { value: "youtube", label: "YouTube" },
  { value: "threads", label: "Threads" },
  { value: "pinterest", label: "Pinterest" },
  { value: "x", label: "X" },
  { value: "telegram", label: "Telegram" }
];

export function CampaignForm({
  record,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: CampaignRecord | null;
  onCancel: () => void;
  onSubmit: (input: CampaignInput) => void;
  pending: boolean;
  error: string;
}) {
  const brands = useCampaignBrandOptions();
  const [value, setValue] = useState<CampaignInput>({
    brandUuid: record?.brandUuid ?? "",
    name: record?.name ?? "",
    objective: record?.objective ?? "",
    channel: record?.channel ?? "website",
    landingUrl: record?.landingUrl ?? "",
    status: record?.status ?? "active"
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = campaignSchema.safeParse(value);
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
      title={record ? "Edit Campaign" : "New Campaign"}
      description="Configure campaign goals, acquisition channel, and tracking parameters."
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

              <WorkspaceFormField label="Campaign name" required>
                <Input
                  aria-label="Campaign name"
                  value={value.name}
                  aria-invalid={Boolean(issues.name)}
                  className={issues.name ? "border-destructive" : ""}
                  placeholder="e.g. Summer Outreach 2026"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, name: event.target.value }));
                    if (issues.name) setIssues((prev) => ({ ...prev, name: "" }));
                  }}
                />
                {issues.name ? <p className="text-xs text-destructive">{issues.name}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Channel" required>
                <Select
                  value={value.channel}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, channel: val }));
                    if (issues.channel) setIssues((prev) => ({ ...prev, channel: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Channel"
                    aria-invalid={Boolean(issues.channel)}
                    className={issues.channel ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.map((ch) => (
                      <SelectItem key={ch.value} value={ch.value}>
                        {ch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.channel ? (
                  <p className="text-xs text-destructive">{issues.channel}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Landing URL">
                <Input
                  aria-label="Landing URL"
                  value={value.landingUrl}
                  aria-invalid={Boolean(issues.landingUrl)}
                  className={issues.landingUrl ? "border-destructive" : ""}
                  placeholder="https://example.com/promo"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, landingUrl: event.target.value }));
                    if (issues.landingUrl) setIssues((prev) => ({ ...prev, landingUrl: "" }));
                  }}
                />
                {issues.landingUrl ? (
                  <p className="text-xs text-destructive">{issues.landingUrl}</p>
                ) : null}
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Objective" required>
                  <Textarea
                    aria-label="Objective"
                    value={value.objective}
                    aria-invalid={Boolean(issues.objective)}
                    className={issues.objective ? "border-destructive" : ""}
                    placeholder="Describe the campaign goal, target audience, and primary call to action..."
                    rows={3}
                    onChange={(event) => {
                      setValue((prev) => ({ ...prev, objective: event.target.value }));
                      if (issues.objective) setIssues((prev) => ({ ...prev, objective: "" }));
                    }}
                  />
                  {issues.objective ? (
                    <p className="text-xs text-destructive">{issues.objective}</p>
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
