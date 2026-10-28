import {
  migratePlatformDatabase,
  platformDatabaseName
} from "../../database/platform-database.js";
import { AppError } from "@codexsun/framework/errors";
import { provisionTenantDatabase } from "../tenant/index.js";
import { PlatformActivityService } from "../platform-activity/index.js";
import { QueueManagerService } from "../queue-manager/index.js";
import { env } from "../../env.js";
import {
  DatabaseMaintenanceRepository,
  tenantRestoreSandboxName
} from "./database-maintenance.repository.js";
import { MasterBackupFiles } from "./database-maintenance.backups.js";
import { TenantBackupFiles } from "./database-maintenance.tenant-backups.js";
import { restoreSandboxName } from "./database-maintenance.executor.js";
import type { DatabaseActionPayload } from "./database-maintenance.types.js";
import {
  verifyTenantMigrationBackup
} from "./database-maintenance.migration-backup.js";

export class DatabaseMaintenanceService {
  constructor(
    private readonly repository = new DatabaseMaintenanceRepository(),
    private readonly activity = new PlatformActivityService(),
    private readonly queue = new QueueManagerService()
  ) {}

  masterStatus() {
    return this.repository.masterStatus();
  }

  async masterRestoreRun(runId: number) {
    const run = await this.repository.findRun(runId);
    if (
      !run ||
      run.scope !== "master" ||
      run.operation !== "restore" ||
      run.targetKey !== "master"
    ) {
      throw AppError.notFound("Master restore job was not found.");
    }
    return run;
  }

  tenantStatuses() {
    return this.repository.tenantStatuses();
  }

  tenantDetails(tenantId: number) {
    return this.repository.tenantDetails(tenantId);
  }

  setupTenant(tenantId: number, input: DatabaseActionPayload = {}) {
    return this.installTenantDatabase(tenantId, "setup", input);
  }

  reinstallTenant(tenantId: number, input: DatabaseActionPayload = {}) {
    return this.installTenantDatabase(tenantId, "reinstall", input);
  }

  async migrateMaster(input: DatabaseActionPayload = {}) {
    const started = await this.repository.recordRun({
      databaseName: platformDatabaseName(),
      details: input,
      operation: "migrate",
      scope: "master",
      status: "running",
      targetKey: "master"
    });
    try {
      await migratePlatformDatabase();
      const run = await this.repository.updateRunStatus(started.id, "completed", input);
      await this.activity.recordActivity({
        action: "database.master.migrated",
        details: input,
        moduleKey: "platform.database-maintenance",
        recordLabel: platformDatabaseName()
      });
      return run;
    } catch (error) {
      await this.repository.updateRunStatus(started.id, "failed", {
        ...input,
        error: errorMessage(error, "Master database migration failed.")
      });
      throw error;
    }
  }

  async migrateTenant(tenantId: number, input: DatabaseActionPayload = {}) {
    const tenant = await this.repository.findTenant(tenantId);
    if (!tenant) return null;
    return this.runTenantProvisioning(tenant, "migrate", input);
  }

  async requestMasterBackup(input: DatabaseActionPayload = {}) {
    const run = await this.repository.recordRun({
      databaseName: platformDatabaseName(),
      details: {
        ...input,
        host: env.DB_HOST,
        policy: "operator-backup-required",
        port: env.DB_PORT,
        user: env.DB_USER
      },
      operation: "backup",
      scope: "master",
      status: "requested",
      targetKey: "master"
    });
    if (run) await this.enqueueMaintenanceRun(run.id, "master", null);
    await this.activity.recordActivity({
      action: "database.master.backup-requested",
      details: input,
      moduleKey: "platform.database-maintenance",
      recordLabel: platformDatabaseName()
    });
    return run;
  }

  private async installTenantDatabase(
    tenantId: number,
    operation: "reinstall" | "setup",
    input: DatabaseActionPayload
  ) {
    const tenant = await this.repository.findTenant(tenantId);
    if (!tenant) return null;
    const details = {
      ...input,
      databaseName: tenant.dbName,
      host: tenant.dbHost,
      preservesExistingData: true
    };
    return this.runTenantProvisioning(tenant, operation, details);
  }

  private async runTenantProvisioning(
    tenant: NonNullable<Awaited<ReturnType<DatabaseMaintenanceRepository["findTenant"]>>>,
    operation: "migrate" | "reinstall" | "setup",
    details: DatabaseActionPayload & Record<string, unknown>
  ) {
    const started = await this.repository.recordRun({
      databaseName: tenant.dbName,
      details,
      operation,
      scope: "tenant",
      status: "running",
      targetKey: String(tenant.id)
    });
    try {
      if (env.NODE_ENV === "production" && operation !== "setup") {
        await verifyTenantMigrationBackup(tenant);
      }
      const result = await provisionTenantDatabase(tenant);
      const completedDetails = { ...details, ...result };
      const run = await this.repository.updateRunStatus(started.id, "completed", completedDetails);
      await this.activity.recordActivity({
        action: `database.tenant.${operation === "migrate" ? "migrated" : operation}`,
        details: completedDetails,
        moduleKey: "platform.database-maintenance",
        recordId: tenant.id,
        recordLabel: tenant.tenantCode,
        recordUuid: tenant.uuid
      });
      return run;
    } catch (error) {
      const message = errorMessage(error, "Tenant database installation failed.");
      await this.repository.updateRunStatus(started.id, "failed", {
        ...details,
        error: message
      });
      throw AppError.internal(message);
    }
  }

