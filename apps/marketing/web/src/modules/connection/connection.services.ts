import type { MarketingTransport } from "../../transport";
import type { ConnectionInput, ConnectionRecord } from "./connection.types";

export const listConnections = (
  api: MarketingTransport,
  search = "",
  offset = 0,
  status = "all",
  limit = 50
) =>
  api.get<ConnectionRecord[]>(
    "/marketing/connections?limit=" +
      limit +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status) +
      "&offset=" +
      offset
  );

export const getConnection = (api: MarketingTransport, uuid: string) =>
  api.get<ConnectionRecord>("/marketing/connections/" + uuid);

export const createConnection = (api: MarketingTransport, input: ConnectionInput) =>
  api.post<ConnectionRecord>("/marketing/connections", input);

export const updateConnection = (api: MarketingTransport, uuid: string, input: ConnectionInput) =>
  api.put<ConnectionRecord>("/marketing/connections/" + uuid, input);

export const connectionActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/connections/" + uuid + "/activity"
  );

export const countConnections = (api: MarketingTransport, search = "", status = "all") =>
  api.get<{ total: number }>(
    "/marketing/connections/count?search=" + encodeURIComponent(search) + "&status=" + status
  );

export const connectionBrandOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; status: string }[]>("/marketing/brands?limit=100&status=active");
