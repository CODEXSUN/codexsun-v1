import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listContactLookups, listContacts } from "./contact.services";

export const contactsQueryKey = ["crm", "contacts"] as const;
export const contactLookupsQueryKey = ["crm", "contacts", "lookups"] as const;

export function useContacts(search = "") {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => listContacts(search),
    queryKey: [...contactsQueryKey, search],
    refetchInterval: 15000
  });
}

export function useContactLookups() {
  return useQuery({
    queryFn: listContactLookups,
    queryKey: contactLookupsQueryKey
  });
}
