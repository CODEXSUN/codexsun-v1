import { whatsAppMessageSchema } from "./enquiry-whatsapp.schema";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { EnquiryWhatsAppForm } from "./enquiry-whatsapp.form";
import { EnquiryWhatsAppList } from "./enquiry-whatsapp.list";
import { useWhatsAppMessages, whatsAppKey } from "./enquiry-whatsapp.hooks";
import { prepareWhatsAppMessage } from "./enquiry-whatsapp.services";
export function EnquiryWhatsAppWorkspace({
  id,
  mobile,
  active = true
}: {
  id: number;
  mobile: string | null;
  active?: boolean;
}) {
  const [message, setMessage] = useState("");
  const retry = useRef<{ message: string; id: string } | null>(null);
  const history = useWhatsAppMessages(id, active);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      whatsAppMessageSchema.parse(message);
      if (retry.current?.message !== message.trim())
        retry.current = { message: message.trim(), id: crypto.randomUUID() };
      return prepareWhatsAppMessage(id, retry.current.message, retry.current.id);
    },
    onError: (error) =>
      toast.error("Could not record WhatsApp message", { description: error.message })
  });
  async function submit() {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error("Allow popups to open WhatsApp.");
      return;
    }
    tab.opener = null;
    try {
      const result = await save.mutateAsync();
      tab.location.href = result.url;
      setMessage("");
      retry.current = null;
      await Promise.all([
        client.invalidateQueries({ queryKey: whatsAppKey(id) }),
        client.invalidateQueries({ queryKey: ["crm", "work-reports", id, null] })
      ]);
    } catch {
      tab.close();
    }
  }
  return (
    <section className="space-y-4 p-4">
      <EnquiryWhatsAppForm
        message={message}
        onChange={setMessage}
        onSubmit={() => void submit()}
        pending={save.isPending}
        mobile={mobile}
      />
      {history.error ? (
        <p role="alert" className="text-sm text-destructive">
          {history.error.message}{" "}
          <Button size="sm" variant="outline" onClick={() => void history.refetch()}>
            Retry
          </Button>
        </p>
      ) : history.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading WhatsApp history�</p>
      ) : (
        <EnquiryWhatsAppList items={history.data ?? []} />
      )}
    </section>
  );
}
