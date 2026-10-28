import assert from "node:assert/strict";
import test from "node:test";
import { withReleaseMigrationLock } from "./migration-release-lock.js";

test("release lock rejects contention and releases after failure", async () => {
  let held = false;
  const connection = {
    async query(statement: string) {
      if (statement.includes("GET_LOCK")) {
        const acquired = !held;
        held = true;
        return [[{ acquired: Number(acquired) }], []];
      }
      held = false;
      return [[], []];
    }
  };
  await assert.rejects(withReleaseMigrationLock(connection as never, "fixture", async () => {
    await assert.rejects(withReleaseMigrationLock(connection as never, "fixture", async () => {}), /Another migration release/);
    throw new Error("fixture failure");
  }), /fixture failure/);
  assert.equal(held, false);
});
