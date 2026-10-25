import type { MarketingTransport } from "../../transport";
import type { OutcomeInput, OutcomeRecord } from "./outcome.types";

export const listOutcomes = (
  api: MarketingTransport,
  search = "",
  status = "all",
  page = 1,
  pageSize = 50
) =>
  api.get<OutcomeRecord[]>(
    "/marketing/outcomes?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status)
  );

export const getOutcome = (api: MarketingTransport, uuid: string) =>
  api.get<OutcomeRecord>("/marketing/outcomes/" + uuid);

export const createOutcome = (api: MarketingTransport, input: OutcomeInput) =>
  api.post<OutcomeRecord>("/marketing/outcomes", input);

export const updateOutcome = (api: MarketingTransport, uuid: string, input: OutcomeInput) =>
  api.put<OutcomeRecord>("/marketing/outcomes/" + uuid, input);

export const countOutcomes = (api: MarketingTransport, search = "", status = "all") =>
  api.get<{ total: number }>(
    "/marketing/outcomes/count?search=" + encodeURIComponent(search) + "&status=" + status
  );

export const outcomeActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/outcomes/" + uuid + "/activity"
  );

export const outcomeLeadOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; email: string; phone: string; companyName?: string; status: string }[]>(
    "/marketing/leads?limit=100"
  );
