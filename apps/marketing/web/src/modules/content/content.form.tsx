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
import { contentSchema } from "./content.schema";
import { useContentBrandOptions, useContentCampaignOptions } from "./content.hooks";
import type {
  ContentChannel,
  ContentInput,
  ContentPublishMode,
  ContentRecord
} from "./content.types";

const channelOptions: { value: ContentChannel; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "threads", label: "Threads" },
  { value: "pinterest", label: "Pinterest" },
  { value: "youtube", label: "YouTube" },
  { value: "google-business", label: "Google Business" },
  { value: "telegram", label: "Telegram" },
  { value: "website", label: "Website" },
  { value: "email", label: "Email" }
];

const publishModeOptions: { value: ContentPublishMode; label: string }[] = [
  { value: "api", label: "API Publishing (Automated)" },
  { value: "manual", label: "Manual Publishing (Native Fallback)" }
];

export function ContentForm({
  record,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: ContentRecord | null;
  onCancel: () => void;
  onSubmit: (input: ContentInput) => void;
  pending: boolean;
  error: string;
}) {
  const brands = useContentBrandOptions();
  const campaigns = useContentCampaignOptions();

  const initialValue: ContentInput = useMemo(
    () => ({
      brandUuid: record?.brandUuid ?? "",
      campaignUuid: record?.campaignUuid ?? "",
      title: record?.title ?? "",
      channel: record?.channel ?? "facebook",
      publishMode: record?.publishMode ?? "api",
      body: record?.body ?? "",
      mediaUrl: record?.mediaUrl ?? "",
      scheduledAt: record?.scheduledAt ? record.scheduledAt.slice(0, 16) : ""
    }),
    [record]
  );

  const [value, setValue] = useState<ContentInput>(initialValue);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const isDirty = useMemo(() => {
    return (
      value.brandUuid !== initialValue.brandUuid ||
      value.campaignUuid !== initialValue.campaignUuid ||
      value.title !== initialValue.title ||
      value.channel !== initialValue.channel ||
      value.publishMode !== initialValue.publishMode ||
      value.body !== initialValue.body ||
      value.mediaUrl !== initialValue.mediaUrl ||
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

  const filteredCampaigns = useMemo(() => {
    const list = campaigns.data ?? [];
    if (!value.brandUuid) return list;
    return list.filter((c) => !c.brandUuid || c.brandUuid === value.brandUuid);
  }, [campaigns.data, value.brandUuid]);

  const handleCancel = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Are you sure you want to discard them?"
      );
      if (!confirmDiscard) return;
    }
    onCancel();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = contentSchema.safeParse(value);
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
      ...result.data,
      scheduledAt: result.data.scheduledAt || null
    });
  };

  const hasErrors = hasSubmitted && (Boolean(error) || Object.keys(issues).length > 0);

  return (
    <WorkspaceUpsertPage
      title={record ? "Edit Content" : "New Content"}
      description="Create or edit marketing social posts, channel copy, media assets, and publishing schedules."
      onBack={handleCancel}
    >
      <form noValidate onSubmit={handleSubmit}>
        <WorkspaceFormSurface>
          <WorkspaceFormBody>
            {hasErrors ? (
              <WorkspaceFormBanner title="Unable to save content" tone="error">
                {error || "Check the required fields below and correct errors before saving."}
              </WorkspaceFormBanner>
            ) : null}

            <WorkspaceFormGrid columns={2}>
              <div className="md:col-span-2">
                <WorkspaceFormField label="Content Title" required>
                  <Input
                    aria-label="Content Title"
                    value={value.title}
                    aria-invalid={Boolean(issues.title)}
                    className={issues.title ? "border-destructive" : ""}
                    placeholder="e.g. Q4 Product Launch Announcement"
                    onChange={(event) => {
                      setValue((prev) => ({ ...prev, title: event.target.value }));
                      if (issues.title) setIssues((prev) => ({ ...prev, title: "" }));
                    }}
                  />
                  {issues.title ? <p className="text-xs text-destructive">{issues.title}</p> : null}
                </WorkspaceFormField>
              </div>

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

              <WorkspaceFormField label="Campaign (Optional)">
                <Select
                  value={value.campaignUuid || "none"}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, campaignUuid: val === "none" ? "" : val }));
                  }}
                >
                  <SelectTrigger aria-label="Campaign">
                    <SelectValue placeholder="Select Campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No associated campaign</SelectItem>
                    {filteredCampaigns.map((c) => (
                      <SelectItem key={c.uuid} value={c.uuid}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </WorkspaceFormField>

              <WorkspaceFormField label="Marketing Channel" required>
                <Select
                  value={value.channel}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, channel: val as ContentChannel }));
                    if (issues.channel) setIssues((prev) => ({ ...prev, channel: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Marketing Channel"
                    aria-invalid={Boolean(issues.channel)}
                    className={issues.channel ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.channel ? (
                  <p className="text-xs text-destructive">{issues.channel}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Publishing Mode" required>
                <Select
                  value={value.publishMode}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, publishMode: val as ContentPublishMode }));
                    if (issues.publishMode) setIssues((prev) => ({ ...prev, publishMode: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Publishing Mode"
                    aria-invalid={Boolean(issues.publishMode)}
                    className={issues.publishMode ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select Publish Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {publishModeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.publishMode ? (
                  <p className="text-xs text-destructive">{issues.publishMode}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Media URL (Optional)">
                <Input
                  aria-label="Media URL"
                  type="url"
                  value={value.mediaUrl ?? ""}
                  aria-invalid={Boolean(issues.mediaUrl)}
                  className={issues.mediaUrl ? "border-destructive" : ""}
                  placeholder="https://example.com/assets/banner.png"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, mediaUrl: event.target.value }));
                    if (issues.mediaUrl) setIssues((prev) => ({ ...prev, mediaUrl: "" }));
                  }}
                />
                {issues.mediaUrl ? (
                  <p className="text-xs text-destructive">{issues.mediaUrl}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Scheduled Date & Time (Optional)">
                <Input
                  aria-label="Scheduled Date & Time"
                  type="datetime-local"
                  value={value.scheduledAt ?? ""}
                  aria-invalid={Boolean(issues.scheduledAt)}
                  className={issues.scheduledAt ? "border-destructive" : ""}
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, scheduledAt: event.target.value }));
                    if (issues.scheduledAt) setIssues((prev) => ({ ...prev, scheduledAt: "" }));
                  }}
                />
                {issues.scheduledAt ? (
                  <p className="text-xs text-destructive">{issues.scheduledAt}</p>
                ) : null}
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Content Body / Caption" required>
                  <Textarea
                    aria-label="Content Body / Caption"
                    value={value.body}
                    aria-invalid={Boolean(issues.body)}
                    className={issues.body ? "border-destructive" : ""}
                    placeholder="Write the full post caption, hashtags, and call to action..."
                    rows={6}
                    onChange={(event) => {
                      setValue((prev) => ({ ...prev, body: event.target.value }));
                      if (issues.body) setIssues((prev) => ({ ...prev, body: "" }));
                    }}
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {issues.body ? (
                        <span className="text-destructive">{issues.body}</span>
                      ) : (
                        "Max 5,000 characters."
                      )}
                    </span>
                    <span className={value.body.length > 5000 ? "text-destructive font-semibold" : ""}>
                      {value.body.length} / 5,000 characters
                    </span>
                  </div>
                </WorkspaceFormField>
              </div>
            </WorkspaceFormGrid>
          </WorkspaceFormBody>

          <WorkspaceFormActions>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : record ? "Update Content" : "Save Draft"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={pending}>
              Cancel
            </Button>
          </WorkspaceFormActions>
        </WorkspaceFormSurface>
      </form>
    </WorkspaceUpsertPage>
  );
}
