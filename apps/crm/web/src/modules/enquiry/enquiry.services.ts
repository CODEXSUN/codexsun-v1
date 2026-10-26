import { crmRequest as request } from "../../crm-request";
import type {
  EnquiryActivity,
  EnquiryAttention,
  EnquiryComment,
  EnquiryEstimate,
  EnquiryEstimateSavePayload,
  EnquiryJob,
  EnquiryJobSavePayload,
  EnquiryLocation,
  EnquiryLookup,
  EnquiryPage,
  EnquiryPropertyPatch,
  EnquiryRecord,
  EnquirySavePayload,
  EnquirySummary,
  EnquiryReportFilters,
  EnquiryReportRow,
  EnquiryColumnFilters
} from "./enquiry.types";

export async function listEnquiryPage(options: {
  scope: "all" | "assigned" | "created";
  page: number;
  pageSize: number;
  search: string;
  mobile?: string;
  contactId?: number;
  columnFilters?: EnquiryColumnFilters;
  filter: string;
  reportFilters?: EnquiryReportFilters | undefined;
  dateRange?: { fromDate: string; toDate: string } | undefined;
}) {
  const query = new URLSearchParams({
    scope: options.scope,
    page: String(options.page),
    pageSize: String(options.pageSize),
    search: options.search,
    filter: options.filter
  });
  if (options.mobile) query.set("mobile", options.mobile);
  if (options.contactId) query.set("contactId", String(options.contactId));
  for (const [column, value] of Object.entries(options.columnFilters ?? {})) {
    if (value?.trim())
      query.set(`search${column[0]!.toUpperCase()}${column.slice(1)}`, value.trim());
  }
  for (const [key, value] of Object.entries(options.reportFilters ?? {})) {
    if (value && !["filter", "fromDate", "toDate"].includes(key)) query.set(key, value);
  }
  addDateRange(query, options.reportFilters ?? {});
  addDateRange(query, options.dateRange ?? {});
  return request<EnquiryPage>(`/crm/enquiries?${query}`);
}

export function listEnquiryReport(
  filters: EnquiryReportFilters,
  view: "list-in" | "creator" | "assignee" | "status"
) {
  const query = new URLSearchParams({ view });
  addDateRange(query, filters);
  if (filters.assignedUserId) query.set("assignedUserId", filters.assignedUserId);
  return request<EnquiryReportRow[]>(`/crm/enquiries/reports?${query}`);
}

function addDateRange(query: URLSearchParams, filters: EnquiryReportFilters) {
  if (filters.fromDate) query.set("fromAt", localDateBoundary(filters.fromDate, 0));
  if (filters.toDate) query.set("toAt", localDateBoundary(filters.toDate, 1));
}

function localDateBoundary(date: string, nextDay: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day! + nextDay).toISOString();
}

export const getEnquiryOverviewActivity = () =>
  request<{ commentsByYou30Days: number }>("/crm/enquiries/overview-activity");
export const getEnquiryAttention = (today: string) =>
  request<EnquiryAttention>(`/crm/enquiries/attention?today=${today}`);
export const getEnquirySummary = (today: string) =>
  request<EnquirySummary>(`/crm/enquiries/summary?today=${today}`);
export const readEnquiryAlert = (id: number) =>
  request<{ read: boolean }>(`/crm/enquiries/alerts/${id}/read`, { method: "POST" });
export const getEnquiry = (id: string) =>
  request<EnquiryRecord>(`/crm/enquiries/${encodeURIComponent(id)}`);
export const listEnquiryComments = (id: string) =>
  request<EnquiryComment[]>(`/crm/enquiries/${id}/comments`);
export const createEnquiryComment = (
  id: string,
  body: string,
  parentId: string | null,
  bodyFormat: "plain" | "html" = "plain",
  requestId?: string
) =>
  request<EnquiryComment>(`/crm/enquiries/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, parentId, bodyFormat, requestId })
  });
export const updateEnquiryProperties = (id: string, patch: EnquiryPropertyPatch) =>
  request<EnquiryRecord>(`/crm/enquiries/${id}/properties`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
export const openNewEnquiryCall = (id: string) =>
  request<EnquiryRecord>(`/crm/enquiries/${id}/open-new-call`, { method: "POST" });
export const listEnquiryJobs = (id: string) => request<EnquiryJob[]>(`/crm/enquiries/${id}/jobs`);
export const startEnquiryJob = (id: string) =>
  request<EnquiryJob>(`/crm/enquiries/${id}/jobs/start`, { method: "POST" });
export const stopEnquiryJob = (id: string, jobId: string) =>
  request<EnquiryJob>(`/crm/enquiries/${id}/jobs/${jobId}/stop`, { method: "POST" });
export const createEnquiryJob = (id: string, payload: EnquiryJobSavePayload) =>
  request<EnquiryJob>(`/crm/enquiries/${id}/jobs`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const updateEnquiryJob = (id: string, jobId: string, payload: EnquiryJobSavePayload) =>
  request<EnquiryJob>(`/crm/enquiries/${id}/jobs/${jobId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
export const listEnquiryEstimates = (id: string) =>
  request<EnquiryEstimate[]>(`/crm/enquiries/${id}/estimates`);
export const createEnquiryEstimate = (id: string, payload: EnquiryEstimateSavePayload) =>
  request<EnquiryEstimate>(`/crm/enquiries/${id}/estimates`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const updateEnquiryEstimate = (
  id: string,
  estimateId: string,
  payload: EnquiryEstimateSavePayload
) =>
  request<EnquiryEstimate>(`/crm/enquiries/${id}/estimates/${estimateId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
export const listEnquiryActivity = (id: string) =>
  request<EnquiryActivity[]>(`/crm/enquiries/${id}/activity`);
export const listEnquiryLocations = async (id: string) => {
  const result = await request<{ items: EnquiryLocation[] }>(`/crm/enquiries/${id}/locations`);
  return result.items;
};
export const createEnquiry = (payload: EnquirySavePayload) =>
  request<EnquiryRecord>("/crm/enquiries", { method: "POST", body: JSON.stringify(payload) });
export const updateEnquiry = (id: string, payload: EnquirySavePayload) =>
  request<EnquiryRecord>(`/crm/enquiries/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const listCoreContacts = () => request<EnquiryLookup[]>("/core/master/contacts");
export const listTenantUsers = () => request<EnquiryLookup[]>("/tenant/access/users");
