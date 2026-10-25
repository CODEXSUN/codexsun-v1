import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listQualifications,
  getQualification,
  countQualifications,
  qualificationActivity,
  qualificationLeadOptions
} from "./qualification.services";

export function useQualifications(search: string, decision = "all", page = 1, pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "qualifications", search, decision, page, pageSize],
    queryFn: () => listQualifications(api, search, decision, page, pageSize)
  });
}

export function useQualificationCount(search = "", decision = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "qualification-count", search, decision],
    queryFn: () => countQualifications(api, search, decision)
  });
}

export function useQualificationDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "qualification-detail", uuid],
    queryFn: () => (uuid ? getQualification(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useQualificationActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "qualification-activity", uuid],
    queryFn: () => (uuid ? qualificationActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useQualificationLeadOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "qualification-lead-options"],
    queryFn: () => qualificationLeadOptions(api)
  });
}
