export type OutcomeStatus = "won" | "lost" | "nurture" | "unresponsive" | "withdrawn";

export type OutcomeInput = {
  expectedRevision?: number | undefined;
  leadUuid: string;
  conversionUuid?: string | undefined;
  status: OutcomeStatus;
  reason: string;
  declaredValue?: number | undefined;
  currency?: string | undefined;
  effectiveDate: string;
  previousOutcomeUuid?: string | undefined;
  notes?: string | undefined;
};

export type OutcomeRecord = OutcomeInput & {
  uuid: string;
  companyId: number;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OutcomeColumnFilters = {
  leadUuid?: string | undefined;
  status?: string | undefined;
  reason?: string | undefined;
};
