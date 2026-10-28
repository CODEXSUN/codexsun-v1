import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { ensureStandardTableColumns } from "./migrations.js";

function fixture(standardUuid: boolean) {
  const statements: string[] = [];
  const driver = {
    async init() {},
    async acquireConnection() {
      return {
        async executeQuery(query: { sql: string }) {
          statements.push(query.sql);
          if (query.sql.includes("information_schema.TABLES"))
            return { rows: [{ table_name: "sample" }] };
          if (query.sql.includes("information_schema.COLUMNS"))
            return {
              rows: [
                { column_name: "id" },
                {
                  column_name: "uuid",
                  data_type: "char",
                  character_maximum_length: standardUuid ? 8 : 36,
                  is_nullable: "NO",
                  column_default: "lcase(substr(md5(uuid()),1,8))"
                }
              ]
            };
          if (query.sql.includes("information_schema.STATISTICS"))
            return { rows: [{ key_count: 1 }] };
          if (query.sql.includes("collision_count")) return { rows: [{ collision_count: 0 }] };
          return { rows: [] };
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
  const database = new Kysely<Record<string, never>>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (db) => new MysqlIntrospector(db),
      createQueryCompiler: () => new MysqlQueryCompiler()
    }
  });
  return { database, statements };
}

test("standard UUIDs avoid a redundant table rewrite and missing audit columns are added together", async () => {
  const { database, statements } = fixture(true);
  await ensureStandardTableColumns(database, ["sample"]);
  assert.equal(
    statements.filter((statement) => statement.includes("MODIFY COLUMN uuid")).length,
    0
  );
  const additions = statements.filter((statement) => statement.includes("ADD COLUMN"));
  assert.equal(additions.length, 1);
  for (const column of ["status", "created_by", "created_at", "updated_at"])
    assert.match(additions[0]!, new RegExp(column));
  await database.destroy();
});

test("legacy UUIDs retain collision checks and conversion", async () => {
  const { database, statements } = fixture(false);
  await ensureStandardTableColumns(database, ["sample"]);
  assert.equal(statements.filter((statement) => statement.includes("collision_count")).length, 2);
  assert.ok(statements.some((statement) => statement.includes("UPDATE `sample` SET uuid")));
  assert.ok(statements.some((statement) => statement.includes("MODIFY COLUMN uuid")));
  await database.destroy();
});
