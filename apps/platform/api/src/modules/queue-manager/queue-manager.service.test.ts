import assert from "node:assert/strict";
import test from "node:test";
import { QueueManagerService } from "./queue-manager.service.js";
import type { QueueManagerRepository } from "./queue-manager.repository.js";
import type { PlatformActivityService } from "../platform-activity/index.js";
import {
  QueueJobHeld,
  registerQueueJobProcessor,
  registerQueueJobReadiness
} from "./queue-manager.worker.js";
import type { QueueJobRecord } from "./queue-manager.types.js";

const pending = {
  id: 1,
  uuid: "job-uuid",
  status: "pending",
  availableAt: new Date().toISOString()
} as QueueJobRecord;

function producerService() {
  let claims = 0;
  const repository = {
    find: async () => pending,
    enqueue: async () => pending,
    backend: async () => "database",
    markRunning: async () => {
      claims++;
      throw new Error("Producer claimed a job");
    },
    nextRunnable: async () => {
      throw new Error("Producer polled the queue");
    }
  };
  const service = new QueueManagerService(repository as unknown as QueueManagerRepository);
  service.canExecute = () => false;
  return { service, claims: () => claims };
}

test("producer manual run defers database work without claiming it", async () => {
  const { service, claims } = producerService();
  assert.equal(await service.runJob(pending.id), pending);
  assert.equal(await service.runNextJob(), null);
  assert.equal(claims(), 0);
});

test("immediate enqueue persists without inline execution even in the selected executor", async () => {
  const { service, claims } = producerService();
  service.canExecute = () => true;
  assert.equal(
    await service.enqueue({
      dispatchImmediately: true,
      jobName: "queue.probe",
      queueName: "system",
      payload: {},
      sourceModule: "platform.queue-manager"
    }),
    pending
  );
  assert.equal(claims(), 0);
});

test("a consumer running in the wrong executor cannot acknowledge delivery", async () => {
  const { service, claims } = producerService();
  await assert.rejects(
    service.runJob(pending.id, {
      fromWorker: true,
      expectedUuid: pending.uuid
    }),
    /does not own queue execution/
  );
  assert.equal(claims(), 0);
});

test("the selected executor preserves preflight holds and cancelled records", async () => {
  const job = { ...pending, jobName: "queue-manager.hold-test", attempts: 0 };
  let claims = 0;
  let calls = 0;
  registerQueueJobProcessor(job.jobName, async () => {
    calls++;
    return {};
  });
  registerQueueJobReadiness(job.jobName, async () => ({
    ready: false,
    retryAt: "2099-01-01T00:00:00.000Z",
    reason: "Availability window"
  }));
  const repository = {
    find: async () => job,
    backend: async () => "database",
    hold: async () => job,
    markRunning: async () => {
      claims++;
      return job;
    }
  };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    undefined,
    "worker"
  );
  service.canExecute = () => true;
  assert.equal(await service.runJob(job.id), job);
  assert.equal(claims, 0);
  assert.equal(calls, 0);
  job.status = "cancelled";
  assert.equal(await service.runJob(job.id), job);
  assert.equal(claims, 0);
});

test("the selected executor dispatches a claimed persisted record once", async () => {
  const job = { ...pending, jobName: "queue-manager.dispatch-test", payload: { tenant: "a" } };
  let calls = 0;
  registerQueueJobProcessor(job.jobName, async (record) => {
    calls++;
    assert.equal(record.payload.tenant, "a");
    return { received: true };
  });
  const repository = {
    find: async () => job,
    backend: async () => "database",
    markRunning: async () => {
      job.status = "running";
      return job;
    },
    markCompleted: async () => {
      job.status = "completed";
      return job;
    }
  };
  const activity = { recordActivity: async () => undefined };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    activity as unknown as PlatformActivityService,
    "worker"
  );
  service.canExecute = () => true;
  await service.runJob(job.id);
  await service.runJob(job.id);
  assert.equal(job.status, "completed");
  assert.equal(calls, 1);
});

test("execution preparation follows claim and precedes the owner handler", async () => {
  const job = {
    ...pending,
    jobName: "queue-manager.prepare-order-test",
    attempts: 0,
    maxAttempts: 1
  };
  const order: string[] = [];
  registerQueueJobProcessor(job.jobName, async () => {
    order.push("handler");
    return {};
  });
  const repository = {
    find: async () => job,
    backend: async () => "database",
    markRunning: async () => {
      order.push("claim");
      job.status = "running";
      return job;
    },
    markCompleted: async () => {
      order.push("complete");
      job.status = "completed";
      return job;
    }
  };
  const activity = { recordActivity: async () => undefined };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    activity as unknown as PlatformActivityService,
    "worker",
    async (claimed) => {
      assert.equal(claimed.status, "running");
      order.push("prepare");
    }
  );
  service.canExecute = () => true;
  await service.runJob(job.id);
  assert.deepEqual(order, ["claim", "prepare", "handler", "complete"]);
});

