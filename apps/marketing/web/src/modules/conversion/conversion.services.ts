import type { MarketingTransport } from "../../transport";
import type { ConversionInput, ConversionRecord } from "./conversion.types";

export const listConversions = (
  api: MarketingTransport,
  search = "",
  status = "all",
  page = 1,
  pageSize = 50
) =>
  api.get<ConversionRecord[]>(
    "/marketing/conversions?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status)
  );

export const getConversion = (api: MarketingTransport, uuid: string) =>
  api.get<ConversionRecord>("/marketing/conversions/" + uuid);

export const createConversion = (api: MarketingTransport, input: ConversionInput) =>
  api.post<ConversionRecord>("/marketing/conversions", input);

export const updateConversion = (api: MarketingTransport, uuid: string, input: ConversionInput) =>
  api.put<ConversionRecord>("/marketing/conversions/" + uuid, input);

export const countConversions = (api: MarketingTransport, search = "", status = "all") =>
  api.get<{ total: number }>(
    "/marketing/conversions/count?search=" + encodeURIComponent(search) + "&status=" + status
  );

export const conversionActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/conversions/" + uuid + "/activity"
  );

export const conversionLeadOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; email: string; phone: string; companyName?: string; status: string }[]>(
    "/marketing/leads?limit=100&status=qualified"
  );
