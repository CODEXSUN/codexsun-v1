import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { withReleaseMigrationLock } from "../../apps/platform/api/src/database/migration-release-lock.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Disposable fixture required.");
const port = Number(process.env.CODEXSUN_MIGRATION_TEST_PORT);
if (!Number.isInteger(port) || port < 1024) throw new Error("Invalid fixture port.");
const config = { host: "host.docker.internal", port, user: "root", password: "codexsun_local_test_only" };

test("release lock excludes a second coordinator and releases after failure", async () => {
  const first = await createConnection(config);
  const second = await createConnection(config);
  try {
    await assert.rejects(withReleaseMigrationLock(first, "fixture", async () => {
      await assert.rejects(withReleaseMigrationLock(second, "fixture", async () => {}), /Another migration release/);
      throw new Error("fixture failure");
    }), /fixture failure/);
    assert.equal(await withReleaseMigrationLock(second, "fixture", async () => "released"), "released");
  } finally {
    await first.end();
    await second.end();
  }
});
