import type { MarketingTransport } from "../../transport";
import type { FollowUpInput, FollowUpRecord } from "./follow-up.types";

export const listFollowUps = (
  api: MarketingTransport,
  search = "",
  status = "all",
  type = "all",
  page = 1,
  pageSize = 50
) =>
  api.get<FollowUpRecord[]>(
    "/marketing/follow-ups?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status) +
      "&type=" +
      encodeURIComponent(type)
  );

export const getFollowUp = (api: MarketingTransport, uuid: string) =>
  api.get<FollowUpRecord>("/marketing/follow-ups/" + uuid);

export const createFollowUp = (api: MarketingTransport, input: FollowUpInput) =>
  api.post<FollowUpRecord>("/marketing/follow-ups", input);

export const updateFollowUp = (api: MarketingTransport, uuid: string, input: FollowUpInput) =>
  api.put<FollowUpRecord>("/marketing/follow-ups/" + uuid, input);

export const countFollowUps = (
  api: MarketingTransport,
  search = "",
  status = "all",
  type = "all"
) =>
  api.get<{ total: number }>(
    "/marketing/follow-ups/count?search=" +
      encodeURIComponent(search) +
      "&status=" +
      status +
      "&type=" +
      type
  );

export const followUpActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/follow-ups/" + uuid + "/activity"
  );

export const followUpLeadOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; email: string; phone: string; companyName?: string; status: string }[]>(
    "/marketing/leads?limit=100"
  );
