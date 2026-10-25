export type ContentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "cancelled";

export type ContentChannel =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "threads"
  | "pinterest"
  | "youtube"
  | "google-business"
  | "telegram"
  | "website"
  | "email";

export type ContentPublishMode = "api" | "manual";

export type ContentInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  campaignUuid?: string | undefined;
  title: string;
  channel: ContentChannel;
  publishMode: ContentPublishMode;
  body: string;
  mediaUrl?: string | undefined;
  scheduledAt?: string | null | undefined;
};

export type ContentRecord = ContentInput & {
  uuid: string;
  companyId: number;
  status: ContentStatus;
  nativePostId?: string | null | undefined;
  rejectionReason?: string | null | undefined;
  publishedAt?: string | null | undefined;
  publishedBy?: string | null | undefined;
  manualNotes?: string | null | undefined;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentActivity = {
  action: string;
  actor: string;
  occurredAt: string;
  details?: string | undefined;
};

export type ContentColumnFilters = {
  title?: string | undefined;
  channel?: string | undefined;
  publishMode?: string | undefined;
  brandUuid?: string | undefined;
  campaignUuid?: string | undefined;
  status?: string | undefined;
  updatedBy?: string | undefined;
};

export type ContentFilter = ContentColumnFilters & {
  search?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
};

export type ContentBrandOption = {
  uuid: string;
  name: string;
  status: string;
};

export type ContentCampaignOption = {
  uuid: string;
  name: string;
  brandUuid: string;
  status: string;
};
