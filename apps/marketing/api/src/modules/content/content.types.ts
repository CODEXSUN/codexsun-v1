export type ContentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "cancelled";

export type ContentChannel =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "threads"
  | "pinterest"
  | "youtube"
  | "telegram";

export type ContentPublishMode = "api" | "manual";

export type ContentInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  campaignUuid?: string | null | undefined;
  title: string;
  body: string;
  channel: ContentChannel;
  publishMode?: ContentPublishMode | undefined;
  scheduledAt?: string | null | undefined;
  mediaUrls?: string[] | undefined;
  status?: ContentStatus | undefined;
  rejectionReason?: string | null | undefined;
  manualTaskNotes?: string | null | undefined;
};

export type ContentRecord = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  campaignUuid: string | null;
  title: string;
  body: string;
  channel: ContentChannel;
  publishMode: ContentPublishMode;
  status: ContentStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  mediaUrls: string[];
  rejectionReason: string | null;
  manualTaskNotes: string | null;
  manualCompletedAt: string | null;
  manualCompletedBy: string | null;
  externalPostId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};
