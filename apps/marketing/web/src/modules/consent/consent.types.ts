export type ConsentAction = "grant" | "withdraw";

export type ConsentInput = {
  brandUuid: string;
  recipient: string;
  channel: string;
  purpose: string;
  action: ConsentAction;
  noticeVersion: string;
  evidence: string;
  source: string;
  occurredAt: string;
  expiresAt: string | null;
  requestKey: string;
};

export type ConsentRecord = ConsentInput & {
  uuid: string;
  companyId: number;
  createdBy: string;
  createdAt: string;
};

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
  checkedAt: string;
};

export type ConsentColumnFilters = {
  recipient?: string | undefined;
  brandUuid?: string | undefined;
  action?: string | undefined;
  noticeVersion?: string | undefined;
  createdBy?: string | undefined;
  source?: string | undefined;
};
