import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { executeDatabaseBackup, executeDatabaseRestore } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.executor.ts";
import { verifiedMasterBackupFile } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.backups.ts";
import { assertMigrationBackupEvidence } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.backup-evidence.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" || process.env.DB_MASTER_NAME !== "codexsun_backup_fixture") throw new Error("Disposable fixture required.");
const target = { databaseName: process.env.DB_MASTER_NAME, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD };

test("backup, checksum verification, sandbox restore and tamper detection", async () => {
  const connection = await createConnection({ host: target.host, port: target.port, user: target.user, password: target.password, database: target.databaseName });
  try {
    await connection.query("CREATE TABLE backup_records (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL)");
    await connection.query("INSERT INTO backup_records VALUES (1, 'preserved')");
    const backup = await executeDatabaseBackup({ operation: "backup", runId: 1, scope: "master", target });
    const now = new Date().toISOString();
    const run = { id: 1, uuid: "backup", scope: "master", targetKey: "master", databaseName: target.databaseName, operation: "backup", status: "completed", createdAt: now, completedAt: now, details: { ...backup, host: target.host, port: target.port } };
    await verifiedMasterBackupFile(run);
    const restored = await executeDatabaseRestore({ backupPath: backup.filePath, operation: "restore", runId: 2, scope: "master", target, restoreMode: "sandbox", sandboxMode: "fresh" });
    const [rows] = await connection.query("SELECT id,name FROM codexsun_backup_fixture_restore_sandbox.backup_records");
    assert.deepEqual(rows, [{ id: 1, name: "preserved" }]);
    const restore = { ...run, id: 2, operation: "restore", completedAt: new Date().toISOString(), details: { backupRunId: 1, backupChecksum: backup.checksum, restoreMode: "sandbox", sandboxMode: "fresh", ...restored } };
    assertMigrationBackupEvidence(run, [restore], target.host, target.port);
    await appendFile(backup.filePath, "-- tampered\n");
    await assert.rejects(verifiedMasterBackupFile(run), /checksum/);
  } finally {
    await connection.end();
  }
});
