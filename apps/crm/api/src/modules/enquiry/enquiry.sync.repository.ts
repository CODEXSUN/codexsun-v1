import { randomUUID } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { EnquiryDatabase, EnquirySyncEventRow } from "./enquiry.types.js";

export type EnquirySyncEventType = EnquirySyncEventRow["event_type"];
export type EnquirySyncValidation = "valid" | "invalid" | "warning";
export type EnquiryDeliveryState = {
  status: EnquirySyncEventRow["status"] | "unlinked";
  error: string | null;
  remoteName?: string | null;
};

export class EnquirySyncRepository {
  constructor(private readonly database: Kysely<EnquiryDatabase>) {}

  async enqueueUpsert(
    input: { actorEmail: string; correlationId: string; enquiryId: number },
    transaction?: Transaction<EnquiryDatabase>
  ) {
    const database = transaction ?? this.database;
    const current = await database
      .selectFrom("crm_enquiry_sync_events")
      .select(["id", "status", "event_type"])
      .where("enquiry_id", "=", input.enquiryId)
      .orderBy("id", "desc")
      .limit(1)
      .forUpdate()
      .executeTakeFirst();
    if (current?.event_type === "enquiry-upsert" && ["pending", "retry"].includes(current.status)) {
      await database
        .updateTable("crm_enquiry_sync_events")
        .set({
          event_type: "enquiry-upsert",
          entity_id: null,
          actor_email: input.actorEmail,
          correlation_id: randomUUID(),
          status: "pending",
          attempts: 0,
          available_at: sql`UTC_TIMESTAMP()`,
          last_error: null,
          updated_at: sql`UTC_TIMESTAMP()`
        })
        .where("id", "=", current.id)
        .execute();
      await this.recordValidation(current.id, "valid", [], database);
      return current.id;
    }
    return this.enqueue({ ...input, eventType: "enquiry-upsert" }, transaction);
  }

  async enqueue(
    input: {
      actorEmail: string;
      correlationId: string;
      entityId?: number | null;
      enquiryId: number;
      eventType: EnquirySyncEventType;
    },
    transaction?: Transaction<EnquiryDatabase>
  ) {
    const database = transaction ?? this.database;
    const idempotencyKey = [
      input.eventType,
      input.enquiryId,
      input.entityId ?? "record",
      randomUUID()
    ]
      .join(":")
      .slice(0, 191);
    const result = await database
      .insertInto("crm_enquiry_sync_events")
      .values({
        enquiry_id: input.enquiryId,
        event_type: input.eventType,
        entity_id: input.entityId ?? null,
        actor_email: input.actorEmail,
        correlation_id: input.correlationId,
        idempotency_key: idempotencyKey,
        status: "pending",
        available_at: sql`UTC_TIMESTAMP()`,
        remote_name: null,
        last_error: null,
        created_at: sql`UTC_TIMESTAMP()`,
        updated_at: sql`UTC_TIMESTAMP()`
      })
      .executeTakeFirstOrThrow();
    const eventId = Number(result.insertId);
    await database
      .insertInto("crm_enquiry_sync_validation")
      .values({
        event_id: eventId,
        validation_status: "valid",
        errors_json: JSON.stringify([]),
        checked_at: sql`UTC_TIMESTAMP()`
      })
      .execute();
    return eventId;
  }

  async listForEnquiry(enquiryId: number) {
    const events = await this.database
      .selectFrom("crm_enquiry_sync_events")
      .selectAll()
      .where("enquiry_id", "=", enquiryId)
      .orderBy("id", "desc")
      .limit(50)
      .execute();
    if (!events.length) return [];
    const validations = await this.database
      .selectFrom("crm_enquiry_sync_validation")
      .selectAll()
      .where(
        "event_id",
        "in",
        events.map((event) => event.id)
      )
      .orderBy("id", "desc")
      .execute();
    const latestValidation = new Map<number, (typeof validations)[number]>();
    for (const validation of validations) {
      if (!latestValidation.has(validation.event_id))
        latestValidation.set(validation.event_id, validation);
    }
    return events.map((event) => {
      const validation = latestValidation.get(event.id);
      return {
        id: String(event.id),
        eventType: event.event_type,
        status: event.status,
        attempts: event.attempts,
        remoteName: event.remote_name,
        lastError: event.last_error,
        createdAt: toIso(event.created_at),
        validation: validation
          ? {
              status: validation.validation_status,
              errors: parseErrors(validation.errors_json),
              checkedAt: toIso(validation.checked_at)
            }
          : null
      };
    });
  }

