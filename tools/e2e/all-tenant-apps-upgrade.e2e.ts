import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { closeAllAccountsDatabases } from "@codexsun/accounts-api";
import { closeAllBillingDatabases } from "@codexsun/billing-api";
import { closeCoreDatabase } from "@codexsun/core-api";
import { env } from "../../apps/platform/api/src/env.js";
import {
  defaultTenantModuleKeys,
  resolveEnabledApps
} from "../../apps/platform/api/src/modules/app-registry/app-registry.service.js";
import { tenantDatabaseMigrationsFor } from "../../apps/platform/api/src/database/tenant-app-database.js";
import {
  migrateTenantDatabase,
  seedTenantDatabase
} from "../../apps/platform/api/src/modules/tenant/tenant.seed.js";
import type { Tenant } from "../../apps/platform/api/src/modules/tenant/tenant.types.js";
import { restoreDumpInSandbox } from "./restore-dump-sandbox.js";
import { populateTenantFixture, assertTenantFixtureUnchanged } from "./populated-tenant-fixture.js";

const dumpPath = process.argv[2];
if (env.NODE_ENV === "production" || !dumpPath) {
  throw new Error("Pass a tenant SQL dump path or --fresh in a nonproduction environment.");
}
const sourceName = dumpPath === "--fresh" ? "fresh" : basename(dumpPath, ".sql");
if (!/^[a-z][a-z0-9_]*$/u.test(sourceName)) throw new Error("Invalid dump name.");
const databaseName = `codexsun_all_${sourceName}_${randomBytes(4).toString("hex")}`;
const admin = await createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  multipleStatements: true
});
const tenant = {
  corporateId: "SANDBOX",
  dbHost: env.DB_HOST,
  dbName: databaseName,
  dbPort: env.DB_PORT,
  dbSecretRef: "DB_PASSWORD",
  dbType: env.DB_DRIVER,
  dbUser: env.DB_USER,
  defaultLandingApp: "application",
  enabledModuleKeys: [],
  id: 0,
  mobile: null,
  payloadSettings: {},
  primaryDomain: "sandbox.invalid",
  slug: "sandbox",
  status: "active",
  storagePrivateRoot: "",
  storagePublicRoot: "",
  storageRoot: "",
  tenantCode: "SANDBOX",
  tenantName: "Upgrade sandbox",
  uuid: randomBytes(4).toString("hex")
} satisfies Tenant;

