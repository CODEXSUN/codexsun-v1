import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { bootstrapPlatformDatabase, closePlatformDatabase } from "../../apps/platform/api/src/database/platform-database.ts";
import { DatabaseMaintenanceRepository } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.repository.ts";
import { processDatabaseMaintenanceJob } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.worker.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" || process.env.NODE_ENV !== "production" || process.env.DB_MASTER_NAME !== "codexsun_lifecycle_fixture") throw new Error("Disposable production-mode fixture required.");

test("production startup requires a valid backup and fresh sandbox restore", async () => {
  const connection = await createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  try {
    await bootstrapPlatformDatabase();
    await connection.query("CREATE TABLE codexsun_lifecycle_fixture.lifecycle_records (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL) ENGINE=InnoDB");
    await connection.query("INSERT INTO codexsun_lifecycle_fixture.lifecycle_records VALUES (1, 'preserved')");
    await closePlatformDatabase();
    await assert.rejects(bootstrapPlatformDatabase(), /completed backup/);

    const repository = new DatabaseMaintenanceRepository();
    const backup = await repository.recordRun({ databaseName: process.env.DB_MASTER_NAME, operation: "backup", scope: "master", status: "requested", targetKey: "master" });
    await processDatabaseMaintenanceJob({ runId: backup.id });
    const backupRun = await repository.findRun(backup.id);
    assert.equal(backupRun?.status, "completed");
    await assert.rejects(bootstrapPlatformDatabase(), /matching completed fresh sandbox restore/);

    const restore = await repository.recordRun({ databaseName: process.env.DB_MASTER_NAME, operation: "restore", scope: "master", status: "requested", targetKey: "master", details: { backupRunId: backup.id, restoreMode: "sandbox", sandboxMode: "fresh" } });
    await processDatabaseMaintenanceJob({ runId: restore.id });
    const restoreRun = await repository.findRun(restore.id);
    assert.equal(restoreRun?.status, "completed");
    const [restored] = await connection.query("SELECT id,name FROM codexsun_lifecycle_restore.lifecycle_records");
    assert.deepEqual(restored, [{ id: 1, name: "preserved" }]);
    await bootstrapPlatformDatabase();
    const [live] = await connection.query("SELECT id,name FROM codexsun_lifecycle_fixture.lifecycle_records");
    assert.deepEqual(live, [{ id: 1, name: "preserved" }]);
    await closePlatformDatabase();
    await appendFile(backupRun.details.filePath, "-- tampered\n");
    await assert.rejects(bootstrapPlatformDatabase(), /checksum/);
  } finally {
    await closePlatformDatabase();
    await connection.end();
  }
});
