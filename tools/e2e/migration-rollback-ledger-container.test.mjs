import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { rollbackMigrationBatch } from "../../packages/framework/src/db/migrations.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Disposable fixture required.");
const port = Number(process.env.CODEXSUN_MIGRATION_TEST_PORT);
if (!Number.isInteger(port) || port < 1024) throw new Error("Invalid fixture port.");
const database = new Kysely({ dialect: new MysqlDialect({ pool: createPool({
  host: "host.docker.internal", port, user: "root", password: "codexsun_local_test_only",
  database: "codexsun_rollback_ledger_fixture"
}) }) });
const batch = { batch: 1, scope: "fixture", description: "test", version: "1", steps: [] };

test("rollback does not create, adopt or merge migration ledgers", async () => {
  try {
    await assert.rejects(rollbackMigrationBatch(database, batch), /ledger migration_schema is missing/);
    let tables = await sql`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()`.execute(database);
    assert.deepEqual(tables.rows, []);
    await sql`CREATE TABLE app_migration_batches (marker INT NOT NULL)`.execute(database);
    await sql`INSERT INTO app_migration_batches VALUES (42)`.execute(database);
    await assert.rejects(rollbackMigrationBatch(database, batch), /ledger migration_schema is missing/);
    tables = await sql`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()`.execute(database);
    assert.deepEqual(tables.rows.map((row) => row.name), ["app_migration_batches"]);
    await sql`CREATE TABLE migration_schema (marker INT NOT NULL)`.execute(database);
    await assert.rejects(rollbackMigrationBatch(database, batch), /both current and legacy/);
    const preserved = await sql`SELECT marker FROM app_migration_batches`.execute(database);
    assert.equal(preserved.rows[0].marker, 42);
  } finally {
    await database.destroy();
  }
});
