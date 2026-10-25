import type { MarketingContext } from "../../context.js";

export type ConsentInput = {
  brandUuid: string;
  recipient: string;
  channel: "email";
  purpose: "promotional";
  action: "grant" | "withdraw";
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

export type EligibilityInput = Pick<
  ConsentInput,
  "brandUuid" | "recipient" | "channel" | "purpose"
>;

export type PolicyResult = { allowed: boolean; reason: string };

export type EligibilityResult = {
  eligible: boolean;
  checkedAt: string;
  consentUuid: string | null;
  reasons: string[];
};

export type ContactRestrictionChannel = "email" | "phone" | "all";

export type ContactRestrictionInput = {
  recipient: string;
  channel: ContactRestrictionChannel;
  blocked: boolean;
  reason: string;
};

export type ContactRestrictionRecord = ContactRestrictionInput & {
  uuid: string;
  companyId: number;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ConsentDependencies = {
  brand(context: MarketingContext, uuid: string): Promise<{ status: string }>;
  mail(context: MarketingContext, recipient: string): Promise<PolicyResult>;
  crm?(context: MarketingContext, recipient: string): Promise<PolicyResult>;
};
