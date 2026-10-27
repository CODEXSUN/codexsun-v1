import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import {
  SalesComplianceRepository,
  ExportSalesComplianceRepository,
  configureSalesComplianceRuntime,
  configureExportSalesComplianceRuntime,
  processSalesComplianceJob,
  processExportSalesComplianceJob,
  registerBillingTenantDatabaseConnection
} from "@codexsun/billing-api";
import { TenantRepository } from "./modules/tenant/index.js";
import { getTenantDatabase, resolveTenantDatabasePassword } from "./database/tenant-database.js";
import { registerQueueJobProcessor } from "./modules/queue-manager/queue-manager.worker.js";
import type { QueueManagerService } from "./modules/queue-manager/index.js";
import type { Tenant } from "./modules/tenant/tenant.types.js";
import { env } from "./env.js";

const payloadSchema = z.object({
  tenantDatabase: z.string().min(1),
  operationUuid: z.string().regex(/^[a-f0-9]{8}$/)
});
export function registerBillingComplianceHost(app: FastifyInstance, queue: QueueManagerService) {
  const enabled = env.CODEXSUN_QUEUE_WORKER_ENABLED === "1";
  configureSalesComplianceRuntime(enabled);
  configureExportSalesComplianceRuntime(enabled);
  registerQueueJobProcessor("billing.sales.compliance", async (job) => {
    const payload = payloadSchema.parse(job.payload),
      tenant = await resolveTenant(job.tenantId, payload.tenantDatabase, "billing.sales");
    registerConnection(tenant);
    return processSalesComplianceJob(tenant.dbName, payload.operationUuid);
  });
  registerQueueJobProcessor("billing.export-sales.compliance", async (job) => {
    const payload = payloadSchema.parse(job.payload),
      tenant = await resolveTenant(job.tenantId, payload.tenantDatabase, "billing.export-sales");
    registerConnection(tenant);
    return processExportSalesComplianceJob(tenant.dbName, payload.operationUuid);
  });
  if (!queue.canExecute()) return;
  let busy = false;
  let activeRelay: Promise<void> | undefined;
  const relay = async () => {
    if (busy) return;
    busy = true;
    try {
      await queue.expireRunningJobs(
        ["billing.sales.compliance", "billing.export-sales.compliance"],
        300000
      );
      for (const tenant of await new TenantRepository().list()) {
        if (tenant.status !== "active") continue;
        try {
          const database = getTenantDatabase(tenant);
          const modules = await sql<{
            module_key: string;
          }>`SELECT module_key FROM app_module_settings WHERE enabled=1 AND status='active' AND module_key IN ('billing.sales','billing.export-sales')`.execute(
            database
          );
          if (!modules.rows.length) continue;
          registerConnection(tenant);
          if (modules.rows.some((row) => row.module_key === "billing.sales"))
            for (const job of await new SalesComplianceRepository().dispatchable(tenant.dbName))
              await queue.enqueue({
                queueName: "system",
                jobName: "billing.sales.compliance",
                sourceModule: "billing.sales",
                tenantId: tenant.uuid,
                actorEmail: job.actorEmail,
                correlationId: job.uuid,
                idempotencyKey: `codexsun-sales-compliance:${tenant.uuid}:${job.uuid}:${job.attempts}`,
                maxAttempts: 1,
                payload: { tenantDatabase: tenant.dbName, operationUuid: job.uuid }
              });
          if (modules.rows.some((row) => row.module_key === "billing.export-sales"))
            for (const job of await new ExportSalesComplianceRepository().dispatchable(
              tenant.dbName
            ))
              await queue.enqueue({
                queueName: "system",
                jobName: "billing.export-sales.compliance",
                sourceModule: "billing.export-sales",
                tenantId: tenant.uuid,
                actorEmail: job.actorEmail,
                correlationId: job.uuid,
                idempotencyKey: `codexsun-export-compliance:${tenant.uuid}:${job.uuid}:${job.attempts}`,
                maxAttempts: 1,
                payload: { tenantDatabase: tenant.dbName, operationUuid: job.uuid }
              });
        } catch (error) {
          app.log.warn(
            {
              tenantId: tenant.uuid,
              error: error instanceof Error ? error.message : "Compliance relay failed"
            },
            "Billing compliance relay deferred"
          );
        }
      }
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    if (!activeRelay)
      activeRelay = relay()
        .catch((error) => app.log.error(error, "Billing compliance relay failed"))
        .finally(() => {
          activeRelay = undefined;
        });
  }, 3000);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await activeRelay;
    configureSalesComplianceRuntime(false);
    configureExportSalesComplianceRuntime(false);
  });
}
async function resolveTenant(tenantId: string | null, databaseName: string, moduleKey: string) {
  const tenant = await new TenantRepository().findByIdOrCode(tenantId ?? "");
  if (
    !tenant ||
    tenant.uuid !== tenantId ||
    tenant.status !== "active" ||
    tenant.dbName !== databaseName
  )
    throw AppError.forbidden("Compliance job tenant is invalid or inactive.");
  const db = getTenantDatabase(tenant);
  const enabled =
    await sql`SELECT module_key FROM app_module_settings WHERE module_key=${moduleKey} AND enabled=1 AND status='active'`.execute(
      db
    );
  if (!enabled.rows.length) throw AppError.forbidden("Billing module is disabled for this tenant.");
  return tenant;
}
function registerConnection(tenant: Tenant) {
  registerBillingTenantDatabaseConnection({
    database: tenant.dbName,
    host: tenant.dbHost || env.DB_HOST,
    port: tenant.dbPort || env.DB_PORT,
    user: tenant.dbUser || env.DB_USER,
    password: resolveTenantDatabasePassword(tenant)
  });
}