try {
  if (dumpPath !== "--fresh") {
    const dump = readFileSync(resolve(dumpPath), "utf8");
    await admin.query(restoreDumpInSandbox(dump, sourceName, databaseName));
  }
  const oldRows = await tableCounts();
  const allEnabled = {
    ...tenant,
    enabledModuleKeys: [...defaultTenantModuleKeys, "blog"]
  } satisfies Tenant;
  assert.deepEqual(
    tenantDatabaseMigrationsFor(tenant),
    tenantDatabaseMigrationsFor(allEnabled),
    "Migration plan must not depend on app activation."
  );

  const migrated = await migrateTenantDatabase(tenant);
  const [ledger] = await admin.query<Array<{ name: string }>>(
    `SELECT name FROM \`${databaseName}\`.migration_schema WHERE status='applied'`
  );
  const applied = new Set(ledger.map(({ name }) => name));
  for (const migration of tenantDatabaseMigrationsFor(tenant)) {
    assert.ok(
      applied.has(migration.name),
      `${migration.name} is absent from the migration ledger.`
    );
  }
  for (const app of [
    "application",
    "qcafe",
    "marketing",
    "hrms",
    "docs",
    "sites",
    "ecommerce",
    "tconnect",
    "sportsclub",
    "crm",
    "frappe",
    "auditor",
    "zetro",
    "billing",
    "accounts",
    "mail",
    "notes",
    "chat",
    "task-manager",
    "codexsun",
    "blog"
  ]) {
    assert.ok(migrated.provisionedApps.includes(app), `${app} schema was not installed.`);
  }
  const populated = await populateTenantFixture(admin, databaseName);
  if (dumpPath === "--fresh") {
    await admin.query(
      `INSERT INTO \`${databaseName}\`.core_companies (uuid,code,name) VALUES (?,?,?)`,
      ["c0def123", "fixture-upgrade-company", "Existing upgrade company"]
    );
    const [existing] = await admin.query<RowDataPacket[]>(
      `SELECT * FROM \`${databaseName}\`.core_companies WHERE uuid=?`,
      ["c0def123"]
    );
    assert.ok(existing[0]);
    populated.push({
      app: "core",
      table: "core_companies",
      id: Number(existing[0].id),
      row: existing[0]
    });
    await admin.query(`ALTER TABLE \`${databaseName}\`.core_companies DROP COLUMN favicon_path`);
    await admin.query(
      `DELETE FROM \`${databaseName}\`.migration_schema WHERE scope='core' AND name='core.organisation.company-favicon-v2'`
    );
  }
  await migrateTenantDatabase(tenant);
  if (dumpPath === "--fresh") {
    const [favicon] = await admin.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='core_companies' AND COLUMN_NAME='favicon_path'",
      [databaseName]
    );
    assert.equal(favicon.length, 1, "Existing company schema was not upgraded.");
    const [company] = await admin.query<RowDataPacket[]>(
      `SELECT name,favicon_path FROM \`${databaseName}\`.core_companies WHERE uuid=?`,
      ["c0def123"]
    );
    assert.equal(company[0]?.name, "Existing upgrade company");
    assert.equal(company[0]?.favicon_path, null);
  }
  await assertTenantFixtureUnchanged(admin, databaseName, populated);
  const afterMigration = await tableCounts();
  for (const [table, count] of oldRows) {
    const currentTable = table;
    if (!afterMigration.has(currentTable)) {
      assert.equal(count, 0, `Existing table ${table} had rows before removal.`);
      continue;
    }
    assert.ok(afterMigration.get(currentTable)! >= count, `Existing table ${table} lost rows.`);
  }

  await seedTenantDatabase(tenant);
  const [disabledModules] = await admin.query<
    Array<{ enabled: number; module_key: string; status: string }>
  >(`SELECT module_key,enabled,status FROM \`${databaseName}\`.app_module_settings`);
  for (const key of ["crm", "ecommerce", "billing.sales", "accounts.overview", "blog"]) {
    const row = disabledModules.find(({ module_key }) => module_key === key);
    assert.ok(row, `${key} module setting is absent.`);
    assert.equal(Number(row.enabled), 0, `${key} was enabled without tenant activation.`);
    assert.equal(row.status, "inactive", `${key} is not inactive.`);
  }

  await seedTenantDatabase(allEnabled);
  const firstSeedRows = await tableCounts();
  await seedTenantDatabase(allEnabled);
  assert.deepEqual(await tableCounts(), firstSeedRows, "Second seed changed row counts.");
  const [qCafe] = await admin.query<Array<{ enabled: number; status: string }>>(
    `SELECT enabled,status FROM \`${databaseName}\`.app_module_settings WHERE module_key='qcafe'`
  );
  assert.equal(Number(qCafe[0]?.enabled), 1, "Q Cafe was not enabled for the tenant.");
  assert.equal(qCafe[0]?.status, "active");
  assert.equal(resolveEnabledApps(["qcafe"]).find(({ appId }) => appId === "qcafe")?.enabled, true);
  assert.equal(
    resolveEnabledApps(["accounts.accounting"]).find(({ appId }) => appId === "accounts")?.enabled,
    true,
    "Legacy Accounts activation did not resolve to the current app."
  );
  await seedTenantDatabase({
    ...tenant,
    enabledModuleKeys: ["accounts.accounting"]
  });
  const [legacyAccounts] = await admin.query<Array<{ enabled: number; status: string }>>(
    `SELECT enabled,status FROM \`${databaseName}\`.app_module_settings WHERE module_key='accounts.overview'`
  );
  assert.equal(Number(legacyAccounts[0]?.enabled), 1);
  assert.equal(legacyAccounts[0]?.status, "active");
  await assertTenantFixtureUnchanged(admin, databaseName, populated);
  console.log("All tenant app upgrade passed", {
    databaseName,
    migrations: migrated.migrationOrder.length,
    tables: firstSeedRows.size,
    populatedApps: new Set(populated.map(({ app }) => app)).size
  });
} finally {
  await admin.end();
  await Promise.all([closeAllAccountsDatabases(), closeAllBillingDatabases(), closeCoreDatabase()]);
}

async function tableCounts() {
  const [tables] = await admin.query<Array<{ TABLE_NAME: string }>>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'",
    [databaseName]
  );
  const counts = new Map<string, number>();
  for (const { TABLE_NAME: table } of tables) {
    const [rows] = await admin.query<Array<{ count: number }>>(
      `SELECT COUNT(*) AS count FROM \`${databaseName}\`.\`${table}\``
    );
    counts.set(table, Number(rows[0]?.count ?? 0));
  }
  return counts;
}
