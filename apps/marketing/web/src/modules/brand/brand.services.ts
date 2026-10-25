import type { MarketingTransport } from "../../transport";
import type { BrandInput, BrandRecord } from "./brand.types";

export const listBrands = (
  api: MarketingTransport,
  search = "",
  offset = 0,
  status = "all",
  limit = 50
) =>
  api.get<BrandRecord[]>(
    "/marketing/brands?limit=" +
      limit +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status) +
      "&offset=" +
      offset
  );

export const getBrand = (api: MarketingTransport, uuid: string) =>
  api.get<BrandRecord>("/marketing/brands/" + uuid);

export const createBrand = (api: MarketingTransport, input: BrandInput) =>
  api.post<BrandRecord>("/marketing/brands", input);

export const updateBrand = (api: MarketingTransport, uuid: string, input: BrandInput) =>
  api.put<BrandRecord>("/marketing/brands/" + uuid, input);

export const brandActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/brands/" + uuid + "/activity"
  );

export const countBrands = (api: MarketingTransport, search = "", status = "all") =>
  api.get<{ total: number }>(
    "/marketing/brands/count?search=" + encodeURIComponent(search) + "&status=" + status
  );
