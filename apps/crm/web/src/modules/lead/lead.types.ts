export type LeadRecord = {
  uuid: string;
  companyId: number;
  submissionUuid: string;
  campaignUuid: string;
  campaignLabel: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
  assignedTo: string;
  status: "review" | "qualified" | "lost" | "converted";
  taskId: number | null;
  contactId: number | null;
  enquiryId: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type LeadInput = Pick<
  LeadRecord,
  "name" | "email" | "phone" | "message" | "campaignLabel" | "contactId"
> & {
  status: "review" | "qualified" | "lost";
  revision?: number | undefined;
};
export type LeadFilters = {
  search: string;
  status: string;
  page: number;
  pageSize: number;
  fromAt?: string | undefined;
  toAt?: string | undefined;
  searchName?: string | undefined;
  searchPhone?: string | undefined;
  searchMessage?: string | undefined;
  searchCampaign?: string | undefined;
  searchStatus?: string | undefined;
};
export type LeadColumnFilters = Partial<
  Record<"name" | "phone" | "message" | "campaignLabel" | "status", string>
>;
export type LeadContact = { id: number; name: string; primaryPhone?: string | null };
export type LeadCapabilities = { canCreate: boolean; canUpdate: boolean; canConvert: boolean };
export type LeadActivity = { action: string; actor: string; details: string; createdAt: string };
export const leadStatusLabels = {
  review: "Needs review",
  qualified: "Qualified",
  lost: "Lost",
  converted: "Converted"
};
