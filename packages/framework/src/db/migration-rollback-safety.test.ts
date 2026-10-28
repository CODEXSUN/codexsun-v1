import assert from "node:assert/strict";
import test from "node:test";
import {
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
} from "kysely";
import {
  migrationChecksum,
  rollbackMigrationBatch,
  type MigrationLedgerEntry,
} from "./migrations.js";

function fixture(ledger: MigrationLedgerEntry[], tables = ["migration_schema"]) {
  const writes: readonly unknown[][] = [];
  const queries: string[] = [];
  const driver = {
    async init() {},
    async acquireConnection() {
      return {
        async executeQuery(query: {
          sql: string;
          parameters: readonly unknown[];
        }) {
          queries.push(query.sql);
          if (query.sql.includes("GET_LOCK"))
            return { rows: [{ acquired: 1 }] };
          if (query.sql.includes("FROM information_schema.TABLES"))
            return { rows: tables.map((table_name) => ({ table_name })) };
          if (
            query.sql.includes(
              "SELECT scope, batch, checksum, name, status, version",
            )
          )
            return { rows: ledger };
          if (query.sql.includes("INSERT INTO"))
            (writes as unknown[][]).push([...query.parameters]);
          return { rows: [] };
        },
        async *streamQuery() {
          yield* [];
          throw new Error("not used");
        },
      };
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };
  const database = new Kysely<Record<string, never>>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (db) => new MysqlIntrospector(db),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
  });
  return { database, writes, queries };
}

test("rollback never creates or adopts a missing or ambiguous ledger", async () => {
  const batch = { batch: 1, scope: "fixture", description: "test", version: "1", steps: [] };
  for (const tables of [[], ["app_migration_batches"], ["migration_schema", "app_migration_batches"]]) {
    const { database, queries } = fixture([], tables);
    await assert.rejects(rollbackMigrationBatch(database, batch), /ledger .*missing|both current and legacy/);
    assert.equal(queries.some((query) => /CREATE TABLE|RENAME TABLE|INSERT INTO|UPDATE |DELETE FROM/i.test(query)), false);
    await database.destroy();
  }
});

test("rollback refuses incomplete, newer, or unknown steps before reversing anything", async () => {
  let downs = 0;
  const step = {
    name: "known",
    description: "test",
    checksum: "v1",
    version: 1,
    up: async () => {},
    down: async () => {
      downs += 1;
    },
  };
  const batch = {
    batch: 1,
    scope: "fixture",
    description: "test",
    version: "1",
    steps: [step],
  };
  const checksum = migrationChecksum(batch, step);
  const known = {
    scope: "fixture",
    batch: 1,
    name: "known",
    version: 1,
    checksum,
    status: "applied" as const,
  };
  for (const extra of [
    { ...known, name: "interrupted", status: "failed" as const },
    { ...known, name: "interrupted", status: "running" as const },
    { ...known, name: "future", batch: 2 },
    { ...known, name: "unknown" },
  ]) {
    const { database, writes } = fixture([known, extra]);
    await assert.rejects(
      rollbackMigrationBatch(database, batch),
      /Reconcile|newer applied batch|not in the rollback plan/,
    );
    assert.equal(writes.length, 0);
    await database.destroy();
  }
  assert.equal(downs, 0);
});

test("a failed down is recorded as failed instead of still applied", async () => {
  const step = {
    name: "known",
    description: "test",
    checksum: "v1",
    version: 1,
    up: async () => {},
    down: async () => {
      throw new Error("partial down");
    },
  };
  const batch = {
    batch: 1,
    scope: "fixture",
    description: "test",
    version: "1",
    steps: [step],
  };
  const { database, writes } = fixture([
    {
      scope: "fixture",
      batch: 1,
      name: "known",
      version: 1,
      checksum: migrationChecksum(batch, step),
      status: "applied",
    },
  ]);
  await assert.rejects(rollbackMigrationBatch(database, batch), /partial down/);
  assert.equal(writes.length, 2);
  assert.ok(writes[0]?.includes("running"));
  assert.ok(writes[1]?.includes("failed"));
  assert.ok(writes[1]?.includes("partial down"));
  await database.destroy();
});
