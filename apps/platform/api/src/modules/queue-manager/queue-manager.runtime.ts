import type { FastifyInstance } from "fastify";
import { env } from "../../env.js";
import { closeBullMq, startBullMqWorker } from "./queue-manager.bullmq.js";
import { queueExecutionAllowed, type QueueExecutionHost } from "./queue-manager.execution.js";
import { QueueManagerService } from "./queue-manager.service.js";

let queueWorkerTimer: NodeJS.Timeout | null = null;
let queueWorkerFailed = false;

export function isQueueWorkerHealthy(executor: QueueExecutionHost = "platform") {
  return !queueExecutionAllowed(env, executor) || (queueWorkerTimer !== null && !queueWorkerFailed);
}

export function startQueueManagerWorker(app: FastifyInstance, service = new QueueManagerService()) {
  if (!service.canExecute() || queueWorkerTimer) {
    return;
  }
  let activeDispatch: Promise<void> | null = null;
  let closing = false;
  let cleanupTicks = 0;
  const dispatch = () => {
    if (activeDispatch || closing || !service.canExecute()) return;
    activeDispatch = service
      .currentBackend()
      .then(async (backend) => {
        if (backend === "bullmq-redis") {
          for (const name of [
            "chat",
            "crm",
            "maintenance",
            "mail",
            "marketing",
            "reports",
            "system"
          ])
            startBullMqWorker(name, (queueJobId, expectedUuid) =>
              service.runJob(queueJobId, { fromWorker: true, expectedUuid })
            );
          await service.reconcilePendingDeliveries();
          return null;
        }
        await closeBullMq();
        return service.runNextJob();
      })
      .then(async () => {
        queueWorkerFailed = false;
        cleanupTicks += 1;
        if (cleanupTicks >= 120) {
          cleanupTicks = 0;
          await service.cleanupRetainedJobs();
        }
      })
      .catch((error) => {
        queueWorkerFailed = true;
        app.log.error({ error }, "queue worker failed");
      })
      .finally(() => {
        activeDispatch = null;
      });
  };
  queueWorkerTimer = setInterval(dispatch, env.CODEXSUN_QUEUE_WORKER_INTERVAL_MS);
  dispatch();
  queueWorkerTimer.unref();
  app.addHook("onClose", async () => {
    closing = true;
    if (queueWorkerTimer) {
      clearInterval(queueWorkerTimer);
      queueWorkerTimer = null;
      queueWorkerFailed = false;
    }
    await activeDispatch;
    await closeBullMq();
  });
}
