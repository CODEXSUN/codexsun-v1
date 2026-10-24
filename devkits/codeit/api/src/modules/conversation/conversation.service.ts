import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { NotFoundError, ValidationError } from "../../errors.js";
import type { ConversationRepository } from "./conversation.repository.js";
import {
  type AppendMessageInput,
  AppendMessageInputSchema,
  type ConversationRecord,
  type CreateConversationInput,
  CreateConversationInputSchema,
  HexUuidSchema,
  type ListMessagesOptions,
  type ListMessagesResult,
  type MessageCompletionState,
  type MessageRecord
} from "./conversation.types.js";

export class ConversationService {
  constructor(
    private readonly repo: ConversationRepository,
    private readonly db: DatabaseSync
  ) {}

  private verifyProjectExists(projectUuid: string): void {
    const row = this.db.prepare("SELECT uuid FROM codeit_projects WHERE uuid = ?").get(projectUuid);
    if (!row) {
      throw new NotFoundError(`Project not found with UUID: ${projectUuid}`, {
        project_uuid: projectUuid
      });
    }
  }

  private generateUniqueUuid(checkExists: (uuid: string) => boolean): string {
    for (let i = 0; i < 10; i++) {
      const candidate = randomBytes(4).toString("hex").toLowerCase();
      if (!checkExists(candidate)) {
        return candidate;
      }
    }
    throw new Error("Failed to generate unique UUID after multiple attempts");
  }

  createConversation(input: CreateConversationInput): ConversationRecord {
    const parseResult = CreateConversationInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError("Invalid conversation input payload", {
        errors: parseResult.error.issues
      });
    }

    const { project_uuid, title, mode, selected_mode } = parseResult.data;
    this.verifyProjectExists(project_uuid);

    const uuid = this.generateUniqueUuid((cand) => Boolean(this.repo.findConversationByUuid(cand)));
    const now = new Date().toISOString();

    return this.repo.insertConversation({
      uuid,
      project_uuid,
      title: title.trim(),
      selected_mode: selected_mode ?? mode ?? "plan",
      archived: false,
      created_at: now,
      updated_at: now
    });
  }

  listConversationsByProject(project_uuid: string): ConversationRecord[] {
    const parseUuid = HexUuidSchema.safeParse(project_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid project UUID format", { project_uuid });
    }

    this.verifyProjectExists(parseUuid.data);
    return this.repo.findConversationsByProject(parseUuid.data);
  }

  getConversationByUuid(uuid: string): ConversationRecord {
    const parseUuid = HexUuidSchema.safeParse(uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid conversation UUID format", { uuid });
    }

    const conversation = this.repo.findConversationByUuid(parseUuid.data);
    if (!conversation) {
      throw new NotFoundError(`Conversation not found with UUID: ${uuid}`, { uuid });
    }

    return conversation;
  }

  appendMessage(conversation_uuid: string, input: AppendMessageInput): MessageRecord {
    const parseUuid = HexUuidSchema.safeParse(conversation_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid conversation UUID format", { conversation_uuid });
    }

    // 1. Verify conversation exists
    const conversation = this.repo.findConversationByUuid(parseUuid.data);
    if (!conversation) {
      throw new NotFoundError(`Conversation not found with UUID: ${conversation_uuid}`, {
        conversation_uuid
      });
    }

    // 2. Validate input payload
    const parseInput = AppendMessageInputSchema.safeParse(input);
    if (!parseInput.success) {
      throw new ValidationError("Invalid message input payload", {
        errors: parseInput.error.issues
      });
    }

    const { role, content, request_key, completion_state } = parseInput.data;

    // 3. Idempotency deduplication check via request_key
    if (request_key && request_key.trim().length > 0) {
      const existing = this.repo.findMessageByRequestKey(conversation.uuid, request_key.trim());
      if (existing) {
        // Return existing record idempotently without side effects
        return existing;
      }
    }

    // 4. Generate unique message UUID
    const uuid = this.generateUniqueUuid((cand) => Boolean(this.repo.findMessageByUuid(cand)));
    const now = new Date().toISOString();

    const state: MessageCompletionState =
      completion_state ?? (role === "assistant" ? "streaming" : "final");

    const message = this.repo.insertMessage({
      uuid,
      conversation_uuid: conversation.uuid,
      role,
      content,
      request_key: request_key ? request_key.trim() : null,
      completion_state: state,
      created_at: now,
      updated_at: now
    });

    this.repo.touchConversation(conversation.uuid);
    return message;
  }

  listMessages(conversation_uuid: string, options: ListMessagesOptions = {}): ListMessagesResult {
    const parseUuid = HexUuidSchema.safeParse(conversation_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid conversation UUID format", { conversation_uuid });
    }

    const conversation = this.repo.findConversationByUuid(parseUuid.data);
    if (!conversation) {
      throw new NotFoundError(`Conversation not found with UUID: ${conversation_uuid}`, {
        conversation_uuid
      });
    }

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);

    let afterId = 0;
    if (options.cursor) {
      const cursorStr = String(options.cursor).trim();
      if (/^[0-9a-f]{8}$/.test(cursorStr)) {
        const cursorMsg = this.repo.findMessageByUuid(cursorStr);
        if (cursorMsg && cursorMsg.id !== undefined) {
          afterId = cursorMsg.id;
        }
      } else if (/^\d+$/.test(cursorStr)) {
        afterId = Number(cursorStr);
      }
    }

    // Query limit + 1 to detect if next page exists
    const messages = this.repo.findMessagesByConversation(conversation.uuid, {
      limit: limit + 1,
      afterId
    });

    let nextCursor: string | null = null;
    let items = messages;

    if (messages.length > limit) {
      items = messages.slice(0, limit);
      const lastItem = items[items.length - 1];
      nextCursor = lastItem ? lastItem.uuid : null;
    }

    return {
      items,
      next_cursor: nextCursor
    };
  }

  updateMessage(
    uuid: string,
    updates: { content?: string; completion_state?: MessageCompletionState }
  ): MessageRecord {
    const parseUuid = HexUuidSchema.safeParse(uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid message UUID format", { uuid });
    }

    const updated = this.repo.updateMessage(parseUuid.data, updates);
    if (!updated) {
      throw new NotFoundError(`Message not found with UUID: ${uuid}`, { uuid });
    }
    return updated;
  }
}
