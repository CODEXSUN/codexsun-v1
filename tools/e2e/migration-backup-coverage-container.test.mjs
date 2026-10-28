import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { executeDatabaseBackup } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.executor.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" || process.env.DB_MASTER_NAME !== "codexsun_coverage_fixture") throw new Error("Disposable fixture required.");
const target = { databaseName: process.env.DB_MASTER_NAME, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD };

test("backup refuses unsupported views and nontransactional tables", async () => {
  const connection = await createConnection({ host: target.host, port: target.port, user: target.user, password: target.password, database: target.databaseName });
  try {
    await connection.query("CREATE TABLE records (id INT PRIMARY KEY) ENGINE=InnoDB");
    await connection.query("CREATE VIEW records_view AS SELECT id FROM records");
    await assert.rejects(executeDatabaseBackup({ operation: "backup", runId: 1, scope: "master", target }), /cannot include view/);
    await connection.query("DROP VIEW records_view");
    await connection.query("CREATE TABLE old_records (id INT PRIMARY KEY) ENGINE=MyISAM");
    await assert.rejects(executeDatabaseBackup({ operation: "backup", runId: 2, scope: "master", target }), /requires InnoDB/);
  } finally {
    await connection.end();
  }
});
