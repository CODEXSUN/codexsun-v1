import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import { listBrands } from "../brand/brand.services";
import { listCampaigns } from "../campaign/campaign.services";
import { listEmailSenders } from "./email-campaign.services";

export function useEmailCampaignBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "brands-lookup"],
    queryFn: () => listBrands(api, "", 0, "active", 100)
  });
}

export function useEmailCampaignCampaignOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "campaigns-lookup"],
    queryFn: () => listCampaigns(api, "", 0, "active", 100)
  });
}

export function useEmailCampaignSenderOptions(brandUuid?: string) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "email-senders-lookup", brandUuid],
    queryFn: () => listEmailSenders(api, brandUuid)
  });
}
