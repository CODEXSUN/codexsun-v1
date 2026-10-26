import { sql } from "kysely";
import type {
  ScheduleInput,
  ScheduleRecord,
  ScheduleSourceOption,
  ScheduleSourceType,
  ScheduleStatus,
  SchedulerDatabase
} from "./scheduler.types.js";

type Scope = { email: string; userId: number; viewAll: boolean };

export class SchedulerRepository {
  constructor(private readonly database: import("kysely").Kysely<SchedulerDatabase>) {}

  async listSources(sourceType: ScheduleSourceType, search: string, scope: Scope) {
    const term = `%${search.trim()}%`;
    let rows: Array<{ id: number; label: string }>;
    switch (sourceType) {
      case "enquiry":
        rows = (
          await sql<{ id: number; label: string }>`SELECT e.id,
          CONCAT('#', e.enquiry_no, ' · ', e.title) AS label
          FROM crm_enquiries e
          WHERE e.status <> 'deleted'
            AND (${scope.viewAll} OR e.created_by=${scope.email} OR e.assigned_user_id=${scope.userId})
            AND (e.title LIKE ${term} OR CAST(e.enquiry_no AS CHAR) LIKE ${term} OR CAST(e.id AS CHAR) LIKE ${term})
          ORDER BY e.enquiry_no DESC LIMIT 30`.execute(this.database)
        ).rows;
        break;
      case "task":
        rows = (
          await sql<{ id: number; label: string }>`SELECT t.id,
          CONCAT('#', t.id, ' · ', t.title) AS label
          FROM crm_tasks t
          WHERE t.status <> 'deleted'
            AND (${scope.viewAll} OR t.created_by=${scope.email} OR t.assigned_user_id=${scope.userId})
            AND (t.title LIKE ${term} OR CAST(t.id AS CHAR) LIKE ${term})
          ORDER BY t.id DESC LIMIT 30`.execute(this.database)
        ).rows;
        break;
      case "call-log":
        rows = (
          await sql<{ id: number; label: string }>`SELECT c.id,
          CONCAT('CL-', c.id, ' · ', c.from_number, ' → ', c.to_number) AS label
          FROM crm_call_logs c
          WHERE (c.from_number LIKE ${term} OR c.to_number LIKE ${term} OR CAST(c.id AS CHAR) LIKE ${term})
          ORDER BY c.id DESC LIMIT 30`.execute(this.database)
        ).rows;
        break;
      case "duty":
        rows = (
          await sql<{ id: number; label: string }>`SELECT d.id,
          CONCAT(s.code, ' · ', i.title, ' · ', COALESCE(u.name, u.email)) AS label
          FROM crm_duty_assignments d
          JOIN crm_sop_items i ON i.id=d.sop_item_id
          JOIN crm_sops s ON s.id=i.sop_id
          JOIN app_users u ON u.id=d.assignee_user_id
          WHERE d.status='active' AND (${scope.viewAll} OR d.assignee_user_id=${scope.userId})
            AND (i.title LIKE ${term} OR s.title LIKE ${term} OR s.code LIKE ${term} OR u.name LIKE ${term})
          ORDER BY d.display_order, d.id DESC LIMIT 30`.execute(this.database)
        ).rows;
        break;
      case "sop":
        rows = (
          await sql<{ id: number; label: string }>`SELECT s.id,
          CONCAT(s.code, ' · ', s.title) AS label
          FROM crm_sops s WHERE s.status='active'
            AND (s.code LIKE ${term} OR s.title LIKE ${term})
          ORDER BY s.title LIMIT 30`.execute(this.database)
        ).rows;
        break;
    }
    return rows.map(
      (row) => ({ id: Number(row.id), label: row.label }) satisfies ScheduleSourceOption
    );
  }

  async findSource(sourceType: ScheduleSourceType, sourceId: number, scope: Scope) {
    const rows = await this.listSources(sourceType, String(sourceId), scope);
    return rows.find((row) => row.id === sourceId) ?? null;
  }

  async create(input: ScheduleInput, sourceLabel: string, actorEmail: string, actorUserId: number) {
    const result = await this.database
      .insertInto("crm_schedules")
      .values({
        title: input.notes.slice(0, 191),
        details: input.notes.slice(191),
        notes: input.notes,
        source_type: input.sourceType,
        source_id: input.sourceId,
        source_label: sourceLabel,
        scheduled_at: utcDateTime(input.scheduledAt),
        reminder_at: utcDateTime(input.reminderAt ?? input.scheduledAt),
        status: "scheduled",
        assigned_user_id: actorUserId,
        created_by: actorEmail
      })
      .executeTakeFirstOrThrow();
    return this.get(Number(result.insertId));
  }

  async list(
    scope: Scope,
    options: { view: "schedules" | "reminders"; sourceType?: string; sourceId?: number }
  ) {
    const sourceType = options.sourceType ?? "";
    const sourceId = options.sourceId ?? 0;
    const query = await sql<RawSchedule>`SELECT s.id, s.uuid, s.notes, s.title, s.details,
      s.source_type AS sourceType, s.source_id AS sourceId, s.source_label AS sourceLabel,
      s.scheduled_at AS scheduledAt, s.reminder_at AS reminderAt,
      s.acknowledged_at AS acknowledgedAt, s.status,
      s.assigned_user_id AS assignedUserId, COALESCE(u.name, u.email) AS assignedTo,
      s.created_by AS createdBy, s.created_at AS createdAt
      FROM crm_schedules s JOIN app_users u ON u.id=s.assigned_user_id
      WHERE (${scope.viewAll} OR s.assigned_user_id=${scope.userId})
        AND (${sourceType}='' OR s.source_type=${sourceType})
        AND (${sourceId}=0 OR s.source_id=${sourceId})
        AND (${options.view === "schedules"} OR
          (s.status='scheduled' AND s.acknowledged_at IS NULL))
      ORDER BY CASE WHEN s.status='scheduled' THEN 0 ELSE 1 END, s.scheduled_at ASC, s.id DESC
      LIMIT 100`.execute(this.database);
    return query.rows.map(mapSchedule);
  }

