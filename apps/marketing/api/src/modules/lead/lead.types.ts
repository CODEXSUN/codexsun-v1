export type LeadStatus = "new" | "contacted" | "qualified" | "disqualified" | "deferred";

export type LeadInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  campaignUuid?: string | undefined;
  captureUuid?: string | undefined;
  submissionUuid?: string | undefined;
  source?: string | undefined;
  sourceReference?: string | undefined;
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  companyName?: string | undefined;
  notes?: string | undefined;
  status?: LeadStatus | undefined;
  assignedTo?: string | undefined;
  score?: number | undefined;
};

export type LeadRecord = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  campaignUuid: string;
  captureUuid: string;
  submissionUuid: string;
  source: string;
  sourceReference: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  notes: string;
  status: LeadStatus;
  assignedTo: string;
  score: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};
