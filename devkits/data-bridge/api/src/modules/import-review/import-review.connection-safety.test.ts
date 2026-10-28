import assert from "node:assert/strict";
import { test } from "node:test";
import type { Connection } from "mysql2/promise";
import {
  isReadOnlyGrant,
  requireDistinctDatabases,
  requireReadOnlySource
} from "./import-review.connection-safety.js";

test("source grants allow only explicit read privileges", () => {
  for (const grant of [
    "GRANT USAGE ON *.* TO 'reader'@'%'",
    "GRANT SELECT, SHOW VIEW ON `legacy`.* TO 'reader'@'%'"
  ])
    assert.equal(isReadOnlyGrant(grant), true);
  for (const grant of [
    "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'",
    "GRANT SELECT, INSERT ON `legacy`.* TO 'reader'@'%'",
    "GRANT SELECT ON *.* TO 'reader'@'%' WITH GRANT OPTION",
    "GRANT 'writer' TO 'reader'@'%'"
  ])
    assert.equal(isReadOnlyGrant(grant), false);
});

test("source session becomes read only before use", async () => {
  const queries: string[] = [];
  const source = {
    query: async (sql: string) => {
      queries.push(sql);
      return [
        sql.startsWith("SHOW") ? [{ grant: "GRANT SELECT ON `legacy`.* TO 'reader'@'%'" }] : []
      ];
    }
  } as unknown as Connection;
  await requireReadOnlySource(source);
  assert.deepEqual(queries, ["SHOW GRANTS FOR CURRENT_USER", "SET SESSION TRANSACTION READ ONLY"]);
});

test("same server and schema is rejected even through different host aliases", async () => {
  const queries: string[] = [];
  const source = {
    query: async (sql: string) => [
      sql.includes("IS_USED_LOCK") ? [{ owner: 42 }] : [{ database_name: "Tenant" }]
    ]
  } as unknown as Connection;
  const target = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes("CONNECTION_ID")) return [[{ database_name: "tenant", connection_id: 42 }]];
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      return [[]];
    }
  } as unknown as Connection;
  await assert.rejects(requireDistinctDatabases(source, target), /different databases/);
  assert.ok(queries.some((sql) => sql.includes("RELEASE_LOCK")));
});
