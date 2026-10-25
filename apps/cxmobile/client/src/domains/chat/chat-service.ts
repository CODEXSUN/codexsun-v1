/**
 * Chat Service Layer for cxmobile Native Transport
 * Exposes all supported M0 routes and actions:
 * - Direct messages, group channels, topic channels, broadcast channels.
 * - Realtime read cursor marking and channel synchronization.
 * - Channel membership administration (add/remove member, leave channel).
 * - Message send, edit, suspend, delete, reactions, and attachments.
 * - Optional Telegram dialogs and settings integration.
 */

import type { NativeHttpTransport } from "../../native/http.js";
import type {
  ChatChannel,
  ChatChannelDetail,
  ChatChannelKind,
  ChatChannelSavePayload,
  ChatMember,
  ChatMemberSavePayload,
  ChatMessage,
  ChatMessageSavePayload,
  ChatTelegramAccount,
  ChatTelegramConversation,
  ChatTelegramDialog,
  ChatUserOption,
  TelegramSendCodePayload
} from "./types.js";

export const MAX_CHAT_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

export class ChatService {
  private readonly transport: NativeHttpTransport;
  private readonly hasPermissionFn: (permission: string) => boolean;

  constructor(
    transport: NativeHttpTransport,
    hasPermissionFn: (permission: string) => boolean = () => true
  ) {
    this.transport = transport;
    this.hasPermissionFn = hasPermissionFn;
  }

  // ==========================================
  // 1. Users
  // ==========================================

  async listUsers(search = ""): Promise<ChatUserOption[]> {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    return this.transport.get<ChatUserOption[]>(`/chat/users${query}`);
  }

  // ==========================================
  // 2. Channels
  // ==========================================

