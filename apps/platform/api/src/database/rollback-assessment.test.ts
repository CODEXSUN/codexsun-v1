import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDistinctRollbackTargets,
  inspectRollbackLedger,
  summarizeRollbackLedger,
} from "./rollback-assessment.js";

test("assessment includes applied and incomplete rows regardless of app activation", () => {
  const summary = summarizeRollbackLedger("tenant A", [
    {
      scope: "disabled-app",
      name: "one",
      batch: 1,
      version: 1,
      status: "applied",
    },
    {
      scope: "disabled-app",
      name: "two",
      batch: 1,
      version: 2,
      status: "failed",
    },
    { scope: "other", name: "three", batch: 2, version: 1, status: "running" },
    {
      scope: "other",
      name: "four",
      batch: 2,
      version: 2,
      status: "rolled_back",
    },
  ]);
  assert.equal(summary.applied, 1);
  assert.equal(summary.incomplete, 2);
  assert.deepEqual(summary.byScope, [
    { scope: "disabled-app", applied: 1, incomplete: 1 },
    { scope: "other", applied: 0, incomplete: 1 },
  ]);
});

test("assessment rejects duplicate targets and unknown ledger states", () => {
  assert.throws(
    () =>
      assertDistinctRollbackTargets([
        { label: "first", host: "DB", port: 3306, database: "tenant" },
        { label: "second", host: "db", port: 3306, database: "TENANT" },
      ]),
    /duplicate database target/,
  );
  assert.throws(
    () =>
      assertDistinctRollbackTargets([
        { label: "missing", host: "", port: 3306, database: "tenant" },
      ]),
    /invalid target identity/,
  );
  assert.throws(
    () =>
      summarizeRollbackLedger("tenant", [
        {
          scope: "app",
          name: "one",
          batch: 1,
          version: 1,
          status: "unexpected",
        },
      ]),
    /invalid ledger row/,
  );
});

test("assessment fails closed when a target ledger cannot be read", async () => {
  await assert.rejects(
    inspectRollbackLedger("tenant A", {
      async query() {
        throw new Error("database unavailable");
      },
    }),
    /cannot read the migration ledger for tenant A/,
  );
});
