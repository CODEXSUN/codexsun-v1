import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listContents,
  countContents,
  getContent,
  contentActivity,
  contentBrandOptions,
  contentCampaignOptions
} from "./content.services";

export function useContents(
  search: string,
  status = "all",
  channel = "all",
  publishMode = "all",
  page = 1,
  pageSize = 25
) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: [
      "marketing",
      api.scopeKey,
      "contents",
      search,
      status,
      channel,
      publishMode,
      page,
      pageSize
    ],
    queryFn: () => listContents(api, search, status, channel, publishMode, page, pageSize)
  });
}

export function useContentCount(
  search = "",
  status = "all",
  channel = "all",
  publishMode = "all"
) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: [
      "marketing",
      api.scopeKey,
      "content-count",
      search,
      status,
      channel,
      publishMode
    ],
    queryFn: () => countContents(api, search, status, channel, publishMode)
  });
}

export function useContentDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "content-detail", uuid],
    queryFn: () => (uuid ? getContent(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useContentActivity(uuid: string | null, updatedAt?: string) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "content-activity", uuid, updatedAt],
    queryFn: () => (uuid ? contentActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useContentBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "content-brand-options"],
    queryFn: () => contentBrandOptions(api)
  });
}

export function useContentCampaignOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "content-campaign-options"],
    queryFn: () => contentCampaignOptions(api)
  });
}
