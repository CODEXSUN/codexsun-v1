import type { DatabaseSync } from "node:sqlite";
import { InvalidStateError, NotFoundError } from "../../errors.js";
import type { ConversationMode } from "../conversation/conversation.types.js";
import {
  type Budget,
  DEFAULT_BUDGET,
  type RunEvent,
  type RunRecord,
  type RunState,
  VALID_RUN_TRANSITIONS
} from "./run.types.js";

interface RunRow {
  id: number;
  uuid: string;
  project_uuid: string;
  conversation_uuid: string;
  mode: string;
  state: string;
  cancellation_generation: number;
  budget: string;
  created_at: string;
  updated_at: string;
}

interface RunEventRow {
  id: number;
  run_uuid: string;
  seq: number;
  event_type: string;
  payload: string;
  correlation_id: string | null;
  created_at: string;
}

function mapRunRow(row: RunRow): RunRecord {
  let budget: Budget;
  try {
    budget = JSON.parse(row.budget) as Budget;
  } catch {
    budget = { ...DEFAULT_BUDGET };
  }

  return {
    id: row.id,
    uuid: row.uuid,
    project_uuid: row.project_uuid,
    conversation_uuid: row.conversation_uuid,
    mode: row.mode as ConversationMode,
    state: row.state as RunState,
    cancellation_generation: row.cancellation_generation,
    budget,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapEventRow(row: RunEventRow): RunEvent {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  return {
    id: row.id,
    run_uuid: row.run_uuid,
    seq: row.seq,
    event_type: row.event_type,
    payload,
    correlation_id: row.correlation_id,
    created_at: row.created_at
  };
}

export class RunRepository {
  constructor(private readonly db: DatabaseSync) {}

  findRunByUuid(uuid: string): RunRecord | null {
    const row = this.db.prepare("SELECT * FROM codeit_runs WHERE uuid = ?").get(uuid) as unknown as
      RunRow | undefined;
    return row ? mapRunRow(row) : null;
  }

  findRunsByConversation(conversation_uuid: string): RunRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM codeit_runs WHERE conversation_uuid = ? ORDER BY id DESC")
      .all(conversation_uuid) as unknown as RunRow[];
    return rows.map(mapRunRow);
  }

  insertRun(data: Omit<RunRecord, "id">): RunRecord {
    const stmt = this.db.prepare(`
      INSERT INTO codeit_runs (
        uuid, project_uuid, conversation_uuid, mode, state, cancellation_generation, budget, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.uuid,
      data.project_uuid,
      data.conversation_uuid,
      data.mode,
      data.state,
      data.cancellation_generation,
      JSON.stringify(data.budget),
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

  updateRun(
    uuid: string,
    updates: Partial<Pick<RunRecord, "state" | "cancellation_generation" | "budget">>
  ): RunRecord | null {
    const existing = this.findRunByUuid(uuid);
    if (!existing) return null;

    const state = updates.state ?? existing.state;
    const gen = updates.cancellation_generation ?? existing.cancellation_generation;
    const budgetJson = updates.budget
      ? JSON.stringify(updates.budget)
      : JSON.stringify(existing.budget);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        UPDATE codeit_runs
        SET state = ?, cancellation_generation = ?, budget = ?, updated_at = ?
        WHERE uuid = ?
      `
      )
      .run(state, gen, budgetJson, now, uuid);

    return this.findRunByUuid(uuid);
  }

  incrementCancellationGeneration(uuid: string): number {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE codeit_runs SET cancellation_generation = cancellation_generation + 1, updated_at = ? WHERE uuid = ?"
      )
      .run(now, uuid);

    const row = this.db
      .prepare("SELECT cancellation_generation FROM codeit_runs WHERE uuid = ?")
      .get(uuid) as unknown as { cancellation_generation: number } | undefined;

    return row ? row.cancellation_generation : 1;
  }

  getNextEventSeq(run_uuid: string): number {
    const row = this.db
      .prepare(
        "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM codeit_run_events WHERE run_uuid = ?"
      )
      .get(run_uuid) as unknown as { next_seq: number } | undefined;

    return row ? Number(row.next_seq) : 1;
  }

  insertEvent(data: Omit<RunEvent, "id">): RunEvent {
    const stmt = this.db.prepare(`
      INSERT INTO codeit_run_events (run_uuid, seq, event_type, payload, correlation_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.run_uuid,
      data.seq,
      data.event_type,
      JSON.stringify(data.payload),
      data.correlation_id ?? null,
      data.created_at
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

  findEventsSinceSeq(run_uuid: string, sinceSeq: number, limit = 1000): RunEvent[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM codeit_run_events WHERE run_uuid = ? AND seq > ? ORDER BY seq ASC LIMIT ?"
      )
      .all(run_uuid, sinceSeq, limit) as unknown as RunEventRow[];

    return rows.map(mapEventRow);
  }

  findLatestEvent(run_uuid: string): RunEvent | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_run_events WHERE run_uuid = ? ORDER BY seq DESC LIMIT 1")
      .get(run_uuid) as unknown as RunEventRow | undefined;

    return row ? mapEventRow(row) : null;
  }

  /**
   * Transactional transition of run state and creation of corresponding RunEvent.
   * Invariant: Every state change is committed in a single transaction with its RunEvent.
   */
  transitionStateWithEvent(
    run_uuid: string,
    nextState: RunState,
    eventType: string,
    payload: Record<string, unknown>,
    correlationId?: string
  ): { run: RunRecord; event: RunEvent } {
    this.db.exec("BEGIN TRANSACTION;");
    try {
      const existing = this.findRunByUuid(run_uuid);
      if (!existing) {
        throw new NotFoundError(`Run not found with UUID: ${run_uuid}`, { run_uuid });
      }

      // Check invariant: valid state transition
      const allowedNext = VALID_RUN_TRANSITIONS[existing.state];
      if (!allowedNext || !allowedNext.includes(nextState)) {
        throw new InvalidStateError(
          `Invalid run state transition from '${existing.state}' to '${nextState}'`,
          409,
          {
            run_uuid,
            current_state: existing.state,
            target_state: nextState,
            allowed_transitions: allowedNext ?? []
          }
        );
      }

      const now = new Date().toISOString();
      this.db
        .prepare("UPDATE codeit_runs SET state = ?, updated_at = ? WHERE uuid = ?")
        .run(nextState, now, run_uuid);

      const nextSeq = this.getNextEventSeq(run_uuid);
      const eventStmt = this.db.prepare(`
        INSERT INTO codeit_run_events (run_uuid, seq, event_type, payload, correlation_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const eventPayload = {
        from_state: existing.state,
        to_state: nextState,
        ...payload
      };

      const result = eventStmt.run(
        run_uuid,
        nextSeq,
        eventType,
        JSON.stringify(eventPayload),
        correlationId ?? null,
        now
      );

      const insertedId =
        typeof result.lastInsertRowid === "bigint"
          ? Number(result.lastInsertRowid)
          : result.lastInsertRowid;

      this.db.exec("COMMIT;");

      const updatedRun: RunRecord = {
        ...existing,
        state: nextState,
        updated_at: now
      };

      const event: RunEvent = {
        id: insertedId,
        run_uuid,
        seq: nextSeq,
        event_type: eventType,
        payload: eventPayload,
        correlation_id: correlationId ?? null,
        created_at: now
      };

      return { run: updatedRun, event };
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }
}
