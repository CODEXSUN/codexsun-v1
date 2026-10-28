import type { DatabaseMaintenanceRun } from "./database-maintenance.types.js";

const maxBackupAgeMs = 24 * 60 * 60 * 1000;

export function assertMigrationBackupEvidence(
  backup: DatabaseMaintenanceRun,
  restores: readonly DatabaseMaintenanceRun[],
  host: string,
  port: number,
  now = Date.now()
) {
  const completedAt = Date.parse(backup.completedAt || "");
  if (!Number.isFinite(completedAt) || completedAt > now || now - completedAt > maxBackupAgeMs) {
    throw new Error(
      `Backup ${backup.id} is missing a valid completion time or is older than 24 hours.`
    );
  }
  if (backup.operation !== "backup" || backup.status !== "completed") {
    throw new Error(`Backup ${backup.id} is not completed.`);
  }
  if (backup.details.host !== host || Number(backup.details.port) !== port) {
    throw new Error(`Backup ${backup.id} does not identify the current database server.`);
  }
  const checksum = backup.details.checksum;
  if (typeof checksum !== "string" || !/^[a-f0-9]{64}$/u.test(checksum)) {
    throw new Error(`Backup ${backup.id} has no valid checksum.`);
  }
  const valid = restores.some((restore) => {
    const restoredAt = Date.parse(restore.completedAt || "");
    return (
      restore.operation === "restore" &&
      restore.status === "completed" &&
      restore.scope === backup.scope &&
      restore.targetKey === backup.targetKey &&
      restore.databaseName === backup.databaseName &&
      Number(restore.details.backupRunId) === backup.id &&
      restore.details.backupChecksum === checksum &&
      restore.details.restoreMode === "sandbox" &&
      restore.details.sandboxMode === "fresh" &&
      Number.isFinite(restoredAt) &&
      restoredAt >= completedAt &&
      restoredAt <= now
    );
  });
  if (!valid)
    throw new Error(`Backup ${backup.id} has no matching completed fresh sandbox restore.`);
}
