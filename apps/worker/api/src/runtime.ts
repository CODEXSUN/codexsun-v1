import { Queue, QueueEvents, Worker } from "bullmq";
import { Redis } from "ioredis";

export type WorkerRuntimeOptions = {
  redisUrl: string;
  prefix?: string;
  onError?: (error: Error) => void;
};

export function startWorkerRuntime(options: WorkerRuntimeOptions) {
  const prefix = options.prefix ?? "codexsun-worker";
  if (!/^codexsun[-a-z0-9:_]{0,100}$/.test(prefix)) throw new Error("Invalid Worker queue prefix.");
  const connection = new Redis(redisConnection(options.redisUrl));
  const worker = new Worker(
    "worker.probe",
    async (job) => {
      if (
        job.name !== "worker.probe" ||
        typeof job.data.value !== "string" ||
        Array.from(job.data.value).length > 128
      ) {
        throw new Error("Invalid worker probe job.");
      }
      return { receivedAt: new Date().toISOString(), value: job.data.value };
    },
    { connection, prefix }
  );
  const queue = new Queue("worker.probe", { connection, prefix });
  const events = new QueueEvents("worker.probe", { connection, prefix });
  let redisReady = () => false;
  const onError = (error: Error) => options.onError?.(error);
  connection.on("error", onError);
  void queue
    .getBackend()
    .client.then((client) => {
      redisReady = () => client.status === "ready";
    })
    .catch(onError);
  worker.on("error", onError);
  queue.on("error", onError);
  events.on("error", onError);
  return {
    isReady: () => redisReady() && worker.isRunning(),
    async close() {
      await worker.close();
      await events.close();
      await queue.close();
      await connection.quit();
    },
    async probe(value = "ready") {
      const job = await queue.add(
        "worker.probe",
        { value },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 250 },
          removeOnComplete: { count: 100, age: 3600 },
          removeOnFail: { count: 100, age: 86400 }
        }
      );
      const result = await job.waitUntilFinished(events, 5000);
      return { id: job.id, prefix, queue: "worker.probe", result };
    },
    async ready() {
      await Promise.all([worker.waitUntilReady(), queue.waitUntilReady(), events.waitUntilReady()]);
    }
  };
}

function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  const db = url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : 0;
  if (!["redis:", "rediss:"].includes(url.protocol) || !Number.isInteger(db) || db < 0) {
    throw new Error("Invalid Worker Redis URL.");
  }
  return {
    db,
    host: url.hostname,
    maxRetriesPerRequest: null,
    connectTimeout: 2000,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    ...(url.protocol === "rediss:" ? { tls: {} } : {})
  };
}
