import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { executeDatabaseBackup } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.executor.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" || process.env.DB_MASTER_NAME !== "codexsun_maintenance_fixture" || process.env.DB_HOST !== "host.docker.internal") throw new Error("Disposable fixture required.");
const target = { databaseName: "codexsun_maintenance_tenant", host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, tenantKey: "tenant-maintenance" };

test("unsupported Ecommerce trigger and function prevent backup without changing tenant data", async () => {
  const connection = await createConnection({ host: target.host, port: target.port, user: target.user, password: target.password, database: target.databaseName });
  try {
    const [beforeTrigger] = await connection.query("SHOW CREATE TRIGGER ecommerce_variant_signature_insert_v1");
    const [beforeFunction] = await connection.query("SHOW CREATE FUNCTION ecommerce_variant_signature_v1");
    const [beforeRows] = await connection.query("SELECT id,name FROM lifecycle_records");
    assert.ok(beforeTrigger.length && beforeFunction.length);
    await assert.rejects(executeDatabaseBackup({ operation: "backup", runId: 999, scope: "tenant", target }), /cannot include (trigger|routine)/);
    const [afterTrigger] = await connection.query("SHOW CREATE TRIGGER ecommerce_variant_signature_insert_v1");
    const [afterFunction] = await connection.query("SHOW CREATE FUNCTION ecommerce_variant_signature_v1");
    const [afterRows] = await connection.query("SELECT id,name FROM lifecycle_records");
    assert.deepEqual(afterTrigger, beforeTrigger);
    assert.deepEqual(afterFunction, beforeFunction);
    assert.deepEqual(afterRows, beforeRows);
    assert.deepEqual(afterRows, [{ id: 1, name: "preserved" }]);
  } finally {
    await connection.end();
  }
});
