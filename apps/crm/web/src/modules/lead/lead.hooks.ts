import { useQuery } from "@tanstack/react-query";
import {
  listLeads,
  lookupLeadCampaigns,
  getLead,
  listLeadPage,
  getLeadOptions,
  getLeadActivity,
  lookupLeadContacts
} from "./lead.services";
import type { LeadFilters } from "./lead.types";
import { useLeadQueryScope } from "./lead.query-scope";
import { CrmHttpError } from "../../crm-request";
export const useLeads = () =>
  useQuery({
    queryKey: ["crm", "leads", useLeadQueryScope()],
    queryFn: ({ queryKey }) => listLeads(String(queryKey[2]))
  });
export const useLead = (uuid: string) =>
  useQuery({
    queryKey: ["crm", "lead", useLeadQueryScope(), uuid],
    queryFn: ({ queryKey }) => getLead(uuid, String(queryKey[2])),
    enabled: Boolean(uuid)
  });
export const useLeadPage = (filters: LeadFilters) =>
  useQuery({
    queryKey: ["crm", "leads", useLeadQueryScope(), filters],
    queryFn: ({ queryKey }) => listLeadPage(filters, String(queryKey[2]))
  });
export const useLeadOptions = () =>
  useQuery({
    queryKey: ["crm", "leads", useLeadQueryScope(), "options"],
    queryFn: ({ queryKey }) => getLeadOptions(String(queryKey[2]))
  });
export const useLeadActivity = (uuid: string) =>
  useQuery({
    queryKey: ["crm", "lead", useLeadQueryScope(), uuid, "activity"],
    queryFn: ({ queryKey }) => getLeadActivity(uuid, String(queryKey[2])),
    enabled: Boolean(uuid)
  });
export const useLeadContacts = (search: string) =>
  useQuery({
    queryKey: ["crm", "lead-contacts", useLeadQueryScope(), search],
    queryFn: ({ queryKey }) => lookupLeadContacts(search, String(queryKey[2]))
  });

export function useLeadNavigationCount(enabled: boolean) {
  const scope = useLeadQueryScope();
  const query = useQuery({
    queryKey: ["crm", "leads", scope, "navigation-count", "active"],
    queryFn: async () =>
      (await listLeadPage({ search: "", status: "active", page: 1, pageSize: 1 }, scope)).total,
    enabled,
    retry: (count, error) => !(error instanceof CrmHttpError && error.status === 403) && count < 1,
    retryOnMount: false,
    refetchInterval: (query) =>
      query.state.error instanceof CrmHttpError && query.state.error.status === 403 ? false : 15000,
    refetchOnMount: (query) =>
      !(query.state.error instanceof CrmHttpError && query.state.error.status === 403)
  });
  return query.data ?? 0;
}

export const useLeadCampaigns = (search: string) =>
  useQuery({
    queryKey: ["crm", "leads", useLeadQueryScope(), "campaigns", search],
    queryFn: ({ queryKey }) => lookupLeadCampaigns(search, String(queryKey[2]))
  });
