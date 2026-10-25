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
import { outcomeSchema } from "./outcome.schema";
import { useOutcomeLeadOptions } from "./outcome.hooks";
import type { OutcomeInput, OutcomeRecord, OutcomeStatus } from "./outcome.types";

const statusOptions: { value: OutcomeStatus; label: string }[] = [
  { value: "won", label: "Won (Customer Acquired)" },
  { value: "lost", label: "Lost (Competition / Not Selected)" },
  { value: "nurture", label: "Nurture (Future Opportunity)" },
  { value: "unresponsive", label: "Unresponsive (No Contact Response)" },
  { value: "withdrawn", label: "Withdrawn (Cancelled Requirement)" }
];

export function OutcomeForm({
  record,
  initialLeadUuid,
  initialConversionUuid,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: OutcomeRecord | null;
  initialLeadUuid?: string | undefined;
  initialConversionUuid?: string | undefined;
  onCancel: () => void;
  onSubmit: (input: OutcomeInput) => void;
  pending: boolean;
  error: string;
}) {
  const leads = useOutcomeLeadOptions();

  const [value, setValue] = useState<OutcomeInput>({
    leadUuid: record?.leadUuid ?? initialLeadUuid ?? "",
    conversionUuid: record?.conversionUuid ?? initialConversionUuid ?? "",
    status: record?.status ?? "won",
    reason: record?.reason ?? "",
    declaredValue: record?.declaredValue ?? 0,
    currency: record?.currency ?? "INR",
    effectiveDate: record?.effectiveDate ?? new Date().toISOString().slice(0, 10),
    previousOutcomeUuid: record?.previousOutcomeUuid ?? "",
    notes: record?.notes ?? ""
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = outcomeSchema.safeParse(value);
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
      title={record ? "Edit Terminal Outcome" : "Record Terminal Outcome"}
      description="Record definitive terminal outcome disposition (won, lost, nurture, unresponsive, withdrawn)."
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
              <WorkspaceFormField label="Marketing lead" required>
                <Select
                  value={value.leadUuid}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, leadUuid: val }));
                    if (issues.leadUuid) setIssues((prev) => ({ ...prev, leadUuid: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Marketing lead"
                    aria-invalid={Boolean(issues.leadUuid)}
                    className={issues.leadUuid ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {(leads.data ?? []).map((l) => (
                      <SelectItem key={l.uuid} value={l.uuid}>
                        {l.name} {l.companyName ? `(${l.companyName})` : ""} - #{l.uuid.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.leadUuid ? (
                  <p className="text-xs text-destructive">{issues.leadUuid}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Outcome disposition" required>
                <Select
                  value={value.status}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, status: val as OutcomeStatus }));
                    if (issues.status) setIssues((prev) => ({ ...prev, status: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Outcome disposition"
                    aria-invalid={Boolean(issues.status)}
                    className={issues.status ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select outcome disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.status ? (
                  <p className="text-xs text-destructive">{issues.status}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Effective date" required>
                <Input
                  type="date"
                  aria-label="Effective date"
                  value={value.effectiveDate}
                  aria-invalid={Boolean(issues.effectiveDate)}
                  className={issues.effectiveDate ? "border-destructive" : ""}
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, effectiveDate: event.target.value }));
                    if (issues.effectiveDate) setIssues((prev) => ({ ...prev, effectiveDate: "" }));
                  }}
                />
                {issues.effectiveDate ? (
                  <p className="text-xs text-destructive">{issues.effectiveDate}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Declared value">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  aria-label="Declared value"
                  value={value.declaredValue ?? 0}
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, declaredValue: Number(event.target.value) || 0 }))
                  }
                />
              </WorkspaceFormField>

              <WorkspaceFormField label="Currency">
                <Input
                  aria-label="Currency"
                  value={value.currency ?? "INR"}
                  maxLength={3}
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                  }
                />
              </WorkspaceFormField>

              <WorkspaceFormField label="Previous outcome reference (if reopening/correcting)">
                <Input
                  aria-label="Previous outcome reference"
                  value={value.previousOutcomeUuid ?? ""}
                  placeholder="e.g. outcome UUID being superseded"
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, previousOutcomeUuid: event.target.value }))
                  }
                />
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Reasoning and disposition explanation" required>
                  <Textarea
                    aria-label="Reasoning and disposition explanation"
                    value={value.reason}
                    aria-invalid={Boolean(issues.reason)}
                    className={issues.reason ? "border-destructive" : ""}
                    placeholder="Describe why this outcome was reached, contract terms or lost factors..."
                    rows={3}
                    onChange={(event) => {
                      setValue((prev) => ({ ...prev, reason: event.target.value }));
                      if (issues.reason) setIssues((prev) => ({ ...prev, reason: "" }));
                    }}
                  />
                  {issues.reason ? (
                    <p className="text-xs text-destructive">{issues.reason}</p>
                  ) : null}
                </WorkspaceFormField>
              </div>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Additional notes">
                  <Textarea
                    aria-label="Additional notes"
                    value={value.notes ?? ""}
                    placeholder="Archival notes, post-mortem observations, or future nurture schedule..."
                    rows={2}
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
