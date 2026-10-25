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
import { WorkspaceSwitchCard } from "@codexsun/ui/workspace/status";
import { connectionSchema } from "./connection.schema";
import { useConnectionBrandOptions } from "./connection.hooks";
import type { ConnectionInput, ConnectionRecord } from "./connection.types";

const providerOptions = [
  { value: "google", label: "Google / YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email Transport" },
  { value: "threads", label: "Threads" },
  { value: "pinterest", label: "Pinterest" },
  { value: "x", label: "X" },
  { value: "telegram", label: "Telegram" }
];

export function ConnectionForm({
  record,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: ConnectionRecord | null;
  onCancel: () => void;
  onSubmit: (input: ConnectionInput) => void;
  pending: boolean;
  error: string;
}) {
  const brands = useConnectionBrandOptions();
  const [value, setValue] = useState<ConnectionInput>({
    brandUuid: record?.brandUuid ?? "",
    name: record?.name ?? "",
    provider: record?.provider ?? "google",
    externalAccountId: record?.externalAccountId ?? "",
    status: record?.status ?? "active"
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = connectionSchema.safeParse(value);
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
      title={record ? "Edit Connection" : "New Connection"}
      description="Connect third-party marketing channels, social accounts, and advertising credentials."
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

              <WorkspaceFormField label="Connection name" required>
                <Input
                  aria-label="Connection name"
                  value={value.name}
                  aria-invalid={Boolean(issues.name)}
                  className={issues.name ? "border-destructive" : ""}
                  placeholder="e.g. Brand YouTube Channel"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, name: event.target.value }));
                    if (issues.name) setIssues((prev) => ({ ...prev, name: "" }));
                  }}
                />
                {issues.name ? <p className="text-xs text-destructive">{issues.name}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Provider" required>
                <Select
                  value={value.provider}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, provider: val }));
                    if (issues.provider) setIssues((prev) => ({ ...prev, provider: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Provider"
                    aria-invalid={Boolean(issues.provider)}
                    className={issues.provider ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.provider ? (
                  <p className="text-xs text-destructive">{issues.provider}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="External account ID">
                <Input
                  aria-label="External account ID"
                  value={value.externalAccountId}
                  placeholder="e.g. UCxxxxxx or act_12345"
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, externalAccountId: event.target.value }))
                  }
                />
              </WorkspaceFormField>

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
