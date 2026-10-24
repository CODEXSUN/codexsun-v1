import { companySeedMarkerMigration } from "../modules/organisation/company/company.seed-marker.migration.js";
import { defaultCompanySeedMarkerMigration } from "../modules/organisation/default-company/default-company.seed-marker.migration.js";
import { companyFaviconMigration } from "../modules/organisation/company/company.favicon.migration.js";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  applyTablePrefixPolicy,
  ensureStandardTableColumns,
  rollbackMigrationBatch,
  rollbackTablePrefixPolicy,
  runMigrationBatch,
  type MigrationBatch
} from "@codexsun/framework/db";
import { Kysely, MysqlDialect, type Transaction } from "kysely";
import { createPool, type PoolOptions } from "mysql2";
import { createConnection } from "mysql2/promise";
import { seedCoreTenantPermissions } from "../auth/tenant-permission.seed.js";
import { env } from "../env.js";
import { commonMigrationSteps } from "../modules/common/common.migration.js";
import {
  ensureUnitDefaults,
  unitsDefaultsMigration
} from "../modules/common/products/units/units.migration.js";
import { seedCommonModule } from "../modules/common/common.seed.js";
import { removeUnknownCountrySeed } from "../modules/common/location/country/index.js";
import { seedMasterModule } from "../modules/master/index.js";
import { masterMigrationSteps } from "../modules/master/master.migration.js";
import { seedOrganisationModule } from "../modules/organisation/index.js";
import { organisationMigrationSteps } from "../modules/organisation/organisation.migration.js";

export type CoreDatabase = Record<string, unknown>;

const coreTableNames = [
  "address_types",
  "bank_names",
  "brands",
  "cities",
  "colours",
  "companies",
  "companies_addresses",
  "companies_bank_accounts",
  "companies_emails",
  "companies_phones",
  "companies_social_links",
  "contact_groups",
  "contact_types",
  "contacts",
  "contacts_addresses",
  "contacts_bank_accounts",
  "contacts_emails",
  "contacts_phones",
  "contacts_social_links",
  "countries",
  "currencies",
  "default_company_settings",
  "destinations",
  "districts",
  "financial_years",
  "hsn_codes",
  "ledger_groups",
  "ledgers",
  "months",
  "payment_terms",
  "pincodes",
  "priorities",
  "product_categories",
  "product_groups",
  "product_types",
  "products",
  "sales_types",
  "sizes",
  "states",
  "stock_rejection_types",
  "styles",
  "taxes",
  "transports",
  "units",
  "warehouses",
  "work_order_types",
  "work_orders"
] as const;

const corePrefixPolicy = { include: coreTableNames, prefix: "core_" } as const;

const context = new AsyncLocalStorage<string>();
const transactionContext = new AsyncLocalStorage<Transaction<CoreDatabase>>();
type CoreConnectionEntry = { database: Kysely<CoreDatabase>; lastUsedAt: number };

const connections = new Map<string, CoreConnectionEntry>();
const tenantConnectionOptions = new Map<string, TenantConnectionOptions>();
const migrated = new Set<string>();
const bootstrapping = new Map<string, Promise<void>>();
const connectionIdleMs = 10 * 60 * 1000;
const evictionTimer = setInterval(() => void evictIdleCoreDatabases(), 60_000);
evictionTimer.unref();

export const coreTenantMigrations = [
  {
    description: "Rename unprefixed legacy Core tables to their module-owned core_ names.",
    name: "core.table-prefix-v1"
  },
  ...commonMigrationSteps.map(({ description, key }) => ({ description, name: key })),
  ...organisationMigrationSteps.map(({ description, key }) => ({ description, name: key })),
  ...masterMigrationSteps.map(({ description, key }) => ({ description, name: key })),
  { description: companyFaviconMigration.description, name: companyFaviconMigration.name },
  {
    description: "Backfill and validate standard Core table identity and audit columns.",
    name: "core.standard-columns-v1"
  },
  {
    description: "Add database-generated UUID defaults for repeatable Core writes.",
    name: "core.uuid-defaults-v2"
  },
  { description: unitsDefaultsMigration.description, name: unitsDefaultsMigration.key },
  companySeedMarkerMigration,
  defaultCompanySeedMarkerMigration
] as const;

