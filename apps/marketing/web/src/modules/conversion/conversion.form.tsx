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
import { conversionSchema } from "./conversion.schema";
import { useConversionLeadOptions } from "./conversion.hooks";
import type { ConversionInput, ConversionRecord, ConversionStatus } from "./conversion.types";

const statusOptions: { value: ConversionStatus; label: string }[] = [
  { value: "converted", label: "Converted (Won/Accepted)" },
  { value: "cancelled", label: "Cancelled" },
  { value: "reversed", label: "Reversed" }
];

export function ConversionForm({
  record,
  initialLeadUuid,
  initialQualificationUuid,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: ConversionRecord | null;
  initialLeadUuid?: string | undefined;
  initialQualificationUuid?: string | undefined;
  onCancel: () => void;
  onSubmit: (input: ConversionInput) => void;
  pending: boolean;
  error: string;
}) {
  const leads = useConversionLeadOptions();

  const [value, setValue] = useState<ConversionInput>({
    leadUuid: record?.leadUuid ?? initialLeadUuid ?? "",
    qualificationUuid: record?.qualificationUuid ?? initialQualificationUuid ?? "",
    status: record?.status ?? "converted",
    declaredValue: record?.declaredValue ?? 0,
    currency: record?.currency ?? "INR",
    cancellationReason: record?.cancellationReason ?? "",
    convertedBy: record?.convertedBy ?? "",
    convertedAt: record?.convertedAt ?? new Date().toISOString(),
    notes: record?.notes ?? ""
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = conversionSchema.safeParse(value);
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
  const needsCancellationReason = value.status === "cancelled" || value.status === "reversed";

  return (
    <WorkspaceUpsertPage
      title={record ? "Edit Sales Conversion" : "New Sales Conversion"}
      description="Record conversion of a qualified marketing lead to a declared business value."
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
                    <SelectValue placeholder="Select qualified lead" />
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

              <WorkspaceFormField label="Conversion status" required>
                <Select
                  value={value.status}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, status: val as ConversionStatus }));
                    if (issues.status) setIssues((prev) => ({ ...prev, status: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Conversion status"
                    aria-invalid={Boolean(issues.status)}
                    className={issues.status ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select status" />
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

              <WorkspaceFormField label="Declared value" required>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  aria-label="Declared value"
                  value={value.declaredValue}
                  aria-invalid={Boolean(issues.declaredValue)}
                  className={issues.declaredValue ? "border-destructive" : ""}
                  placeholder="e.g. 50000"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, declaredValue: Number(event.target.value) || 0 }));
                    if (issues.declaredValue) setIssues((prev) => ({ ...prev, declaredValue: "" }));
                  }}
                />
                {issues.declaredValue ? (
                  <p className="text-xs text-destructive">{issues.declaredValue}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Currency" required>
                <Input
                  aria-label="Currency"
                  value={value.currency}
                  aria-invalid={Boolean(issues.currency)}
                  className={issues.currency ? "border-destructive" : ""}
                  placeholder="INR"
                  maxLength={3}
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }));
                    if (issues.currency) setIssues((prev) => ({ ...prev, currency: "" }));
                  }}
                />
                {issues.currency ? (
                  <p className="text-xs text-destructive">{issues.currency}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Converted by" required>
                <Input
                  aria-label="Converted by"
                  value={value.convertedBy}
                  aria-invalid={Boolean(issues.convertedBy)}
                  className={issues.convertedBy ? "border-destructive" : ""}
                  placeholder="e.g. Sales Specialist or account owner"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, convertedBy: event.target.value }));
                    if (issues.convertedBy) setIssues((prev) => ({ ...prev, convertedBy: "" }));
                  }}
                />
                {issues.convertedBy ? (
                  <p className="text-xs text-destructive">{issues.convertedBy}</p>
                ) : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Conversion timestamp">
                <Input
                  aria-label="Conversion timestamp"
                  value={value.convertedAt}
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, convertedAt: event.target.value }))
                  }
                />
              </WorkspaceFormField>

              {needsCancellationReason ? (
                <div className="md:col-span-2">
                  <WorkspaceFormField label="Cancellation / Reversal reason" required>
                    <Textarea
                      aria-label="Cancellation / Reversal reason"
                      value={value.cancellationReason ?? ""}
                      aria-invalid={Boolean(issues.cancellationReason)}
                      className={issues.cancellationReason ? "border-destructive" : ""}
                      placeholder="Explain why the conversion was cancelled or reversed..."
                      rows={3}
                      onChange={(event) => {
                        setValue((prev) => ({ ...prev, cancellationReason: event.target.value }));
                        if (issues.cancellationReason) setIssues((prev) => ({ ...prev, cancellationReason: "" }));
                      }}
                    />
                    {issues.cancellationReason ? (
                      <p className="text-xs text-destructive">{issues.cancellationReason}</p>
                    ) : null}
                  </WorkspaceFormField>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <WorkspaceFormField label="Notes">
                  <Textarea
                    aria-label="Notes"
                    value={value.notes ?? ""}
                    placeholder="Contract notes, scope summary, or deal context..."
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
