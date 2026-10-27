import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { env } from "../../apps/platform/api/src/env.js";
import {
  getPlatformDatabase,
  closePlatformDatabase
} from "../../apps/platform/api/src/database/platform-database.js";
import { migrateQueueManagerModule } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.migration.js";
import { migratePlatformActivityModule } from "../../apps/platform/api/src/modules/platform-activity/platform-activity.migration.js";
import { QueueManagerService } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.service.js";
import { startQueueManagerWorker } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.runtime.js";
import {
  registerQueueJobProcessor,
  registerQueueJobReadiness
} from "../../apps/platform/api/src/modules/queue-manager/queue-manager.worker.js";

// This test creates only fixture tables. It never drops, resets, or scans tenant registries.
assert.match(env.DB_MASTER_NAME, /^codexsun_platform_[a-f0-9]{6}_master$/);
assert.match(env.DB_USER, /^cx_platform_[a-f0-9]{6}$/);
assert.equal(env.DB_HOST, "127.0.0.1");
assert.equal(env.CODEXSUN_QUEUE_EXECUTION_HOST, "worker");
assert.equal(env.CODEXSUN_QUEUE_BACKEND, "database");
const stem = env.DB_MASTER_NAME.replace(/_master$/, "");
const targets = { a: `${stem}_tenant_a`, b: `${stem}_tenant_b` };
const producer = new QueueManagerService();
const worker = new QueueManagerService(undefined, undefined, "worker");
const connect = (database: string) =>
  mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database
  });

