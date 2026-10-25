import { selectUserRole } from "./modules/tenant-user-role/index.js";
import { CredentialRecoveryRepository } from "./modules/credential-recovery/index.js";
import { copyBridgeUsers } from "./modules/tenant-user/index.js";
import { getTenantDatabase } from "./database/tenant-database.js";
import { createConnection } from "mysql2/promise";
import type { Kysely } from "kysely";
import {
  billingDashboardProjection,
  registerBillingTenantDatabaseConnection,
  seedBillingStandardUserAccess
} from "@codexsun/billing-api";
import { seedCrmUserAccess } from "@codexsun/crm-api";
import {
  hasActiveTransferCompanyContext,
  seedCoreStandardUserAccess,
  isUntouchedCompanySeed
} from "@codexsun/core-api";
import {
  createDataMigrationBridgeAccess,
  type DataMigrationHost
} from "@codexsun/data-migration-api";
import {
  registerDataBridgeApi,
  CommonBulkService,
  TransferService,
  businessImportWorker,
  type CommonTableImportHost
} from "@codexsun/data-bridge-api";
import { AppError } from "@codexsun/framework/errors";
import type { FastifyInstance } from "fastify";
import { resolveTenantDatabasePassword } from "./database/tenant-database.js";
import { TenantRepository } from "./modules/tenant/tenant.repository.js";
import { QueueManagerService } from "./modules/queue-manager/queue-manager.service.js";
import { registerQueueJobProcessor } from "./modules/queue-manager/queue-manager.worker.js";
import { env } from "./env.js";

const tenants = new TenantRepository();

