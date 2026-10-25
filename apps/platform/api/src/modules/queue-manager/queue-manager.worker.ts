import type { QueueJobRecord } from "./queue-manager.types.js";

type QueueJobProcessor = (
  job: QueueJobRecord,
  report: (result: Record<string, unknown>) => Promise<void>
) => Promise<Record<string, unknown>>;

const processors = new Map<string, QueueJobProcessor>();

export function registerQueueJobProcessor(jobName: string, processor: QueueJobProcessor) {
  processors.set(jobName, processor);
}

export function queueJobProcessor(jobName: string) {
  return processors.get(jobName);
}

export const queueManagerWorker = {
  backends: ["database", "bullmq-redis"],
  jobs: [
    "chat.telegram.sync",
    "client-artifact.prepare",
    "crm.enquiry.frappe-sync",
    "crm.contact.frappe-sync",
    "crm.sop.frappe-sync",
    "crm.call-log.frappe-sync",
    "database-maintenance.run",
    "frappe.enquiries.import",
    "frappe.call-logs.import",
    "frappe.live-sync",
    "mail.send",
    "mail.sync",
    "mail.system-send",
    "marketing.submission.handoff",
    "queue.probe"
  ],
  queues: ["chat", "crm", "maintenance", "mail", "marketing", "reports", "system"]
} as const;

export function queueJobCanRunInline(job: QueueJobRecord) {
  return job.status === "pending" || job.status === "failed";
}

export async function processQueueManagerJob(
  job: QueueJobRecord,
  run: (id: number) => Promise<unknown>
) {
  if (!queueJobCanRunInline(job)) {
    return { processed: false, reason: "job-not-runnable", status: job.status };
  }
  await run(job.id);
  return { jobId: job.id, processed: true };
}

export type QueueReadiness = { ready: boolean; retryAt: string; reason: string | null };
type QueueReadinessCheck = (job: QueueJobRecord, error?: unknown, result?: Record<string, unknown>) => Promise<QueueReadiness>;
const readinessChecks = new Map<string, QueueReadinessCheck>();
export function registerQueueJobReadiness(jobName: string, check: QueueReadinessCheck) {
  readinessChecks.set(jobName, check);
}
export function queueJobReadiness(
  job: QueueJobRecord,
  error?: unknown,
  result?: Record<string, unknown>
) {
  return readinessChecks.get(job.jobName)?.(job, error, result);
}
export class QueueJobHeld extends Error {
  constructor(readonly retryAt: string) {
    super("Queue job is waiting for its availability window.");
  }
}
