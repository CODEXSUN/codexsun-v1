import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "ioredis";
import { env } from "../../env.js";
import { closeBullMq, publishBullMqJob } from "./queue-manager.bullmq.js";
import type { QueueJobRecord } from "./queue-manager.types.js";

test("a Redis peer that accepts TCP but never answers cannot hold publication indefinitely", async () => {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("data", () => {});
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const original = env.CODEXSUN_REDIS_URL;
  env.CODEXSUN_REDIS_URL = `redis://127.0.0.1:${address.port}/0`;
  let timer: NodeJS.Timeout | undefined;
  try {
    const publication = Promise.resolve().then(() =>
      publishBullMqJob({
        id: 1,
        uuid: randomUUID(),
        queueName: `codexsun-unresponsive-${randomUUID()}`,
        jobName: "queue.probe",
        status: "pending",
        attempts: 0,
        maxAttempts: 1,
        priority: 1,
        payload: {},
        availableAt: new Date().toISOString()
      } as QueueJobRecord)
    );
    await Promise.race([
      assert.rejects(publication),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Publication exceeded its outage bound")), 11000);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    for (const socket of sockets) socket.destroy();
    await closeBullMq();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    env.CODEXSUN_REDIS_URL = original;
  }
});