  async latestStatuses(enquiryIds: number[]) {
    if (!enquiryIds.length) return new Map<number, EnquirySyncEventRow["status"]>();
    const latest = this.database
      .selectFrom("crm_enquiry_sync_events")
      .select("enquiry_id")
      .select(({ fn }) => fn.max<number>("id").as("id"))
      .where("enquiry_id", "in", enquiryIds)
      .groupBy("enquiry_id")
      .as("latest");
    const rows = await this.database
      .selectFrom("crm_enquiry_sync_events as event")
      .innerJoin(latest, "latest.id", "event.id")
      .select(["event.enquiry_id as enquiryId", "event.status"])
      .execute();
    return new Map(rows.map((row) => [row.enquiryId, row.status]));
  }

  async deliveryStates(enquiryIds: number[]) {
    const statuses = await this.latestStatuses(enquiryIds);
    const states = new Map<number, EnquiryDeliveryState>(
      [...statuses].map(([id, status]) => [id, { status, error: null as string | null }])
    );
    if (!enquiryIds.length) return states;
    const failures = await this.database
      .selectFrom("crm_enquiry_sync_events")
      .select(["enquiry_id", "status", "last_error", "event_type"])
      .where("enquiry_id", "in", enquiryIds)
      .where("status", "!=", "synced")
      .where(
        sql<boolean>`event_type <> 'enquiry-upsert' OR NOT EXISTS (
        SELECT 1 FROM crm_enquiry_sync_events recovered
        WHERE recovered.enquiry_id = crm_enquiry_sync_events.enquiry_id
          AND recovered.event_type = 'enquiry-upsert' AND recovered.status = 'synced'
          AND recovered.id > crm_enquiry_sync_events.id
      )`
      )
      .orderBy(sql`CASE WHEN event_type = 'enquiry-upsert' THEN 0 ELSE 1 END`)
      .orderBy("id", "desc")
      .execute();
    for (const row of failures) {
      const current = states.get(row.enquiry_id);
      if (!current?.error && row.last_error)
        states.set(row.enquiry_id, { status: row.status, error: row.last_error });
      else if (!current || current.status === "synced")
        states.set(row.enquiry_id, { status: row.status, error: row.last_error });
    }
    return states;
  }

