import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { runMigrationBatch } from "./migrations.js";

test("migration advisory locks use the same connection for acquire and release", async () => {
  const queries: Array<{ id: number; sql: string }> = [];
  let nextId = 0;
  const driver = {
    async init() {},
    async acquireConnection() {
      const id = ++nextId;
      return {
        async executeQuery(query: { sql: string }) {
          queries.push({ id, sql: query.sql });
          return { rows: query.sql.includes("GET_LOCK") ? [{ acquired: 1 }] : [] };
        },
        async *streamQuery() {
          yield* [];
          throw new Error("not used");
        }
      };
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {}
  };
  const db = new Kysely<Record<string, never>>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (database) => new MysqlIntrospector(database),
      createQueryCompiler: () => new MysqlQueryCompiler()
    }
  });
  await runMigrationBatch(db, {
    batch: 1,
    scope: "test",
    description: "test",
    version: "1",
    steps: []
  });
  const locks = queries.filter((query) => /GET_LOCK|RELEASE_LOCK/.test(query.sql));
  assert.equal(locks.length, 4);
  assert.equal(locks[0]?.id, locks[1]?.id);
  assert.equal(locks[2]?.id, locks[3]?.id);
  await db.destroy();
});
