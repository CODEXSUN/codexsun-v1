import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listLeads,
  getLead,
  countLeads,
  leadActivity,
  leadBrandOptions,
  leadCampaignOptions
} from "./lead.services";

export function useLeads(search: string, status = "all", page = 1, pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "leads", search, status, page, pageSize],
    queryFn: () => listLeads(api, search, status, page, pageSize)
  });
}

export function useLeadCount(search = "", status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "lead-count", search, status],
    queryFn: () => countLeads(api, search, status)
  });
}

export function useLeadDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "lead-detail", uuid],
    queryFn: () => (uuid ? getLead(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useLeadActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "lead-activity", uuid],
    queryFn: () => (uuid ? leadActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useLeadBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "lead-brand-options"],
    queryFn: () => leadBrandOptions(api)
  });
}

export function useLeadCampaignOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "lead-campaign-options"],
    queryFn: () => leadCampaignOptions(api)
  });
}
