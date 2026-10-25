import { isFrappeUnavailable } from "../../apps/frappe/api/src/modules/live-sync/live-sync.availability.policy.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createConnection } from "mysql2/promise";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { env } from "../../apps/platform/api/src/env.js";
import {
  getPlatformDatabase,
  closePlatformDatabase
} from "../../apps/platform/api/src/database/platform-database.js";
import { migrateQueueManagerModule } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.migration.js";
import { migratePlatformActivityModule } from "../../apps/platform/api/src/modules/platform-activity/platform-activity.migration.js";
import { QueueManagerService } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.service.js";
import { QueueManagerRepository } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.repository.js";
import {
  registerQueueJobReadiness,
  registerQueueJobProcessor,
  QueueJobHeld
} from "../../apps/platform/api/src/modules/queue-manager/queue-manager.worker.js";
import {
  migrateFrappeTenantDatabase,
  FrappeConnectionRepository,
  type FrappeDatabase
} from "../../apps/frappe/api/src/modules/connection/index.js";
import { FrappeAvailabilityService } from "../../apps/frappe/api/src/modules/live-sync/live-sync.availability.js";

assert.equal(env.NODE_ENV, "development");
test("Frappe server hours, offline cooldown, queue hold, and recovery preserve job identity and retries", async (t) => {
  const name = `codexsun_availability_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const originalMaster = env.DB_MASTER_NAME;
  const originalFetch = globalThis.fetch;
  const admin = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  });
  await admin.query(`CREATE DATABASE ${name}`);
  const db = new Kysely<FrappeDatabase>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: name,
        timezone: "Z"
      })
    })
  });
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await closePlatformDatabase();
    env.DB_MASTER_NAME = originalMaster;
    await db.destroy();
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  });
  await sql`CREATE TABLE crm_enquiries (id INT NOT NULL PRIMARY KEY)`.execute(db);
  await migrateFrappeTenantDatabase(db);
  await migrateFrappeTenantDatabase(db);
  const connection = new FrappeConnectionRepository(db);
  const settings = {
    baseUrl: "https://frappe.example",
    apiKey: "test",
    apiSecret: "test",
    enabled: true
  };
  await connection.saveConnection({ ...settings, connectionName: "Local test" }, env.JWT_SECRET);
  await connection.recordVerification("verified");
  const service = new FrappeAvailabilityService(db, env.JWT_SECRET, settings);
  await service.save(
    { scheduleEnabled: true, timezone: "Asia/Kolkata", opensAt: "08:00", closesAt: "21:00" },
    "test"
  );
  let probes = 0;
  let online = false;
  globalThis.fetch = async () => {
    probes++;
    return online
      ? Response.json({ message: "pong" })
      : Response.json({ error_code: 1033 }, { status: 530 });
  };
  let clock = new Date("2026-10-25T15:30:00Z");
  const closed = await service.ready(clock);
  assert.equal(closed.ready, false);
  assert.equal(closed.retryAt, "2026-10-26T02:30:00.000Z");
  assert.equal(probes, 0, "No health probes outside hours");
  clock = new Date("2026-10-26T02:30:00Z");
  assert.equal((await service.ready(clock)).ready, false);
  assert.equal(probes, 1);
  for (let scan = 0; scan < 25; scan++) assert.equal((await service.ready(clock)).ready, false);
  assert.equal(probes, 1, "Offline scans share one five-minute cooldown");
  online = true;
  clock = new Date("2026-10-26T02:35:00Z");
  const concurrent = await Promise.all([
    service.ready(clock),
    service.ready(clock),
    service.ready(clock)
  ]);
  assert.ok(concurrent.some((value) => value.ready));
  assert.equal(probes, 2, "One shared database lease probes on recovery");
  assert.equal((await service.ready(clock)).ready, true);
  assert.equal(probes, 2);

  env.DB_MASTER_NAME = name;
  await migrateQueueManagerModule(getPlatformDatabase());
  await migratePlatformActivityModule(getPlatformDatabase());
  const repository = new QueueManagerRepository();
  await repository.setBackend("database", "test");
  const queue = new QueueManagerService(repository);
  const jobName = "test.frappe-availability";
  let writes = 0;
  registerQueueJobReadiness(jobName, () => service.ready(clock));
  registerQueueJobProcessor(jobName, async () => {
    writes++;
    return { imported: 1 };
  });
  clock = new Date("2026-10-26T15:30:00Z");
  const job = await queue.enqueue({
    jobName,
    queueName: "reports",
    sourceModule: "test",
    payload: {},
    idempotencyKey: `availability-${name}`,
    maxAttempts: 3
  });
  assert.ok(job);
  const held = await queue.runJob(job.id);
  assert.equal(held?.status, "pending");
  assert.equal(held?.result.held, true);
  assert.equal(held?.attempts, 0);
  assert.equal(writes, 0);
  for (let retry = 0; retry < 3; retry++) await queue.runJob(job.id);
  assert.equal((await queue.findJob(job.id))?.attempts, 0);
  assert.equal(probes, 2);
  await assert.rejects(
    queue.runJob(job.id, { fromWorker: true, expectedUuid: job.uuid }),
    QueueJobHeld
  );
  clock = new Date("2026-10-27T02:30:00Z");
  online = false;
  await queue.runJob(job.id);
  assert.equal((await queue.findJob(job.id))?.attempts, 0);
  assert.equal(writes, 0);
  online = true;
  clock = new Date("2026-10-27T02:35:00Z");
  const completed = await queue.runJob(job.id);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.attempts, 1);
  assert.equal(completed?.uuid, job.uuid);
  assert.equal(completed?.idempotencyKey, job.idempotencyKey);
  await queue.runJob(job.id);
  assert.equal(writes, 1, "Completed work cannot run twice");
  const count = await sql<{ count: number }>`SELECT COUNT(*) AS count FROM queue_jobs`.execute(
    getPlatformDatabase()
  );
  assert.equal(Number(count.rows[0]?.count), 1, "Holding does not create another job");
  const disconnectedName = "test.frappe-disconnect-after-probe";
  let remoteCalls = 0;
  registerQueueJobReadiness(disconnectedName, async (_job, error, result) => {
    if (error && isFrappeUnavailable(error)) return service.unavailable(error, clock);
    if (result) return { ready: true, reason: null, retryAt: clock.toISOString() };
    return service.ready(clock);
  });
  registerQueueJobProcessor(disconnectedName, async () => {
    remoteCalls++;
    if (remoteCalls === 1) throw new Error("Frappe could not be reached.");
    return { imported: 1 };
  });
  const disconnected = await queue.enqueue({
    jobName: disconnectedName,
    queueName: "reports",
    sourceModule: "test",
    payload: {},
    maxAttempts: 3
  });
  assert.ok(disconnected);
  const disconnectedHold = await queue.runJob(disconnected.id);
  assert.equal(disconnectedHold?.status, "pending");
  assert.equal(disconnectedHold?.attempts, 0, "Transport loss refunds the queue attempt");
  assert.equal(disconnectedHold?.result.held, true);
  await queue.runJob(disconnected.id);
  assert.equal(remoteCalls, 1, "The open circuit blocks another business request");
  clock = new Date(clock.getTime() + 300_000);
  const reconnected = await queue.runJob(disconnected.id);
  assert.equal(reconnected?.status, "completed");
  assert.equal(reconnected?.attempts, 1);
  assert.equal(reconnected?.uuid, disconnected.uuid);
  const mappingName = "test.frappe-mapping-error";
  registerQueueJobReadiness(mappingName, async (_job, error) =>
    error ? { ready: true, reason: null, retryAt: clock.toISOString() } : service.ready(clock)
  );
  registerQueueJobProcessor(mappingName, async () => {
    throw new Error("Customer mapping is missing");
  });
  const mappingJob = await queue.enqueue({
    jobName: mappingName,
    queueName: "reports",
    sourceModule: "test",
    payload: {},
    maxAttempts: 3
  });
  assert.ok(mappingJob);
  const mappingFailure = await queue.runJob(mappingJob.id);
  assert.equal(mappingFailure?.attempts, 1);
  assert.notEqual(mappingFailure?.result.held, true);
  assert.match(mappingFailure?.errorMessage ?? "", /Customer mapping/u);
});
