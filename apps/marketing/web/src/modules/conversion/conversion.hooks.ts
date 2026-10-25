import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listConversions,
  getConversion,
  countConversions,
  conversionActivity,
  conversionLeadOptions
} from "./conversion.services";

export function useConversions(search: string, status = "all", page = 1, pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "conversions", search, status, page, pageSize],
    queryFn: () => listConversions(api, search, status, page, pageSize)
  });
}

export function useConversionCount(search = "", status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "conversion-count", search, status],
    queryFn: () => countConversions(api, search, status)
  });
}

export function useConversionDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "conversion-detail", uuid],
    queryFn: () => (uuid ? getConversion(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useConversionActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "conversion-activity", uuid],
    queryFn: () => (uuid ? conversionActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useConversionLeadOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "conversion-lead-options"],
    queryFn: () => conversionLeadOptions(api)
  });
}
