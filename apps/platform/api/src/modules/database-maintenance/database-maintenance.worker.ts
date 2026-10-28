import {
  DatabaseMaintenanceRepository,
  tenantRestoreSandboxName
} from "./database-maintenance.repository.js";
import { env } from "../../env.js";
import { executeDatabaseBackup, executeDatabaseRestore } from "./database-maintenance.executor.js";
import { resolveTenantDatabasePassword } from "../../database/tenant-database.js";
import { verifiedMasterBackupFile } from "./database-maintenance.backups.js";
import { verifiedTenantBackupFile } from "./database-maintenance.tenant-backups.js";
import { withCoordinatedMigration } from "../../database/migration-coordination.js";

export async function processDatabaseMaintenanceJob(payload: Record<string, unknown>) {
  return withCoordinatedMigration(() => processDatabaseMaintenanceJobLocked(payload));
}

async function processDatabaseMaintenanceJobLocked(payload: Record<string, unknown>) {
  const runId = Number(payload.runId);
  if (!Number.isInteger(runId) || runId <= 0) {
    throw new Error("Database maintenance job requires a valid runId.");
  }

  const repository = new DatabaseMaintenanceRepository();
  const run = await repository.findRun(runId);
  if (!run) {
    throw new Error("Database maintenance run was not found.");
  }

  await repository.updateRunStatus(run.id, "running", { ...run.details, queueStatus: "running" });

  const executedAt = new Date().toISOString();
  const tenant = run.scope === "tenant" ? await repository.findTenant(Number(run.targetKey)) : null;
  if (run.scope === "tenant" && (!tenant || tenant.dbName !== run.databaseName)) {
    await repository.updateRunStatus(run.id, "failed", {
      ...run.details,
      error: "Tenant restore target is no longer valid.",
      queueStatus: "failed"
    });
    throw new Error("Tenant restore target is no longer valid.");
  }
  const target = {
    databaseName: run.databaseName,
    host: tenant?.dbHost || env.DB_HOST,
    password: tenant ? resolveTenantDatabasePassword(tenant) : env.DB_PASSWORD,
    port: tenant?.dbPort || env.DB_PORT,
    ...(tenant ? { tenantKey: tenant.slug || tenant.tenantCode } : {}),
    user: tenant?.dbUser || env.DB_USER
  };

  try {
    const result =
      run.operation === "restore"
        ? await executeDatabaseRestore({
            backupPath: await restoreBackupPath(repository, run),
            liveRestoreConfirm: stringDetail(run.details.liveRestoreConfirm),
            operation: run.operation,
            restoreMode: stringDetail(run.details.restoreMode),
            sandboxMode: run.details.sandboxMode === "append" ? "append" : "fresh",
            ...(tenant ? { sandboxName: tenantRestoreSandboxName(tenant.dbName, tenant.id) } : {}),
            runId: run.id,
            scope: run.scope,
            target
          })
        : await executeDatabaseBackup({
            operation: run.operation,
            runId: run.id,
            scope: run.scope,
            target
          });

    const details = {
      ...run.details,
      executedAt,
      ...result,
      host: target.host,
      port: target.port,
      ...(run.operation === "restore" ? await restoreEvidence(repository, run) : {}),
      queueStatus: "completed"
    };
    await repository.updateRunStatus(run.id, "completed", details);

    return {
      databaseName: run.databaseName,
      operation: run.operation,
      runId: run.id,
      scope: run.scope,
      ...result
    };
  } catch (error) {
    await repository.updateRunStatus(run.id, "failed", {
      ...run.details,
      error: error instanceof Error ? error.message : "Database maintenance failed.",
      queueStatus: "failed"
    });
    throw error;
  }
}

async function restoreEvidence(
  repository: DatabaseMaintenanceRepository,
  run: NonNullable<Awaited<ReturnType<DatabaseMaintenanceRepository["findRun"]>>>
) {
  const backup = await repository.findRun(Number(run.details.backupRunId));
  if (!backup || typeof backup.details.checksum !== "string") {
    throw new Error("Restore backup checksum is missing.");
  }
  return { backupChecksum: backup.details.checksum };
}

async function restoreBackupPath(
  repository: DatabaseMaintenanceRepository,
  run: NonNullable<Awaited<ReturnType<DatabaseMaintenanceRepository["findRun"]>>>
) {
  if (run.scope === "master") {
    const backupRunId = Number(run.details.backupRunId);
    if (!Number.isInteger(backupRunId) || backupRunId <= 0) {
      throw new Error("Select a completed master backup before restoring.");
    }
    const selected = await repository.findRun(backupRunId);
    if (!selected) throw new Error("Selected master backup was not found.");
    return (await verifiedMasterBackupFile(selected)).path;
  }
  const tenant = await repository.findTenant(Number(run.targetKey));
  if (!tenant || tenant.dbName !== run.databaseName)
    throw new Error("Tenant restore target is no longer valid.");
  const backupRunId = Number(run.details.backupRunId);
  if (!Number.isInteger(backupRunId) || backupRunId <= 0)
    throw new Error("Select a completed tenant backup before restoring.");
  const selected = await repository.findRun(backupRunId);
  if (!selected) throw new Error("Selected tenant backup was not found.");
  return (await verifiedTenantBackupFile(selected, tenant)).path;
}

function stringDetail(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