  async listQueue(
    status: "all" | "pending" | "processing" | "retry" | "failed" | "synced",
    page: number,
    pageSize: number
  ) {
    let query = this.database
      .selectFrom("crm_enquiry_sync_events as event")
      .innerJoin("crm_enquiries as enquiry", "enquiry.id", "event.enquiry_id")
      .select([
        "event.id",
        "event.enquiry_id as enquiryId",
        "enquiry.enquiry_no as enquiryNo",
        "enquiry.title",
        "event.event_type as eventType",
        "event.status",
        "event.attempts",
        "event.remote_name as remoteName",
        "event.last_error as lastError",
        "event.created_at as createdAt"
      ]);
    if (status !== "all") query = query.where("event.status", "=", status);
    const [rows, totalRow] = await Promise.all([
      query
        .orderBy("event.id", "desc")
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      this.database
        .selectFrom("crm_enquiry_sync_events")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .$if(status !== "all", (builder) =>
          builder.where("status", "=", status === "all" ? "pending" : status)
        )
        .executeTakeFirstOrThrow()
    ]);
    return {
      items: rows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) })),
      page,
      pageSize,
      total: Number(totalRow.count)
    };
  }

  async retry(id: number) {
    const event = await this.getEvent(id);
    if (!event) throw AppError.notFound("Sync queue event was not found.");
    if (event.status !== "failed")
      throw AppError.conflict("Only failed sync events can be retried.");
    const result = await this.database
      .updateTable("crm_enquiry_sync_events")
      .set({
        status: "pending",
        attempts: 0,
        correlation_id: randomUUID(),
        available_at: sql`UTC_TIMESTAMP()`,
        updated_at: sql`UTC_TIMESTAMP()`
      })
      .where("id", "=", id)
      .where("status", "=", "failed")
      .execute();
    if (!result.some((item) => Number(item.numUpdatedRows) === 1))
      throw AppError.conflict("This sync event has already been retried.");
    return { id, status: "pending" as const };
  }

  async requeueStaleProcessing() {
    await this.database
      .updateTable("crm_enquiry_sync_events")
      .set({
        status: "retry",
        attempts: sql`attempts + 1`,
        last_error: "Sync worker stopped before recording a result.",
        available_at: sql`UTC_TIMESTAMP()`,
        updated_at: sql`UTC_TIMESTAMP()`
      })
      .where("status", "=", "processing")
      .where(sql<boolean>`updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)`)
      .execute();
  }

  dispatchableEvents(limit = 50, enquiryId?: number) {
    return this.database
      .selectFrom("crm_enquiry_sync_events as event")
      .select(["event.id", "event.actor_email", "event.correlation_id", "event.attempts"])
      .where("event.status", "in", ["pending", "retry"])
      .$if(enquiryId !== undefined, (query) => query.where("event.enquiry_id", "=", enquiryId!))
      .where(sql<boolean>`event.available_at <= UTC_TIMESTAMP()`)
      .where(
        sql<boolean>`NOT EXISTS (
        SELECT 1 FROM crm_enquiry_sync_events earlier
        WHERE earlier.enquiry_id = event.enquiry_id
          AND earlier.id < event.id
          AND earlier.status IN ('pending','processing','retry')
      )`
      )
      .orderBy("event.id")
      .limit(limit)
      .execute();
  }

  latestEvent(enquiryId: number, actorEmail: string) {
    return this.database
      .selectFrom("crm_enquiry_sync_events")
      .selectAll()
      .where("enquiry_id", "=", enquiryId)
      .where("actor_email", "=", actorEmail)
      .orderBy("id", "desc")
      .executeTakeFirst();
  }

  getEvent(id: number) {
    return this.database
      .selectFrom("crm_enquiry_sync_events")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  latestUpsert(enquiryId: number) {
    return this.database
      .selectFrom("crm_enquiry_sync_events")
      .selectAll()
      .where("enquiry_id", "=", enquiryId)
      .where("event_type", "=", "enquiry-upsert")
      .orderBy("id", "desc")
      .executeTakeFirst();
  }

  commentForSync(enquiryId: number, commentId: number) {
    return this.database
      .selectFrom("crm_enquiry_comments")
      .selectAll()
      .where("id", "=", commentId)
      .where("enquiry_id", "=", enquiryId)
      .executeTakeFirst();
  }

  commentSyncEvent(commentId: number) {
    return this.database
      .selectFrom("crm_enquiry_sync_events")
      .selectAll()
      .where("event_type", "=", "comment-add")
      .where("entity_id", "=", commentId)
      .orderBy("id", "asc")
      .executeTakeFirst();
  }

  commentSyncEvents(enquiryId: number) {
    return this.database
      .selectFrom("crm_enquiry_sync_events")
      .select(["idempotency_key", "remote_name", "entity_id"])
      .where("enquiry_id", "=", enquiryId)
      .where("event_type", "=", "comment-add")
      .execute();
  }

  async markProcessing(id: number) {
    const result = await sql`UPDATE crm_enquiry_sync_events AS event
      LEFT JOIN crm_enquiry_sync_events AS earlier
        ON earlier.enquiry_id=event.enquiry_id AND earlier.id<event.id
        AND earlier.status IN ('pending','processing','retry')
      SET event.status='processing',event.updated_at=UTC_TIMESTAMP()
      WHERE event.id=${id} AND event.status IN ('pending','retry')
        AND earlier.id IS NULL`.execute(this.database);
    return Number(result.numAffectedRows) === 1;
  }

  async markSynced(id: number, remoteName: string) {
    await this.database
      .updateTable("crm_enquiry_sync_events")
      .set({
        status: "synced",
        remote_name: remoteName,
        last_error: null,
        updated_at: sql`UTC_TIMESTAMP()`
      })
      .where("id", "=", id)
      .execute();
    await this.recordValidation(id, "valid", []);
  }

  async markFailed(id: number, attempt: number, message: string, validationErrors: string[] = []) {
    const retryable = !validationErrors.length && attempt < 5;
    const delay = Math.min(1800, 10 * 2 ** Math.min(attempt, 7));
    await this.database
      .updateTable("crm_enquiry_sync_events")
      .set({
        status: retryable ? "retry" : "failed",
        attempts: attempt + 1,
        last_error: message.slice(0, 4000),
        available_at: retryable
          ? sql`DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${delay} SECOND)`
          : sql`UTC_TIMESTAMP()`,
        updated_at: sql`UTC_TIMESTAMP()`
      })
      .where("id", "=", id)
      .execute();
    await this.recordValidation(
      id,
      validationErrors.length ? "invalid" : "warning",
      validationErrors
    );
  }

  private async recordValidation(
    eventId: number,
    status: EnquirySyncValidation,
    errors: string[],
    database: Kysely<EnquiryDatabase> | Transaction<EnquiryDatabase> = this.database
  ) {
    await database
      .insertInto("crm_enquiry_sync_validation")
      .values({
        event_id: eventId,
        validation_status: status,
        errors_json: JSON.stringify(errors),
        checked_at: sql`UTC_TIMESTAMP()`
      })
      .execute();
  }
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const text = String(value).replace(" ", "T");
  return new Date(text.endsWith("Z") ? text : `${text}Z`).toISOString();
}

function parseErrors(value: unknown) {
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return ["Stored validation details could not be read."];
  }
}
