import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
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
import { brandSchema } from "./brand.schema";
import type { BrandInput, BrandRecord } from "./brand.types";

export function BrandForm({
  record,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: BrandRecord | null;
  onCancel: () => void;
  onSubmit: (input: BrandInput) => void;
  pending: boolean;
  error: string;
}) {
  const [value, setValue] = useState<BrandInput>({
    name: record?.name ?? "",
    timezone: record?.timezone ?? "Asia/Kolkata",
    website: record?.website ?? "",
    status: record?.status ?? "active"
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = brandSchema.safeParse(value);
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
      title={record ? "Edit Brand" : "New Brand"}
      description="Manage brand details, timezone, and online presence."
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
              <WorkspaceFormField label="Brand name" required>
                <Input
                  aria-label="Brand name"
                  value={value.name}
                  aria-invalid={Boolean(issues.name)}
                  className={issues.name ? "border-destructive" : ""}
                  placeholder="e.g. Acme Corp"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, name: event.target.value }));
                    if (issues.name) setIssues((prev) => ({ ...prev, name: "" }));
                  }}
                />
                {issues.name ? <p className="text-xs text-destructive">{issues.name}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Timezone" required>
                <Input
                  aria-label="Timezone"
                  value={value.timezone}
                  aria-invalid={Boolean(issues.timezone)}
                  className={issues.timezone ? "border-destructive" : ""}
                  placeholder="e.g. Asia/Kolkata or UTC"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, timezone: event.target.value }));
                    if (issues.timezone) setIssues((prev) => ({ ...prev, timezone: "" }));
                  }}
                />
                {issues.timezone ? (
                  <p className="text-xs text-destructive">{issues.timezone}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Website URL">
                <Input
                  aria-label="Website URL"
                  value={value.website}
                  aria-invalid={Boolean(issues.website)}
                  className={issues.website ? "border-destructive" : ""}
                  placeholder="https://example.com"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, website: event.target.value }));
                    if (issues.website) setIssues((prev) => ({ ...prev, website: "" }));
                  }}
                />
                {issues.website ? (
                  <p className="text-xs text-destructive">{issues.website}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Status">
                <WorkspaceSwitchCard
                  fieldLabel="Status"
                  checked={value.status === "active"}
                  onCheckedChange={(checked) =>
                    setValue((prev) => ({ ...prev, status: checked ? "active" : "inactive" }))
                  }
                />
              </WorkspaceFormField>
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