test("preparation failure fails the claimed job without invoking its handler", async () => {
  const job = {
    ...pending,
    jobName: "queue-manager.prepare-failure-test",
    attempts: 0,
    maxAttempts: 1
  };
  let calls = 0;
  let errorMessage = "";
  registerQueueJobProcessor(job.jobName, async () => {
    calls++;
    return {};
  });
  const repository = {
    find: async () => job,
    backend: async () => "database",
    markRunning: async () => {
      job.status = "running";
      return job;
    },
    markFailed: async (_id: number, message: string) => {
      errorMessage = message;
      job.status = "failed";
      return job;
    }
  };
  const activity = { recordActivity: async () => undefined };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    activity as unknown as PlatformActivityService,
    "worker",
    async () => {
      throw new Error("Authoritative tenant is unavailable");
    }
  );
  service.canExecute = () => true;
  assert.equal((await service.runJob(job.id))?.status, "failed");
  assert.equal(calls, 0);
  assert.equal(errorMessage, "Authoritative tenant is unavailable");
});

test("producer manual run requeues a failed job for the external database executor", async () => {
  const job = { ...pending, status: "failed", attempts: 2, maxAttempts: 3 } as QueueJobRecord;
  let retries = 0;
  let claims = 0;
  const repository = {
    find: async () => job,
    backend: async () => "database",
    retry: async (id: number) => {
      assert.equal(id, job.id);
      retries++;
      job.status = "pending";
      return job;
    },
    markRunning: async () => {
      claims++;
      return job;
    }
  };
  const service = new QueueManagerService(repository as unknown as QueueManagerRepository);
  service.canExecute = () => false;
  assert.equal((await service.runJob(job.id))?.status, "pending");
  assert.equal(retries, 1);
  assert.equal(claims, 0);
  assert.equal(job.attempts, 2);
});

test("successful execution is not replayed when its activity write fails", async (t) => {
  const warning = t.mock.method(console, "warn", () => undefined);
  const job = {
    ...pending,
    jobName: "queue-manager.audit-failure-test",
    attempts: 0,
    maxAttempts: 3
  };
  let calls = 0;
  registerQueueJobProcessor(job.jobName, async () => {
    calls++;
    return { saved: true };
  });
  const repository = {
    find: async () => job,
    backend: async () => "database",
    markRunning: async () => {
      job.status = "running";
      return job;
    },
    markCompleted: async () => {
      job.status = "completed";
      return job;
    },
    markFailed: async () => {
      throw new Error("Successful job was changed to failed");
    },
    retryAfter: async () => {
      throw new Error("Successful job was requeued");
    }
  };
  const activity = {
    recordActivity: async () => {
      throw new Error("Audit database unavailable");
    }
  };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    activity as unknown as PlatformActivityService,
    "worker"
  );
  service.canExecute = () => true;
  assert.equal((await service.runJob(job.id))?.status, "completed");
  await service.runJob(job.id);
  assert.equal(calls, 1);
  assert.equal(warning.mock.callCount(), 1);
});

test("persisted scheduling prevents early claims and delays stale BullMQ delivery", async () => {
  const job = { ...pending, availableAt: "2099-01-01T00:00:00.000Z" };
  let claims = 0;
  const repository = {
    find: async () => job,
    markRunning: async () => {
      claims++;
      return job;
    }
  };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    undefined,
    "worker"
  );
  service.canExecute = () => true;
  assert.equal(await service.runJob(job.id), job);
  await assert.rejects(
    service.runJob(job.id, { fromWorker: true, expectedUuid: job.uuid }),
    (error: unknown) => error instanceof QueueJobHeld && error.retryAt === job.availableAt
  );
  assert.equal(claims, 0);
});

test("a concurrent reschedule cannot complete its stale delivery early", async () => {
  const job = { ...pending };
  const repository = {
    find: async () => job,
    backend: async () => "database",
    markRunning: async () => {
      job.availableAt = "2099-01-01T00:00:00.000Z";
      return null;
    }
  };
  const service = new QueueManagerService(
    repository as unknown as QueueManagerRepository,
    undefined,
    "worker"
  );
  service.canExecute = () => true;
  await assert.rejects(
    service.runJob(job.id, { fromWorker: true, expectedUuid: job.uuid }),
    QueueJobHeld
  );
});
