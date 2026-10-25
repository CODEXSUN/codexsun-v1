import type { MarketingTransport } from "../../transport";
import type { SubmissionInput, SubmissionRecord } from "./submission.types";

export const listSubmissions = (
  api: MarketingTransport,
  page = 1,
  search = "",
  status = "all",
  pageSize = 50
) =>
  api.get<SubmissionRecord[]>(
    "/marketing/submissions?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      status
  );

export const saveSubmission = (api: MarketingTransport, input: SubmissionInput) =>
  api.post<SubmissionRecord>("/marketing/submissions", input);

export const retrySubmission = (api: MarketingTransport, uuid: string) =>
  api.post<SubmissionRecord>("/marketing/submissions/" + uuid + "/retry", {});

export const captureOptions = (api: MarketingTransport) =>
  api.get<
    { uuid: string; name: string; consentNotice: string; noticeVersion: string; status: string }[]
  >("/marketing/captures?limit=100");

export const getSubmission = (api: MarketingTransport, uuid: string) =>
  api.get<SubmissionRecord>("/marketing/submissions/" + uuid);

export const countSubmissions = (api: MarketingTransport, search = "", status = "all") =>
  api.get<{ total: number }>(
    "/marketing/submissions/count?search=" + encodeURIComponent(search) + "&status=" + status
  );
