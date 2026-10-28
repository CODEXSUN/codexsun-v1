import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { getPlatformDatabase, closePlatformDatabase } from "../../apps/platform/api/src/database/platform-database.ts";
import { createTenantDatabase } from "../../apps/platform/api/src/database/tenant-database.ts";
import { migrateDatabaseMaintenanceModule } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.migration.ts";
import { DatabaseMaintenanceRepository } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.repository.ts";
import { executeDatabaseBackup, executeDatabaseRestore } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.executor.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" || process.env.NODE_ENV !== "production" || process.env.DB_MASTER_NAME !== "codexsun_tenant_gate_master" || process.env.DB_HOST !== "host.docker.internal") throw new Error("Disposable production-mode fixture required.");
const connectionConfig = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
const tenant = { id: 7, uuid: "fixture7", tenantCode: "FIXTURE", slug: "tenant-gate-fixture", dbName: "codexsun_tenant_gate_fixture", dbHost: connectionConfig.host, dbPort: connectionConfig.port, dbUser: connectionConfig.user, dbSecretRef: "DB_PASSWORD" };
const target = { databaseName: tenant.dbName, ...connectionConfig, tenantKey: tenant.slug };

test("existing tenant migration gate requires an intact backup and sandbox restore", async () => {
  const connection = await createConnection(connectionConfig);
  try {
    await connection.query("CREATE DATABASE codexsun_tenant_gate_master");
    await connection.query("CREATE DATABASE codexsun_tenant_gate_fixture");
    await connection.query("CREATE TABLE codexsun_tenant_gate_fixture.records (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL) ENGINE=InnoDB");
    await connection.query("INSERT INTO codexsun_tenant_gate_fixture.records VALUES (1, 'preserved')");
    await migrateDatabaseMaintenanceModule(getPlatformDatabase());
    const repository = new DatabaseMaintenanceRepository();
    await assert.rejects(createTenantDatabase(tenant), /completed backup/);

    const backupFile = await executeDatabaseBackup({ operation: "backup", runId: 1, scope: "tenant", target });
    const backup = await repository.recordRun({ databaseName: tenant.dbName, operation: "backup", scope: "tenant", status: "completed", targetKey: String(tenant.id), details: { ...backupFile, host: target.host, port: target.port } });
    await assert.rejects(createTenantDatabase(tenant), /matching completed fresh sandbox restore/);
    const restored = await executeDatabaseRestore({ backupPath: backupFile.filePath, operation: "restore", runId: 2, scope: "tenant", target, restoreMode: "sandbox", sandboxMode: "fresh", sandboxName: "codexsun_tenant_gate_restore" });
    await repository.recordRun({ databaseName: tenant.dbName, operation: "restore", scope: "tenant", status: "completed", targetKey: String(tenant.id), details: { ...restored, backupRunId: backup.id, backupChecksum: backupFile.checksum, restoreMode: "sandbox", sandboxMode: "fresh" } });
    const [restoredRows] = await connection.query("SELECT id,name FROM codexsun_tenant_gate_restore.records");
    assert.deepEqual(restoredRows, [{ id: 1, name: "preserved" }]);
    await createTenantDatabase(tenant);
    const [liveRows] = await connection.query("SELECT id,name FROM codexsun_tenant_gate_fixture.records");
    assert.deepEqual(liveRows, [{ id: 1, name: "preserved" }]);
    await appendFile(backupFile.filePath, "-- tampered\n");
    await assert.rejects(createTenantDatabase(tenant), /checksum/);
  } finally {
    await closePlatformDatabase();
    await connection.end();
  }
});
