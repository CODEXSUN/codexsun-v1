import { PlatformActivityService } from "../platform-activity/index.js";
import { QueueManagerRepository } from "./queue-manager.repository.js";
import { env } from "../../env.js";
import { probeBullMq, publishBullMqJob } from "./queue-manager.bullmq.js";
import type {
  ClientArtifactQueueInput,
  ClientArtifactQueueResult,
  QueueBackend,
  QueueJobFilters,
  QueueJobPayload,
  QueueJobRecord
} from "./queue-manager.types.js";
import { getTenantDatabase } from "../../database/tenant-database.js";
import { resolveMailJobTenant } from "./queue-manager.mail.js";
import { queueExecutionAllowed, type QueueExecutionHost } from "./queue-manager.execution.js";
import { queueJobProcessor, queueJobReadiness, QueueJobHeld } from "./queue-manager.worker.js";
import {
  publishPendingDeliveries,
  queueDeliveryDelay,
  verifyQueueDelivery
} from "./queue-manager.delivery.js";

export class QueueManagerService {
  constructor(
    private readonly repository = new QueueManagerRepository(),
    private readonly activity = new PlatformActivityService(),
    private readonly executor: QueueExecutionHost = "platform",
    private readonly prepareJob?: (job: QueueJobRecord) => Promise<void>,
    private readonly publishDelivery = publishBullMqJob
  ) {}

  canExecute() {
    return queueExecutionAllowed(env, this.executor);
  }

  listJobs(filters: QueueJobFilters = {}) {
    return this.repository.list(filters);
  }

  findJob(id: number) {
    return this.repository.find(id);
  }

  ageMilliseconds(id: number) {
    return this.repository.ageMilliseconds(id);
  }

  runtimeSettings() {
    return this.repository.settings();
  }

  async enqueue(input: QueueJobPayload) {
    const job = await this.repository.enqueue(input);
    if (job?.status === "pending") {
      const backend = await this.repository.backend();
      if (backend === "bullmq-redis") await this.publishSavedJob(job);
    }
    return job;
  }

  async enqueueClientArtifact(
    input: ClientArtifactQueueInput,
    identity: { actorEmail: string; tenantId: string },
    correlationId: string
  ): Promise<ClientArtifactQueueResult> {
    const job = await this.enqueue({
      actorEmail: identity.actorEmail,
      correlationId,
      jobName: "client-artifact.prepare",
      maxAttempts: 2,
      payload: input,
      queueName: "reports",
      sourceModule: "platform.client-artifact",
      tenantId: identity.tenantId
    });
    if (!job) throw new Error("The document export queue job was not created.");
    return { jobId: job.id, jobUuid: job.uuid, status: job.status };
  }