export async function registerDataBridgeHost(
  app: FastifyInstance,
  migrationHost: DataMigrationHost
) {
  const queue = new QueueManagerService();
  const refreshDashboard = async (targetTenantId: number) => {
    const target = await tenants.findByIdOrCode(String(targetTenantId));
    if (
      !target ||
      target.id !== targetTenantId ||
      target.status !== "active" ||
      target.dbType !== "mariadb"
    )
      throw AppError.validation("The target tenant is unavailable for dashboard refresh.");
    registerBillingTenantDatabaseConnection({
      database: target.dbName,
      host: target.dbHost,
      port: target.dbPort,
      user: target.dbUser,
      password: resolveTenantDatabasePassword(target)
    });
    return billingDashboardProjection.rebuildAll(
      target.dbName,
      "billing.dashboard.data-bridge-import"
    );
  };
  const host: CommonTableImportHost = {
    database: migrationHost.database,
    isCompanySeed: isUntouchedCompanySeed,
    async copyUsers(input) {
      const authorize = async () => {
        if (!(await new CredentialRecoveryRepository().isActiveSuperAdmin(input.actor)))
          throw AppError.forbidden("An active Super Admin must authorize tenant user transfer.");
      };
      await authorize();
      const tenant = await tenants.findByIdOrCode(String(input.targetTenantId));
      if (
        !tenant ||
        tenant.id !== input.targetTenantId ||
        tenant.status !== "active" ||
        tenant.dbType !== "mariadb"
      )
        throw AppError.forbidden("The registered target tenant is unavailable.");
      const source = await createDataMigrationBridgeAccess(migrationHost).resolveSource(
        input.sourceId
      );
      const connection = await createConnection({
        host: source.host,
        port: source.port,
        user: source.user,
        password: source.password,
        database: source.database,
        timezone: "Z",
        ...(source.tlsMode === "required" ? { ssl: { rejectUnauthorized: true } } : {})
      });
      try {
        const database = getTenantDatabase(tenant);
        const accessDatabase = database as unknown as Kysely<unknown>;
        if (!(await hasActiveTransferCompanyContext(accessDatabase)))
          return {
            imported: 0,
            existing: 0,
            warnings: 1,
            rows: [
              {
                sourceId: 0,
                targetId: null,
                email: "",
                status: "warning" as const,
                message:
                  "Configure an active mapped default company and financial year before copying accounts. No users were copied."
              }
            ]
          };
        await seedCoreStandardUserAccess(accessDatabase);
        await seedBillingStandardUserAccess(accessDatabase);
        await seedCrmUserAccess(accessDatabase);
        return await copyBridgeUsers(connection, database, authorize, selectUserRole);
      } finally {
        await connection.end();
      }
    },
    dataMigration: createDataMigrationBridgeAccess(migrationHost),
    authorize(request) {
      const payload = request.authContext?.payload;
      if (payload?.userType !== "super_admin") {
        throw AppError.forbidden("Data Bridge is available only to Super Admin.");
      }
      return payload.email;
    },
    async listTenants() {
      const records = await tenants.list();
      return records
        .filter((tenant) => tenant.status === "active" && tenant.dbType === "mariadb")
        .map((tenant) => ({
          id: tenant.id,
          label: `${tenant.tenantName} (${tenant.tenantCode})`,
          database: tenant.dbName
        }));
    },
    async enqueueBusiness(input) {
      if (env.CODEXSUN_QUEUE_WORKER_ENABLED !== "1")
        throw AppError.validation("Enable the Queue Manager worker before starting this import.");
      const tenant = await tenants.findByIdOrCode(String(input.targetTenantId));
      if (!tenant || tenant.status !== "active")
        throw AppError.validation("The target tenant is unavailable.");
      const job = await queue.enqueue({
        jobName: "data-bridge.business-import",
        queueName: "system",
        sourceModule: "data-bridge.business-import",
        tenantId: String(tenant.id),
        actorEmail: input.actor,
        correlationId: input.correlationId,
        maxAttempts: 2,
        idempotencyKey: `data-bridge:business:${input.runId}`,
        payload: { runId: input.runId, targetTenantId: input.targetTenantId }
      });
      if (!job) throw AppError.validation("The business import could not be queued.");
    },
    async enqueueTransfer(input) {
      if (env.CODEXSUN_QUEUE_WORKER_ENABLED !== "1")
        throw AppError.validation("Enable the Queue Manager worker before starting this import.");
      const tenant = await tenants.findByIdOrCode(String(input.targetTenantId));
      if (!tenant || tenant.status !== "active")
        throw AppError.validation("The target tenant is unavailable.");
      const job = await queue.enqueue({
        jobName: "data-bridge.mapped-import",
        queueName: "system",
        sourceModule: "data-bridge.common-table-import",
        tenantId: String(tenant.id),
        actorEmail: input.actor,
        correlationId: input.correlationId,
        maxAttempts: 2,
        idempotencyKey: `data-bridge:transfer:${input.runId}`,
        payload: { runId: input.runId, targetTenantId: input.targetTenantId }
      });
      if (!job) throw AppError.validation("The import could not be queued.");
    },
    async enqueueBulk(input) {
      if (env.CODEXSUN_QUEUE_WORKER_ENABLED !== "1")
        throw AppError.validation("Enable the Queue Manager worker before starting this import.");
      const tenant = await tenants.findByIdOrCode(String(input.targetTenantId));
      if (!tenant || tenant.status !== "active")
        throw AppError.validation("The target tenant is unavailable.");
      const job = await queue.enqueue({
        jobName: "data-bridge.common-import",
        queueName: "system",
        sourceModule: "data-bridge.common-table-import",
        tenantId: String(tenant.id),
        actorEmail: input.actor,
        correlationId: input.correlationId,
        maxAttempts: 2,
        idempotencyKey: `data-bridge:${input.runId}`,
        payload: { runId: input.runId, targetTenantId: input.targetTenantId }
      });
      if (!job) throw AppError.validation("The import could not be queued.");
    },
    async resolveTenant(id) {
      const tenant = await tenants.findByIdOrCode(String(id));
      if (
        !tenant ||
        tenant.id !== id ||
        tenant.status !== "active" ||
        tenant.dbType !== "mariadb"
      ) {
        throw AppError.validation("Choose an active MariaDB tenant from the registry.");
      }
      return {
        id: tenant.id,
        label: tenant.tenantName,
        database: tenant.dbName,
        host: tenant.dbHost,
        port: tenant.dbPort,
        user: tenant.dbUser,
        password: resolveTenantDatabasePassword(tenant)
      };
    }
  };
  registerQueueJobProcessor("data-bridge.common-import", async (job) => {
    if (
      typeof job.payload.runId !== "string" ||
      typeof job.payload.targetTenantId !== "number" ||
      job.tenantId !== String(job.payload.targetTenantId)
    )
      throw AppError.validation("Invalid Data Bridge job context.");
    const report = await new CommonBulkService(host).run(
      job.payload.runId,
      job.payload.targetTenantId
    );
    await refreshDashboard(job.payload.targetTenantId);
    return {
      runId: report.id,
      status: report.status,
      tables: report.tables.length,
      inserted: report.tables.reduce((sum, table) => sum + table.inserted, 0),
      attention: report.tables.reduce((sum, table) => sum + table.attention.length, 0)
    };
  });
  registerQueueJobProcessor("data-bridge.mapped-import", async (job) => {
    if (
      typeof job.payload.runId !== "string" ||
      typeof job.payload.targetTenantId !== "number" ||
      job.tenantId !== String(job.payload.targetTenantId)
    )
      throw AppError.validation("Invalid transfer context.");
    const result = await new TransferService(host).run(
      job.payload.runId,
      job.payload.targetTenantId
    );
    await refreshDashboard(job.payload.targetTenantId);
    return { runId: result.id, status: result.status, rows: result.rows.length };
  });
  const processBusinessImport = businessImportWorker(host);
  registerQueueJobProcessor("data-bridge.business-import", async (job, progress) => {
    const result = await processBusinessImport(job, progress);
    await refreshDashboard(Number(job.payload.targetTenantId));
    return {
      runId: result.id,
      status: result.status,
      tables: result.tables.length,
      inserted: result.tables.reduce((n, t) => n + t.imported, 0),
      warnings: result.tables.reduce((n, t) => n + t.warnings, 0) + (result.users?.warnings ?? 0),
      updated: result.tables.reduce((n, t) => n + (t.updated ?? 0), 0),
      usersImported: result.users?.imported ?? 0,
      invoices: result.invoiceCount,
      invoiceWarnings: result.invoiceWarnings
    };
  });
  await registerDataBridgeApi(app, host);
}
