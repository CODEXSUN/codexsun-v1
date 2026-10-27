import type { FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import type { TelegramDependencies } from "./chat.telegram.types.js";

export type ChatChannelKind = "channel" | "dm" | "group" | "broadcast";
export type ChatStatus = "active" | "inactive";
export type ChatMemberRole = "admin" | "member";

export type ChatUserOption = {
  email: string;
  name: string;
};

export type ChatRuntimeContext = {
  actorEmail: string;
  authorize: (permission: string) => Promise<void>;
  companyId: number;
  database: Kysely<Record<string, Record<string, unknown>>>;
  tenantDatabase: string;
  tenantId: string;
};

export type ChatModuleDependencies = {
  telegram?: TelegramDependencies;
  telegramExecution?: boolean;
  subscribeExternalMessages?: (
    publish: (context: ChatRuntimeContext, message: ChatMessage) => Promise<void>
  ) => Promise<() => Promise<void>>;
  audit?: (context: ChatRuntimeContext, action: string, uuid: string) => Promise<void>;
  events?: ChatRealtimeEvents;
  resolveContext: (request: FastifyRequest) => ChatRuntimeContext | Promise<ChatRuntimeContext>;
};

export type ChatRealtimeEvents = {
  messageChanged: (
    context: ChatRuntimeContext,
    channelUuid: string,
    message: ChatMessage
  ) => Promise<void>;
  messageCreated: (
    context: ChatRuntimeContext,
    channelUuid: string,
    message: ChatMessage
  ) => Promise<void>;
  messageDeleted: (context: ChatRuntimeContext, channelUuid: string, uuid: string) => Promise<void>;
};

export type ChatChannelSavePayload = {
  kind: ChatChannelKind;
  members?: string[];
  name: string;
};

export type ChatMemberSavePayload = {
  role?: ChatMemberRole;
  userEmail: string;
};

export type ChatMessageSavePayload = {
  attachments?: ChatAttachmentPayload[];
  body: string;
  channelUuid: string;
  replyToUuid?: string;
};

export type ChatAttachmentPayload = {
  base64: string;
  fileName: string;
  mimeType: string;
};

export type ChatAttachment = {
  contentBase64: string;
  fileName: string;
  id: number;
  mimeType: string;
  sizeBytes: number;
  uuid: string;
};

export type ChatMember = {
  createdAt: string;
  id: number;
  role: ChatMemberRole;
  status: ChatStatus;
  userEmail: string;
  uuid: string;
};

export type ChatChannelListFilters = {
  limit?: number;
  search?: string;
};

export type ChatMessageListFilters = {
  channelUuid: string;
  limit?: number;
};

export type ChatChannel = {
  createdAt: string;
  id: number;
  kind: ChatChannelKind;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
  name: string;
  status: ChatStatus;
  unreadCount: number;
  updatedAt: string;
  uuid: string;
};

export type ChatChannelDetail = {
  channel: ChatChannel;
  members: ChatMember[];
  messages: ChatMessage[];
};

export type ChatMessageReply = {
  body: string;
  senderEmail: string;
  uuid: string;
};

export type ChatMessageReaction = {
  count: number;
  emoji: string;
  own: boolean;
};

export type ChatMessage = {
  attachments: ChatAttachment[];
  body: string;
  channelUuid: string;
  createdAt: string;
  editedAt: string | null;
  id: number;
  reactions: ChatMessageReaction[];
  reply: ChatMessageReply | null;
  senderEmail: string;
  status: ChatStatus;
  updatedAt: string;
  uuid: string;
};
