import type { FastifyInstance } from "fastify";
import type { BackgroundRuntime } from "./background.contract.js";
import { closeCoreDatabase, registerCoreTenantDatabaseConnection } from "@codexsun/core-api";
import {
  closeAllBillingDatabases,
  registerBillingTenantDatabaseConnection
} from "@codexsun/billing-api";
import { ChatTelegramWorker } from "@codexsun/chat-api";
import { env } from "./env.js";
import { closePlatformDatabase, getPlatformDatabase } from "./database/platform-database.js";
import {
  closeAllTenantDatabases,
  getTenantDatabase,
  resolveTenantDatabasePassword
} from "./database/tenant-database.js";
import { TenantRepository } from "./modules/tenant/tenant.repository.js";
import type { QueueJobRecord } from "./modules/queue-manager/queue-manager.types.js";
import { QueueManagerService } from "./modules/queue-manager/queue-manager.service.js";
import {
  startQueueManagerWorker,
  isQueueWorkerHealthy
} from "./modules/queue-manager/queue-manager.runtime.js";
import { startCrmEnquirySyncRelay } from "./modules/queue-manager/crm-enquiry-sync.relay.js";
import { startCrmDutySyncRelay } from "./modules/queue-manager/crm-duty-sync.relay.js";
import { startFrappeLiveSyncScheduler } from "./modules/queue-manager/frappe-live-sync.scheduler.js";
import { registerFrappeAvailabilityReadiness } from "./modules/queue-manager/frappe-availability.readiness.js";
import { registerCrmFrappeBackground } from "./crm-frappe-background.js";
import { registerBillingComplianceHost } from "./billing-compliance-host.js";
import { registerMarketingBackground } from "./marketing-host.js";
import { registerDataBridgeBackground } from "./data-bridge-host.js";
import { createDataMigrationHost } from "./data-migration-host.js";
import { sitesDeliveryHost } from "./sites-delivery-host.js";
import { telegramChatDependencies } from "./chat-host.js";
import { createChatEventPublisher } from "./chat-event-transport.js";

/** Headless composition only. Schema migration and seeding remain explicit API operations. */
export async function startBackgroundRuntime(app: FastifyInstance): Promise<BackgroundRuntime> {
  const queue = new QueueManagerService(undefined, undefined, "worker", prepareTenantConnection);
  if (!queue.canExecute()) throw new Error("Worker business execution is not selected or enabled.");
  const publisher = createChatEventPublisher();
  // Fastify closes hooks in reverse order. Pools close after dispatch and relay hooks drain.
  app.addHook("onClose", async () => {
    await publisher.close();
    await closeAllBillingDatabases();
    await closeCoreDatabase();
    await closeAllTenantDatabases();
    await closePlatformDatabase();
  });
  // Refuse an unprepared master database before starting any dispatch loops.
  await queue.currentBackend();
  await getPlatformDatabase().selectFrom("tenants").select("uuid").limit(1).execute();
  await publisher.ready();
  const stops: Array<() => void | Promise<void>> = [];
  app.addHook("onClose", async () => {
    for (const stop of stops) await stop();
  });
  registerFrappeAvailabilityReadiness();
  registerCrmFrappeBackground(queue);
  registerBillingComplianceHost(app, queue);
  registerMarketingBackground(app, queue);
  registerDataBridgeBackground(createDataMigrationHost(), queue);
  sitesDeliveryHost(app, queue);
  stops.push(startCrmEnquirySyncRelay(queue));
  stops.push(startCrmDutySyncRelay(queue));
  stops.push(startFrappeLiveSyncScheduler(queue));
  stops.push(new ChatTelegramWorker(telegramChatDependencies(queue), publisher.publish).start());
  startQueueManagerWorker(app, queue);
  return {
    isReady: () => isQueueWorkerHealthy("worker") && publisher.isReady(),
    executionHost: env.CODEXSUN_QUEUE_EXECUTION_HOST
  };
}

async function prepareTenantConnection(job: QueueJobRecord) {
  if (!job.tenantId) return;
  const tenant = await new TenantRepository().findByIdOrCode(job.tenantId);
  const matches =
    tenant &&
    (tenant.uuid === job.tenantId ||
      (job.jobName.startsWith("data-bridge.") && String(tenant.id) === job.tenantId));
  if (!matches || tenant.status !== "active")
    throw new Error("Queue tenant identity is unavailable.");
  const connection = {
    database: tenant.dbName,
    host: tenant.dbHost,
    port: tenant.dbPort,
    user: tenant.dbUser,
    password: resolveTenantDatabasePassword(tenant)
  };
  registerCoreTenantDatabaseConnection(connection);
  registerBillingTenantDatabaseConnection(connection);
  getTenantDatabase(tenant);
}