export const coreMigrationBatch: MigrationBatch<CoreDatabase> = {
  batch: 1,
  description: "Core module-owned schema baseline through release 1.0.42.",
  scope: "core",
  version: "1.0.42",
  steps: [
    {
      checksum: coreTableNames.join(","),
      description: "Rename legacy Core tables without copying or dropping data.",
      down: (database) =>
        rollbackTablePrefixPolicy(database, corePrefixPolicy).then(() => undefined),
      name: "core.table-prefix-v1",
      up: (database) => applyTablePrefixPolicy(database, corePrefixPolicy).then(() => undefined),
      version: 1
    },
    ...[...commonMigrationSteps, ...organisationMigrationSteps, ...masterMigrationSteps].map(
      ({ description, key, migrate }) => ({
        checksum: `${key}:v1`,
        description,
        name: key,
        up: migrate,
        version: 1
      })
    ),
    {
      checksum: `standard-columns:${coreTableNames.join(",")}`,
      description: "Backfill and validate standard Core table identity and audit columns.",
      name: "core.standard-columns-v1",
      up: (database) =>
        ensureStandardTableColumns(
          database,
          coreTableNames.map((tableName) => `core_${tableName}`)
        ),
      version: 1
    },
    {
      checksum: `uuid-defaults:${coreTableNames.join(",")}`,
      description: "Add database-generated UUID defaults for repeatable Core writes.",
      name: "core.uuid-defaults-v2",
      up: (database) =>
        ensureStandardTableColumns(
          database,
          coreTableNames.map((tableName) => `core_${tableName}`)
        ),
      version: 2
    },
    companyFaviconMigration,
    companySeedMarkerMigration,
    defaultCompanySeedMarkerMigration,
    {
      checksum: `${unitsDefaultsMigration.key}:v1`,
      description: unitsDefaultsMigration.description,
      name: unitsDefaultsMigration.key,
      up: ensureUnitDefaults,
      version: 2
    }
  ]
};

export function resolveCoreDatabaseName(value: unknown) {
  const requested = typeof value === "string" ? value.trim() : "";
  if (!requested) throw new Error("x-tenant-db is required for Core database access.");
  if (!/^[a-zA-Z0-9_]+$/.test(requested)) throw new Error("Invalid tenant database name.");
  if (requested === env.DB_MASTER_NAME)
    throw new Error("Core tables cannot use the Platform master database.");
  return requested;
}

export function runWithCoreDatabase<T>(databaseName: string, callback: () => T) {
  return context.run(resolveCoreDatabaseName(databaseName), callback);
}

export function runWithCoreTransaction<T>(
  databaseName: string,
  transaction: Transaction<CoreDatabase>,
  callback: () => T
) {
  return runWithCoreDatabase(databaseName, () => transactionContext.run(transaction, callback));
}

export function currentCoreTransaction() {
  return transactionContext.getStore();
}

export function registerCoreTenantDatabaseConnection(input: TenantConnectionOptions) {
  const name = resolveCoreDatabaseName(input.database);
  tenantConnectionOptions.set(name, { ...input, database: name });
}

export function getCoreDatabase(databaseName = context.getStore()) {
  const name = resolveCoreDatabaseName(databaseName);
  const transaction = transactionContext.getStore();
  if (transaction && name === context.getStore()) return transaction as Kysely<CoreDatabase>;
  const existing = connections.get(name);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing.database;
  }
  const database = new Kysely<CoreDatabase>({
    dialect: new MysqlDialect({
      pool: createPool({
        database: name,
        host: tenantConnectionOptions.get(name)?.host ?? env.DB_HOST,
        password: tenantConnectionOptions.get(name)?.password ?? env.DB_PASSWORD,
        port: tenantConnectionOptions.get(name)?.port ?? env.DB_PORT,
        connectionLimit: 4,
        idleTimeout: 60_000,
        maxIdle: 1,
        queueLimit: 100,
        timezone: "Z",
        user: tenantConnectionOptions.get(name)?.user ?? env.DB_USER
      } satisfies PoolOptions)
    })
  });
  connections.set(name, { database, lastUsedAt: Date.now() });
  return database;
}

