import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmRequest } from "../../crm-request";
import {
  getEnquiry,
  getEnquiryOverviewActivity,
  getEnquiryAttention,
  getEnquirySummary,
  listCoreContacts,
  listEnquiryPage,
  listEnquiryReport,
  listEnquiryActivity,
  listEnquiryComments,
  listEnquiryEstimates,
  listEnquiryJobs,
  listEnquiryLocations,
  listTenantUsers
} from "./enquiry.services";
import type { EnquiryColumnFilters, EnquiryReportFilters } from "./enquiry.types";

export const enquiriesQueryKey = ["crm", "enquiries"] as const;
export const enquiryAttentionQueryKey = ["crm", "enquiries", "attention"] as const;
export const enquirySummaryQueryKey = ["crm", "enquiries", "summary"] as const;
export const enquiryReportQueryKey = ["crm", "enquiries", "reports"] as const;
export const enquiryContactsQueryKey = ["crm", "enquiry", "core-contacts"] as const;
export const enquiryUsersQueryKey = ["crm", "enquiry", "tenant-users"] as const;
export const enquiryDetailQueryKey = (id: string) => ["crm", "enquiry", id] as const;

export const enquiryCommentsQueryKey = (id: string) => ["crm", "enquiry", id, "comments"] as const;
export const enquiryJobsQueryKey = (id: string) => ["crm", "enquiry", id, "jobs"] as const;
export const enquiryEstimatesQueryKey = (id: string) =>
  ["crm", "enquiry", id, "estimates"] as const;
export const enquiryActivityQueryKey = (id: string) => ["crm", "enquiry", id, "activity"] as const;
export const enquiryLocationsQueryKey = (id: string) =>
  ["crm", "enquiry", id, "locations"] as const;

export const useEnquirySummary = (enabled = true) =>
  useQuery({
    queryKey: enquirySummaryQueryKey,
    queryFn: () => getEnquirySummary(localToday()),
    enabled
  });
export const useEnquiryPage = (options: {
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
}) =>
  useQuery({
    queryKey: [
      ...enquiriesQueryKey,
      "page",
      options.scope,
      options.page,
      options.pageSize,
      options.search,
      options.mobile,
      options.contactId,
      options.columnFilters,
      options.filter,
      options.reportFilters,
      options.dateRange
    ],
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
    queryFn: () => listEnquiryPage(options)
  });
export const useEnquiryReport = (
  filters: EnquiryReportFilters,
  view: "list-in" | "creator" | "assignee" | "status"
) =>
  useQuery({
    queryKey: [
      ...enquiryReportQueryKey,
      view,
      filters.fromDate,
      filters.toDate,
      filters.listInId,
      filters.createdBy,
      filters.assignedUserId,
      filters.filter
    ],
    queryFn: () => listEnquiryReport(filters, view)
  });
export const useEnquiryOverviewActivity = () =>
  useQuery({
    queryKey: ["crm", "enquiry", "overview-activity"],
    queryFn: getEnquiryOverviewActivity
  });
export const useEnquiryAttention = (enabled = true) =>
  useQuery({
    queryKey: enquiryAttentionQueryKey,
    queryFn: () => getEnquiryAttention(localToday()),
    enabled,
    refetchInterval: 60_000
  });

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export const useEnquiryContacts = (enabled = true) =>
  useQuery({ queryKey: enquiryContactsQueryKey, queryFn: listCoreContacts, enabled });
export const useEnquiryOptions = (enabled = true) =>
  useQuery({
    queryKey: ["crm", "enquiries", "options"],
    queryFn: () =>
      crmRequest<{
        lists: import("./enquiry.types").EnquiryMasterLookup[];
        statuses: import("./enquiry.types").EnquiryMasterLookup[];
        priorities: import("./enquiry.types").EnquiryMasterLookup[];
        users: import("./enquiry.types").EnquiryLookup[];
        suppliers: import("./enquiry.types").EnquiryLookup[];
      }>("/crm/enquiries/options"),
    enabled
  });
export const useEnquiryUsers = (enabled = true) =>
  useQuery({ queryKey: enquiryUsersQueryKey, queryFn: listTenantUsers, enabled });
export function useCrmNavigationCounts(_email: string, enabled: boolean) {
  const summary = useQuery({
    queryKey: ["crm", "enquiries", "navigation-summary", localToday()],
    queryFn: () => getEnquirySummary(localToday()),
    enabled
  });
  return {
    assigned: summary.data?.assigned.active ?? 0,
    created: summary.data?.created.active ?? 0,
    all: summary.data?.all.active ?? 0
  };
}
export const useEnquiryDetail = (id: string) =>
  useQuery({
    queryKey: enquiryDetailQueryKey(id),
    queryFn: () => getEnquiry(id),
    refetchInterval: 15000
  });

export const useEnquiryComments = (id: string, poll = true) =>
  useQuery({
    queryKey: enquiryCommentsQueryKey(id),
    queryFn: () => listEnquiryComments(id),
    refetchInterval: poll ? 10000 : false
  });
export const useEnquiryJobs = (id: string, poll = true) =>
  useQuery({
    queryKey: enquiryJobsQueryKey(id),
    queryFn: () => listEnquiryJobs(id),
    refetchInterval: poll ? 10000 : false
  });
export const useEnquiryEstimates = (id: string) =>
  useQuery({ queryKey: enquiryEstimatesQueryKey(id), queryFn: () => listEnquiryEstimates(id) });
export const useEnquiryActivity = (id: string) =>
  useQuery({ queryKey: enquiryActivityQueryKey(id), queryFn: () => listEnquiryActivity(id) });
export const useEnquiryLocations = (id: string) =>
  useQuery({ queryKey: enquiryLocationsQueryKey(id), queryFn: () => listEnquiryLocations(id) });
