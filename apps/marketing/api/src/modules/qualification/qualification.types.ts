export type QualificationDecision = "qualified" | "disqualified" | "deferred";

export type QualificationInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  leadUuid: string;
  decision: QualificationDecision;
  criteria?: string | undefined;
  reason: string;
  notes?: string | undefined;
};

export type QualificationRecord = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  leadUuid: string;
  reviewer: string;
  decision: QualificationDecision;
  criteria: string;
  reason: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type QualificationActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};
