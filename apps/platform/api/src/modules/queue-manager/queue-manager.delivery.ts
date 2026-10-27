import { createHash } from "node:crypto";

export function redisQueuePrefix(database: { host: string; port: number; name: string }) {
  const identity = JSON.stringify([
    database.host.trim().toLowerCase(),
    database.port,
    database.name
  ]);
  return `codexsun-${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

export function readQueueDelivery(data: unknown) {
  if (!data || typeof data !== "object") throw new Error("Invalid queue delivery.");
  const record = data as Record<string, unknown>;
  if (
    !Number.isSafeInteger(record.queueJobId) ||
    Number(record.queueJobId) <= 0 ||
    typeof record.queueJobUuid !== "string" ||
    !record.queueJobUuid.length ||
    record.queueJobUuid.length > 128
  )
    throw new Error("Queue delivery requires a persisted job ID and UUID.");
  return { id: Number(record.queueJobId), uuid: record.queueJobUuid };
}

export function verifyQueueDelivery(
  expectedUuid: string,
  job: { uuid: string } | null | undefined
) {
  if (!job || job.uuid !== expectedUuid)
    throw new Error("Queue delivery does not match the persisted job identity.");
}

export function queueDeliveryDelay(availableAt: string, now = Date.now()) {
  const available = Date.parse(availableAt);
  if (!Number.isFinite(available))
    throw new Error("Queue delivery requires a valid availability time.");
  return Math.max(0, available - now);
}

export async function publishPendingDeliveries<TJob extends { id: number }>(
  readBatch: (afterId: number) => Promise<TJob[]>,
  publish: (job: TJob) => Promise<void>
) {
  let afterId = 0;
  for (;;) {
    const jobs = await readBatch(afterId);
    for (const job of jobs) await publish(job);
    if (jobs.length < 100) return;
    afterId = jobs.at(-1)!.id;
  }
}

export function queueDeliveryId(job: { uuid: string; attempts: number }) {
  return createHash("sha256").update(`${job.uuid}:${job.attempts}`).digest("hex");
}

export async function reuseQueueDelivery(
  delivery:
    | {
        getState: () => Promise<string>;
        remove: () => Promise<void>;
        promote: () => Promise<void>;
      }
    | undefined,
  availableAt: string
) {
  if (!delivery) return false;
  const state = await delivery.getState();
  // A cancelled SQL job can be retried without consuming an attempt generation.
  if (state === "completed" || state === "failed") {
    await delivery.remove();
    return false;
  }
  if (state === "delayed" && queueDeliveryDelay(availableAt) === 0) await delivery.promote();
  return true;
}
