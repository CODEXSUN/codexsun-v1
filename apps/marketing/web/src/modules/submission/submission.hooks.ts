import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listSubmissions,
  getSubmission,
  countSubmissions,
  captureOptions,
  type SubmissionFilters
} from "./submission.services";

export function useSubmissions(page: number, filters: SubmissionFilters, pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "submissions", page, filters, pageSize],
    queryFn: () => listSubmissions(api, page, filters, pageSize)
  });
}

export function useSubmissionCount(filters: SubmissionFilters) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "submission-count", filters],
    queryFn: () => countSubmissions(api, filters)
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
