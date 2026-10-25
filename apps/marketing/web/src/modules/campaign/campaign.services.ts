import type { MarketingTransport } from "../../transport";
import type { CampaignInput, CampaignRecord } from "./campaign.types";

export const listCampaigns = (
  api: MarketingTransport,
  search = "",
  offset = 0,
  status = "all",
  limit = 50
) =>
  api.get<CampaignRecord[]>(
    "/marketing/campaigns?limit=" +
      limit +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status) +
      "&offset=" +
      offset
  );

export const getCampaign = (api: MarketingTransport, uuid: string) =>
  api.get<CampaignRecord>("/marketing/campaigns/" + uuid);

export const createCampaign = (api: MarketingTransport, input: CampaignInput) =>
  api.post<CampaignRecord>("/marketing/campaigns", input);

export const updateCampaign = (api: MarketingTransport, uuid: string, input: CampaignInput) =>
  api.put<CampaignRecord>("/marketing/campaigns/" + uuid, input);

export const duplicateCampaign = (api: MarketingTransport, uuid: string, name: string) =>
  api.post<CampaignRecord>("/marketing/campaigns/" + uuid + "/duplicate", { name });

export const campaignActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/campaigns/" + uuid + "/activity"
  );

export const countCampaigns = (api: MarketingTransport, search = "", status = "all") =>
  api.get<{ total: number }>(
    "/marketing/campaigns/count?search=" + encodeURIComponent(search) + "&status=" + status
  );

export const campaignBrandOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; status: string }[]>("/marketing/brands?limit=100&status=active");
