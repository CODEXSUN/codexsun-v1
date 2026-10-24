import type { DatabaseSync } from "node:sqlite";
import type {
  ConversationMode,
  ConversationRecord,
  MessageCompletionState,
  MessageRecord,
  MessageRole
} from "./conversation.types.js";

interface ConversationRow {
  id: number;
  uuid: string;
  project_uuid: string;
  title: string;
  selected_mode: string;
  archived: number;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: number;
  uuid: string;
  conversation_uuid: string;
  role: string;
  content: string;
  request_key: string | null;
  completion_state: string;
  created_at: string;
  updated_at: string;
}

function mapConversationRow(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    project_uuid: row.project_uuid,
    title: row.title,
    selected_mode: row.selected_mode as ConversationMode,
    archived: Boolean(row.archived),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapMessageRow(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    conversation_uuid: row.conversation_uuid,
    role: row.role as MessageRole,
    content: row.content,
    request_key: row.request_key ?? null,
    completion_state: row.completion_state as MessageCompletionState,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class ConversationRepository {
  constructor(private readonly db: DatabaseSync) {}

  findConversationByUuid(uuid: string): ConversationRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_conversations WHERE uuid = ?")
      .get(uuid) as unknown as ConversationRow | undefined;
    return row ? mapConversationRow(row) : null;
  }

  findConversationsByProject(project_uuid: string): ConversationRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM codeit_conversations WHERE project_uuid = ? ORDER BY id DESC")
      .all(project_uuid) as unknown as ConversationRow[];
    return rows.map(mapConversationRow);
  }

  insertConversation(data: Omit<ConversationRecord, "id">): ConversationRecord {
    const stmt = this.db.prepare(`
      INSERT INTO codeit_conversations (uuid, project_uuid, title, selected_mode, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.uuid,
      data.project_uuid,
      data.title,
      data.selected_mode,
      data.archived ? 1 : 0,
      data.created_at,
      data.updated_at
    );

    const insertedId =
      typeof result.lastInsertRowid === "bigint"
        ? Number(result.lastInsertRowid)
        : result.lastInsertRowid;

    return {
      id: insertedId,
      ...data
    };
  }

  updateConversation(
    uuid: string,
    updates: Partial<Pick<ConversationRecord, "title" | "selected_mode" | "archived">>
  ): ConversationRecord | null {
    const existing = this.findConversationByUuid(uuid);
    if (!existing) return null;

    const title = updates.title ?? existing.title;
    const mode = updates.selected_mode ?? existing.selected_mode;
    const archived =
      updates.archived !== undefined ? (updates.archived ? 1 : 0) : existing.archived ? 1 : 0;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        UPDATE codeit_conversations
        SET title = ?, selected_mode = ?, archived = ?, updated_at = ?
        WHERE uuid = ?
      `
      )
      .run(title, mode, archived, now, uuid);

    return this.findConversationByUuid(uuid);
  }

  touchConversation(uuid: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE codeit_conversations SET updated_at = ? WHERE uuid = ?").run(now, uuid);
  }

  deleteConversation(uuid: string): boolean {
    const result = this.db.prepare("DELETE FROM codeit_conversations WHERE uuid = ?").run(uuid);
    return Number(result.changes) > 0;
  }

  findMessageByUuid(uuid: string): MessageRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_messages WHERE uuid = ?")
      .get(uuid) as unknown as MessageRow | undefined;
    return row ? mapMessageRow(row) : null;
  }

  findMessageByRequestKey(conversation_uuid: string, request_key: string): MessageRecord | null {
    const row = this.db
      .prepare(
        "SELECT * FROM codeit_messages WHERE conversation_uuid = ? AND request_key = ? LIMIT 1"
      )
      .get(conversation_uuid, request_key) as unknown as MessageRow | undefined;
    return row ? mapMessageRow(row) : null;
  }

  findMessagesByConversation(
    conversation_uuid: string,
    options: { limit?: number; afterId?: number } = {}
  ): MessageRecord[] {
    const limit = options.limit ?? 50;
    const afterId = options.afterId ?? 0;

    const rows = this.db
      .prepare(
        "SELECT * FROM codeit_messages WHERE conversation_uuid = ? AND id > ? ORDER BY id ASC LIMIT ?"
      )
      .all(conversation_uuid, afterId, limit) as unknown as MessageRow[];

    return rows.map(mapMessageRow);
  }

  insertMessage(data: Omit<MessageRecord, "id">): MessageRecord {
    const stmt = this.db.prepare(`
      INSERT INTO codeit_messages (uuid, conversation_uuid, role, content, request_key, completion_state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.uuid,
      data.conversation_uuid,
      data.role,
      data.content,
      data.request_key ?? null,
      data.completion_state,
      data.created_at,
      data.updated_at
    );

    const insertedId =
      typeof result.lastInsertRowid === "bigint"
        ? Number(result.lastInsertRowid)
        : result.lastInsertRowid;

    return {
      id: insertedId,
      ...data
    };
  }

  updateMessage(
    uuid: string,
    updates: { content?: string; completion_state?: MessageCompletionState }
  ): MessageRecord | null {
    const existing = this.findMessageByUuid(uuid);
    if (!existing) return null;

    const content = updates.content ?? existing.content;
    const state = updates.completion_state ?? existing.completion_state;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        UPDATE codeit_messages
        SET content = ?, completion_state = ?, updated_at = ?
        WHERE uuid = ?
      `
      )
      .run(content, state, now, uuid);

    return this.findMessageByUuid(uuid);
  }
}
