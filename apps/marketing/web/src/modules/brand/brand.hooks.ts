import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import { listBrands, getBrand, brandActivity, countBrands } from "./brand.services";

export function useBrands(search: string, page: number, status = "all", pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "brand", search, page, status, pageSize],
    queryFn: () => listBrands(api, search, Math.max(0, page - 1) * pageSize, status, pageSize)
  });
}

export function useBrandCount(search: string, status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "brand-count", search, status],
    queryFn: () => countBrands(api, search, status)
  });
}

export function useBrandDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "brand-detail", uuid],
    queryFn: () => (uuid ? getBrand(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useBrandActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "brand-activity", uuid],
    queryFn: () => (uuid ? brandActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}
