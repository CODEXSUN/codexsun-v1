import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listCaptures,
  getCapture,
  captureActivity,
  countCaptures,
  captureBrandOptions,
  captureCampaignOptions
} from "./capture.services";

export function useCaptures(search: string, page: number, status = "all", pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "capture", search, page, status, pageSize],
    queryFn: () => listCaptures(api, search, Math.max(0, page - 1) * pageSize, status, pageSize)
  });
}

export function useCaptureCount(search: string, status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-count", search, status],
    queryFn: () => countCaptures(api, search, status)
  });
}

export function useCaptureDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-detail", uuid],
    queryFn: () => (uuid ? getCapture(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useCaptureActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-activity", uuid],
    queryFn: () => (uuid ? captureActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useCaptureBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-brand-options"],
    queryFn: () => captureBrandOptions(api)
  });
}

export function useCaptureCampaignOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-campaign-options"],
    queryFn: () => captureCampaignOptions(api)
  });
}
