export type EmailCampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled"
  | "sending"
  | "completed"
  | "paused"
  | "cancelled";

export type RecipientStatus =
  | "enqueued"
  | "sending"
  | "sent"
  | "suppressed"
  | "failed"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "cancelled";

export type EmailSenderStatus = "verified" | "unverified" | "failed";

export type EmailSenderInput = {
  brandUuid: string;
  name: string;
  email: string;
  domain: string;
};

export type EmailSenderRecord = EmailSenderInput & {
  uuid: string;
  companyId: number;
  spfStatus: EmailSenderStatus;
  dkimStatus: EmailSenderStatus;
  dmarcStatus: EmailSenderStatus;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmailCampaignInput = {
  brandUuid: string;
  campaignUuid?: string | null | undefined;
  senderUuid: string;
  name: string;
  subject: string;
  preheader?: string | undefined;
  bodyHtml: string;
  bodyText: string;
  scheduledAt?: string | null | undefined;
  expectedRevision?: number | undefined;
};

export type EmailCampaignRecord = {
  uuid: string;
  companyId: number;
  brandUuid: string;
  campaignUuid: string | null;
  senderUuid: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  name: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
  bodyText: string;
  status: EmailCampaignStatus;
  rejectionReason: string | null;
  scheduledAt: string | null;
  sentCount: number;
  suppressedCount: number;
  bouncedCount: number;
  complainedCount: number;
  unsubscribedCount: number;
  totalRecipients: number;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EmailCampaignRecipient = {
  uuid: string;
  companyId: number;
  emailCampaignUuid: string;
  recipientEmail: string;
  leadUuid: string | null;
  status: RecipientStatus;
  suppressionReason: string | null;
  unsubscribeToken: string;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailCampaignActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};

export type EmailPreviewResult = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
  variablesUsed: string[];
  unresolvedVariables: string[];
};

export type DispatchBatchResult = {
  processed: number;
  sent: number;
  suppressed: number;
  cancelled: number;
  failed: number;
  remaining: number;
};
