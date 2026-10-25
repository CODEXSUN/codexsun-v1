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
import { leadSchema } from "./lead.schema";
import { useLeadBrandOptions, useLeadCampaignOptions } from "./lead.hooks";
import type { LeadInput, LeadRecord, LeadStatus } from "./lead.types";

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
  { value: "deferred", label: "Deferred" }
];

const sourceOptions = [
  { value: "website", label: "Website Form" },
  { value: "campaign", label: "Marketing Campaign" },
  { value: "organic", label: "Organic Search" },
  { value: "referral", label: "Referral" },
  { value: "social", label: "Social Media" },
  { value: "import", label: "Import" },
  { value: "event", label: "Event / Webinar" }
];

export function LeadForm({
  record,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: LeadRecord | null;
  onCancel: () => void;
  onSubmit: (input: LeadInput) => void;
  pending: boolean;
  error: string;
}) {
  const brands = useLeadBrandOptions();
  const campaigns = useLeadCampaignOptions();

  const [value, setValue] = useState<LeadInput>({
    brandUuid: record?.brandUuid ?? "",
    campaignUuid: record?.campaignUuid ?? "",
    name: record?.name ?? "",
    email: record?.email ?? "",
    phone: record?.phone ?? "",
    companyName: record?.companyName ?? "",
    status: record?.status ?? "new",
    score: record?.score ?? 0,
    source: record?.source ?? "website",
    assignedTo: record?.assignedTo ?? "",
    notes: record?.notes ?? ""
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = leadSchema.safeParse(value);
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
      title={record ? "Edit Marketing Lead" : "New Marketing Lead"}
      description="Manage lead contact details, source attribution, qualification readiness, and assignment."
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
              <WorkspaceFormField label="Contact name" required>
                <Input
                  aria-label="Contact name"
                  value={value.name}
                  aria-invalid={Boolean(issues.name)}
                  className={issues.name ? "border-destructive" : ""}
                  placeholder="e.g. John Doe"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, name: event.target.value }));
                    if (issues.name) setIssues((prev) => ({ ...prev, name: "" }));
                  }}
                />
                {issues.name ? <p className="text-xs text-destructive">{issues.name}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Company name">
                <Input
                  aria-label="Company name"
                  value={value.companyName ?? ""}
                  placeholder="e.g. Acme Industries"
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, companyName: event.target.value }))
                  }
                />
              </WorkspaceFormField>

              <WorkspaceFormField label="Email address">
                <Input
                  type="email"
                  aria-label="Email address"
                  value={value.email}
                  aria-invalid={Boolean(issues.email)}
                  className={issues.email ? "border-destructive" : ""}
                  placeholder="john@example.com"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, email: event.target.value }));
                    if (issues.email) setIssues((prev) => ({ ...prev, email: "" }));
                  }}
                />
                {issues.email ? <p className="text-xs text-destructive">{issues.email}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Phone number">
                <Input
                  type="tel"
                  aria-label="Phone number"
                  value={value.phone}
                  aria-invalid={Boolean(issues.phone)}
                  className={issues.phone ? "border-destructive" : ""}
                  placeholder="+91 9876543210"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, phone: event.target.value }));
                    if (issues.phone) setIssues((prev) => ({ ...prev, phone: "" }));
                  }}
                />
                {issues.phone ? <p className="text-xs text-destructive">{issues.phone}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Source" required>
                <Select
                  value={value.source}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, source: val }));
                    if (issues.source) setIssues((prev) => ({ ...prev, source: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Source"
                    aria-invalid={Boolean(issues.source)}
                    className={issues.source ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select acquisition source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.source ? <p className="text-xs text-destructive">{issues.source}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Lifecycle status" required>
                <Select
                  value={value.status}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, status: val as LeadStatus }));
                    if (issues.status) setIssues((prev) => ({ ...prev, status: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Lifecycle status"
                    aria-invalid={Boolean(issues.status)}
                    className={issues.status ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((st) => (
                      <SelectItem key={st.value} value={st.value}>
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.status ? <p className="text-xs text-destructive">{issues.status}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Lead score (0–100)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  aria-label="Lead score"
                  value={value.score ?? 0}
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, score: Number(event.target.value) || 0 }))
                  }
                />
              </WorkspaceFormField>

              <WorkspaceFormField label="Assigned to">
                <Input
                  aria-label="Assigned to"
                  value={value.assignedTo ?? ""}
                  placeholder="e.g. Sales Specialist or team email"
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, assignedTo: event.target.value }))
                  }
                />
              </WorkspaceFormField>

              <WorkspaceFormField label="Brand">
                <Select
                  value={value.brandUuid ?? ""}
                  onValueChange={(val) => setValue((prev) => ({ ...prev, brandUuid: val }))}
                >
                  <SelectTrigger aria-label="Brand">
                    <SelectValue placeholder="Select Brand (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(brands.data ?? []).map((b) => (
                      <SelectItem key={b.uuid} value={b.uuid}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </WorkspaceFormField>

              <WorkspaceFormField label="Campaign">
                <Select
                  value={value.campaignUuid ?? ""}
                  onValueChange={(val) => setValue((prev) => ({ ...prev, campaignUuid: val }))}
                >
                  <SelectTrigger aria-label="Campaign">
                    <SelectValue placeholder="Select Campaign (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(campaigns.data ?? []).map((c) => (
                      <SelectItem key={c.uuid} value={c.uuid}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Internal notes">
                  <Textarea
                    aria-label="Internal notes"
                    value={value.notes ?? ""}
                    placeholder="Context, background, requirement notes, or qualification findings..."
                    rows={3}
                    onChange={(event) =>
                      setValue((prev) => ({ ...prev, notes: event.target.value }))
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
