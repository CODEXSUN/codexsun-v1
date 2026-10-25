import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listSubmissions,
  getSubmission,
  countSubmissions,
  captureOptions
} from "./submission.services";

export function useSubmissions(page: number, search = "", status = "all", pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "submissions", page, search, status, pageSize],
    queryFn: () => listSubmissions(api, page, search, status, pageSize)
  });
}

export function useSubmissionCount(search = "", status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "submission-count", search, status],
    queryFn: () => countSubmissions(api, search, status)
  });
}

export function useSubmissionDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "submission-detail", uuid],
    queryFn: () => (uuid ? getSubmission(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useCaptureOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "capture-options"],
    queryFn: () => captureOptions(api)
  });
}
