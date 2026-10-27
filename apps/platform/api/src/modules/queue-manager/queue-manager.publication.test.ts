import assert from "node:assert/strict";
import test from "node:test";
import { QueueManagerService } from "./queue-manager.service.js";
import type { QueueManagerRepository } from "./queue-manager.repository.js";
import type { PlatformActivityService } from "../platform-activity/index.js";
import type { QueueJobRecord } from "./queue-manager.types.js";

const pending = { id: 1, uuid: "job-uuid", status: "pending", attempts: 0 } as QueueJobRecord;

test("a Redis publication failure preserves the durable pending enqueue result", async () => {
  let published = 0;
  const repository = { enqueue: async () => pending, backend: async () => "bullmq-redis" };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    undefined,
    "platform",
    undefined,
    async () => {
      published++;
      throw new Error("Redis unavailable");
    }
  );
  assert.equal(
    await service.enqueue({
      jobName: "queue.probe",
      queueName: "system",
      sourceModule: "test",
      payload: {}
    }),
    pending
  );
  assert.equal(published, 1);
});

test("reconciliation exposes transport failure so readiness can report unavailable", async () => {
  const repository = { pendingDeliveries: async () => [pending] };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    undefined,
    "worker",
    undefined,
    async () => {
      throw new Error("Redis unavailable");
    }
  );
  await assert.rejects(service.reconcilePendingDeliveries(), /Redis unavailable/);
});

test("activity failure cannot invalidate a saved retry, cancellation, or backend change", async (context) => {
  const warning = context.mock.method(console, "warn", () => {});
  const cancelled = { ...pending, status: "cancelled" } as QueueJobRecord;
  const settings = { backend: "database", backendLabel: "Database queue" };
  const repository = {
    retry: async () => pending,
    cancel: async () => cancelled,
    backend: async () => "database",
    setBackend: async () => settings
  };
  const activity = {
    recordActivity: async () => {
      throw new Error("Activity unavailable");
    }
  };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    activity as unknown as PlatformActivityService
  );
  assert.equal(await service.retryJob(1), pending);
  assert.equal(await service.cancelJob(1), cancelled);
  assert.equal(await service.switchBackend("database", "admin@example.test"), settings);
  assert.equal(warning.mock.callCount(), 3);
});

for (const status of ["running", "completed"] as const) {
  test(`idempotent enqueue returns an existing ${status} record without publication`, async () => {
    const existing = { ...pending, status, attempts: 1 };
    let transportChecks = 0;
    const repository = {
      enqueue: async () => existing,
      backend: async () => {
        transportChecks++;
        throw new Error("Nonpending records cannot create transport deliveries");
      }
    };
    const service = new QueueManagerService(repository as unknown as QueueManagerRepository);
    assert.equal(
      await service.enqueue({
        jobName: "queue.probe",
        queueName: "system",
        sourceModule: "test",
        payload: {},
        idempotencyKey: "already-running-or-completed"
      }),
      existing
    );
    assert.equal(transportChecks, 0);
  });
}

for (const status of ["running", "completed"] as const) {
  test(`manual retry cannot publish an unchanged ${status} record`, async () => {
    const existing = { ...pending, status, attempts: 1 };
    let transportChecks = 0;
    const repository = {
      retry: async () => existing,
      backend: async () => {
        transportChecks++;
        throw new Error("Nonpending records cannot create transport deliveries");
      }
    };
    const activity = { recordActivity: async () => undefined };
    const service = new QueueManagerService(
      repository as unknown as QueueManagerRepository,
      activity as unknown as PlatformActivityService
    );
    assert.equal(await service.retryJob(existing.id), existing);
    assert.equal(transportChecks, 0);
  });
}
