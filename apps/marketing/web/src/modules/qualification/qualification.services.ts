import type { MarketingTransport } from "../../transport";
import type { QualificationInput, QualificationRecord } from "./qualification.types";

export const listQualifications = (
  api: MarketingTransport,
  search = "",
  decision = "all",
  page = 1,
  pageSize = 50
) =>
  api.get<QualificationRecord[]>(
    "/marketing/qualifications?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&search=" +
      encodeURIComponent(search) +
      "&decision=" +
      encodeURIComponent(decision)
  );

export const getQualification = (api: MarketingTransport, uuid: string) =>
  api.get<QualificationRecord>("/marketing/qualifications/" + uuid);

export const createQualification = (api: MarketingTransport, input: QualificationInput) =>
  api.post<QualificationRecord>("/marketing/qualifications", input);

export const updateQualification = (api: MarketingTransport, uuid: string, input: QualificationInput) =>
  api.put<QualificationRecord>("/marketing/qualifications/" + uuid, input);

export const countQualifications = (api: MarketingTransport, search = "", decision = "all") =>
  api.get<{ total: number }>(
    "/marketing/qualifications/count?search=" + encodeURIComponent(search) + "&decision=" + decision
  );

export const qualificationActivity = (api: MarketingTransport, uuid: string) =>
  api.get<{ action: string; actor: string; occurredAt: string }[]>(
    "/marketing/qualifications/" + uuid + "/activity"
  );

export const qualificationLeadOptions = (api: MarketingTransport) =>
  api.get<{ uuid: string; name: string; email: string; phone: string; companyName?: string; status: string }[]>(
    "/marketing/leads?limit=100"
  );
