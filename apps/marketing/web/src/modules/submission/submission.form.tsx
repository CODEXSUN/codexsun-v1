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
import { submissionSchema } from "./submission.schema";
import { useCaptureOptions } from "./submission.hooks";
import type { SubmissionInput } from "./submission.types";

export function SubmissionForm({
  onCancel,
  onSubmit,
  pending,
  error
}: {
  onCancel: () => void;
  onSubmit: (input: SubmissionInput) => void;
  pending: boolean;
  error: string;
}) {
  const captures = useCaptureOptions();
  const [value, setValue] = useState<SubmissionInput>({
    captureUuid: "",
    sourceKey: crypto.randomUUID(),
    name: "",
    email: "",
    phone: "",
    message: "",
    privacyConsent: true,
    sourceReference: "",
    sourceConsentAt: new Date().toISOString(),
    sourceNoticeVersion: "v1"
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const selectedCapture = (captures.data ?? []).find((c) => c.uuid === value.captureUuid);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const result = submissionSchema.safeParse(value);
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
      title="New Submission"
      description="Record an inbound enquiry or lead submission linked to a verified capture form."
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
              <div className="md:col-span-2">
                <WorkspaceFormField label="Capture form" required>
                  <Select
                    value={value.captureUuid}
                    onValueChange={(val) => {
                      const c = (captures.data ?? []).find((item) => item.uuid === val);
                      setValue((prev) => ({
                        ...prev,
                        captureUuid: val,
                        sourceNoticeVersion: c?.noticeVersion || "v1"
                      }));
                      if (issues.captureUuid) setIssues((prev) => ({ ...prev, captureUuid: "" }));
                    }}
                  >
                    <SelectTrigger
                      aria-label="Capture form"
                      aria-invalid={Boolean(issues.captureUuid)}
                      className={issues.captureUuid ? "border-destructive" : ""}
                    >
                      <SelectValue placeholder="Select capture form" />
                    </SelectTrigger>
                    <SelectContent>
                      {(captures.data ?? []).map((c) => (
                        <SelectItem key={c.uuid} value={c.uuid}>
                          {c.name} ({c.noticeVersion})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {issues.captureUuid ? (
                    <p className="text-xs text-destructive">{issues.captureUuid}</p>
                  ) : null}
                  {selectedCapture ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Notice: {selectedCapture.consentNotice.slice(0, 120)}…
                    </p>
                  ) : null}
                </WorkspaceFormField>
              </div>

              <WorkspaceFormField label="Contact name" required>
                <Input
                  aria-label="Contact name"
                  value={value.name}
                  aria-invalid={Boolean(issues.name)}
                  className={issues.name ? "border-destructive" : ""}
                  placeholder="e.g. Jane Doe"
                  onChange={(event) => {
                    setValue((prev) => ({ ...prev, name: event.target.value }));
                    if (issues.name) setIssues((prev) => ({ ...prev, name: "" }));
                  }}
                />
                {issues.name ? <p className="text-xs text-destructive">{issues.name}</p> : null}
              </WorkspaceFormField>

              <WorkspaceFormField label="Email address">
                <Input
                  type="email"
                  aria-label="Email address"
                  value={value.email}
                  aria-invalid={Boolean(issues.email)}
                  className={issues.email ? "border-destructive" : ""}
                  placeholder="jane@example.com"
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

              <WorkspaceFormField label="Source reference">
                <Input
                  aria-label="Source reference"
                  value={value.sourceReference ?? ""}
                  placeholder="e.g. landing-page-header"
                  onChange={(event) =>
                    setValue((prev) => ({ ...prev, sourceReference: event.target.value }))
                  }
                />
              </WorkspaceFormField>

              <div className="md:col-span-2">
                <WorkspaceFormField label="Message or enquiry notes">
                  <Textarea
                    aria-label="Message or enquiry notes"
                    value={value.message}
                    placeholder="Inquiry message content..."
                    rows={3}
                    onChange={(event) =>
                      setValue((prev) => ({ ...prev, message: event.target.value }))
                    }
                  />
                </WorkspaceFormField>
              </div>

              <div className="md:col-span-2">
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Privacy notice acknowledgement</p>
                  <p className="mt-0.5">
                    Recording this submission confirms user consent to the enquiry privacy notice.
                    Promotional subscription is not granted by standard enquiry submission.
                  </p>
                </div>
              </div>
            </WorkspaceFormGrid>
          </WorkspaceFormBody>

          <WorkspaceFormActions>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save submission"}
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
