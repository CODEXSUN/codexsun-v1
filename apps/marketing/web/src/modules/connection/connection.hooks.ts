import { useQuery } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import {
  listConnections,
  getConnection,
  connectionActivity,
  countConnections,
  connectionBrandOptions
} from "./connection.services";

export function useConnections(search: string, page: number, status = "all", pageSize = 50) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "connection", search, page, status, pageSize],
    queryFn: () => listConnections(api, search, Math.max(0, page - 1) * pageSize, status, pageSize)
  });
}

export function useConnectionCount(search: string, status = "all") {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "connection-count", search, status],
    queryFn: () => countConnections(api, search, status)
  });
}

export function useConnectionDetail(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "connection-detail", uuid],
    queryFn: () => (uuid ? getConnection(api, uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useConnectionActivity(uuid: string | null) {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "connection-activity", uuid],
    queryFn: () => (uuid ? connectionActivity(api, uuid) : []),
    enabled: Boolean(uuid)
  });
}

export function useConnectionBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "connection-brand-options"],
    queryFn: () => connectionBrandOptions(api)
  });
}
