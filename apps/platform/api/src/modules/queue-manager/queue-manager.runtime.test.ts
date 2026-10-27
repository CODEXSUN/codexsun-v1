import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyInstance } from "fastify";
import { QueueManagerService } from "./queue-manager.service.js";
import { startQueueManagerWorker } from "./queue-manager.runtime.js";

test("worker shutdown waits for active database dispatch", async () => {
  let resolveDispatch!: () => void;
  const dispatch = new Promise<void>((resolve) => {
    resolveDispatch = resolve;
  });
  let started!: () => void;
  const dispatched = new Promise<void>((resolve) => {
    started = resolve;
  });
  const service = new QueueManagerService();
  service.canExecute = () => true;
  service.currentBackend = async () => "database";
  service.runNextJob = async () => {
    started();
    await dispatch;
    return null;
  };
  let close!: () => Promise<void>;
  const app = {
    log: { error: () => {} },
    addHook: (_name: string, callback: () => Promise<void>) => {
      close = callback;
    }
  } as unknown as FastifyInstance;
  startQueueManagerWorker(app, service);
  await dispatched;
  let closed = false;
  const closing = close().then(() => {
    closed = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, false);
  resolveDispatch();
  await closing;
  assert.equal(closed, true);
});
