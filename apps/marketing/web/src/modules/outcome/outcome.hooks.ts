import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listOutcomes,
  getOutcome,
  countOutcomes,
  outcomeActivity,
  outcomeLeadOptions
} from "./outcome.services";

export function useOutcomes(search: string, status = "all", page = 1, pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "outcomes", search, status, page, pageSize],
    queryFn: () => listOutcomes(api, search, status, page, pageSize)
  });
}

export function useOutcomeCount(search = "", status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "outcome-count", search, status],
    queryFn: () => countOutcomes(api, search, status)
  });
}

export function useOutcomeDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "outcome-detail", uuid],
    queryFn: () => (uuid ? getOutcome(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useOutcomeActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "outcome-activity", uuid],
    queryFn: () => (uuid ? outcomeActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useOutcomeLeadOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "outcome-lead-options"],
    queryFn: () => outcomeLeadOptions(api)
  });
}
