import { env } from "../../env.js";
import { platformDatabaseName } from "../../database/platform-database.js";
import type { Tenant } from "../tenant/tenant.types.js";
import { verifiedMasterBackupFile } from "./database-maintenance.backups.js";
import { DatabaseMaintenanceRepository } from "./database-maintenance.repository.js";
import { verifiedTenantBackupFile } from "./database-maintenance.tenant-backups.js";
import type { DatabaseMaintenanceRun } from "./database-maintenance.types.js";
import { assertMigrationBackupEvidence } from "./database-maintenance.backup-evidence.js";

export async function verifyMigrationBackups(tenants: readonly Tenant[]) {
  await verifyMasterMigrationBackup();
  for (const tenant of tenants) await verifyTenantMigrationBackup(tenant);
}

export async function verifyMasterMigrationBackup() {
  const repository = new DatabaseMaintenanceRepository();
  const master = await repository.latestCompletedBackup("master", "master");
  if (!master || master.databaseName !== platformDatabaseName()) {
    throw new Error("A completed backup for the platform database is required.");
  }
  await verifiedMasterBackupFile(master);
  await verifyEvidence(repository, master, env.DB_HOST, env.DB_PORT);
}

export async function verifyTenantMigrationBackup(tenant: Tenant) {
  const repository = new DatabaseMaintenanceRepository();
  const backup = await repository.latestCompletedBackup("tenant", String(tenant.id));
  if (!backup) throw new Error(`A completed backup is required for tenant ${tenant.tenantCode}.`);
  await verifiedTenantBackupFile(backup, tenant);
  await verifyEvidence(
    repository,
    backup,
    tenant.dbHost || env.DB_HOST,
    tenant.dbPort || env.DB_PORT
  );
}

async function verifyEvidence(
  repository: DatabaseMaintenanceRepository,
  backup: DatabaseMaintenanceRun,
  host: string,
  port: number
) {
  const restores = await repository.completedRestores(backup.scope, backup.targetKey);
  assertMigrationBackupEvidence(backup, restores, host, port);
}
