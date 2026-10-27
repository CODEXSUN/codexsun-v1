import { createHash, randomBytes } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { PlatformDatabase } from "../../database/schema.js";
import { getPlatformDatabase } from "../../database/platform-database.js";
import { env } from "../../env.js";
import { queueExecutionAllowed } from "./queue-manager.execution.js";
import type {
  QueueJobFilters,
  QueueJobPayload,
  QueueJobRecord,
  QueueJobStatus,
  QueueBackend,
  QueueRuntimeSettings
} from "./queue-manager.types.js";

export class QueueManagerRepository {
  async list(filters: QueueJobFilters = {}) {
    let query = getPlatformDatabase().selectFrom("queue_jobs").selectAll();
    if (filters.jobName) query = query.where("job_name", "=", filters.jobName);
    if (filters.status) query = query.where("status", "=", filters.status);
    if (filters.queueName) query = query.where("queue_name", "=", filters.queueName);
    if (filters.tenantId) query = query.where("tenant_id", "=", filters.tenantId);
    if (filters.correlationId) query = query.where("correlation_id", "=", filters.correlationId);
    const rows = await query
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(100)
      .execute();
    return rows.map(toQueueJob);
  }

  async pendingDeliveries(afterId: number) {
    const rows = await getPlatformDatabase()
      .selectFrom("queue_jobs")
      .selectAll()
      .where("status", "=", "pending")
      .where("id", ">", afterId)
      .orderBy("id", "asc")
      .limit(100)
      .execute();
    return rows.map(toQueueJob);
  }

  async settings(): Promise<QueueRuntimeSettings> {
    const jobs = await this.list();
    const selected = await getPlatformDatabase()
      .selectFrom("queue_runtime_settings")
      .selectAll()
      .where("singleton_key", "=", 1)
      .executeTakeFirst();
    const backend = normalizeBackend(selected?.backend ?? env.CODEXSUN_QUEUE_BACKEND);
    return {
      availableBackends: ["database", "bullmq-redis"],
      backend,
      backendLabel: backend === "bullmq-redis" ? "BullMQ + Redis" : "Database queue",
      canRunInline: backend !== "bullmq-redis" && queueExecutionAllowed(env, "platform"),
      completed: jobs.filter((job) => job.status === "completed").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      pending: jobs.filter((job) => job.status === "pending").length,
      redisConfigured: Boolean(env.CODEXSUN_REDIS_URL.trim()),
      running: jobs.filter((job) => job.status === "running").length,
      updatedAt: selected?.updated_at ? new Date(selected.updated_at).toISOString() : null,
      updatedBy: selected?.updated_by ?? "environment"
    };
  }

  async backend() {
    return (await this.settings()).backend;
  }

  async setBackend(backend: QueueBackend, actorEmail: string) {
    await getPlatformDatabase()
      .insertInto("queue_runtime_settings")
      .values({
        backend,
        singleton_key: 1,
        updated_at: new Date(),
        updated_by: actorEmail
      })
      .onDuplicateKeyUpdate({
        backend,
        updated_at: new Date(),
        updated_by: actorEmail
      })
      .execute();
    return this.settings();
  }

  async enqueue(input: QueueJobPayload) {
    const database = getPlatformDatabase();
    if (!input.idempotencyKey) return this.enqueueOnDatabase(database, input);
    // SQL collation equates keys that JavaScript hashing cannot normalize safely.
    // Serialize keyed enqueues for this master to retain the existing SQL semantics.
    const lock = createHash("sha256")
      .update(JSON.stringify(["codexsun.queue.enqueue", env.DB_MASTER_NAME]))
      .digest("hex");
    return database.connection().execute(async (connection) => {
      const acquired = await sql<{ acquired: number | null }>`
        SELECT GET_LOCK(${lock}, 10) AS acquired
      `.execute(connection);
      if (Number(acquired.rows[0]?.acquired) !== 1)
        throw new Error("Queue enqueue could not acquire its idempotency lock.");
      try {
        // Commit before unlocking so the next producer sees the persisted identity.
        return await connection
          .transaction()
          .execute((transaction) => this.enqueueOnDatabase(transaction, input));
      } finally {
        await sql`SELECT RELEASE_LOCK(${lock})`.execute(connection);
      }
    });
  }