  async listChannels(filters?: { limit?: number; search?: string }): Promise<ChatChannel[]> {
    const params = new URLSearchParams();
    if (filters?.search?.trim()) {
      params.set("search", filters.search.trim());
    }
    if (filters?.limit !== undefined) {
      params.set("limit", String(filters.limit));
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.get<ChatChannel[]>(`/chat/channels${query}`);
  }

  async getChannel(channelUuid: string): Promise<ChatChannelDetail> {
    if (!channelUuid) {
      throw new Error("Channel UUID is required.");
    }
    return this.transport.get<ChatChannelDetail>(`/chat/channels/${encodeURIComponent(channelUuid)}`);
  }

  async createChannel(payload: ChatChannelSavePayload): Promise<ChatChannel> {
    if (!payload.name?.trim()) {
      throw new Error("Channel name is required.");
    }
    const validKinds: ChatChannelKind[] = ["channel", "dm", "group", "broadcast"];
    if (!validKinds.includes(payload.kind)) {
      throw new Error(`Invalid channel kind: ${payload.kind}`);
    }
    return this.transport.post<ChatChannel>("/chat/channels", {
      kind: payload.kind,
      members: payload.members ?? [],
      name: payload.name.trim()
    });
  }

  async renameChannel(channelUuid: string, name: string): Promise<ChatChannel> {
    if (!name?.trim()) {
      throw new Error("Channel name is required.");
    }
    return this.transport.put<ChatChannel>(`/chat/channels/${encodeURIComponent(channelUuid)}`, {
      name: name.trim()
    });
  }

  async suspendChannel(channelUuid: string): Promise<ChatChannel> {
    return this.transport.post<ChatChannel>(
      `/chat/channels/${encodeURIComponent(channelUuid)}/suspend`,
      {}
    );
  }

  async restoreChannel(channelUuid: string): Promise<ChatChannel> {
    return this.transport.post<ChatChannel>(
      `/chat/channels/${encodeURIComponent(channelUuid)}/restore`,
      {}
    );
  }

  async forceDeleteChannel(channelUuid: string): Promise<{ uuid: string }> {
    return this.transport.delete<{ uuid: string }>(
      `/chat/channels/${encodeURIComponent(channelUuid)}`
    );
  }

  async markChannelRead(channelUuid: string, messageId?: number): Promise<{ uuid: string }> {
    const payload = messageId !== undefined ? { messageId } : {};
    return this.transport.post<{ uuid: string }>(
      `/chat/channels/${encodeURIComponent(channelUuid)}/read`,
      payload
    );
  }

  // ==========================================
  // 3. Channel Membership Administration
  // ==========================================

  async listMembers(channelUuid: string): Promise<ChatMember[]> {
    return this.transport.get<ChatMember[]>(
      `/chat/channels/${encodeURIComponent(channelUuid)}/members`
    );
  }

  async addMember(channelUuid: string, payload: ChatMemberSavePayload): Promise<ChatMember> {
    if (!payload.userEmail?.trim()) {
      throw new Error("Member userEmail is required.");
    }
    return this.transport.post<ChatMember>(
      `/chat/channels/${encodeURIComponent(channelUuid)}/members`,
      {
        role: payload.role ?? "member",
        userEmail: payload.userEmail.trim().toLowerCase()
      }
    );
  }

  async removeMember(channelUuid: string, memberUuid: string): Promise<{ uuid: string }> {
    if (!channelUuid || !memberUuid) {
      throw new Error("channelUuid and memberUuid are required for member removal.");
    }
    return this.transport.delete<{ uuid: string }>(
      `/chat/channels/${encodeURIComponent(channelUuid)}/members/${encodeURIComponent(memberUuid)}`
    );
  }

  async leaveChannel(channelUuid: string, currentMemberUuid: string): Promise<{ uuid: string }> {
    return this.removeMember(channelUuid, currentMemberUuid);
  }

  // ==========================================
  // 4. Messages & Attachments
  // ==========================================

  async listMessages(channelUuid: string, limit?: number): Promise<ChatMessage[]> {
    const params = new URLSearchParams();
    params.set("channelUuid", channelUuid);
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    return this.transport.get<ChatMessage[]>(`/chat/messages?${params.toString()}`);
  }

  async getMessage(messageUuid: string): Promise<ChatMessage> {
    return this.transport.get<ChatMessage>(`/chat/messages/${encodeURIComponent(messageUuid)}`);
  }

  async sendMessage(payload: ChatMessageSavePayload): Promise<ChatMessage> {
    if (!payload.channelUuid) {
      throw new Error("channelUuid is required to send a message.");
    }
    if (!payload.body?.trim() && (!payload.attachments || payload.attachments.length === 0)) {
      throw new Error("Message must have text body or attachments.");
    }
    if (payload.attachments && payload.attachments.length > MAX_CHAT_ATTACHMENTS) {
      throw new Error(`Maximum of ${MAX_CHAT_ATTACHMENTS} attachments per message allowed.`);
    }

    // Validate attachment format
    if (payload.attachments) {
      for (const att of payload.attachments) {
        if (!att.fileName?.trim()) throw new Error("Attachment fileName is required.");
        if (!att.mimeType?.trim()) throw new Error("Attachment mimeType is required.");
        if (!att.base64?.trim()) throw new Error("Attachment base64 content is required.");
      }
    }

    return this.transport.post<ChatMessage>("/chat/messages", {
      attachments: payload.attachments ?? [],
      body: payload.body ?? "",
      channelUuid: payload.channelUuid,
      ...(payload.replyToUuid ? { replyToUuid: payload.replyToUuid } : {})
    });
  }

  async updateMessage(messageUuid: string, body: string): Promise<ChatMessage> {
    if (!body?.trim()) {
      throw new Error("Message body is required.");
    }
    return this.transport.put<ChatMessage>(`/chat/messages/${encodeURIComponent(messageUuid)}`, {
      body: body.trim()
    });
  }

  async toggleReaction(messageUuid: string, emoji: string): Promise<ChatMessage> {
    if (!emoji?.trim()) {
      throw new Error("Reaction emoji is required.");
    }
    return this.transport.post<ChatMessage>(
      `/chat/messages/${encodeURIComponent(messageUuid)}/reactions`,
      { emoji: emoji.trim() }
    );
  }

  async suspendMessage(messageUuid: string): Promise<ChatMessage> {
    return this.transport.post<ChatMessage>(
      `/chat/messages/${encodeURIComponent(messageUuid)}/suspend`,
      {}
    );
  }

  async restoreMessage(messageUuid: string): Promise<ChatMessage> {
    return this.transport.post<ChatMessage>(
      `/chat/messages/${encodeURIComponent(messageUuid)}/restore`,
      {}
    );
  }

  async forceDeleteMessage(messageUuid: string): Promise<{ uuid: string }> {
    return this.transport.delete<{ uuid: string }>(
      `/chat/messages/${encodeURIComponent(messageUuid)}`
    );
  }

  // ==========================================
  // 5. Telegram Integration
  // ==========================================

  async getTelegramAccount(): Promise<ChatTelegramAccount | null> {
    return this.transport.get<ChatTelegramAccount | null>("/chat/telegram/account");
  }

  async requestTelegramCode(payload: TelegramSendCodePayload): Promise<ChatTelegramAccount | null> {
    return this.transport.post<ChatTelegramAccount | null>(
      "/chat/telegram/account/send-code",
      payload
    );
  }

  async verifyTelegramCode(code: string): Promise<ChatTelegramAccount | null> {
    return this.transport.post<ChatTelegramAccount | null>(
      "/chat/telegram/account/verify-code",
      { code }
    );
  }

  async verifyTelegramPassword(password: string): Promise<ChatTelegramAccount | null> {
    return this.transport.post<ChatTelegramAccount | null>(
      "/chat/telegram/account/verify-password",
      { password }
    );
  }

  async disconnectTelegram(): Promise<ChatTelegramAccount | null> {
    return this.transport.post<ChatTelegramAccount | null>(
      "/chat/telegram/account/disconnect",
      {}
    );
  }

  async refreshTelegramDialogs(): Promise<ChatTelegramAccount | null> {
    return this.transport.post<ChatTelegramAccount | null>(
      "/chat/telegram/dialogs/refresh",
      {}
    );
  }

  async listTelegramDialogs(): Promise<ChatTelegramDialog[]> {
    return this.transport.get<ChatTelegramDialog[]>("/chat/telegram/dialogs");
  }

  async linkTelegramDialog(
    dialogId: string,
    channelUuid: string | null
  ): Promise<{ linked: boolean }> {
    return this.transport.put<{ linked: boolean }>(
      `/chat/telegram/dialogs/${encodeURIComponent(dialogId)}/link`,
      { channelUuid }
    );
  }

  async listTelegramConversations(): Promise<ChatTelegramConversation[]> {
    return this.transport.get<ChatTelegramConversation[]>("/chat/telegram/conversations");
  }
}

// Standalone function exports matching billing domain style
export function createChatService(
  transport: NativeHttpTransport,
  hasPermissionFn?: (permission: string) => boolean
): ChatService {
  return new ChatService(transport, hasPermissionFn);
}
