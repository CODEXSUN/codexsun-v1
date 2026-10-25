export type QualificationDecision = "qualified" | "disqualified" | "deferred";

export type QualificationInput = {
  expectedRevision?: number | undefined;
  leadUuid: string;
  decision: QualificationDecision;
  criteria: string;
  reason: string;
  score?: number | undefined;
  reviewer: string;
  notes?: string | undefined;
};

export type QualificationRecord = QualificationInput & {
  uuid: string;
  companyId: number;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type QualificationColumnFilters = {
  leadUuid?: string | undefined;
  decision?: string | undefined;
  criteria?: string | undefined;
  reason?: string | undefined;
  reviewer?: string | undefined;
};