  async runJob(id: number, options: { fromWorker?: boolean; expectedUuid?: string } = {}) {
    const job = await this.repository.find(id);
    if (options.fromWorker) {
      if (!options.expectedUuid) throw new Error("Queue worker requires a job UUID.");
      verifyQueueDelivery(options.expectedUuid, job);
    }
    if (!job) return null;
    if (!this.canExecute()) {
      if (options.fromWorker) throw new Error("This process does not own queue execution.");
      const deferred = job.status === "failed" ? await this.repository.retry(id) : job;
      if (deferred?.status === "pending" && (await this.repository.backend()) === "bullmq-redis")
        await this.publishSavedJob(deferred);
      return deferred;
    }
    if (job.status === "pending" || job.status === "failed") {
      if (queueDeliveryDelay(job.availableAt) > 0) {
        if (options.fromWorker) throw new QueueJobHeld(job.availableAt);
        return job;
      }
      const readiness = await queueJobReadiness(job);
      if (readiness && !readiness.ready) {
        const held = await this.repository.hold(id, readiness.retryAt, readiness.reason);
        if (options.fromWorker) throw new QueueJobHeld(readiness.retryAt);
        return held;
      }
    }
    if (
      (await this.repository.backend()) === "bullmq-redis" &&
      job.status === "pending" &&
      !options.fromWorker
    ) {
      await this.publishSavedJob(job);
      return job;
    }
    if (job.status !== "pending" && job.status !== "failed") {
      return job;
    }

    const claimed = await this.repository.markRunning(id);
    if (!claimed) {
      const current = await this.repository.find(id);
      if (
        options.fromWorker &&
        current?.status === "pending" &&
        queueDeliveryDelay(current.availableAt) > 0
      )
        throw new QueueJobHeld(current.availableAt);
      return current;
    }
    try {
      await this.prepareJob?.(claimed);
      const result = await this.dispatch(job, claimed.attempts);
      const readiness = await queueJobReadiness(job, undefined, result);
      if (readiness && !readiness.ready) {
        const held = await this.repository.hold(
          id,
          readiness.retryAt,
          readiness.reason,
          true,
          claimed.attempts
        );
        if (options.fromWorker) throw new QueueJobHeld(readiness.retryAt);
        return held;
      }
      const completed = await this.repository.markCompleted(id, result, claimed.attempts);
      if (completed?.status !== "completed" || completed.attempts !== claimed.attempts)
        return completed;
      await this.recordQueueActivity({
        action: "queue.job.completed",
        details: { jobName: job.jobName, queueName: job.queueName },
        moduleKey: "platform.queue-manager",
        recordId: job.id,
        recordLabel: job.jobName,
        recordUuid: job.uuid
      });
      return completed;
    } catch (error) {
      if (error instanceof QueueJobHeld) throw error;
      const readiness = await queueJobReadiness(job, error);
      if (readiness && !readiness.ready) {
        const held = await this.repository.hold(
          id,
          readiness.retryAt,
          readiness.reason,
          true,
          claimed.attempts
        );
        if (options.fromWorker) throw new QueueJobHeld(readiness.retryAt);
        return held;
      }
      const message = error instanceof Error ? error.message : "Queue job failed.";
      const progress = await this.repository.find(id);
      const failed = await this.repository.markFailed(
        id,
        message,
        progress?.result ?? {},
        claimed.attempts
      );
      if (failed?.status !== "failed" || failed.attempts !== claimed.attempts) return failed;
      await this.recordQueueActivity({
        action: "queue.job.failed",
        details: { error: message, jobName: job.jobName, queueName: job.queueName },
        moduleKey: "platform.queue-manager",
        recordId: job.id,
        recordLabel: job.jobName,
        recordUuid: job.uuid
      });
      if (options.fromWorker) throw error;
      if (job.attempts + 1 < job.maxAttempts) {
        return this.repository.retryAfter(id, 5000 * 2 ** job.attempts, claimed.attempts);
      }
      return failed;
    }
  }

  expireRunningJobs(jobNames: string[], leaseMs: number) {
    return this.repository.expireRunningJobs(jobNames, new Date(Date.now() - leaseMs));
  }

  async runNextJob() {
    if (!this.canExecute()) return null;
    const backend = await this.repository.backend();
    if (backend === "bullmq-redis") return null;
    const job = await this.repository.nextRunnable();
    return job ? this.runJob(job.id) : null;
  }

  async reconcilePendingDeliveries() {
    await publishPendingDeliveries(
      (afterId) => this.repository.pendingDeliveries(afterId),
      this.publishDelivery
    );
  }

  async retryJob(id: number) {
    const job = await this.repository.retry(id);
    if (!job) return null;
    if (job.status === "pending") {
      const backend = await this.repository.backend();
      if (backend === "bullmq-redis") await this.publishSavedJob(job);
    }
    await this.recordQueueActivity({
      action: "queue.job.retried",
      moduleKey: "platform.queue-manager",
      recordId: job.id,
      recordLabel: job.jobName,
      recordUuid: job.uuid
    });
    return job;
  }

