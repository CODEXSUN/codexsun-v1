import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import {
  WorkspaceFormActions,
  WorkspaceFormBody,
  WorkspaceFormField,
  WorkspaceFormGrid,
  WorkspaceFormSurface,
  WorkspaceUpsertPage
} from "@codexsun/ui/workspace/upsert";
import { useConversationBrandOptions } from "./conversation.hooks";
import type { ThreadInput } from "./conversation.types";

export function ConversationForm({
  onSubmit,
  onCancel,
  pending = false
}: {
  onSubmit: (data: ThreadInput) => Promise<void>;
  onCancel: () => void;
  pending?: boolean;
}) {
  const brandsQuery = useConversationBrandOptions();
  const brands = brandsQuery.data ?? [];
  const [brandUuid, setBrandUuid] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "chat">("whatsapp");
  const [contactIdentifier, setContactIdentifier] = useState("");
  const [contactName, setContactName] = useState("");
  const [leadUuid, setLeadUuid] = useState("");

  const [touched, setTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errors: Record<string, string> = {};
  if (!brandUuid.trim()) errors.brandUuid = "Brand is required";
  if (!contactIdentifier.trim()) errors.contactIdentifier = "Phone number is required";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (Object.keys(errors).length > 0) {
      setErrorMessage("Please check the required fields before continuing.");
      return;
    }

    try {
      setErrorMessage(null);
      await onSubmit({
        brandUuid,
        channel,
        contactIdentifier: contactIdentifier.trim(),
        contactName: contactName.trim() || undefined,
        leadUuid: leadUuid.trim() || undefined
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to start conversation");
    }
  };

  return (
    <WorkspaceUpsertPage title="Start new conversation" onBack={onCancel}>
      <form onSubmit={handleSubmit}>
        <WorkspaceFormSurface>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <WorkspaceFormBody>
            <WorkspaceFormGrid columns={2}>
              {/* Brand Field */}
              <WorkspaceFormField label="Brand" required>
                <select
                  value={brandUuid}
                  onChange={(e) => setBrandUuid(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-invalid={touched && Boolean(errors.brandUuid)}
                  aria-describedby={
                    touched && errors.brandUuid ? "conversation-brand-error" : undefined
                  }
                  aria-label="Brand"
                >
                  <option value="">Select a brand</option>
                  {brands.map((b) => (
                    <option key={b.uuid} value={b.uuid}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {touched && errors.brandUuid ? (
                  <p
                    id="conversation-brand-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.brandUuid}
                  </p>
                ) : null}
              </WorkspaceFormField>

              {/* Channel Field */}
              <WorkspaceFormField label="Channel" required>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "whatsapp" | "sms" | "chat")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Channel"
                >
                  <option value="whatsapp">WhatsApp Cloud API</option>
                  <option value="sms">SMS</option>
                  <option value="chat">Web Chat</option>
                </select>
              </WorkspaceFormField>

              {/* Phone Number Field */}
              <WorkspaceFormField label="Contact / Phone" required>
                <Input
                  value={contactIdentifier}
                  onChange={(e) => setContactIdentifier(e.target.value)}
                  placeholder="+15551234567"
                  aria-invalid={touched && Boolean(errors.contactIdentifier)}
                  aria-describedby={
                    touched && errors.contactIdentifier ? "conversation-contact-error" : undefined
                  }
                  aria-label="Contact / Phone"
                />
                {touched && errors.contactIdentifier ? (
                  <p
                    id="conversation-contact-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.contactIdentifier}
                  </p>
                ) : null}
              </WorkspaceFormField>

              {/* Contact Name Field */}
              <WorkspaceFormField label="Contact Name">
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Customer Name"
                  aria-label="Contact Name"
                />
              </WorkspaceFormField>

              {/* Optional Marketing Lead UUID */}
              <WorkspaceFormField label="Marketing Lead UUID">
                <Input
                  value={leadUuid}
                  onChange={(e) => setLeadUuid(e.target.value)}
                  placeholder="Optional associated lead ID"
                  aria-label="Marketing Lead UUID"
                />
              </WorkspaceFormField>
            </WorkspaceFormGrid>

            <WorkspaceFormActions>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Starting..." : "Start Conversation"}
              </Button>
            </WorkspaceFormActions>
          </WorkspaceFormBody>
        </WorkspaceFormSurface>
      </form>
    </WorkspaceUpsertPage>
  );
}
