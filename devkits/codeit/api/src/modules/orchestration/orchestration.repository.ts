import type { DatabaseSync } from "node:sqlite";
import { NotFoundError } from "../../errors.js";
import {
  type AssignmentRecord,
  type AssignmentState,
  normalizeAssignmentState,
  type PathLease
} from "./orchestration.types.js";

interface AssignmentRow {
  id: number;
  uuid: string;
  run_uuid: string;
  task_id: string;
  worker_id: string;
  dependencies: string;
  lease_generation: number;
  lease_expiry: string;
  allowed_paths: string;
  attempt: number;
  state: string;
  result_payload: string | null;
  error_payload: string | null;
  created_at: string;
  updated_at: string;
}

interface RunRowBrief {
  uuid: string;
  state: string;
  cancellation_generation: number;
}

function mapAssignmentRow(row: AssignmentRow): AssignmentRecord {
  let dependencies: string[] = [];
  try {
    dependencies = JSON.parse(row.dependencies || "[]") as string[];
  } catch {
    dependencies = [];
  }

  let allowedPaths: string[] = [];
  try {
    allowedPaths = JSON.parse(row.allowed_paths || "[]") as string[];
  } catch {
    allowedPaths = [];
  }

  let resultPayload: Record<string, unknown> | null = null;
  if (row.result_payload) {
    try {
      resultPayload = JSON.parse(row.result_payload) as Record<string, unknown>;
    } catch {
      resultPayload = null;
    }
  }

  let errorPayload: Record<string, unknown> | null = null;
  if (row.error_payload) {
    try {
      errorPayload = JSON.parse(row.error_payload) as Record<string, unknown>;
    } catch {
      errorPayload = null;
    }
  }

  return {
    id: row.id,
    uuid: row.uuid,
    run_uuid: row.run_uuid,
    task_id: row.task_id,
    worker_id: row.worker_id,
    dependencies,
    lease_generation: row.lease_generation,
    lease_expiry: row.lease_expiry,
    allowed_paths: allowedPaths,
    attempt: row.attempt,
    state: normalizeAssignmentState(row.state),
    result_payload: resultPayload,
    error_payload: errorPayload,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class OrchestrationRepository {
  constructor(private readonly db: DatabaseSync) {
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS codeit_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        run_uuid TEXT NOT NULL,
        task_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        dependencies TEXT NOT NULL DEFAULT '[]',
        lease_generation INTEGER NOT NULL DEFAULT 0,
        lease_expiry TEXT NOT NULL,
        allowed_paths TEXT NOT NULL DEFAULT '[]',
        attempt INTEGER NOT NULL DEFAULT 1,
        state TEXT NOT NULL DEFAULT 'assigned',
        result_payload TEXT,
        error_payload TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_codeit_assignments_uuid ON codeit_assignments(uuid);
      CREATE INDEX IF NOT EXISTS idx_codeit_assignments_run_uuid ON codeit_assignments(run_uuid);
      CREATE INDEX IF NOT EXISTS idx_codeit_assignments_task_id ON codeit_assignments(task_id);
      CREATE INDEX IF NOT EXISTS idx_codeit_assignments_state ON codeit_assignments(state);
    `);

    try {
      this.db.exec("ALTER TABLE codeit_assignments ADD COLUMN result_payload TEXT;");
    } catch {
      // Column already exists
    }
    try {
      this.db.exec("ALTER TABLE codeit_assignments ADD COLUMN error_payload TEXT;");
    } catch {
      // Column already exists
    }
  }

  findByUuid(uuid: string): AssignmentRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_assignments WHERE uuid = ?")
      .get(uuid) as unknown as AssignmentRow | undefined;
    return row ? mapAssignmentRow(row) : null;
  }

  findByRunAndTaskId(run_uuid: string, task_id: string): AssignmentRecord | null {
    const row = this.db
      .prepare(
        "SELECT * FROM codeit_assignments WHERE run_uuid = ? AND task_id = ? ORDER BY id DESC LIMIT 1"
      )
      .get(run_uuid, task_id) as unknown as AssignmentRow | undefined;
    return row ? mapAssignmentRow(row) : null;
  }

  findAssignmentsByRun(run_uuid: string): AssignmentRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM codeit_assignments WHERE run_uuid = ? ORDER BY id ASC")
      .all(run_uuid) as unknown as AssignmentRow[];
    return rows.map(mapAssignmentRow);
  }

  createAssignment(data: Omit<AssignmentRecord, "id">): AssignmentRecord {
    const stmt = this.db.prepare(`
      INSERT INTO codeit_assignments (
        uuid, run_uuid, task_id, worker_id, dependencies,
        lease_generation, lease_expiry, allowed_paths, attempt,
        state, result_payload, error_payload, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.uuid,
      data.run_uuid,
      data.task_id,
      data.worker_id,
      JSON.stringify(data.dependencies ?? []),
      data.lease_generation ?? 0,
      data.lease_expiry,
      JSON.stringify(data.allowed_paths ?? []),
      data.attempt ?? 1,
      data.state ?? "assigned",
      data.result_payload ? JSON.stringify(data.result_payload) : null,
      data.error_payload ? JSON.stringify(data.error_payload) : null,
      data.created_at,
      data.updated_at
    );

    const record = this.findByUuid(data.uuid);
    if (!record) {
      throw new Error(`Failed to retrieve newly created assignment: ${data.uuid}`);
    }
    return record;
  }

  updateHeartbeat(uuid: string, newExpiry: string, nowIso?: string): AssignmentRecord {
    const now = nowIso ?? new Date().toISOString();
    this.db
      .prepare("UPDATE codeit_assignments SET lease_expiry = ?, updated_at = ? WHERE uuid = ?")
      .run(newExpiry, now, uuid);

    const record = this.findByUuid(uuid);
    if (!record) {
      throw new NotFoundError(`Assignment ${uuid} not found during heartbeat`);
    }
    return record;
  }

  transitionState(
    uuid: string,
    newState: AssignmentState,
    options?: {
      result_payload?: Record<string, unknown> | null | undefined;
      error_payload?: Record<string, unknown> | null | undefined;
      nowIso?: string | undefined;
    }
  ): AssignmentRecord {
    const now = options?.nowIso ?? new Date().toISOString();
    const existing = this.findByUuid(uuid);
    if (!existing) {
      throw new NotFoundError(`Assignment ${uuid} not found for state transition`);
    }

    const finalResultPayload =
      options?.result_payload !== undefined ? options.result_payload : existing.result_payload;
    const finalErrorPayload =
      options?.error_payload !== undefined ? options.error_payload : existing.error_payload;

    this.db
      .prepare(
        `
        UPDATE codeit_assignments
        SET state = ?, result_payload = ?, error_payload = ?, updated_at = ?
        WHERE uuid = ?
      `
      )
      .run(
        newState,
        finalResultPayload ? JSON.stringify(finalResultPayload) : null,
        finalErrorPayload ? JSON.stringify(finalErrorPayload) : null,
        now,
        uuid
      );

    const updated = this.findByUuid(uuid);
    if (!updated) {
      throw new Error(`Failed to reload assignment ${uuid} after transition`);
    }
    return updated;
  }

  countActiveAssignments(run_uuid: string, nowIso?: string): number {
    const now = nowIso ?? new Date().toISOString();
    const row = this.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM codeit_assignments
        WHERE run_uuid = ?
          AND state IN ('assigned', 'active')
          AND lease_expiry > ?
      `
      )
      .get(run_uuid, now) as { count: number } | undefined;
    return Number(row?.count ?? 0);
  }

  findActiveAssignments(run_uuid?: string, nowIso?: string): AssignmentRecord[] {
    const now = nowIso ?? new Date().toISOString();
    if (run_uuid) {
      const rows = this.db
        .prepare(
          `
          SELECT * FROM codeit_assignments
          WHERE run_uuid = ?
            AND state IN ('assigned', 'active')
            AND lease_expiry > ?
          ORDER BY id ASC
        `
        )
        .all(run_uuid, now) as unknown as AssignmentRow[];
      return rows.map(mapAssignmentRow);
    }

    const rows = this.db
      .prepare(
        `
        SELECT * FROM codeit_assignments
        WHERE state IN ('assigned', 'active')
          AND lease_expiry > ?
        ORDER BY id ASC
      `
      )
      .all(now) as unknown as AssignmentRow[];
    return rows.map(mapAssignmentRow);
  }

  queryActiveLeases(run_uuid?: string, nowIso?: string): PathLease[] {
    const activeAssignments = this.findActiveAssignments(run_uuid, nowIso);
    const leases: PathLease[] = [];

    for (const assignment of activeAssignments) {
      for (const pattern of assignment.allowed_paths) {
        leases.push({
          path_pattern: pattern,
          assignment_uuid: assignment.uuid,
          task_id: assignment.task_id,
          worker_id: assignment.worker_id,
          run_uuid: assignment.run_uuid,
          lease_expiry: assignment.lease_expiry,
          created_at: assignment.created_at
        });
      }
    }

    return leases;
  }

  markExpiredLeases(nowIso: string, run_uuid?: string): AssignmentRecord[] {
    const expiredRows = run_uuid
      ? (this.db
          .prepare(
            `
            SELECT * FROM codeit_assignments
            WHERE run_uuid = ?
              AND state IN ('assigned', 'active')
              AND lease_expiry <= ?
          `
          )
          .all(run_uuid, nowIso) as unknown as AssignmentRow[])
      : (this.db
          .prepare(
            `
            SELECT * FROM codeit_assignments
            WHERE state IN ('assigned', 'active')
              AND lease_expiry <= ?
          `
          )
          .all(nowIso) as unknown as AssignmentRow[]);

    if (expiredRows.length === 0) {
      return [];
    }

    const expiredUuids = expiredRows.map((r) => r.uuid);
    for (const uuid of expiredUuids) {
      this.db
        .prepare(
          `
          UPDATE codeit_assignments
          SET state = 'expired', updated_at = ?
          WHERE uuid = ?
        `
        )
        .run(nowIso, uuid);
    }

    return expiredRows.map((r) => ({
      ...mapAssignmentRow(r),
      state: "expired" as const,
      updated_at: nowIso
    }));
  }

  cancelActiveAssignmentsForRun(run_uuid: string, nowIso?: string): number {
    const now = nowIso ?? new Date().toISOString();
    const result = this.db
      .prepare(
        `
        UPDATE codeit_assignments
        SET state = 'cancelled', updated_at = ?
        WHERE run_uuid = ?
          AND state IN ('assigned', 'active')
      `
      )
      .run(now, run_uuid);

    return Number(result.changes);
  }

  getRunBrief(run_uuid: string): RunRowBrief | null {
    try {
      const row = this.db
        .prepare("SELECT uuid, state, cancellation_generation FROM codeit_runs WHERE uuid = ?")
        .get(run_uuid) as RunRowBrief | undefined;
      return row ?? null;
    } catch {
      return null;
    }
  }
}
