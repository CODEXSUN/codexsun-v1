import { WorkspaceHeaderActions } from "@codexsun/ui/workspace/navigation";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
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
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import {
  WorkspaceUpsertPage,
  WorkspaceFormSurface,
  WorkspaceFormBody,
  WorkspaceFormField,
  WorkspaceFormBanner,
  WorkspaceFormActions
} from "@codexsun/ui/workspace/upsert";
import { useLeadContacts, useLeadCampaigns } from "./lead.hooks";
import { leadSchema } from "./lead.schema";
import { leadStatusLabels, type LeadInput, type LeadRecord } from "./lead.types";

export function LeadForm({
  record,
  saving,
  error,
  onBack,
  onSubmit
}: {
  record: LeadRecord | null;
  saving: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (input: LeadInput) => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s" || event.altKey)
        return;
      event.preventDefault();
      if (!saving && !event.repeat) formRef.current?.requestSubmit();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [saving]);
  const [value, setValue] = useState<LeadInput>(() => ({
    name: record?.name ?? "",
    phone: record?.phone ?? "",
    email: record?.email ?? "",
    message: record?.message ?? "",
    campaignLabel: record?.campaignLabel ?? "",
    contactId: record?.contactId ?? null,
    status: record?.status === "qualified" || record?.status === "lost" ? record.status : "review",
    ...(record ? { revision: record.revision } : {})
  }));
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [campaignSearch, setCampaignSearch] = useState("");
  const campaigns = useLeadCampaigns(useDeferredValue(campaignSearch));
  const [search, setSearch] = useState("");
  const contacts = useLeadContacts(useDeferredValue(search));
  const options = (contacts.data ?? []).map((contact) => ({
    value: String(contact.id),
    label: contact.name,
    description: contact.primaryPhone ?? ""
  }));
  if (value.contactId && !options.some((option) => option.value === String(value.contactId)))
    options.unshift({
      value: String(value.contactId),
      label: value.name,
      description: value.phone
    });
  const textField = (
    key: "name" | "phone" | "email" | "campaignLabel",
    label: string,
    required = false
  ) => (
    <WorkspaceFormField label={label} required={required}>
      <Input
        aria-label={label}
        aria-invalid={Boolean(issues[key])}
        value={value[key]}
        disabled={saving}
        {...(key === "phone" ? { inputMode: "tel" as const, maxLength: 10 } : {})}
        onChange={(event) =>
          setValue((current) => ({
            ...current,
            [key]: event.target.value,
            ...(key === "name" ? { contactId: null } : {})
          }))
        }
      />
      {issues[key] ? <p className="text-xs text-destructive">{issues[key]}</p> : null}
    </WorkspaceFormField>
  );
  return (
    <WorkspaceUpsertPage title="">
      <WorkspaceHeaderActions>
        <Button
          type="submit"
          form={formId}
          size="sm"
          className="h-7 px-3"
          disabled={saving}
          aria-keyshortcuts="Control+S Meta+S"
        >
          {saving ? "Saving…" : "Save lead"}
          <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
            Ctrl S
          </kbd>
        </Button>
      </WorkspaceHeaderActions>
      <form
        id={formId}
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (saving) return;
          const result = leadSchema.safeParse(value);
          if (!result.success) {
            setIssues(
              Object.fromEntries(
                result.error.issues.map((issue) => [String(issue.path[0]), issue.message])
              )
            );
            return;
          }
          setIssues({});
          onSubmit(result.data);
        }}
      >
        <WorkspaceFormSurface>
          <WorkspaceFormBody>
            {error || Object.keys(issues).length ? (
              <WorkspaceFormBanner title="Unable to save lead">
                {error || "Correct the highlighted fields."}
              </WorkspaceFormBanner>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <WorkspaceFormField label="Existing contact" className="sm:col-span-2">
                <WorkspaceLookup
                  ariaLabel="Existing contact"
                  allowTextValue={false}
                  options={options}
                  value={value.contactId ? String(value.contactId) : ""}
                  loading={contacts.isLoading}
                  disabled={saving}
                  onTextChange={setSearch}
                  onValueChange={(id) => {
                    const contact = contacts.data?.find((row) => String(row.id) === id);
                    setValue((current) => ({
                      ...current,
                      contactId: contact?.id ?? null,
                      ...(contact
                        ? { name: contact.name, phone: contact.primaryPhone || current.phone }
                        : {})
                    }));
                  }}
                />
                {contacts.error ? (
                  <p role="alert" className="text-xs text-destructive">
                    {contacts.error.message}
                  </p>
                ) : null}
              </WorkspaceFormField>
              {textField("name", "Contact")}
              {textField("phone", "Mobile", true)}
              <WorkspaceFormField label="Enquiry details" className="sm:col-span-2">
                <Textarea
                  aria-label="Enquiry details"
                  aria-invalid={Boolean(issues.message)}
                  value={value.message}
                  disabled={saving}
                  rows={4}
                  onChange={(event) =>
                    setValue((current) => ({ ...current, message: event.target.value }))
                  }
                />
                {issues.message ? (
                  <p className="text-xs text-destructive">{issues.message}</p>
                ) : null}
              </WorkspaceFormField>
              <WorkspaceFormField label="Campaign">
                <WorkspaceLookup
                  ariaLabel="Campaign"
                  value={value.campaignLabel}
                  options={(campaigns.data ?? []).map(({ label }) => ({ value: label, label }))}
                  loading={campaigns.isLoading}
                  disabled={saving}
                  allowTextValue={false}
                  createMode="inline"
                  createLabel="Create campaign"
                  onTextChange={setCampaignSearch}
                  onCreate={(name) => ({ value: name, label: name })}
                  onValueChange={(campaignLabel) =>
                    setValue((current) => ({ ...current, campaignLabel }))
                  }
                />
                {campaigns.error && (
                  <p role="alert" className="text-xs text-destructive">
                    {campaigns.error.message}
                  </p>
                )}
                {issues.campaignLabel && (
                  <p className="text-xs text-destructive">{issues.campaignLabel}</p>
                )}
              </WorkspaceFormField>
              {textField("email", "Email")}
              <WorkspaceFormField label="Status" required>
                <Select
                  value={value.status}
                  disabled={saving}
                  onValueChange={(status) => {
                    if (status === "review" || status === "qualified" || status === "lost")
                      setValue((current) => ({ ...current, status }));
                  }}
                >
                  <SelectTrigger aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["review", "qualified", "lost"] as const).map((status) => (
                      <SelectItem key={status} value={status}>
                        {leadStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </WorkspaceFormField>
            </div>
          </WorkspaceFormBody>
          <WorkspaceFormActions>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : record ? "Update lead" : "Save lead"}
            </Button>
            <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
              Cancel
            </Button>
          </WorkspaceFormActions>
        </WorkspaceFormSurface>
      </form>
    </WorkspaceUpsertPage>
  );
}
