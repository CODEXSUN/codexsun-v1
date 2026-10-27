import assert from "node:assert/strict";
import test from "node:test";
import { QueueManagerService } from "./queue-manager.service.js";
import type { QueueManagerRepository } from "./queue-manager.repository.js";
import type { PlatformActivityService } from "../platform-activity/index.js";
import type { QueueJobRecord } from "./queue-manager.types.js";

const pending = { id: 1, uuid: "job-uuid", status: "pending", attempts: 0 } as QueueJobRecord;

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
