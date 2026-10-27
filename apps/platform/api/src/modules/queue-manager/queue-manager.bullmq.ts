import { QueueJobHeld } from "./queue-manager.worker.js";
import { Queue, Worker, DelayedError, type JobsOptions } from "bullmq";
import { env } from "../../env.js";
import type { QueueJobRecord } from "./queue-manager.types.js";
import {
  queueDeliveryDelay,
  queueDeliveryId,
  readQueueDelivery,
  redisQueuePrefix
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
  if (await hasLivePriorDelivery(queue, job)) return;
  const options: JobsOptions = {
    attempts: job.maxAttempts,
    backoff: { delay: 5000, type: "exponential" },
    jobId: queueDeliveryId(job),
    priority: job.priority,
    delay: queueDeliveryDelay(job.availableAt),
    removeOnComplete: false,
    removeOnFail: false
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
    { connection: redisConnectionOptions(), prefix: queueRedisPrefix }
  );
  workers.set(queueName, worker);
  return worker;
}

export async function probeBullMq() {
  const queue = new Queue(`codexsun-probe-${process.pid}`, {
    connection: redisConnectionOptions(),
    prefix: queueRedisPrefix
  });
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
    connection: redisConnectionOptions(),
    prefix: queueRedisPrefix
  });
  queues.set(queueName, queue);
  return queue;
}

function redisConnectionOptions() {
  const url = new URL(env.CODEXSUN_REDIS_URL);
  return {
    db: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : 0,
    host: url.hostname || "127.0.0.1",
    maxRetriesPerRequest: null,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined
  };
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
    if (previous && liveStates.has(await previous.getState())) return true;
  }
  return false;
}