  async cancelJob(id: number) {
    const job = await this.repository.cancel(id);
    if (!job) return null;
    await this.recordQueueActivity({
      action: "queue.job.cancelled",
      moduleKey: "platform.queue-manager",
      recordId: job.id,
      recordLabel: job.jobName,
      recordUuid: job.uuid
    });
    return job;
  }

  async cleanupRetainedJobs() {
    const completedBefore = new Date(
      Date.now() - env.CODEXSUN_QUEUE_COMPLETED_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const failedBefore = new Date(
      Date.now() - env.CODEXSUN_QUEUE_FAILED_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    return this.repository.cleanup({ completedBefore, failedBefore });
  }

  async switchBackend(backend: QueueBackend, actorEmail: string) {
    if (backend === "bullmq-redis") await probeBullMq();
    const settings = await this.repository.setBackend(backend, actorEmail);
    if (backend === "bullmq-redis") {
      await this.reconcilePendingDeliveries();
    }
    await this.recordQueueActivity({
      action: "queue.backend.switched",
      actorEmail,
      details: { backend },
      moduleKey: "platform.queue-manager",
      recordLabel: settings.backendLabel
    });
    return settings;
  }

  currentBackend() {
    return this.repository.backend();
  }

  private async recordQueueActivity(
    input: Parameters<PlatformActivityService["recordActivity"]>[0]
  ) {
    try {
      await this.activity.recordActivity(input);
    } catch {
      console.warn("[queue] activity could not be recorded", {
        jobId: input.recordId,
        action: input.action
      });
    }
  }

  private async publishSavedJob(job: QueueJobRecord) {
    try {
      await this.publishDelivery(job);
    } catch {
      console.warn("[queue] saved job awaits Redis reconciliation", { jobId: job.id });
    }
  }

  private async dispatch(job: QueueJobRecord, expectedAttempts: number) {
    const { jobName, payload } = job;
    const processor = queueJobProcessor(jobName);
    if (processor)
      return processor(job, (result) =>
        this.repository.updateResult(job.id, result, expectedAttempts)
      );
    if (jobName === "queue.probe") {
      return { echo: payload, processedAt: new Date().toISOString() };
    }
    if (jobName === "client-artifact.prepare") {
      return {
        ...payload,
        preparedAt: new Date().toISOString()
      };
    }
    if (jobName === "database-maintenance.run") {
      const { processDatabaseMaintenanceJob } =
        await import("../database-maintenance/database-maintenance.worker.js");
      return processDatabaseMaintenanceJob(payload);
    }
    if (jobName === "mail.system-send") {
      const { processMailJob } = await import("@codexsun/mail-api");
      return processMailJob(jobName, payload, {
        fallback: mailFallback(),
        secretKey: env.JWT_SECRET
      });
    }
    if (jobName === "mail.send" || jobName === "mail.sync") {
      const { TenantRepository } = await import("../tenant/index.js");
      const tenant = await resolveMailJobTenant(job, (id) =>
        new TenantRepository().findByIdOrCode(id)
      );
      const database = getTenantDatabase(tenant);
      const enabled = await database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "=", "mail")
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!enabled) throw new Error("Mail is disabled for the queued tenant.");
      const { processMailJob } = await import("@codexsun/mail-api");
      return processMailJob(jobName, payload, {
        database: database as never,
        fallback: mailFallback(),
        secretKey: env.JWT_SECRET
      });
    }
    throw new Error(`No queue worker registered for ${jobName}.`);
  }
}

function mailFallback() {
  return {
    enabled: env.MAIL_ENABLED === "1",
    fromEmail: env.MAIL_FROM_EMAIL || env.MAIL_USERNAME,
    fromName: env.MAIL_FROM_NAME,
    host: env.MAIL_SMTP_HOST,
    password: env.MAIL_PASSWORD,
    port: env.MAIL_SMTP_PORT,
    replyTo: env.MAIL_REPLY_TO,
    secure: env.MAIL_SMTP_SECURE === "1",
    username: env.MAIL_USERNAME
  };
}
