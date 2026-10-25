import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Queue, QueueEvents } from "bullmq";
import { Redis } from "ioredis";

const [mode, run, rawCount] = process.argv.slice(2);
const count = Number(rawCount);
assert.match(run, /^codexsun-hardness-[a-z0-9-]+$/);
assert.equal(process.env.CODEXSUN_WORKER_QUEUE_PREFIX, "codexsun-worker-local-cloud");
assert.ok(Number.isInteger(count) && count > 0 && count <= 2000);
const connection = new Redis(process.env.CODEXSUN_REDIS_URL, { maxRetriesPerRequest: null });
const options = { connection, prefix: process.env.CODEXSUN_WORKER_QUEUE_PREFIX };
const queue = new Queue("worker.probe", options);
const events = new QueueEvents("worker.probe", options);
const completedEvents = new Map();
events.on("completed", ({ jobId }) => {
  if (jobId.startsWith(run)) completedEvents.set(jobId, (completedEvents.get(jobId) ?? 0) + 1);
});
await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]);
const ids = Array.from({ length: count }, (_, index) => `${run}-${index}`);
const extraIds = [];
let remove = mode !== "enqueue";
try {
  const started = performance.now();
  if (mode === "cleanup") {
    const records = await queue.getJobs(["completed", "failed", "waiting", "delayed"], 0, -1);
    let removed = 0;
    for (const job of records)
      if (
        String(job.id).startsWith(run) ||
        (typeof job.data.value === "string" && job.data.value.startsWith(run))
      ) {
        await job.remove();
        removed++;
      }
    console.log(JSON.stringify({ removed }));
  } else {
    if (mode !== "verify") {
      await queue.addBulk(
        ids.map((jobId) => ({
          name: "worker.probe",
          data: { value: jobId },
          opts: { jobId, removeOnComplete: false }
        }))
      );
    }
    if (mode === "enqueue") {
      const states = await Promise.all(ids.map(async (id) => (await queue.getJob(id)).getState()));
      assert.ok(states.every((state) => state === "waiting"));
      console.log(JSON.stringify({ queued: count, state: "waiting" }));
    } else {
      if (mode === "load") {
        await Promise.all(
          ids
            .slice(0, 10)
            .map((jobId) =>
              queue.add("worker.probe", { value: "duplicate-must-not-replace" }, { jobId })
            )
        );
      }
      const jobs = await finish(ids, "completed");
      const durations = [];
      for (const [index, job] of jobs.entries()) {
        assert.equal(job.returnvalue.value, ids[index]);
        assert.equal(job.attemptsMade, 1);
        durations.push(job.finishedOn - job.timestamp);
      }
      const elapsedMs = performance.now() - started;
      const summary = {
        completed: count,
        duplicateAttempts: mode === "load" ? 10 : 0,
        duplicateExecutions: 0,
        elapsedMs: Math.round(elapsedMs),
        jobsPerSecond: Math.round((count / elapsedMs) * 1000),
        latencyMs: percentiles(durations)
      };
      if (mode === "verify") {
        summary.verificationSweepMs = summary.elapsedMs;
        summary.includesRestartDowntime = true;
        delete summary.elapsedMs;
        delete summary.jobsPerSecond;
      }
      if (mode === "load") {
        await delay(100);
        for (const id of ids) assert.equal(completedEvents.get(id), 1);
        const delayedIds = Array.from({ length: 20 }, (_, index) => `${run}-delayed-${index}`);
        extraIds.push(...delayedIds);
        await queue.addBulk(
          delayedIds.map((jobId) => ({
            name: "worker.probe",
            data: { value: jobId },
            opts: { jobId, delay: 500, removeOnComplete: false }
          }))
        );
        const delayed = await finish(delayedIds, "completed");
        for (const job of delayed) assert.ok(job.processedOn - job.timestamp >= 450);
        const invalidId = `${run}-invalid`;
        extraIds.push(invalidId);
        await queue.add(
          "worker.probe",
          { value: { invalid: true } },
          {
            jobId: invalidId,
            attempts: 3,
            backoff: { type: "exponential", delay: 100 },
            removeOnFail: false
          }
        );
        const [failed] = await finish([invalidId], "failed");
        assert.equal(failed.attemptsMade, 3);
        assert.match(failed.failedReason, /Invalid worker probe job/);
        summary.delayedJobs = 20;
        summary.invalidJobAttempts = 3;
      }
      console.log(JSON.stringify(summary));
    }
  }
} finally {
  if (remove)
    for (const id of [...ids, ...extraIds]) {
      const job = await queue.getJob(id);
      if (job) await job.remove();
    }
  await events.close();
  await queue.close();
  await connection.quit();
}

async function finish(jobIds, expected) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const jobs = await Promise.all(jobIds.map((id) => queue.getJob(id)));
    if (jobs.every(Boolean)) {
      const states = await Promise.all(jobs.map((job) => job.getState()));
      if (states.every((state) => state === expected))
        return Promise.all(jobIds.map((id) => queue.getJob(id)));
      if (expected === "completed")
        assert.ok(!states.includes("failed"), "Unexpected failed sample job");
    }
    await delay(100);
  }
  throw new Error(`Sample jobs did not reach ${expected}`);
}
function percentiles(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    max: sorted.at(-1)
  };
}
