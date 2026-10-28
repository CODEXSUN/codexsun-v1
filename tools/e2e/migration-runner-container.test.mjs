import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { runMigrationBatch, rollbackMigrationBatch } from "/app/dist/packages/framework/db/migrations.js";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") {
  throw new Error("This test requires the disposable local Docker fixture.");
}
const db = new Kysely({ dialect: new MysqlDialect({ pool: createPool({
  host: "host.docker.internal", port: Number(process.env.CODEXSUN_MIGRATION_TEST_PORT),
  user: "root", password: "codexsun_local_test_only", database: "codexsun_migration_fixture_2"
}) }) });

test("migration rerun and rollback preflight on disposable MariaDB", async () => {
  const batch = { batch: 1, scope: "fixture", description: "test", version: "1", steps: [
    { name: "create", description: "create fixture", checksum: "1", version: 1,
      up: async (database) => sql`CREATE TABLE fixture_records (id INT PRIMARY KEY)`.execute(database) },
    { name: "alter", description: "add marker", checksum: "1", version: 2,
      up: async (database) => sql`ALTER TABLE fixture_records ADD COLUMN marker INT`.execute(database),
      down: async (database) => sql`ALTER TABLE fixture_records DROP COLUMN marker`.execute(database) }
  ] };
  try {
    assert.equal((await runMigrationBatch(db, batch)).applied.length, 2);
    assert.equal((await runMigrationBatch(db, batch)).skipped.length, 2);
    await assert.rejects(rollbackMigrationBatch(db, batch), /no safe rollback/);
    const columns = await sql`SELECT COLUMN_NAME AS name FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'fixture_records'`.execute(db);
    assert.ok(columns.rows.some((column) => column.name === "marker"));
    const failedBatch = { batch: 2, scope: "failure-fixture", description: "test", version: "1", steps: [
      { name: "create", description: "create fixture", checksum: "1", version: 1,
        up: async (database) => sql`CREATE TABLE failure_records (id INT PRIMARY KEY)`.execute(database),
        down: async (database) => sql`DROP TABLE failure_records`.execute(database) },
      { name: "partial", description: "fail after ddl", checksum: "1", version: 2,
        up: async (database) => {
          await sql`ALTER TABLE failure_records ADD COLUMN marker INT`.execute(database);
          throw new Error("fixture failure");
        } }
    ] };
    await assert.rejects(runMigrationBatch(db, failedBatch), /fixture failure/);
    const partial = await sql`SELECT COLUMN_NAME AS name FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'failure_records'`.execute(db);
    assert.ok(partial.rows.some((column) => column.name === "marker"));
    await assert.rejects(runMigrationBatch(db, failedBatch), /Reconcile its schema and ledger/);
  } finally {
    await db.destroy();
  }
});
