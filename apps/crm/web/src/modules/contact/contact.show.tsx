import { useCrmFrappeSyncEnabled } from "../frappe-sync/frappe-sync.hooks";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { ContactRelatedTabs } from "./contact.related";
import { useQuery } from "@tanstack/react-query";
import {
  FrappeSyncIndicator,
  getFrappeRecordStates,
  verifyFrappeRecord
} from "../frappe-sync/frappe-sync.indicator";
import type { ContactLookups, ContactRecord, ContactSavePayload } from "./contact.types";

export function CrmContactShow({
  record,
  lookups,
  saving,
  onUpdate,
  onStatusChange,
  onOpenEnquiry
}: {
  record: ContactRecord;
  lookups: ContactLookups;
  saving: boolean;
  onUpdate: (patch: Partial<ContactSavePayload>) => Promise<void>;
  onStatusChange: (active: boolean) => Promise<void>;
  onOpenEnquiry?: (id: string) => void;
}) {
  const frappeSyncEnabled = useCrmFrappeSyncEnabled();
  const sync = useQuery({
    queryKey: ["crm", "frappe-sync", "contacts", [Number(record.id)]],
    queryFn: () => getFrappeRecordStates("contacts", [Number(record.id)]),
    enabled: frappeSyncEnabled,
    refetchInterval: 1000
  });
  const state = sync.data?.[Number(record.id)];
  return (
    <div className="mx-auto w-[calc(100%-2rem)] max-w-[92rem] py-4 lg:w-[calc(100%-3rem)] lg:py-5">
      {frappeSyncEnabled ? (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span>Frappe mobile sync</span>
          <FrappeSyncIndicator
            status={state?.status ?? null}
            error={state?.message ?? sync.error?.message}
            onVerify={() => verifyFrappeRecord("contacts", Number(record.id))}
          />
        </div>
      ) : null}
      <ContactRelatedTabs
        contactId={record.id}
        mobile={record.primaryPhone}
        {...(onOpenEnquiry ? { onOpenEnquiry } : {})}
        details={
          <EditableContactDetails
            record={record}
            lookups={lookups}
            saving={saving}
            onUpdate={onUpdate}
            onStatusChange={onStatusChange}
          />
        }
      />
    </div>
  );
}

type EditableContactField = "name" | "legalName" | "code" | "typeId" | "status";

function EditableContactDetails({
  record,
  lookups,
  saving,
  onUpdate,
  onStatusChange
}: {
  record: ContactRecord;
  lookups: ContactLookups;
  saving: boolean;
  onUpdate: (patch: Partial<ContactSavePayload>) => Promise<void>;
  onStatusChange: (active: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState<EditableContactField | null>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setEditing(null);
    setDraft("");
  }, [record.id]);
  const startEdit = (field: EditableContactField) => {
    setEditing(field);
    setDraft(
      field === "typeId"
        ? String(record.typeId ?? "")
        : field === "status"
          ? record.isActive
            ? "active"
            : "inactive"
          : String(record[field] ?? "")
    );
  };
  const save = async () => {
    if (!editing) return;
    const field = editing;
    const value = draft.trim();
    if (
      (field === "name" || field === "code" || field === "typeId" || field === "status") &&
      !value
    ) {
      toast.error(
        `${field === "typeId" ? "Contact type" : field === "name" ? "Name" : field === "code" ? "Code" : "Status"} is required.`
      );
      return;
    }
    try {
      if (field === "status") await onStatusChange(value === "active");
      else if (field === "typeId") await onUpdate({ typeId: Number(value) });
      else if (field === "legalName") await onUpdate({ legalName: value || null });
      else if (field === "code") await onUpdate({ code: value });
      else await onUpdate({ name: value });
      setEditing(null);
    } catch {
      // Keep the draft available so the user can correct a rejected update.
    }
  };
  const values: Array<[EditableContactField | "phone" | "status", string, ReactNode]> = [
    ["phone", "Phone", record.primaryPhone],
    ["name", "Name", record.name],
    ["legalName", "Legal name", record.legalName ?? null],
    ["code", "Code", record.code],
    ["typeId", "Type", record.typeName],
    ["status", "Status", record.isActive ? "Active" : "Inactive"]
  ];
  const isProtectedCode = /^EXT-[a-f0-9]{64}$/i.test(record.code);

  return (
    <div className="-mx-px w-[calc(100%+2px)] overflow-hidden rounded-b-md border border-border/70 bg-card shadow-sm">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {values.map(([field, label, value]) => {
            const isEditable = field !== "phone";
            const isEditing = isEditable && editing === field;
            return (
              <tr key={field} className="border-b border-border/60 last:border-b-0">
                <th className="w-40 border-r border-border/70 bg-muted/35 px-3 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </th>
                <td className="px-3 py-1.5 align-middle font-medium text-foreground">
                  <div className="flex min-h-8 min-w-0 items-center gap-2">
                    {isEditing ? (
                      <div className="min-w-0 flex-1">
                        {field === "typeId" || field === "status" ? (
                          <WorkspaceLookup
                            allowTextValue={false}
                            clearable={false}
                            showAllOptionsOnFocus
                            options={
                              field === "typeId"
                                ? lookups.contactTypes
                                    .filter(
                                      (item) =>
                                        item.isActive !== false && item.status !== "inactive"
                                    )
                                    .map((item) => ({ label: item.name, value: String(item.id) }))
                                : [
                                    { label: "Active", value: "active" },
                                    { label: "Inactive", value: "inactive" }
                                  ]
                            }
                            placeholder={
                              field === "typeId" ? "Choose contact type" : "Choose status"
                            }
                            value={draft}
                            onValueChange={setDraft}
                          />
                        ) : (
                          <Input
                            aria-label={label}
                            autoFocus
                            maxLength={field === "code" ? 80 : 191}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void save();
                              if (event.key === "Escape") setEditing(null);
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="min-w-0 flex-1 break-words">
                        {value ?? <span className="text-muted-foreground">Not set</span>}
                      </span>
                    )}
                    {isEditing ? (
                      <>
                        <Button
                          aria-label={`Save ${label}`}
                          className="size-8 shrink-0"
                          disabled={saving}
                          size="icon"
                          type="button"
                          onClick={() => void save()}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          aria-label={`Cancel editing ${label}`}
                          className="size-8 shrink-0"
                          disabled={saving}
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() => setEditing(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : isEditable && !(field === "code" && isProtectedCode) ? (
                      <Button
                        aria-label={`Edit ${label}`}
                        className="size-8 shrink-0"
                        disabled={saving}
                        size="icon"
                        type="button"
                        variant="ghost"
                        onClick={() => startEdit(field)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
