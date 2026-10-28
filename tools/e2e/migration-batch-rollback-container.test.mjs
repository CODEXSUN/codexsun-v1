import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import {
  runMigrationBatch,
  rollbackMigrationBatch,
} from "../../packages/framework/src/db/migrations.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1")
  throw new Error("Disposable fixture required.");
const port = Number(process.env.CODEXSUN_MIGRATION_TEST_PORT);
if (!Number.isInteger(port) || port < 1024)
  throw new Error("Invalid Docker fixture port.");
const database = new Kysely({
  dialect: new MysqlDialect({
    pool: createPool({
      host: "host.docker.internal",
      port,
      user: "root",
      password: "codexsun_local_test_only",
      database: "codexsun_rollback_safety_fixture",
    }),
  }),
});

test("failed down records failure and prevents reversal of earlier steps", async () => {
  const batch = {
    batch: 1,
    scope: "fixture",
    description: "test",
    version: "1",
    steps: [
      {
        name: "create",
        description: "create fixture",
        checksum: "v1",
        version: 1,
        up: (db) =>
          sql`CREATE TABLE fixture_records (id INT PRIMARY KEY)`.execute(db),
        down: (db) => sql`DROP TABLE fixture_records`.execute(db),
      },
      {
        name: "marker",
        description: "add marker",
        checksum: "v1",
        version: 2,
        up: (db) =>
          sql`ALTER TABLE fixture_records ADD COLUMN marker INT`.execute(db),
        down: async (db) => {
          await sql`ALTER TABLE fixture_records DROP COLUMN marker`.execute(db);
          throw new Error("fixture partial down");
        },
      },
    ],
  };
  try {
    await runMigrationBatch(database, batch);
    await assert.rejects(
      rollbackMigrationBatch(database, batch),
      /fixture partial down/,
    );
    const state =
      await sql`SELECT name,status,error_text FROM migration_schema WHERE scope='fixture' ORDER BY version`.execute(
        database,
      );
    assert.deepEqual(
      state.rows.map(({ name, status }) => [name, status]),
      [
        ["create", "applied"],
        ["marker", "failed"],
      ],
    );
    assert.match(state.rows[1].error_text, /fixture partial down/);
    const table =
      await sql`SELECT COUNT(*) AS total FROM fixture_records`.execute(
        database,
      );
    assert.equal(Number(table.rows[0].total), 0);
    await assert.rejects(
      rollbackMigrationBatch(database, batch),
      /Reconcile its schema and ledger/,
    );
  } finally {
    await database.destroy();
  }
});
