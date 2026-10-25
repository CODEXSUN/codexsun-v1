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
import { followUpSchema } from "./follow-up.schema";
import { useFollowUpLeadOptions } from "./follow-up.hooks";
import type { FollowUpInput, FollowUpRecord, FollowUpStatus, FollowUpType } from "./follow-up.types";

const typeOptions: { value: FollowUpType; label: string }[] = [
  { value: "call", label: "Phone Call" },
  { value: "email", label: "Email Follow-up" },
  { value: "meeting", label: "Client Meeting / Demo" },
  { value: "review", label: "Requirement Review" }
];

const statusOptions: { value: FollowUpStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

export function FollowUpForm({
  record,
  initialLeadUuid,
  onCancel,
  onSubmit,
  pending,
  error
}: {
  record: FollowUpRecord | null;
  initialLeadUuid?: string | undefined;
  onCancel: () => void;
  onSubmit: (input: FollowUpInput) => void;
  pending: boolean;
  error: string;
}) {
  const leads = useFollowUpLeadOptions();

  const [value, setValue] = useState<FollowUpInput>({
    leadUuid: record?.leadUuid ?? initialLeadUuid ?? "",
    type: record?.type ?? "call",
    title: record?.title ?? "",
    scheduledAt: record?.scheduledAt ?? new Date().toISOString().slice(0, 16),
    dueAt: record?.dueAt ?? "",
    status: record?.status ?? "pending",
    assignedTo: record?.assignedTo ?? "",
    notes: record?.notes ?? "",
    completedAt: record?.completedAt ?? ""
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = followUpSchema.safeParse(value);
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
      title={record ? "Edit Follow-up Task" : "New Follow-up Task"}
      description="Schedule and track marketing follow-up activities, calls, emails, and meetings."
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

              <WorkspaceFormField label="Follow-up type" required>
                <Select
                  value={value.type}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, type: val as FollowUpType }));
                    if (issues.type) setIssues((prev) => ({ ...prev, type: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Follow-up type"
                    aria-invalid={Boolean(issues.type)}
                    className={issues.type ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issues.type ? (
                  <p className="text-xs text-destructive">{issues.type}</p>
                ) : null}
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Task title / Summary" required>
                  <Input
                    aria-label="Task title"
                    value={value.title}
                    aria-invalid={Boolean(issues.title)}
                    className={issues.title ? "border-destructive" : ""}
                    placeholder="e.g. Schedule discovery call to review software requirements"
                    onChange={(event) => {
                      setValue((prev) => ({ ...prev, title: event.target.value }));
                      if (issues.title) setIssues((prev) => ({ ...prev, title: "" }));
                    }}
                  />
                  {issues.title ? (
                    <p className="text-xs text-destructive">{issues.title}</p>
                  ) : null}
                </WorkspaceFormField>
              </div>

              <WorkspaceFormField label="Scheduled timestamp" required>
                <Input
                  type="datetime-local"
                  aria-label="Scheduled timestamp"
                  value={value.scheduledAt}
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

              <WorkspaceFormField label="Status" required>
                <Select
                  value={value.status}
                  onValueChange={(val) => {
                    setValue((prev) => ({ ...prev, status: val as FollowUpStatus }));
                    if (issues.status) setIssues((prev) => ({ ...prev, status: "" }));
                  }}
                >
                  <SelectTrigger
                    aria-label="Status"
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

              <WorkspaceFormField label="Due date / Deadline (optional)">
                <Input
                  type="datetime-local"
                  aria-label="Due date"
                  value={value.dueAt ?? ""}
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, dueAt: event.target.value }))
                  }
                />
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Notes / Agenda">
                  <Textarea
                    aria-label="Notes / Agenda"
                    value={value.notes ?? ""}
                    placeholder="Meeting link, call questions, talking points, or follow-up outcomes..."
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
