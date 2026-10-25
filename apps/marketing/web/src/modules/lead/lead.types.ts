export type LeadStatus = "new" | "contacted" | "qualified" | "disqualified" | "deferred";

export type LeadInput = {
  expectedRevision?: number | undefined;
  brandUuid?: string | undefined;
  campaignUuid?: string | undefined;
  name: string;
  email: string;
  phone: string;
  companyName?: string | undefined;
  status: LeadStatus;
  score?: number | undefined;
  source: string;
  assignedTo?: string | undefined;
  notes?: string | undefined;
};

export type LeadRecord = LeadInput & {
  uuid: string;
  companyId: number;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadColumnFilters = {
  name?: string | undefined;
  companyName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  source?: string | undefined;
  status?: string | undefined;
  assignedTo?: string | undefined;
};
