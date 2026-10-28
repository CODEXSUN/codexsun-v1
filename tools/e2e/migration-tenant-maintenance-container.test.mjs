import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { bootstrapPlatformDatabase, closePlatformDatabase } from "../../apps/platform/api/src/database/platform-database.ts";
import { closeAllTenantDatabases } from "../../apps/platform/api/src/database/tenant-database.ts";
import { TenantRepository } from "../../apps/platform/api/src/modules/tenant/tenant.repository.ts";
import { DatabaseMaintenanceService } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.service.ts";
import { DatabaseMaintenanceRepository } from "../../apps/platform/api/src/modules/database-maintenance/database-maintenance.repository.ts";
import { QueueManagerService } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.service.ts";
import { closeAllAccountsDatabases } from "@codexsun/accounts-api";
import { closeAllBillingDatabases } from "@codexsun/billing-api";
import { closeCoreDatabase } from "@codexsun/core-api";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" || process.env.NODE_ENV !== "production" || process.env.DB_MASTER_NAME !== "codexsun_maintenance_fixture" || process.env.DB_HOST !== "host.docker.internal") throw new Error("Disposable production-mode fixture required.");
const config = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
const tenantDatabase = "codexsun_maintenance_tenant";

test("registered tenant setup blocks backup and reinstall when executable database objects are unsupported", async () => {
  const connection = await createConnection(config);
  try {
    await bootstrapPlatformDatabase();
    const tenant = await new TenantRepository().create({
      corporateId: "DOCKERFIXTURE", dbHost: config.host, dbName: tenantDatabase,
      dbPort: config.port, dbSecretRef: "DB_PASSWORD", dbType: "mariadb", dbUser: config.user,
      defaultLandingApp: "application", enabledModuleKeys: [], mobile: null, payloadSettings: {},
      primaryDomain: "tenant-maintenance.invalid", slug: "tenant-maintenance", status: "active",
      tenantCode: "DOCKERFIXTURE", tenantName: "Docker fixture"
    });
    const service = new DatabaseMaintenanceService();
    const repository = new DatabaseMaintenanceRepository();
    const queue = new QueueManagerService();
    const setup = await service.setupTenant(tenant.id);
    assert.equal(setup?.status, "completed");
    await connection.query(`CREATE TABLE \`${tenantDatabase}\`.lifecycle_records (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL) ENGINE=InnoDB`);
    await connection.query(`INSERT INTO \`${tenantDatabase}\`.lifecycle_records VALUES (1, 'preserved')`);
    await assert.rejects(service.reinstallTenant(tenant.id), /completed backup/);

    const backup = await service.requestTenantBackup(tenant.id);
    assert.ok(backup);
    const result = await runMaintenanceJob(queue, backup.id);
    assert.match(result?.errorMessage || "", /SQL backup cannot include (trigger|routine)/);
    assert.notEqual(result?.status, "completed");
    const rejectedBackup = await repository.findRun(backup.id);
    assert.equal(rejectedBackup?.status, "failed");
    await assert.rejects(service.reinstallTenant(tenant.id), /completed backup/);
    const [live] = await connection.query(`SELECT id,name FROM \`${tenantDatabase}\`.lifecycle_records`);
    assert.deepEqual(live, [{ id: 1, name: "preserved" }]);
  } finally {
    await closeAllTenantDatabases();
    await Promise.all([closeAllAccountsDatabases(), closeAllBillingDatabases(), closeCoreDatabase()]);
    await closePlatformDatabase();
    await connection.end();
  }
});

async function runMaintenanceJob(queue, runId) {
  const jobs = await queue.listJobs({ correlationId: `database-maintenance:${runId}` });
  assert.equal(jobs.length, 1);
  return queue.runJob(jobs[0].id);
}
