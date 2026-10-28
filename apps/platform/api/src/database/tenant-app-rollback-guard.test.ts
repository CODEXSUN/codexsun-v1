import assert from "node:assert/strict";
import test from "node:test";
import { rollbackSelectedTenantApps } from "./tenant-app-database.js";

test("tenant app rollback refuses before querying or mutating a database", async () => {
  let accessed = false;
  const database = new Proxy(
    {},
    {
      get() {
        accessed = true;
        throw new Error("database was accessed");
      },
    },
  );
  await assert.rejects(
    rollbackSelectedTenantApps(database as never, {} as never),
    /verified safe reverse plan/,
  );
  assert.equal(accessed, false);
});
