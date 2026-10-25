import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listConsents,
  getConsent,
  countConsents,
  consentBrandOptions
} from "./consent.services";

export function useConsents(search: string, action = "all", page = 1, pageSize = 50) {
  const api = useMarketingTransport();
  const list = useQuery({
    queryKey: ["marketing", api.scopeKey, "consents", search, action, page, pageSize],
    queryFn: () => listConsents(api, search, action, page, pageSize)
  });
  const count = useQuery({
    queryKey: ["marketing", api.scopeKey, "consents-count", search, action],
    queryFn: () => countConsents(api, search, action)
  });
  return { list, count };
}

export function useConsentDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "consent-detail", uuid],
    queryFn: () => (uuid ? getConsent(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useConsentBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "consent-brand-options"],
    queryFn: () => consentBrandOptions(api)
  });
}
