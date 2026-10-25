/**
 * Chat Domain Type Definitions for cxmobile Client
 * Covers all M0 workflows: Direct messages, group channels, topic channels, broadcast channels,
 * realtime lifecycle, membership administration, read cursor tracking, attachments, and Telegram integration.
 */

export type ChatChannelKind = "channel" | "dm" | "group" | "broadcast";
export type ChatStatus = "active" | "inactive";
export type ChatMemberRole = "admin" | "member";

export interface ChatUserOption {
  email: string;
  name: string;
}

export interface ChatChannel {
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
}

export interface ChatChannelDetail {
  channel: ChatChannel;
  members: ChatMember[];
  messages: ChatMessage[];
}

export interface ChatChannelSavePayload {
  kind: ChatChannelKind;
  members?: string[];
  name: string;
}

export interface ChatChannelUpdatePayload {
  name: string;
}

export interface ChatMember {
  createdAt: string;
  id: number;
  role: ChatMemberRole;
  status: ChatStatus;
  userEmail: string;
  uuid: string;
}

export interface ChatMemberSavePayload {
  role?: ChatMemberRole;
  userEmail: string;
}

export interface ChatAttachment {
  contentBase64: string;
  fileName: string;
  id: number;
  mimeType: string;
  sizeBytes: number;
  uuid: string;
}

export interface ChatAttachmentPayload {
  base64: string;
  fileName: string;
  mimeType: string;
}

export interface ChatMessageReply {
  body: string;
  senderEmail: string;
  uuid: string;
}

export interface ChatMessageReaction {
  count: number;
  emoji: string;
  own: boolean;
}

export interface ChatMessage {
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
}

export interface ChatMessageSavePayload {
  attachments?: ChatAttachmentPayload[];
  body: string;
  channelUuid: string;
  replyToUuid?: string;
}

export interface ChatMessageUpdatePayload {
  body: string;
}

// Telegram Integration Contracts
export interface ChatTelegramAccount {
  accountLabel: string;
  apiId: number;
  authState: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  phoneLabel: string;
  uuid: string;
}

export interface ChatTelegramDialog {
  channelUuid: string | null;
  title: string;
  uuid: string;
}

export interface ChatTelegramConversation {
  channelName: string;
  channelUuid: string;
}

export interface TelegramSendCodePayload {
  apiHash: string;
  apiId: number;
  phone: string;
}

// Realtime & Protocol Contracts
export type ChatRealtimeStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

export interface ChatRealtimeEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  payload: T;
  timestamp?: string;
}

export interface ChatRealtimeHandlers {
  onError?: (error: Error | string) => void;
  onMessageChanged?: (message: ChatMessage, channelUuid: string) => void;
  onMessageCreated?: (message: ChatMessage, channelUuid: string) => void;
  onMessageDeleted?: (channelUuid: string, uuid: string) => void;
  onPresence?: (channelUuid: string, onlineEmails: string[]) => void;
  onReadAck?: (channelUuid: string) => void;
  onStatusChange?: (status: ChatRealtimeStatus) => void;
  onSyncCompleted?: (channelUuid: string, messages: ChatMessage[]) => void;
  onTyping?: (channelUuid: string, userEmail: string, typing: boolean) => void;
}

// Read Cursor and Synchronization Contracts
export interface ChatReadCursor {
  channelUuid: string;
  lastMessageId?: number | undefined;
  lastMessageUuid?: string | undefined;
  lastReadAt: string;
}

export interface ChatSyncRequest {
  after: string;
  channelUuid: string;
  limit?: number;
}

// Error Hierarchies
export class ChatPermissionDeniedError extends Error {
  public readonly code: string;
  public readonly requiredPermission: string | undefined;

  constructor(message: string, code = "PERMISSION_DENIED", requiredPermission?: string | undefined) {
    super(message);
    this.name = "ChatPermissionDeniedError";
    this.code = code;
    this.requiredPermission = requiredPermission;
  }
}

export class ChatMembershipError extends Error {
  public readonly code: string;

  constructor(message: string, code = "MEMBERSHIP_DENIED") {
    super(message);
    this.name = "ChatMembershipError";
    this.code = code;
  }
}
