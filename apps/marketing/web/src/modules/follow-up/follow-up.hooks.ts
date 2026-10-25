import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listFollowUps,
  getFollowUp,
  countFollowUps,
  followUpActivity,
  followUpLeadOptions
} from "./follow-up.services";

export function useFollowUps(
  search: string,
  status = "all",
  type = "all",
  page = 1,
  pageSize = 50
) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-ups", search, status, type, page, pageSize],
    queryFn: () => listFollowUps(api, search, status, type, page, pageSize)
  });
}

export function useFollowUpCount(search = "", status = "all", type = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-up-count", search, status, type],
    queryFn: () => countFollowUps(api, search, status, type)
  });
}

export function useFollowUpDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-up-detail", uuid],
    queryFn: () => (uuid ? getFollowUp(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useFollowUpActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-up-activity", uuid],
    queryFn: () => (uuid ? followUpActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useFollowUpLeadOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-up-lead-options"],
    queryFn: () => followUpLeadOptions(api)
  });
}
