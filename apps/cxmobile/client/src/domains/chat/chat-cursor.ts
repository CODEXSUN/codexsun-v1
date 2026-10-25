/**
 * Read Cursor Synchronization and Message Deduplication Engine
 * Solves:
 * - Same-second cursor tracking (sub-second or same-second timestamp disambiguation using monotonic ID/UUID).
 * - Exact unread count updates.
 * - Deduplication guarantees across realtime frames and sync batch ingestion.
 */

import type { ChatMessage, ChatReadCursor } from "./types.js";

/**
 * Determines whether a message is unread relative to a given read cursor.
 * Handles same-second cursor collision disambiguation via message ID and UUID.
 */
export function isMessageUnread(
  message: ChatMessage,
  cursor: ChatReadCursor | null,
  currentUserEmail?: string
): boolean {
  // If the message was authored by the current user, it does not increment unread count
  if (
    currentUserEmail &&
    message.senderEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
  ) {
    return false;
  }

  // If no cursor exists or never marked read, any incoming message is unread
  if (!cursor || !cursor.lastReadAt) {
    return true;
  }

  // Fast path: distinct timestamps
  if (message.createdAt > cursor.lastReadAt) {
    return true;
  }
  if (message.createdAt < cursor.lastReadAt) {
    return false;
  }

  // Same-second disambiguation: message.createdAt === cursor.lastReadAt
  if (cursor.lastMessageUuid && message.uuid === cursor.lastMessageUuid) {
    return false;
  }

  if (cursor.lastMessageId !== undefined && message.id !== undefined) {
    return message.id > cursor.lastMessageId;
  }

  // If timestamps are equal and no ID disambiguation, assume read if matched
  return false;
}

/**
 * Computes exact unread message count for a collection of messages.
 */
export function calculateUnreadCount(
  messages: ChatMessage[],
  cursor: ChatReadCursor | null,
  currentUserEmail?: string
): number {
  let count = 0;
  for (const message of messages) {
    if (message.status === "active" && isMessageUnread(message, cursor, currentUserEmail)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Creates a cursor reflecting that the given message (and all predecessors) has been read.
 */
export function createReadCursor(channelUuid: string, lastMessage: ChatMessage): ChatReadCursor {
  return {
    channelUuid,
    lastMessageId: lastMessage.id,
    lastMessageUuid: lastMessage.uuid,
    lastReadAt: lastMessage.createdAt
  };
}

/**
 * Merges and deduplicates message streams (e.g. combining cached, HTTP fetched, and realtime frames).
 * Guarantees zero duplicate UUIDs and preserves chronological order (createdAt ascending, then id ascending).
 */
export function mergeMessages(
  existingMessages: ChatMessage[],
  incomingMessages: ChatMessage[]
): ChatMessage[] {
  const messageMap = new Map<string, ChatMessage>();

  // Ingest existing
  for (const msg of existingMessages) {
    messageMap.set(msg.uuid, msg);
  }

  // Merge incoming (incoming updates existing fields like reactions, status, editedAt)
  for (const msg of incomingMessages) {
    const existing = messageMap.get(msg.uuid);
    if (!existing) {
      messageMap.set(msg.uuid, msg);
    } else {
      messageMap.set(msg.uuid, {
        ...existing,
        ...msg,
        // Preserve reactions or attachments if incoming doesn't overwrite
        reactions: msg.reactions ?? existing.reactions,
        attachments: msg.attachments ?? existing.attachments
      });
    }
  }

  const merged = Array.from(messageMap.values());

  // Chronological sort
  merged.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });

  return merged;
}

/**
 * Stateful Read Cursor & Channel Message Store
 */
export class ChatCursorTracker {
  private readonly cursors = new Map<string, ChatReadCursor>();
  private readonly channelMessages = new Map<string, ChatMessage[]>();
  private readonly currentUserEmail: string | undefined;

  constructor(currentUserEmail?: string | undefined) {
    this.currentUserEmail = currentUserEmail?.trim().toLowerCase();
  }

  getCursor(channelUuid: string): ChatReadCursor | null {
    return this.cursors.get(channelUuid) ?? null;
  }

  setCursor(channelUuid: string, cursor: ChatReadCursor): void {
    this.cursors.set(channelUuid, cursor);
  }

  getMessages(channelUuid: string): ChatMessage[] {
    return this.channelMessages.get(channelUuid) ?? [];
  }

  /**
   * Ingests messages into channel store, merges duplicates, and returns updated list.
   */
  ingest(channelUuid: string, incoming: ChatMessage | ChatMessage[]): ChatMessage[] {
    const current = this.channelMessages.get(channelUuid) ?? [];
    const array = Array.isArray(incoming) ? incoming : [incoming];
    const merged = mergeMessages(current, array);
    this.channelMessages.set(channelUuid, merged);
    return merged;
  }

  /**
   * Advances cursor to the specified message or latest message in channel.
   */
  markRead(channelUuid: string, specificMessage?: ChatMessage): ChatReadCursor | null {
    const messages = this.getMessages(channelUuid);
    const target = specificMessage ?? messages[messages.length - 1];
    if (!target) {
      const nowCursor: ChatReadCursor = {
        channelUuid,
        lastReadAt: new Date().toISOString()
      };
      this.cursors.set(channelUuid, nowCursor);
      return nowCursor;
    }

    const cursor = createReadCursor(channelUuid, target);
    this.cursors.set(channelUuid, cursor);
    return cursor;
  }

  /**
   * Returns unread count for the channel.
   */
  getUnreadCount(channelUuid: string): number {
    const messages = this.getMessages(channelUuid);
    const cursor = this.getCursor(channelUuid);
    return calculateUnreadCount(messages, cursor, this.currentUserEmail);
  }
}