  async find(id: number) {
    const row = await getPlatformDatabase()
      .selectFrom("queue_jobs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toQueueJob(row) : null;
  }

  async ageMilliseconds(id: number) {
    const result = await sql<{ age_milliseconds: number | string }>`
      SELECT TIMESTAMPDIFF(MICROSECOND, created_at, CURRENT_TIMESTAMP) / 1000 AS age_milliseconds
      FROM queue_jobs WHERE id=${id} LIMIT 1
    `.execute(getPlatformDatabase());
    const age = result.rows[0]?.age_milliseconds;
    return age === undefined ? null : Number(age);
  }

  async expireRunningJobs(jobNames: string[], olderThan: Date) {
    if (!jobNames.length) return 0;
    const result = await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({
        status: "failed",
        error_message:
          "Worker lease expired. The owning module must reconcile the operation before another submission.",
        updated_at: new Date()
      })
      .where("job_name", "in", jobNames)
      .where("status", "=", "running")
      .where("updated_at", "<", olderThan)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  async nextRunnable() {
    const row = await getPlatformDatabase()
      .selectFrom("queue_jobs")
      .selectAll()
      .where("status", "=", "pending")
      .where("available_at", "<=", new Date())
      .orderBy("priority", "asc")
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .executeTakeFirst();
    return row ? toQueueJob(row) : null;
  }

  async hold(id: number, retryAt: string, reason: string | null, refundAttempt = false) {
    await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({
        status: "pending",
        available_at: new Date(retryAt),
        started_at: null,
        completed_at: null,
        error_message: null,
        updated_at: new Date(),
        ...(refundAttempt ? { attempts: sql<number>`GREATEST(0, attempts - 1)` } : {}),
        result_json: JSON.stringify({ held: true, holdReason: reason, resumeAt: retryAt })
      })
      .where("id", "=", id)
      .where("status", "in", refundAttempt ? ["running"] : ["pending", "failed"])
      .execute();
    return this.find(id);
  }

  async markRunning(id: number) {
    const claim = await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({
        attempts: sql`attempts + 1`,
        error_message: null,
        started_at: new Date(),
        status: "running",
        updated_at: new Date()
      })
      .where("id", "=", id)
      .where("status", "in", ["pending", "failed"])
      .where("available_at", "<=", new Date())
      .executeTakeFirst();
    if (!Number(claim.numUpdatedRows)) return null;
    return this.find(id);
  }

  async markCompleted(id: number, result: Record<string, unknown>) {
    await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({
        completed_at: new Date(),
        result_json: JSON.stringify(result),
        status: "completed",
        updated_at: new Date()
      })
      .where("id", "=", id)
      .execute();
    return this.find(id);
  }

  async updateResult(id: number, result: Record<string, unknown>) {
    await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({ result_json: JSON.stringify(result), updated_at: new Date() })
      .where("id", "=", id)
      .where("status", "=", "running")
      .execute();
  }

  async markFailed(id: number, errorMessage: string, result: Record<string, unknown> = {}) {
    await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({
        completed_at: new Date(),
        error_message: errorMessage,
        result_json: JSON.stringify(result),
        status: "failed",
        updated_at: new Date()
      })
      .where("id", "=", id)
      .execute();
    return this.find(id);
  }

  async retry(id: number) {
    await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({
        available_at: new Date(),
        completed_at: null,
        error_message: null,
        started_at: null,
        status: "pending",
        updated_at: new Date()
      })
      .where("id", "=", id)
      .where("status", "in", ["failed", "cancelled"])
      .execute();
    return this.find(id);
  }

  async retryAfter(id: number, delayMs: number) {
    await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({
        available_at: new Date(Date.now() + Math.max(1000, delayMs)),
        completed_at: null,
        started_at: null,
        status: "pending",
        updated_at: new Date()
      })
      .where("id", "=", id)
      .where("status", "=", "failed")
      .execute();
    return this.find(id);
  }

  async cancel(id: number) {
    await getPlatformDatabase()
      .updateTable("queue_jobs")
      .set({ completed_at: new Date(), status: "cancelled", updated_at: new Date() })
      .where("id", "=", id)
      .where("status", "in", ["pending", "failed"])
      .execute();
    return this.find(id);
  }

  async cleanup(input: { completedBefore: Date; failedBefore: Date }) {
    const completed = await getPlatformDatabase()
      .deleteFrom("queue_jobs")
      .where("status", "in", ["completed", "cancelled"])
      .where("completed_at", "<", input.completedBefore)
      .executeTakeFirst();
    const failed = await getPlatformDatabase()
      .deleteFrom("queue_jobs")
      .where("status", "=", "failed")
      .where("completed_at", "<", input.failedBefore)
      .executeTakeFirst();
    return {
      completedDeleted: Number(completed.numDeletedRows ?? 0),
      failedDeleted: Number(failed.numDeletedRows ?? 0)
    };
  }

  private async enqueueOnDatabase(database: Kysely<PlatformDatabase>, input: QueueJobPayload) {
    const payloadJson = JSON.stringify(input.payload);
    if (input.idempotencyKey) {
      const existing = await database
        .selectFrom("queue_jobs")
        .selectAll()
        .where("idempotency_key", "=", input.idempotencyKey)
        .where("status", "in", ["pending", "running", "completed"])
        .executeTakeFirst();
      if (existing) return toQueueJob(existing);
    }

    const result = await database
      .insertInto("queue_jobs")
      .values({
        actor_email: input.actorEmail ?? null,
        attempts: 0,
        available_at: input.availableAt ? new Date(input.availableAt) : new Date(),
        correlation_id: input.correlationId ?? null,
        idempotency_key: input.idempotencyKey ?? null,
        job_name: input.jobName,
        max_attempts: input.maxAttempts ?? 3,
        payload_json: payloadJson,
        priority: input.priority ?? 100,
        queue_name: input.queueName,
        result_json: JSON.stringify({}),
        source_module: input.sourceModule,
        status: "pending",
        tenant_id: input.tenantId ?? null,
        uuid: randomBytes(4).toString("hex")
      })
      .executeTakeFirst();

    const row = await database
      .selectFrom("queue_jobs")
      .selectAll()
      .where("id", "=", Number(result.insertId))
      .executeTakeFirst();
    return row ? toQueueJob(row) : null;
  }
}

function normalizeBackend(value: string): QueueBackend {
  return value === "bullmq-redis" ? value : "database";
}

function toQueueJob(row: {
  actor_email: string | null;
  attempts: number;
  available_at: Date | string;
  completed_at: Date | string | null;
  correlation_id: string | null;
  created_at: Date | string;
  error_message: string | null;
  id: number;
  idempotency_key: string | null;
  job_name: string;
  max_attempts: number;
  payload_json: unknown;
  priority: number;
  queue_name: string;
  result_json: unknown;
  source_module: string;
  started_at: Date | string | null;
  status: QueueJobStatus;
  tenant_id: string | null;
  updated_at: Date | string;
  uuid: string;
}): QueueJobRecord {
  return {
    actorEmail: row.actor_email,
    attempts: Number(row.attempts),
    availableAt: new Date(row.available_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    correlationId: row.correlation_id,
    createdAt: new Date(row.created_at).toISOString(),
    errorMessage: row.error_message,
    id: Number(row.id),
    idempotencyKey: row.idempotency_key,
    jobName: row.job_name,
    maxAttempts: Number(row.max_attempts),
    payload: parseJson(row.payload_json),
    priority: Number(row.priority),
    queueName: row.queue_name,
    result: parseJson(row.result_json),
    sourceModule: row.source_module,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    status: row.status,
    tenantId: row.tenant_id,
    updatedAt: new Date(row.updated_at).toISOString(),
    uuid: row.uuid
  };
}

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
