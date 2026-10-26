import type { Kysely, Transaction } from "kysely";
export type LeadDatabase = Record<string, Record<string, unknown>>;
export type LeadIntake = {
  submissionUuid: string;
  campaignUuid: string;
  campaignLabel: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
};
export type LeadRecord = LeadIntake & {
  uuid: string;
  companyId: number;
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
  LeadIntake,
  "name" | "email" | "phone" | "message" | "campaignLabel"
> & {
  contactId: number | null;
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
export type LeadContact = { id: number; name: string; primaryPhone?: string | null };
export type LeadContext = {
  database: Kysely<LeadDatabase>;
  companyId: number;
  actorEmail: string;
  authorize: (permission: string) => Promise<void>;
  canViewAll?: boolean;
  contact?: (id: number) => Promise<LeadContact | null>;
  contacts?: (search: string) => Promise<LeadContact[]>;
  resolveContact?: (transaction: Transaction<LeadDatabase>, lead: LeadRecord) => Promise<number>;
};
