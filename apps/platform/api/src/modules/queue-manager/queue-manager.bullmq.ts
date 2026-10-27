import { QueueJobHeld } from "./queue-manager.worker.js";
import { Queue, Worker, DelayedError, type JobsOptions } from "bullmq";
import { env } from "../../env.js";
import type { QueueJobRecord } from "./queue-manager.types.js";
import { queueRedisConnection } from "./queue-manager.redis.js";
import {
  queueDeliveryDelay,
  queueDeliveryId,
  readQueueDelivery,
  redisQueuePrefix,
  reuseQueueDelivery
} from "./queue-manager.delivery.js";

export const queueRedisPrefix = redisQueuePrefix({
  host: env.DB_HOST,
  port: env.DB_PORT,
  name: env.DB_MASTER_NAME
});

const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

export async function publishBullMqJob(job: QueueJobRecord) {
  if (job.status !== "pending") return;
  const queue = queueFor(job.queueName);
  try {
    await publishDelivery(queue, job);
  } catch (error) {
    if (queues.get(job.queueName) === queue) queues.delete(job.queueName);
    await queue.close().catch(() => undefined);
    throw error;
  }
}

async function publishDelivery(queue: Queue, job: QueueJobRecord) {
  if (await hasLivePriorDelivery(queue, job)) return;
  if (await reuseQueueDelivery(await queue.getJob(queueDeliveryId(job)), job.availableAt)) return;
  const options: JobsOptions = {
    attempts: job.maxAttempts,
    backoff: { delay: 5000, type: "exponential" },
    jobId: queueDeliveryId(job),
    priority: job.priority,
    delay: queueDeliveryDelay(job.availableAt),
    removeOnComplete: { age: env.CODEXSUN_QUEUE_COMPLETED_RETENTION_DAYS * 86400 },
    removeOnFail: { age: env.CODEXSUN_QUEUE_FAILED_RETENTION_DAYS * 86400 }
  };
  await queue.add(
    job.jobName,
    { ...job.payload, queueJobId: job.id, queueJobUuid: job.uuid },
    options
  );
}

export function startBullMqWorker(
  queueName: string,
  run: (queueJobId: number, queueJobUuid: string) => Promise<unknown>
) {
  if (workers.has(queueName)) return null;
  const worker = new Worker(
    queueName,
    async (job, token) => {
      const identity = readQueueDelivery(job.data);
      try {
        return await run(identity.id, identity.uuid);
      } catch (error) {
        if (!(error instanceof QueueJobHeld)) throw error;
        await job.moveToDelayed(Date.parse(error.retryAt), token);
        throw new DelayedError();
      }
    },
    { connection: queueRedisConnection(env.CODEXSUN_REDIS_URL, true), prefix: queueRedisPrefix }
  );
  worker.on("error", () => console.warn("[queue] Redis consumer unavailable."));
  workers.set(queueName, worker);
  return worker;
}

export async function probeBullMq() {
  const queue = new Queue(`codexsun-probe-${process.pid}`, {
    connection: queueRedisConnection(env.CODEXSUN_REDIS_URL),
    prefix: queueRedisPrefix
  });
  queue.on("error", () => console.warn("[queue] Redis probe unavailable."));
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      queue.waitUntilReady(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Redis connection probe timed out.")), 3000);
      })
    ]);
    return { connected: true as const };
  } finally {
    if (timer) clearTimeout(timer);
    await queue.close().catch(() => undefined);
  }
}

export async function closeBullMq() {
  for (const worker of workers.values()) await worker.close();
  for (const queue of queues.values()) await queue.close();
  workers.clear();
  queues.clear();
}

function queueFor(queueName: string) {
  const existing = queues.get(queueName);
  if (existing) return existing;
  const queue = new Queue(queueName, {
    connection: queueRedisConnection(env.CODEXSUN_REDIS_URL),
    prefix: queueRedisPrefix
  });
  queue.on("error", () => console.warn("[queue] Redis producer unavailable."));
  queues.set(queueName, queue);
  return queue;
}

async function hasLivePriorDelivery(queue: Queue, job: QueueJobRecord) {
  const liveStates = new Set([
    "waiting",
    "active",
    "delayed",
    "prioritized",
    "waiting-children",
    "paused"
  ]);
  for (let attempts = 0; attempts < job.attempts; attempts++) {
    const previous = await queue.getJob(queueDeliveryId({ uuid: job.uuid, attempts }));
    if (previous) {
      const state = await previous.getState();
      if (liveStates.has(state)) {
        if (state === "delayed" && queueDeliveryDelay(job.availableAt) === 0)
          await previous.promote();
        return true;
      }
    }
  }
  return false;
}