export async function bootstrapCoreDatabase(databaseName: string) {
  const name = resolveCoreDatabaseName(databaseName);
  if (migrated.has(name)) return;
  const active = bootstrapping.get(name);
  if (active) return active;
  const promise = runWithCoreDatabase(name, async () => {
    await ensureDatabase(name);
    const database = getCoreDatabase(name);
    await migrateCoreModules(database);
    await seedCoreModules(database);
    migrated.add(name);
  });
  bootstrapping.set(name, promise);
  try {
    await promise;
  } finally {
    bootstrapping.delete(name);
  }
}

export async function migrateCoreTenantDatabase(databaseName: string) {
  const name = resolveCoreDatabaseName(databaseName);
  const active = bootstrapping.get(name);
  if (active) await active.catch(() => undefined);
  await closeCoreDatabaseConnection(name);
  migrated.delete(name);
  await runWithCoreDatabase(name, async () => {
    await ensureDatabase(name);
    await migrateCoreModules(getCoreDatabase(name));
  });
}

export async function seedCoreTenantDatabase(databaseName: string) {
  const name = resolveCoreDatabaseName(databaseName);
  await runWithCoreDatabase(name, async () => {
    await ensureDatabase(name);
    const database = getCoreDatabase(name);
    await migrateCoreModules(database);
    await seedCoreModules(database);
    migrated.add(name);
  });
}

async function migrateCoreModules(database: Kysely<CoreDatabase>) {
  await runMigrationBatch(database, coreMigrationBatch, { batchSize: 10 });
}

export async function rollbackCoreTenantDatabase(databaseName: string) {
  const name = resolveCoreDatabaseName(databaseName);
  await ensureDatabase(name);
  return rollbackMigrationBatch(getCoreDatabase(name), coreMigrationBatch);
}

async function seedCoreModules(database: Kysely<CoreDatabase>) {
  // Seed dependency order mirrors the schema dependency order: shared lookup
  // records first, tenant organisation defaults second, transactional masters last.
  await seedCommonModule();
  await seedOrganisationModule();
  await seedMasterModule();
  await removeUnknownCountrySeed();
  await seedCoreTenantPermissions(database as unknown as Kysely<unknown>);
}

export async function bootstrapRegisteredCoreDatabases() {
  const databaseNames = await registeredTenantDatabaseNames();
  await Promise.all(databaseNames.map((databaseName) => bootstrapCoreDatabase(databaseName)));
}

export async function closeCoreDatabase() {
  const open = Array.from(connections.values(), (entry) => entry.database);
  connections.clear();
  migrated.clear();
  await Promise.all(open.map((database) => database.destroy()));
}

async function closeCoreDatabaseConnection(name: string) {
  const entry = connections.get(name);
  if (!entry) return;
  connections.delete(name);
  await entry.database.destroy();
}

export async function evictIdleCoreDatabases(now = Date.now()) {
  const idle = Array.from(connections.entries()).filter(
    ([name, entry]) => now - entry.lastUsedAt >= connectionIdleMs && !bootstrapping.has(name)
  );
  for (const [name, entry] of idle) {
    if (connections.get(name) !== entry) continue;
    connections.delete(name);
    await entry.database.destroy();
  }
  return idle.length;
}

async function ensureDatabase(databaseName: string) {
  const options = tenantConnectionOptions.get(databaseName);
  const connection = await createConnection({
    host: options?.host ?? env.DB_HOST,
    password: options?.password ?? env.DB_PASSWORD,
    port: options?.port ?? env.DB_PORT,
    timezone: "Z",
    user: options?.user ?? env.DB_USER
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

type TenantConnectionOptions = {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
};

async function registeredTenantDatabaseNames() {
  const connection = await createConnection({
    database: env.DB_MASTER_NAME,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    timezone: "Z",
    user: env.DB_USER
  });
  try {
    const [rows] = await connection.query(
      "SELECT db_name FROM tenants WHERE db_name IS NOT NULL AND status <> 'deleted'"
    );
    return (rows as Array<{ db_name: string }>).map(({ db_name }) =>
      resolveCoreDatabaseName(db_name)
    );
  } finally {
    await connection.end();
  }
}
