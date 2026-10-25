import type { MarketingTransport } from "../../transport";
import type { LeadInput, LeadRecord } from "./lead.types";

export const listLeads = (
  api: MarketingTransport,
  search = "",
  status = "all",
  page = 1,
  pageSize = 50
) =>
  api.get<LeadRecord[]>(
    "/marketing/leads?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status)
  );

export const getLead = (api: MarketingTransport, uuid: string) =>
  api.get<LeadRecord>("/marketing/leads/" + uuid);

export const createLead = (api: MarketingTransport, input: LeadInput) =>
  api.post<LeadRecord>("/marketing/leads", input);

export const updateLead = (api: MarketingTransport, uuid: string, input: LeadInput) =>
  api.put<LeadRecord>("/marketing/leads/" + uuid, input);

export const countLeads = (api: MarketingTransport, search = "", status = "all") =>
  api.get<{ total: number }>(
    "/marketing/leads/count?search=" + encodeURIComponent(search) + "&status=" + status
  );

export const leadActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/leads/" + uuid + "/activity"
  );

export const leadBrandOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; status: string }[]>("/marketing/brands?limit=100&status=active");

export const leadCampaignOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; status: string }[]>("/marketing/campaigns?limit=100&status=active");
