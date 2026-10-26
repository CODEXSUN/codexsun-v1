import type { LeadColumnFilters, LeadFilters } from "./lead.types";

export const leadFilterLabels = {
  name: "Contact",
  phone: "Mobile",
  message: "Enquiry details",
  campaignLabel: "Campaign",
  status: "Status"
};
export function isLeadFilterColumn(key: string): key is keyof LeadColumnFilters {
  return Object.hasOwn(leadFilterLabels, key);
}

export function buildLeadFilters(
  base: LeadFilters,
  range: { fromDate: string; toDate: string },
  columns: LeadColumnFilters
): LeadFilters {
  return {
    ...base,
    ...(range.fromDate ? { fromAt: dateBoundary(range.fromDate, 0) } : {}),
    ...(range.toDate ? { toAt: dateBoundary(range.toDate, 1) } : {}),
    searchName: columns.name,
    searchPhone: columns.phone,
    searchMessage: columns.message,
    searchCampaign: columns.campaignLabel,
    searchStatus: columns.status
  };
}

function dateBoundary(value: string, offset: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day! + offset).toISOString();
}
