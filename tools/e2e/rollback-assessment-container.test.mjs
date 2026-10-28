import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { assertDistinctRollbackTargets, inspectRollbackLedger } from "../../apps/platform/api/src/database/rollback-assessment.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Disposable fixture required.");
const port = Number(process.env.CODEXSUN_MIGRATION_TEST_PORT);
const database = process.env.CODEXSUN_MIGRATION_FIXTURE_DATABASE;
if (!Number.isInteger(port) || port < 1024 || !/^codexsun_all_fresh_[a-f0-9]{8}$/.test(database || "")) {
  throw new Error("Invalid disposable fixture identity.");
}

test("reads a real migration ledger without changing it", async () => {
  const connection = await createConnection({ host: "host.docker.internal", port, user: "root", password: "codexsun_local_test_only", database });
  try {
    const [identity] = await connection.query("SELECT @@hostname AS serverHost, @@port AS serverPort, DATABASE() AS schemaName");
    assertDistinctRollbackTargets([{ label: "fixture", host: identity[0].serverHost, port: Number(identity[0].serverPort), database: identity[0].schemaName }]);
    const report = await inspectRollbackLedger("fixture", connection);
    assert.ok(report.applied > 0);
    assert.equal(report.applied, report.byScope.reduce((sum, scope) => sum + scope.applied, 0));
  } finally {
    await connection.end();
  }
});
