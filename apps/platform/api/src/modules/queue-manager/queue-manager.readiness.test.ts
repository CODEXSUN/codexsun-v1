import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { env } from "../../env.js";
import type { QueueManagerService } from "./queue-manager.service.js";

let finish!: () => void;
const failed = new Promise<void>((resolve) => {
  finish = resolve;
});
mock.module(new URL("./queue-manager.service.ts", import.meta.url), {
  namedExports: { QueueManagerService: class {} }
});
mock.module(new URL("./queue-manager.bullmq.ts", import.meta.url), {
  namedExports: {
    startBullMqWorker: () => null,
    closeBullMq: async () => {},
    probeBullMq: async () => {
      throw new Error("Redis unavailable");
    }
  }
});
const { startQueueManagerWorker, isQueueWorkerHealthy } =
  await import("./queue-manager.runtime.js");

test("an empty SQL backlog cannot make unavailable Redis report healthy", async () => {
  const original = {
    host: env.CODEXSUN_QUEUE_EXECUTION_HOST,
    enabled: env.CODEXSUN_QUEUE_WORKER_ENABLED
  };
  env.CODEXSUN_QUEUE_EXECUTION_HOST = "worker";
  env.CODEXSUN_QUEUE_WORKER_ENABLED = "1";
  let close!: () => Promise<void>;
  let reconciliation = 0;
  const app = {
    log: { error: () => finish() },
    addHook: (_name: string, hook: () => Promise<void>) => {
      close = hook;
    }
  } as unknown as FastifyInstance;
  const service = {
    canExecute: () => true,
    currentBackend: async () => "bullmq-redis",
    reconcilePendingDeliveries: async () => {
      reconciliation++;
    }
  } as unknown as QueueManagerService;
  try {
    startQueueManagerWorker(app, service);
    await failed;
    assert.equal(isQueueWorkerHealthy("worker"), false);
    assert.equal(reconciliation, 0);
  } finally {
    await close();
    env.CODEXSUN_QUEUE_EXECUTION_HOST = original.host;
    env.CODEXSUN_QUEUE_WORKER_ENABLED = original.enabled;
  }
});