  async reminderCount(scope: Scope) {
    const result = await sql<{ total: number | string }>`SELECT COUNT(*) AS total
      FROM crm_schedules s JOIN app_users u ON u.id=s.assigned_user_id
      WHERE (${scope.viewAll} OR s.assigned_user_id=${scope.userId})
        AND s.status='scheduled' AND s.acknowledged_at IS NULL`.execute(this.database);
    return Number(result.rows[0]?.total ?? 0);
  }

  async reminders(scope: Scope) {
    const query = await sql<RawSchedule>`SELECT s.id, s.uuid, s.notes, s.title, s.details,
      s.source_type AS sourceType, s.source_id AS sourceId, s.source_label AS sourceLabel,
      s.scheduled_at AS scheduledAt, s.reminder_at AS reminderAt,
      s.acknowledged_at AS acknowledgedAt, s.status,
      s.assigned_user_id AS assignedUserId, COALESCE(u.name, u.email) AS assignedTo,
      s.created_by AS createdBy, s.created_at AS createdAt
      FROM crm_schedules s JOIN app_users u ON u.id=s.assigned_user_id
      WHERE (${scope.viewAll} OR s.assigned_user_id=${scope.userId})
        AND s.status='scheduled' AND s.acknowledged_at IS NULL
        AND s.reminder_at <= UTC_TIMESTAMP() + INTERVAL 15 MINUTE
      ORDER BY s.reminder_at ASC, s.id ASC LIMIT 8`.execute(this.database);
    return query.rows.map(mapSchedule);
  }

  async updateStatus(id: number, status: Exclude<ScheduleStatus, "scheduled">, scope: Scope) {
    let query = this.database.updateTable("crm_schedules").set({ status });
    query = query.where("id", "=", id);
    if (!scope.viewAll) query = query.where("assigned_user_id", "=", scope.userId);
    const result = await query.executeTakeFirst();
    return Number(result.numUpdatedRows) > 0 ? this.get(id) : null;
  }

  async reschedule(id: number, scheduledAt: string, scope: Scope) {
    let query = this.database
      .updateTable("crm_schedules")
      .set({
        scheduled_at: utcDateTime(scheduledAt),
        reminder_at: utcDateTime(scheduledAt),
        acknowledged_at: null
      })
      .where("id", "=", id)
      .where("status", "=", "scheduled");
    if (!scope.viewAll) query = query.where("assigned_user_id", "=", scope.userId);
    const result = await query.executeTakeFirst();
    return Number(result.numUpdatedRows) > 0 ? this.get(id) : null;
  }

  async acknowledge(id: number, scope: Scope) {
    let query = this.database
      .updateTable("crm_schedules")
      .set({ acknowledged_at: sql`UTC_TIMESTAMP()` });
    query = query.where("id", "=", id).where("status", "=", "scheduled");
    if (!scope.viewAll) query = query.where("assigned_user_id", "=", scope.userId);
    const result = await query.executeTakeFirst();
    return Number(result.numUpdatedRows) > 0 ? this.get(id) : null;
  }

  private async get(id: number) {
    const row = await sql<RawSchedule>`SELECT s.id, s.uuid, s.notes, s.title, s.details,
      s.source_type AS sourceType, s.source_id AS sourceId, s.source_label AS sourceLabel,
      s.scheduled_at AS scheduledAt, s.reminder_at AS reminderAt,
      s.acknowledged_at AS acknowledgedAt, s.status,
      s.assigned_user_id AS assignedUserId, COALESCE(u.name, u.email) AS assignedTo,
      s.created_by AS createdBy, s.created_at AS createdAt
      FROM crm_schedules s JOIN app_users u ON u.id=s.assigned_user_id WHERE s.id=${id}`.execute(
      this.database
    );
    return row.rows[0] ? mapSchedule(row.rows[0]) : null;
  }
}

type RawSchedule = {
  id: number;
  uuid: string;
  notes: string;
  title: string;
  details: string;
  sourceType: ScheduleSourceType;
  sourceId: number;
  sourceLabel: string;
  scheduledAt: string | Date;
  reminderAt: string | Date;
  acknowledgedAt: string | Date | null;
  status: ScheduleStatus;
  assignedUserId: number;
  assignedTo: string;
  createdBy: string;
  createdAt: string | Date;
};

function mapSchedule(row: RawSchedule): ScheduleRecord {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    notes: row.notes,
    title: row.title,
    details: row.details,
    sourceType: row.sourceType,
    sourceId: Number(row.sourceId),
    sourceLabel: row.sourceLabel,
    assignedUserId: Number(row.assignedUserId),
    scheduledAt: toIso(row.scheduledAt),
    reminderAt: toIso(row.reminderAt),
    acknowledgedAt: row.acknowledgedAt ? toIso(row.acknowledgedAt) : null,
    status: row.status,
    assignedTo: row.assignedTo,
    createdBy: row.createdBy,
    createdAt: toIso(row.createdAt)
  };
}

function utcDateTime(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function toIso(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/iu.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized).toISOString();
}
