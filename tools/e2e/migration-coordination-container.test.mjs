import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { withCoordinatedMigration } from "../../apps/platform/api/src/database/migration-coordination.ts";
import { withReleaseMigrationLock } from "../../apps/platform/api/src/database/migration-release-lock.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Disposable fixture required.");
test("nested operations share a release lock and other connections are excluded", async () => {
  const other = await createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  try {
    const result = await withCoordinatedMigration(async () => {
      assert.equal(await withCoordinatedMigration(async () => "nested"), "nested");
      await assert.rejects(withReleaseMigrationLock(other, process.env.DB_MASTER_NAME, async () => {}), /Another migration release/);
      return "done";
    });
    assert.equal(result, "done");
    assert.equal(await withReleaseMigrationLock(other, process.env.DB_MASTER_NAME, async () => "released"), "released");
  } finally {
    await other.end();
  }
});
