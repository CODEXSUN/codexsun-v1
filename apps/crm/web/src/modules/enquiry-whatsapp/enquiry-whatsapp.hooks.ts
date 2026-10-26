import { useQuery } from "@tanstack/react-query";
import { listWhatsAppMessages } from "./enquiry-whatsapp.services";
export const whatsAppKey = (id: number) => ["crm", "enquiry-whatsapp", id];
export const useWhatsAppMessages = (id: number, poll = true) =>
  useQuery({
    queryKey: whatsAppKey(id),
    queryFn: () => listWhatsAppMessages(id),
    refetchInterval: poll ? 10000 : false
  });
