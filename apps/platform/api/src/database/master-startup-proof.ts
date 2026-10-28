import { createConnection, type RowDataPacket } from "mysql2/promise";
import { env } from "../env.js";
import { quoteIdentifier } from "./database-utils.js";
import { platformDatabaseName } from "./platform-database.js";
import { DatabaseMaintenanceRepository } from "../modules/database-maintenance/database-maintenance.repository.js";
import { verifyMasterMigrationBackup } from "../modules/database-maintenance/database-maintenance.migration-backup.js";
import { processDatabaseMaintenanceJob } from "../modules/database-maintenance/database-maintenance.worker.js";
import { assertMasterProofConfiguration } from "./master-startup-proof-options.js";

/** Run only while the host updater has stopped all writers and isolated database access. */
export async function createMasterStartupProof() {
  const sandbox = env.CODEXSUN_RESTORE_TEST_DB_NAME;
  assertMasterProofConfiguration(
    sandbox,
    process.env.CODEXSUN_MASTER_PROOF_CONFIRM || "",
    env.NODE_ENV
  );
  const connection = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    timezone: "Z"
  });
  try {
    const [privileges] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM information_schema.USER_PRIVILEGES WHERE GRANTEE = CONCAT(QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', 1)), '@', QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', -1))) AND PRIVILEGE_TYPE IN ('PROCESS', 'ALL PRIVILEGES')"
    );
    if (!(Number(privileges[0]?.n) >= 1))
      throw new Error("Master proof requires PROCESS privilege.");
    const [scheduler] = await connection.query<RowDataPacket[]>(
      "SELECT @@GLOBAL.event_scheduler AS state"
    );
    if (!["OFF", "DISABLED", "0"].includes(String(scheduler[0]?.state).toUpperCase()))
      throw new Error("Master proof requires the event scheduler to be disabled.");
    const [clients] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE ID <> CONNECTION_ID()"
    );
    if (Number(clients[0]?.n) !== 0)
      throw new Error("Master proof requires no other database connections.");
    const [schemas] = await connection.execute<RowDataPacket[]>(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [sandbox]
    );
    if (schemas.length) throw new Error("Master proof sandbox already exists.");
    const repository = new DatabaseMaintenanceRepository();
    const backup = await repository.recordRun({
      databaseName: platformDatabaseName(),
      operation: "backup",
      scope: "master",
      status: "requested",
      targetKey: "master"
    });
    await processDatabaseMaintenanceJob({ runId: backup.id });
    const completedBackup = await repository.findRun(backup.id);
    if (completedBackup?.status !== "completed")
      throw new Error("Master proof backup did not complete.");
    const restore = await repository.recordRun({
      databaseName: platformDatabaseName(),
      operation: "restore",
      scope: "master",
      status: "requested",
      targetKey: "master",
      details: {
        backupRunId: backup.id,
        restoreMode: "sandbox",
        sandboxMode: "fresh",
        requireNewSandbox: true
      }
    });
    await processDatabaseMaintenanceJob({ runId: restore.id });
    const completedRestore = await repository.findRun(restore.id);
    if (
      completedRestore?.status !== "completed" ||
      completedRestore.details.restoredDatabaseName !== sandbox
    )
      throw new Error("Master proof restore did not complete in its own sandbox.");
    await verifyMasterMigrationBackup();
    await connection.query(`DROP DATABASE ${quoteIdentifier(sandbox)}`);
    console.info("[database] verified fresh master backup and sandbox restore for startup");
  } finally {
    await connection.end();
  }
}
