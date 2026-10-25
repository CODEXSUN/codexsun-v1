export type OutcomeDisposition = "won" | "lost" | "nurture" | "unresponsive" | "withdrawn";

export type OutcomeInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  leadUuid: string;
  qualificationUuid?: string | undefined;
  conversionUuid?: string | undefined;
  disposition: OutcomeDisposition;
  reason: string;
  previousOutcomeUuid?: string | undefined;
  notes?: string | undefined;
};

export type OutcomeRecord = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  leadUuid: string;
  qualificationUuid: string;
  conversionUuid: string;
  disposition: OutcomeDisposition;
  reason: string;
  previousOutcomeUuid: string | null;
  notes: string;
  decidedAt: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OutcomeActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};
