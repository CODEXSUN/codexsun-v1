import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { createMigrationDatabase } from "../../apps/platform/api/src/database/create-migration-database.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Disposable fixture required.");
const port = Number(process.env.CODEXSUN_MIGRATION_TEST_PORT);
if (!Number.isInteger(port) || port < 1024) throw new Error("Invalid fixture port.");

test("existing database requires backup verification before migration", async () => {
  const connection = await createConnection({ host: "host.docker.internal", port, user: "root", password: "codexsun_local_test_only" });
  const name = "codexsun_tenant_guard_fixture";
  let checks = 0;
  try {
    assert.equal(await createMigrationDatabase(connection, name, async () => { checks += 1; }), "created");
    assert.equal(checks, 0);
    await assert.rejects(createMigrationDatabase(connection, name, async () => {
      checks += 1;
      throw new Error("backup rejected");
    }), /backup rejected/);
    assert.equal(checks, 1);
    assert.equal(await createMigrationDatabase(connection, name, async () => { checks += 1; }), "existing");
    assert.equal(checks, 2);
  } finally {
    await connection.end();
  }
});
