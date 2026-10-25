export type ConversationChannel = "whatsapp" | "sms" | "chat";
export type ThreadStatus = "open" | "resolved" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type ThreadInput = {
  brandUuid: string;
  channel?: ConversationChannel | undefined;
  contactIdentifier: string; // phone number or handle
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

export type MessageInput = {
  content: string;
  templateName?: string | undefined;
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

export type NurtureTriggerEvent = "lead_created" | "inbound_message" | "manual";
export type NurtureEnrollmentStatus = "active" | "completed" | "stopped";
export type NurtureStopReason =
  | "reply"
  | "opt_out"
  | "conversion"
  | "human_takeover"
  | "channel_restriction";

export type NurtureRuleInput = {
  brandUuid: string;
  name: string;
  triggerEvent: NurtureTriggerEvent;
  maxSteps?: number | undefined;
  intervalHours?: number | undefined;
  templateName: string;
};

export type NurtureRuleRecord = {
  uuid: string;
  companyId: number;
  brandUuid: string;
  name: string;
  triggerEvent: NurtureTriggerEvent;
  maxSteps: number;
  intervalHours: number;
  templateName: string;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

export type NurtureEnrollmentRecord = {
  uuid: string;
  companyId: number;
  ruleUuid: string;
  threadUuid: string;
  leadUuid: string | null;
  stepNumber: number;
  status: NurtureEnrollmentStatus;
  stopReason: NurtureStopReason | null;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};

export type WhatsAppWebhookMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string } | undefined;
};

export type WhatsAppWebhookStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }> | undefined;
};
