export type ConversationChannel = "whatsapp" | "sms" | "chat";
export type ThreadStatus = "open" | "resolved" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type ThreadInput = {
  brandUuid: string;
  channel?: ConversationChannel | undefined;
  contactIdentifier: string;
  contactName?: string | undefined;
  leadUuid?: string | undefined;
  assignedTo?: string | undefined;
};

export type ThreadRecord = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  channel: ConversationChannel;
  contactIdentifier: string;
  contactName: string;
  leadUuid: string | null;
  status: ThreadStatus;
  assignedTo: string | null;
  isHumanTakeover: boolean;
  stopConditionMet: boolean;
  lastInboundAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRecord = {
  uuid: string;
  companyId: number;
  threadUuid: string;
  direction: MessageDirection;
  sender: string;
  content: string;
  templateName: string | null;
  status: MessageStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ThreadDetailRecord = ThreadRecord & {
  messages: MessageRecord[];
  inServiceWindow: boolean;
};

export type NurtureEnrollmentRecord = {
  uuid: string;
  companyId: number;
  ruleUuid: string;
  threadUuid: string;
  leadUuid: string | null;
  stepNumber: number;
  status: "active" | "completed" | "stopped";
  stopReason: string | null;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};
