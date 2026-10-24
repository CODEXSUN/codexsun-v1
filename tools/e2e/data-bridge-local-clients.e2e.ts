import { verifyLocalClientAccess } from "./data-bridge-local-access.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createPool } from "mysql2";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { Kysely, MysqlDialect } from "kysely";
import {
  seedCoreTenantDatabase,
  closeCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import { isUntouchedCompanySeed } from "../../apps/core/api/src/modules/organisation/company/company.seed-policy.js";
import { hasActiveTransferCompanyContext } from "../../apps/core/api/src/modules/organisation/default-company/default-company.transfer.js";
import { seedCoreStandardUserAccess } from "../../apps/core/api/src/auth/tenant-permission.seed.js";
import { seedBillingStandardUserAccess } from "../../apps/billing/api/src/auth/tenant-permission.seed.js";
import {
  seedBillingTenantDatabase,
  closeAllBillingDatabases
} from "../../apps/billing/api/src/database/billing-database.js";
import { migrateTenantRuntimeModule } from "../../apps/platform/api/src/modules/tenant/tenant.migration.js";
import { seedTenantRoleModule } from "../../apps/platform/api/src/modules/tenant-role/tenant-role.seed.js";
import { copyBridgeUsers } from "../../apps/platform/api/src/modules/tenant-user/tenant-user.bridge.js";
import { selectUserRole } from "../../apps/platform/api/src/modules/tenant-user-role/tenant-user-role.repository.js";
import type { TenantDatabase } from "../../apps/platform/api/src/database/schema.js";
import { migrateCrmTenantDatabase } from "../../apps/crm/api/src/crm.migration.js";
import { seedCrmTenantDatabase } from "../../apps/crm/api/src/crm.seed.js";
import { seedCrmUserAccess } from "../../apps/crm/api/src/crm.user-access.seed.js";
import { migrateDataBridgeDatabase } from "../../devkits/data-bridge/api/src/modules/data-bridge/data-bridge.migration.js";
import { BusinessImportService } from "../../devkits/data-bridge/api/src/modules/business-import/business-import.service.js";
import { BusinessImportRepository } from "../../devkits/data-bridge/api/src/modules/business-import/business-import.repository.js";
import { BusinessImportQueries } from "../../devkits/data-bridge/api/src/modules/business-import/business-import.queries.js";
import type { CommonTableImportHost } from "../../devkits/data-bridge/api/src/modules/import-review/import-review.types.js";

assert.equal(
  process.env.CODEXSUN_BRIDGE_LOCAL_CLIENT_TEST,
  "1",
  "Explicit local write opt-in required"
);
const config = {
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!
};
assert.ok(["127.0.0.1", "localhost", "::1"].includes(config.host), "Local databases only");
const pairs = [
  { source: "sukraa_cloud_db", target: "sukraa_db" },
  { source: "altex_cloud_db", target: "altex_db" }
];
const reviewName = `codexsun_bridge_local_${Date.now()}`;
const admin = await createConnection(config);
const pools: Kysely<TenantDatabase>[] = [];
const evidence: Record<string, unknown>[] = [];
await mkdir("dist/verification/data-bridge-local", { recursive: true });
try {
  for (const pair of pairs) {
    const [existing] = await admin.query<RowDataPacket[]>(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?",
      [pair.target]
    );
    assert.equal(existing.length, 0, `Refusing to replace existing target ${pair.target}`);
  }
  await admin.query(
    `CREATE DATABASE \`${reviewName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  const reports = pool(reviewName);
  await migrateDataBridgeDatabase(reports);
  for (const [index, pair] of pairs.entries()) {
    console.log(`START ${pair.source} -> ${pair.target}`);
    const source = await createConnection({ ...config, database: pair.source, timezone: "Z" });
    let target: Connection | undefined;
    try {
      const before = await fingerprint(source);
      await admin.query(
        `CREATE DATABASE \`${pair.target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      const database = pool(pair.target);
      await migrateTenantRuntimeModule(database);
      await seedTenantRoleModule(database);
      await seedCoreTenantDatabase(pair.target);
      await seedBillingTenantDatabase(pair.target);
      await migrateCrmTenantDatabase(database as never);
      await seedCrmTenantDatabase(database as never);
      target = await createConnection({ ...config, database: pair.target, timezone: "Z" });
      const seed = (await query(target, "SELECT id,uuid FROM core_companies"))[0]!;
      assert.equal((await query(target, "SELECT name FROM core_units WHERE id=1"))[0]?.name, "-");
      const host: CommonTableImportHost = {
        database: reports,
        isCompanySeed: isUntouchedCompanySeed,
        authorize: () => "local-operator",
        listTenants: async () => [{ id: index + 1, label: pair.target, database: pair.target }],
        resolveTenant: async () => ({
          ...config,
          id: index + 1,
          label: pair.target,
          database: pair.target
        }),
        dataMigration: {
          listSources: async () => [],
          resolveSource: async () => ({
            ...config,
            id: index + 1,
            label: pair.source,
            database: pair.source,
            tlsMode: "disabled"
          })
        },
        enqueueBusiness: async () => {},
        copyUsers: async () => {
          assert.ok(await hasActiveTransferCompanyContext(database));
          await seedCoreStandardUserAccess(database);
          await seedBillingStandardUserAccess(database);
          await seedCrmUserAccess(database);
          return copyBridgeUsers(source, database, async () => {}, selectUserRole);
        }
      };
      const service = new BusinessImportService(host);
      const start = await service.start(
        index + 1,
        index + 1,
        "local-operator",
        "fresh-client-test"
      );
      let last = "";
      const first = await service.run(start.id, index + 1, async (progress) => {
        const phase = String(progress.phase);
        if (phase !== last) {
          console.log(`${pair.target}: ${phase}`);
          last = phase;
        }
      });
      const warnings = await new BusinessImportQueries(host).warnings(first.id, 1);
      await writeFile(
        `dist/verification/data-bridge-local/${pair.target}-first.json`,
        JSON.stringify({ report: first, warnings }, null, 2)
      );
      console.log(
        JSON.stringify({ target: pair.target, status: first.status, warnings: warnings.rows })
      );
      assert.equal(first.orphans, 0);
      assert.equal(first.invoiceMatched, first.invoiceCount);
      assert.equal(first.invoiceWarnings, 0);
      assert.equal(first.users?.warnings, 0);
      const company = await query(target, "SELECT id,uuid FROM core_companies");
      assert.equal(company.length, 1, "Do not create a second company");
      assert.deepEqual(company[0], seed, "Reuse seed company identity");
      const users = await verifyUsers(source, target);
      const access = await verifyLocalClientAccess(target, pair.target);
      const invoices = await verifyInvoices(new BusinessImportRepository(reports), first.id);
      const tableNames = first.tables.filter((t) => t.status !== "skipped").map((t) => t.table);
      const snapshot = await fingerprint(target, [...tableNames, "app_users", "app_user_roles"]);
      const again = await service.start(
        index + 1,
        index + 1,
        "local-operator",
        "repeat-client-test"
      );
      const repeat = await service.run(again.id, index + 1);
      assert.equal(
        repeat.tables.reduce((n, t) => n + t.imported + (t.updated ?? 0), 0),
        0,
        "Repeat must not insert or update business rows"
      );
      assert.equal(repeat.users?.imported, 0);
      assert.equal(repeat.invoiceMatched, repeat.invoiceCount);
      assert.equal(repeat.orphans, 0);
      assert.equal(
        await fingerprint(target, [...tableNames, "app_users", "app_user_roles"]),
        snapshot,
        "Repeat preserves all business/user row values"
      );
      const after = await fingerprint(source);
      assert.equal(after, before, "Source rows must remain unchanged");
      const result = {
        ...pair,
        reviewDatabase: reviewName,
        firstRun: first.id,
        repeatRun: repeat.id,
        status: first.status,
        sourceHash: before,
        sourceUnchanged: true,
        repeatUnchanged: true,
        users,
        access,
        invoices,
        groups: ["common", "masters", "billing"].map((group) => ({
          group,
          tables: first.tables.filter((t) => t.group === group && t.status !== "skipped").length,
          inserted: first.tables
            .filter((t) => t.group === group)
            .reduce((n, t) => n + t.imported, 0),
          updated: first.tables
            .filter((t) => t.group === group)
            .reduce((n, t) => n + (t.updated ?? 0), 0),
          warnings: first.tables
            .filter((t) => t.group === group)
            .reduce((n, t) => n + t.warnings, 0)
        })),
        warnings: warnings.rows
      };
      evidence.push(result);
      await writeFile(
        "dist/verification/data-bridge-local/summary.json",
        JSON.stringify(evidence, null, 2)
      );
      console.log(`PASS ${pair.target} ${JSON.stringify(result)}`);
    } finally {
      await source.end();
      await target?.end();
    }
  }
} finally {
  await closeAllBillingDatabases();
  await closeCoreDatabase();
  await Promise.all(pools.map((p) => p.destroy()));
  await admin.end();
}
function pool(database: string) {
  const db = new Kysely<TenantDatabase>({
    dialect: new MysqlDialect({ pool: createPool({ ...config, database, timezone: "Z" }) })
  });
  pools.push(db);
  return db;
}
async function query(connection: Connection, statement: string) {
  return (await connection.query<RowDataPacket[]>(statement))[0];
}
async function fingerprint(connection: Connection, tables?: string[]) {
  const names =
    tables ??
    (await query(connection, "SHOW FULL TABLES WHERE Table_type='BASE TABLE'")).map((row) =>
      String(Object.values(row)[0])
    );
  const hash = createHash("sha256");
  for (const name of [...new Set(names)].sort()) {
    assert.match(name, /^[A-Za-z0-9_]+$/u);
    const rows = await query(connection, `SELECT * FROM \`${name}\``);
    hash.update(name + JSON.stringify(rows.map((row) => JSON.stringify(row)).sort()));
  }
  return hash.digest("hex");
}
async function verifyUsers(source: Connection, target: Connection) {
  const original = await query(
    source,
    "SELECT email,password_hash,status FROM app_users ORDER BY id"
  );
  for (const account of original) {
    const [saved] = await target.query<RowDataPacket[]>(
      "SELECT u.password_hash,u.status,u.role,r.`key` role_key FROM app_users u JOIN app_user_roles ur ON ur.user_id=u.id AND ur.status='active' JOIN app_roles r ON r.id=ur.role_id WHERE u.email=?",
      [account.email]
    );
    assert.equal(saved.length, 1);
    assert.equal(saved[0]!.password_hash, account.password_hash);
    assert.equal(saved[0]!.status, account.status);
    assert.equal(saved[0]!.role_key, "user");
    assert.equal(saved[0]!.role, "user");
  }
  return { matchedHashes: original.length, assignedUserRole: original.length };
}
async function verifyInvoices(repository: BusinessImportRepository, id: string) {
  let invoices = 0,
    children = 0,
    deleted = 0;
  const byTable: Record<string, { matched: number; children: number; deleted: number }> = {};
  for (let page = 1; ; page++) {
    const results = await repository.invoices(id, page, false);
    for (const row of results.rows) {
      assert.equal(row.status, "success");
      const totals = (byTable[row.table] ??= { matched: 0, children: 0, deleted: 0 });
      totals.matched++;
      if (row.deleted) totals.deleted++;
      invoices++;
      if (row.deleted) deleted++;
      for (const child of row.children) {
        assert.equal(child.differences, 0);
        assert.equal(child.matched, child.sourceRows);
        children += child.matched;
        totals.children += child.matched;
      }
    }
    if (page * 100 >= results.total) break;
  }
  return { matched: invoices, matchedChildren: children, deletedHistory: deleted, byTable };
}
