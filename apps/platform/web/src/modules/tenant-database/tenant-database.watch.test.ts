import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseMaintenanceRun } from "./tenant-database.types";
import { runningTenantDatabaseRun, watchedDatabaseRun } from "./tenant-database.watch";

function run(
  id: number,
  operation: DatabaseMaintenanceRun["operation"],
  status: DatabaseMaintenanceRun["status"]
): DatabaseMaintenanceRun {
  return {
    id,
    operation,
    status,
    completedAt: null,
    createdAt: "",
    databaseName: "tenant",
    details: {},
    scope: "tenant",
    targetKey: "1",
    uuid: String(id)
  };
}

test("watches the new setup run, not older or unrelated maintenance", () => {
  const older = run(4, "setup", "completed");
  const backup = run(6, "backup", "completed");
  const current = run(5, "setup", "running");
  assert.equal(
    watchedDatabaseRun([backup, current, older], { afterId: 4, operation: "setup" }),
    current
  );
  assert.equal(watchedDatabaseRun([backup, older], { afterId: 4, operation: "setup" }), undefined);
  assert.equal(
    watchedDatabaseRun([run(5, "setup", "completed")], { afterId: 4, operation: "setup" })?.status,
    "completed"
  );
  assert.equal(
    watchedDatabaseRun([run(5, "setup", "failed")], { afterId: 4, operation: "setup" })?.status,
    "failed"
  );
});

test("blocks starting a duplicate while setup, reinstall or migration is running", () => {
  for (const operation of ["setup", "reinstall", "migrate"] as const) {
    assert.equal(runningTenantDatabaseRun([run(2, operation, "running")])?.operation, operation);
  }
  assert.equal(
    runningTenantDatabaseRun([run(3, "backup", "running"), run(2, "setup", "completed")]),
    undefined
  );
});
