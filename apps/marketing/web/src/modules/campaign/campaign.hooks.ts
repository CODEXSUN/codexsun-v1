import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listCampaigns,
  getCampaign,
  campaignActivity,
  countCampaigns,
  campaignBrandOptions
} from "./campaign.services";

export function useCampaigns(search: string, page: number, status = "all", pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign", search, page, status, pageSize],
    queryFn: () => listCampaigns(api, search, Math.max(0, page - 1) * pageSize, status, pageSize)
  });
}

export function useCampaignCount(search: string, status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign-count", search, status],
    queryFn: () => countCampaigns(api, search, status)
  });
}

export function useCampaignDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign-detail", uuid],
    queryFn: () => (uuid ? getCampaign(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useCampaignActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign-activity", uuid],
    queryFn: () => (uuid ? campaignActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useCampaignBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign-brand-options"],
    queryFn: () => campaignBrandOptions(api)
  });
}