  async requestTenantBackup(tenantId: number, input: DatabaseActionPayload = {}) {
    const tenant = await this.repository.findTenant(tenantId);
    if (!tenant) return null;
    const run = await this.repository.recordRun({
      databaseName: tenant.dbName,
      details: {
        ...input,
        host: tenant.dbHost,
        policy: "operator-backup-required",
        port: tenant.dbPort,
        storageRoot: tenant.storageRoot,
        tenantCode: tenant.tenantCode,
        tenantKey: tenant.slug || tenant.tenantCode,
        user: tenant.dbUser
      },
      operation: "backup",
      scope: "tenant",
      status: "requested",
      targetKey: String(tenant.id)
    });
    if (run) await this.enqueueMaintenanceRun(run.id, "tenant", tenant.id);
    await this.activity.recordActivity({
      action: "database.tenant.backup-requested",
      details: input,
      moduleKey: "platform.database-maintenance",
      recordId: tenant.id,
      recordLabel: tenant.tenantCode,
      recordUuid: tenant.uuid
    });
    return run;
  }

  async requestMasterRestore(input: {
    backupRunId: number;
    sandboxMode: "fresh" | "append";
    note?: string | undefined;
  }) {
    const sandboxName = restoreSandboxName(platformDatabaseName());
    if (await this.repository.activeMasterRestore()) {
      throw AppError.conflict("A master restore is already queued or running.");
    }
    if (
      input.sandboxMode === "append" &&
      !(await this.repository.masterSandboxExists(sandboxName))
    ) {
      throw AppError.validation("Append requires an existing sandbox. Run Fresh restore first.");
    }
    const selected = await new MasterBackupFiles(this.repository, this.activity).selectForRestore(
      input.backupRunId
    );
    const run = await this.repository.recordRun({
      databaseName: platformDatabaseName(),
      details: {
        ...input,
        backupId: selected.backupId,
        host: env.DB_HOST,
        policy: "sandbox-restore-required",
        port: env.DB_PORT,
        restoreMode: "sandbox",
        user: env.DB_USER
      },
      operation: "restore",
      scope: "master",
      status: "requested",
      targetKey: "master"
    });
    if (run) await this.enqueueMaintenanceRun(run.id, "master", null);
    await this.activity.recordActivity({
      action: "database.master.restore-requested",
      details: input,
      moduleKey: "platform.database-maintenance",
      recordLabel: platformDatabaseName()
    });
    return run;
  }

  async tenantRestoreRun(tenantId: number, runId: number) {
    const run = await this.repository.findRun(runId);
    if (
      !run ||
      run.scope !== "tenant" ||
      run.targetKey !== String(tenantId) ||
      run.operation !== "restore"
    ) {
      throw AppError.notFound("Tenant restore job was not found.");
    }
    return run;
  }

  async requestTenantRestore(
    tenantId: number,
    input: { backupRunId: number; sandboxMode: "fresh" | "append"; note?: string | undefined }
  ) {
    const tenant = await this.repository.findTenant(tenantId);
    if (!tenant) return null;
    if (await this.repository.activeTenantRestore(tenantId)) {
      throw AppError.conflict("A restore is already queued or running for this tenant.");
    }
    const sandboxName = tenantRestoreSandboxName(tenant.dbName, tenant.id);
    if (
      input.sandboxMode === "append" &&
      !(await this.repository.tenantSandboxExists(tenant, sandboxName))
    ) {
      throw AppError.validation("Append requires an existing sandbox. Run Fresh restore first.");
    }
    const selected = await new TenantBackupFiles(this.repository, this.activity).selectForRestore(
      tenant,
      input.backupRunId
    );
    const run = await this.repository.recordRun({
      databaseName: tenant.dbName,
      details: {
        ...input,
        backupId: selected.backupId,
        host: tenant.dbHost,
        policy: "sandbox-restore-required",
        port: tenant.dbPort,
        restoreMode: "sandbox",
        sandboxName,
        storageRoot: tenant.storageRoot,
        tenantCode: tenant.tenantCode,
        tenantKey: tenant.slug || tenant.tenantCode,
        user: tenant.dbUser
      },
      operation: "restore",
      scope: "tenant",
      status: "requested",
      targetKey: String(tenant.id)
    });
    if (run) await this.enqueueMaintenanceRun(run.id, "tenant", tenant.id);
    await this.activity.recordActivity({
      action: "database.tenant.restore-requested",
      details: input,
      moduleKey: "platform.database-maintenance",
      recordId: tenant.id,
      recordLabel: tenant.tenantCode,
      recordUuid: tenant.uuid
    });
    return run;
  }

  private enqueueMaintenanceRun(
    runId: number,
    scope: "master" | "tenant",
    tenantId: number | null
  ) {
    return this.queue.enqueue({
      correlationId: `database-maintenance:${runId}`,
      idempotencyKey: `database-maintenance:${runId}`,
      jobName: "database-maintenance.run",
      maxAttempts: 3,
      payload: { runId, scope },
      queueName: "maintenance",
      sourceModule: "platform.database-maintenance",
      tenantId: tenantId ? String(tenantId) : null
    });
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
