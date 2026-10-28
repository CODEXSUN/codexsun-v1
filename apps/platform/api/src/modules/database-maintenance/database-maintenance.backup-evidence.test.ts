import assert from "node:assert/strict";
import test from "node:test";
import { assertMigrationBackupEvidence } from "./database-maintenance.backup-evidence.js";
import type { DatabaseMaintenanceRun } from "./database-maintenance.types.js";

const now = Date.parse("2026-10-27T12:00:00Z");
const checksum = "a".repeat(64);
const backup: DatabaseMaintenanceRun = {
  id: 3,
  uuid: "backup",
  scope: "tenant",
  targetKey: "1",
  databaseName: "tenant_1",
  operation: "backup",
  status: "completed",
  createdAt: "2026-10-27T10:00:00Z",
  completedAt: "2026-10-27T10:00:00Z",
  details: { host: "db", port: 3306, checksum }
};
const restore: DatabaseMaintenanceRun = {
  ...backup,
  id: 4,
  uuid: "restore",
  operation: "restore",
  completedAt: "2026-10-27T11:00:00Z",
  details: {
    backupRunId: 3,
    backupChecksum: checksum,
    restoreMode: "sandbox",
    sandboxMode: "fresh"
  }
};

test("accepts a recent backup and matching fresh sandbox restore", () => {
  assert.doesNotThrow(() => assertMigrationBackupEvidence(backup, [restore], "db", 3306, now));
});

test("rejects stale, mismatched and incomplete evidence", () => {
  assert.throws(() => assertMigrationBackupEvidence(backup, [restore], "db", 3306, now + 86400000));
  assert.throws(() => assertMigrationBackupEvidence(backup, [restore], "other", 3306, now));
  assert.throws(() =>
    assertMigrationBackupEvidence(backup, [{ ...restore, targetKey: "2" }], "db", 3306, now)
  );
  assert.throws(() =>
    assertMigrationBackupEvidence(
      backup,
      [{ ...restore, details: { ...restore.details, backupChecksum: "b".repeat(64) } }],
      "db",
      3306,
      now
    )
  );
  assert.throws(() =>
    assertMigrationBackupEvidence(
      backup,
      [{ ...restore, details: { ...restore.details, sandboxMode: "append" } }],
      "db",
      3306,
      now
    )
  );
  assert.throws(() =>
    assertMigrationBackupEvidence(backup, [{ ...restore, status: "failed" }], "db", 3306, now)
  );
});
