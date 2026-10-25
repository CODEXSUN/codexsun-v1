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
import { qualificationSchema } from "./qualification.schema";
import { useQualificationLeadOptions } from "./qualification.hooks";
import type { QualificationInput, QualificationRecord, QualificationDecision } from "./qualification.types";

const decisionOptions: { value: QualificationDecision; label: string }[] = [
  { value: "qualified", label: "Qualified (Ready for Sales)" },
  { value: "disqualified", label: "Disqualified (Does Not Meet Criteria)" },
  { value: "deferred", label: "Deferred (Nurture / Follow-up Needed)" }
];

export function QualificationForm({
  record,
  initialLeadUuid,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: QualificationRecord | null;
  initialLeadUuid?: string | undefined;
  onCancel: () => void;
  onSubmit: (input: QualificationInput) => void;
  pending: boolean;
  error: string;
}) {
  const leads = useQualificationLeadOptions();

  const [value, setValue] = useState<QualificationInput>({
    leadUuid: record?.leadUuid ?? initialLeadUuid ?? "",
    decision: record?.decision ?? "qualified",
    criteria: record?.criteria ?? "BANT",
    reason: record?.reason ?? "",
    score: record?.score ?? 70,
    reviewer: record?.reviewer ?? "",
    notes: record?.notes ?? ""
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = qualificationSchema.safeParse(value);
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
      title={record ? "Edit Qualification" : "New Qualification"}
      description="Record structured qualification evaluation, decision criteria, review evidence, and reason."
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
                    <SelectValue placeholder="Select marketing lead" />
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

              <WorkspaceFormField label="Qualification decision" required>
                <Select
                  value={value.decision}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, decision: val as QualificationDecision }));
                    if (issues.decision) setIssues((prev) => ({ ...prev, decision: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Qualification decision"
                    aria-invalid={Boolean(issues.decision)}
                    className={issues.decision ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select decision" />
                  </SelectTrigger>
                  <SelectContent>
                    {decisionOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.decision ? (
                  <p className="text-xs text-destructive">{issues.decision}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Evaluation criteria" required>
                <Input
                  aria-label="Evaluation criteria"
                  value={value.criteria}
                  aria-invalid={Boolean(issues.criteria)}
                  className={issues.criteria ? "border-destructive" : ""}
                  placeholder="e.g. Budget, Authority, Need, Timeline (BANT)"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, criteria: event.target.value }));
                    if (issues.criteria) setIssues((prev) => ({ ...prev, criteria: "" }));
                  }}
                />
                {issues.criteria ? (
                  <p className="text-xs text-destructive">{issues.criteria}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Reviewer name" required>
                <Input
                  aria-label="Reviewer name"
                  value={value.reviewer}
                  aria-invalid={Boolean(issues.reviewer)}
                  className={issues.reviewer ? "border-destructive" : ""}
                  placeholder="e.g. Lead Reviewer or Specialist Name"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, reviewer: event.target.value }));
                    if (issues.reviewer) setIssues((prev) => ({ ...prev, reviewer: "" }));
                  }}
                />
                {issues.reviewer ? (
                  <p className="text-xs text-destructive">{issues.reviewer}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Qualification score (0–100)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  aria-label="Qualification score"
                  value={value.score ?? 0}
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, score: Number(event.target.value) || 0 }))
                  }
                />
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Qualification reasoning" required>
                  <Textarea
                    aria-label="Qualification reasoning"
                    value={value.reason}
                    aria-invalid={Boolean(issues.reason)}
                    className={issues.reason ? "border-destructive" : ""}
                    placeholder="Provide specific findings, business rationale, budget alignment, and decision justification..."
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
                    placeholder="Next steps, requirements, handover details..."
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
