export type FollowUpActionType = "call" | "email" | "meeting" | "review";
export type FollowUpStatus = "pending" | "completed" | "cancelled";

export type FollowUpInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  leadUuid: string;
  actionType: FollowUpActionType;
  subject: string;
  notes?: string | undefined;
  dueAt: string;
  assignedTo: string;
  status?: FollowUpStatus | undefined;
};

export type FollowUpRecord = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  leadUuid: string;
  actionType: FollowUpActionType;
  subject: string;
  notes: string;
  dueAt: string;
  assignedTo: string;
  status: FollowUpStatus;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};