if (process.env.CODEXSUN_PLATFORM_FIXTURE_CHILD === "1") {
  const app = Fastify();
  registerQueueJobReadiness("fixture.write", async (job) => ({
    ready: Date.now() >= Number(job.payload.holdUntil ?? 0),
    retryAt: new Date(Number(job.payload.holdUntil ?? Date.now())).toISOString(),
    reason: "fixture hold"
  }));
  registerQueueJobProcessor("fixture.write", async (job) => {
    const target = job.tenantId === "fixture-a" ? "a" : job.tenantId === "fixture-b" ? "b" : null;
    if (!target || job.payload.target !== target) throw new Error("Fixture tenant mismatch");
    if (job.payload.retry && job.attempts === 0) throw new Error("Fixture retry");
    const database = await connect(targets[target]);
    try {
      await database.execute("INSERT INTO worker_fixture_events (uuid, value) VALUES (?, ?)", [
        job.uuid,
        job.payload.value
      ]);
      return { target, processId: process.pid };
    } finally {
      await database.end();
    }
  });
  startQueueManagerWorker(app, worker);
  process.send?.("ready");
  const shutdown = () => {
    void app
      .close()
      .then(() => closePlatformDatabase())
      .then(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("message", (message) => {
    if (message === "stop") shutdown();
  });
} else {
  let child: ChildProcess | undefined;
  const run = randomUUID();
  try {
    await migrateQueueManagerModule(getPlatformDatabase());
    await migratePlatformActivityModule(getPlatformDatabase());
    assert.equal(await producer.currentBackend(), "database");
    for (const name of Object.values(targets)) {
      const database = await connect(name);
      try {
        await database.query(
          "CREATE TABLE IF NOT EXISTS worker_fixture_events (uuid VARCHAR(8) PRIMARY KEY, value VARCHAR(100) NOT NULL)"
        );
      } finally {
        await database.end();
      }
    }
    const first = await enqueue("a", "persisted-before-worker");
    await producer.runJob(first.id);
    assert.equal((await producer.findJob(first.id))?.status, "pending");
    assert.equal(producer.canExecute(), false);
    child = await start();
    const result = await wait(first.id, "completed");
    assert.notEqual(result.result.processId, process.pid);
    await Promise.all([worker.runJob(first.id), worker.runJob(first.id)]);
    assert.equal((await producer.findJob(first.id))?.attempts, 1);
    const second = await enqueue("b", "tenant-b");
    await wait(second.id, "completed");
    for (const [key, name] of Object.entries(targets)) {
      const database = await connect(name);
      try {
        const [rows] = await database.query<RowDataPacket[]>(
          "SELECT uuid FROM worker_fixture_events WHERE uuid IN (?,?)",
          [first.uuid, second.uuid]
        );
        assert.deepEqual(
          rows.map((row) => row.uuid),
          [key === "a" ? first.uuid : second.uuid]
        );
      } finally {
        await database.end();
      }
    }
    const held = await enqueue("a", "held", { holdUntil: Date.now() + 2500 });
    await delay(450);
    assert.equal((await producer.findJob(held.id))?.attempts, 0);
    await wait(held.id, "completed");
    const retried = await enqueue("b", "retry", { retry: true });
    assert.equal((await wait(retried.id, "completed")).attempts, 2);
    const cancelled = await enqueue(
      "a",
      "cancelled",
      {},
      new Date(Date.now() + 3000).toISOString()
    );
    await producer.cancelJob(cancelled.id);
    await stop(child);
    child = undefined;
    const persisted = await enqueue("b", "restart");
    child = await start();
    await wait(persisted.id, "completed");
    await delay(3200);
    assert.equal((await producer.findJob(cancelled.id))?.status, "cancelled");
    const mismatch = await producer.enqueue({
      jobName: "fixture.write",
      queueName: "system",
      sourceModule: "fixture",
      tenantId: "fixture-a",
      payload: { target: "b", value: "rejected" },
      maxAttempts: 1
    });
    assert.ok(mismatch);
    await wait(mismatch.id, "failed");
    console.log(
      JSON.stringify({
        evidence: "real MariaDB; separate child consumer; fixture owner handler",
        producerDeferred: true,
        tenantSeparation: true,
        duplicateTerminalDelivery: true,
        hold: true,
        retry: true,
        pendingRestart: true,
        cancellation: true,
        invalidTenantRejected: true,
        redis: "not tested",
        activeCrashRecovery: "not tested"
      })
    );
  } finally {
    if (child) await stop(child);
    await closePlatformDatabase();
  }

  async function enqueue(
    target: "a" | "b",
    value: string,
    extra: Record<string, unknown> = {},
    availableAt?: string
  ) {
    const job = await producer.enqueue({
      jobName: "fixture.write",
      queueName: "system",
      sourceModule: "fixture",
      tenantId: `fixture-${target}`,
      correlationId: run,
      idempotencyKey: `${run}:${value}`,
      payload: { target, value, ...extra },
      ...(availableAt ? { availableAt } : {})
    });
    assert.ok(job);
    return job;
  }
  async function wait(id: number, status: string) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const job = await producer.findJob(id);
      if (job?.status === status) return job;
      await delay(100);
    }
    throw new Error(`Fixture job ${id} did not reach ${status}`);
  }
  async function start() {
    const child = fork(fileURLToPath(import.meta.url), [], {
      cwd: process.cwd(),
      execArgv: ["--import", "tsx"],
      env: { ...process.env, CODEXSUN_PLATFORM_FIXTURE_CHILD: "1" },
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    child.stderr?.on("data", (data) => process.stderr.write(data));
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Fixture consumer startup timeout")),
          20000
        );
        child.once("message", () => {
          clearTimeout(timer);
          resolve();
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Fixture consumer exited: ${code}`));
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
    } catch (error) {
      if (child.pid && child.exitCode === null) {
        child.kill();
        await new Promise<void>((resolve) => child.once("close", () => resolve()));
      }
      throw error;
    }
    return child;
  }
  async function stop(child: ChildProcess) {
    if (child.exitCode !== null) return;
    // Windows does not deliver POSIX SIGTERM to Node. IPC requests graceful drain there.
    child.send("stop");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Fixture consumer did not drain"));
      }, 15000);
      child.once("exit", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`Fixture consumer exit: ${code}`));
      });
    });
  }
}
