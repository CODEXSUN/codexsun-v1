export type FollowUpType = "call" | "email" | "meeting" | "review";
export type FollowUpStatus = "pending" | "completed" | "cancelled";

export type FollowUpInput = {
  expectedRevision?: number | undefined;
  leadUuid: string;
  type: FollowUpType;
  title: string;
  scheduledAt: string;
  dueAt?: string | undefined;
  status: FollowUpStatus;
  assignedTo?: string | undefined;
  notes?: string | undefined;
  completedAt?: string | undefined;
};

export type FollowUpRecord = FollowUpInput & {
  uuid: string;
  companyId: number;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpColumnFilters = {
  title?: string | undefined;
  leadUuid?: string | undefined;
  type?: string | undefined;
  status?: string | undefined;
  assignedTo?: string | undefined;
};
