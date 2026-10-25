import { readCrmFrappeSyncAccess, crmFrappeAvailability } from "../../crm-frappe-sync-access.js";
import type { Kysely } from "kysely";
import {
  FrappeConnectionAccess,
  FrappeLiveSyncService,
  type ExportKind,
  type FrappeDatabase
} from "@codexsun/frappe-api";
import { env } from "../../env.js";
import { getTenantDatabase } from "../../database/tenant-database.js";
import { TenantRepository } from "../tenant/tenant.repository.js";
import type { QueueManagerService } from "./queue-manager.service.js";
import {
  approvedFrappeAutomaticExports,
  frappeInboundModifiedAfter
} from "./frappe-live-sync.policy.js";

export function startFrappeLiveSyncScheduler(queue: QueueManagerService) {
  let running = false;
  const dispatch = async () => {
    if (running) return;
    running = true;
    try {
      for (const tenant of await new TenantRepository().list()) {
        if (tenant.status !== "active" || !tenant.enabledModuleKeys.includes("frappe")) continue;
        const database = getTenantDatabase(tenant) as unknown as Kysely<FrappeDatabase>;
        try {
          if (!(await readCrmFrappeSyncAccess(getTenantDatabase(tenant))).enabled) continue;
          const liveSync = new FrappeLiveSyncService(database);
          const previous = await liveSync.settings();
          if (
            !previous.enabled ||
            previous.paused ||
            !(await crmFrappeAvailability(getTenantDatabase(tenant)).ready()).ready
          )
            continue;
          const kinds = await liveSync.dueKinds();
          // Enquiry writes use the immediate outbox, avoiding a second competing creation path.
          for (const kind of approvedFrappeAutomaticExports(kinds, previous.direction).filter(
            (kind) => kind !== "enquiries"
          ))
            await enqueue(queue, tenant.uuid, tenant.dbName, kind);
          if (kinds.includes("enquiries")) {
            const connection = await new FrappeConnectionAccess(database, env.JWT_SECRET, {
              baseUrl: env.CODEXSUN_FRAPPE_BASE_URL,
              apiKey: env.CODEXSUN_FRAPPE_APP_KEY,
              apiSecret: env.CODEXSUN_FRAPPE_APP_SECRET,
              enabled: env.CODEXSUN_FRAPPE_ENABLED === "1"
            }).credentials();
            if (connection) {
              const modifiedAfter = frappeInboundModifiedAfter(previous, connection.baseUrl);
              await enqueueInboundEnquiries(
                queue,
                tenant.uuid,
                tenant.dbName,
                connection.baseUrl,
                modifiedAfter
              );
            }
          }
        } catch (error) {
          console.warn("[frappe-live-sync] schedule pass deferred", {
            tenantId: tenant.uuid,
            message: error instanceof Error ? error.message : "Live sync schedule failed."
          });
        }
      }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void dispatch(), 10_000);
  timer.unref?.();
  void dispatch();
  return () => clearInterval(timer);
}

async function enqueueInboundEnquiries(
  queue: QueueManagerService,
  tenantId: string,
  tenantDatabase: string,
  baseUrl: string,
  modifiedAfter: string | undefined
) {
  const active = (
    await Promise.all(
      ["pending", "running"].map((status) =>
        queue.listJobs({
          tenantId,
          jobName: "frappe.enquiries.import",
          queueName: "reports",
          status: status as "pending" | "running"
        })
      )
    )
  )
    .flat()
    .some(
      (job) => job.payload.tenantDatabase === tenantDatabase && job.payload.baseUrl === baseUrl
    );
  if (active) return;
  const windowKey = Math.floor(Date.now() / 60_000);
  await queue.enqueue({
    dispatchImmediately: true,
    actorEmail: "system:frappe-live-sync",
    correlationId: `frappe-live-import:enquiries:${tenantId}`,
    idempotencyKey: `frappe-live-import:${tenantId}:enquiries:${windowKey}`,
    jobName: "frappe.enquiries.import",
    maxAttempts: 3,
    payload: {
      tenantDatabase,
      baseUrl,
      ...(modifiedAfter ? { modifiedAfter } : {}),
      checkpointAt: new Date().toISOString()
    },
    queueName: "reports",
    sourceModule: "frappe.live-sync",
    tenantId
  });
}

async function enqueue(
  queue: QueueManagerService,
  tenantId: string,
  tenantDatabase: string,
  kind: ExportKind
) {
  await queue.enqueue({
    actorEmail: "system:frappe-live-sync",
    correlationId: `frappe-live-sync:${kind}`,
    idempotencyKey: `frappe-live-sync:${tenantId}:${kind}:${Math.floor(Date.now() / 60_000)}`,
    jobName: "frappe.live-sync",
    maxAttempts: 3,
    payload: { tenantDatabase, kind, manual: false },
    queueName: "reports",
    sourceModule: "frappe.live-sync",
    tenantId
  });
}
