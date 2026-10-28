import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { migrationChecksum, runMigrationBatch } from "./migrations.js";

for (const status of ["running", "failed"] as const) {
  test(`refuses to retry a ${status} migration without reconciliation`, async () => {
    let executions = 0;
    const step = {
      name: "step", description: "test", checksum: "v1", version: 1,
      up: async () => { executions += 1; }
    };
    const batch = { batch: 1, scope: "test", description: "test", version: "1", steps: [step] };
    const checksum = migrationChecksum(batch, step);
    const driver = {
      async init() {},
      async acquireConnection() {
        return {
          async executeQuery(query: { sql: string }) {
            if (query.sql.includes("GET_LOCK")) return { rows: [{ acquired: 1 }] };
            if (query.sql.includes("SELECT checksum, name, status, version")) {
              return { rows: [{ checksum, name: "step", status, version: 1 }] };
            }
            return { rows: [] };
          },
          async *streamQuery() { yield* []; throw new Error("not used"); }
        };
      },
      async beginTransaction() {}, async commitTransaction() {}, async rollbackTransaction() {},
      async releaseConnection() {}, async destroy() {}
    };
    const db = new Kysely<Record<string, never>>({
      dialect: {
        createAdapter: () => new MysqlAdapter(),
        createDriver: () => driver as never,
        createIntrospector: (database) => new MysqlIntrospector(database),
        createQueryCompiler: () => new MysqlQueryCompiler()
      }
    });
    await assert.rejects(runMigrationBatch(db, batch), /Reconcile its schema and ledger/);
    assert.equal(executions, 0);
    await db.destroy();
  });
}
