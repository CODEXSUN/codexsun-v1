import type { MarketingTransport } from "../../transport";
import type {
  SubmissionInput,
  SubmissionRecord,
  SubmissionColumnFilters
} from "./submission.types";

export type SubmissionFilters = Omit<SubmissionColumnFilters, "status"> & {
  search: string;
  status: string;
  columnStatus: string;
  fromDate: string;
  toDate: string;
};
function filterQuery(filters: SubmissionFilters) {
  return new URLSearchParams(
    Object.entries(filters).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  ).toString();
}

export const listSubmissions = (
  api: MarketingTransport,
  page: number,
  filters: SubmissionFilters,
  pageSize = 50
) =>
  api.get<SubmissionRecord[]>(
    "/marketing/submissions?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&" +
      filterQuery(filters)
  );

export const saveSubmission = (api: MarketingTransport, input: SubmissionInput) =>
  api.post<SubmissionRecord>("/marketing/submissions", input);

export const handoffSubmission = (api: MarketingTransport, uuid: string) =>
  api.post<{ uuid: string; leadUuid: string | null; status: string }>(
    "/marketing/submissions/" + uuid + "/handoff", {}
  );

export const captureOptions = (api: MarketingTransport) =>
  api.get<
    { uuid: string; name: string; consentNotice: string; noticeVersion: string; status: string }[]
  >("/marketing/captures?limit=100");

export const getSubmission = (api: MarketingTransport, uuid: string) =>
  api.get<SubmissionRecord>("/marketing/submissions/" + uuid);

export const countSubmissions = (api: MarketingTransport, filters: SubmissionFilters) =>
  api.get<{ total: number }>("/marketing/submissions/count?" + filterQuery(filters));
