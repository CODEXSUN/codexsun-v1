import { migrateProviderAccountClaims } from "../modules/app-registry/app-registry.account-claims.js";
import { Kysely, MysqlDialect } from "kysely";
import { createPool, type PoolOptions } from "mysql2";
import { createConnection } from "mysql2/promise";
import { existsSync, writeFileSync } from "node:fs";
import {
  applyTablePrefixPolicy,
  ensureStandardTableColumns,
  rollbackTablePrefixPolicy,
  runMigrationBatch,
  type MigrationBatch
} from "@codexsun/framework/db";
import { env } from "../env.js";
import {
  appRegistryMigration,
  migrateAppRegistryModule
} from "../modules/app-registry/app-registry.migration.js";
import { seedAppRegistryModule } from "../modules/app-registry/app-registry.seed.js";
import { migrateTenantDomainModule } from "../modules/tenant-domain/tenant-domain.migration.js";
import {
  migrateTenantRegistryModule,
  tenantMigration
} from "../modules/tenant/tenant.migration.js";
import { migratePlanModule } from "../modules/plan/plan.migration.js";
import { seedPlanModule } from "../modules/plan/plan.seed.js";
import { migrateSubscriptionModule } from "../modules/subscription/subscription.migration.js";
import { seedSubscriptionModule } from "../modules/subscription/subscription.seed.js";
import { migrateIndustryModule } from "../modules/industry/industry.migration.js";
import { seedIndustryModule } from "../modules/industry/industry.seed.js";
import { migrateEntitlementModule } from "../modules/entitlement/entitlement.migration.js";
import { seedEntitlementModule } from "../modules/entitlement/entitlement.seed.js";
import { migrateAccessControlModule } from "../modules/access-control/access-control.migration.js";
import { seedAccessControlModule } from "../modules/access-control/access-control.seed.js";
import { migratePlatformActivityModule } from "../modules/platform-activity/platform-activity.migration.js";
import { seedPlatformActivityModule } from "../modules/platform-activity/platform-activity.seed.js";
import { migrateDatabaseMaintenanceModule } from "../modules/database-maintenance/database-maintenance.migration.js";
import { seedDatabaseMaintenanceModule } from "../modules/database-maintenance/database-maintenance.seed.js";
import { migrateQueueManagerModule } from "../modules/queue-manager/queue-manager.migration.js";
import { seedQueueManagerModule } from "../modules/queue-manager/queue-manager.seed.js";
import { migrateStorageManagerModule } from "../modules/storage-manager/storage-manager.migration.js";
import { seedStorageManagerModule } from "../modules/storage-manager/storage-manager.seed.js";
import { migrateAppOrchestrationModule } from "../modules/app-orchestration/app-orchestration.migration.js";
import { seedAppOrchestrationModule } from "../modules/app-orchestration/app-orchestration.seed.js";
import {
  credentialRecoveryMigration,
  migrateCredentialRecoveryModule
} from "../modules/credential-recovery/credential-recovery.migration.js";
import { seedCredentialRecoveryModule } from "../modules/credential-recovery/credential-recovery.seed.js";
import {
  migrateTaskManagerModule,
  taskManagerMigration,
  taskManagerVisibilityMigration,
  migrateTaskManagerVisibility,
  taskManagerTitleOnlyMigration,
  migrateTaskManagerTitleOnly
} from "../modules/task-manager/task-manager.migration.js";
import { seedTaskManagerModule } from "../modules/task-manager/task-manager.seed.js";
import { assertDatabaseName, quoteIdentifier } from "./database-utils.js";
import type { PlatformDatabase } from "./schema.js";
import { authSessionMigration, migrateAuthSession } from "../auth/auth-session.migration.js";
import {
  authLoginAttemptMigration,
  migrateAuthLoginAttempt
} from "../auth/auth-login-attempt.migration.js";
import { migrateDataMigrationDatabase } from "@codexsun/data-migration-api";
import { migrateDataBridgeDatabase } from "@codexsun/data-bridge-api";
import { createMigrationDatabase } from "./create-migration-database.js";
import { withCoordinatedMigration } from "./migration-coordination.js";
import { migrateZunoDatabase, type ZunoDatabase } from "@codexsun/zuno-api";

let platformDatabase: Kysely<PlatformDatabase> | null = null;
let bootstrapped = false;

const platformMasterMigrationSteps = [
  {
    description: "Provider account ownership routing without tenant credentials.",
    migrate: migrateProviderAccountClaims,
    name: "platform.provider-account-claims.v1"
  },
  {
    description: appRegistryMigration.description,
    migrate: migrateAppRegistryModule,
    name: appRegistryMigration.key
  },
  {
    description: "Platform tenant registry and audit foundation.",
    migrate: migrateTenantRegistryModule,
    name: tenantMigration.key
  },
  {
    description: "Tenant domain registry.",
    migrate: migrateTenantDomainModule,
    name: "platform.tenant-domain.foundation"
  },
  {
    description: authSessionMigration.description,
    migrate: migrateAuthSession,
    name: authSessionMigration.key
  },
  {
    description: authLoginAttemptMigration.description,
    migrate: migrateAuthLoginAttempt,
    name: authLoginAttemptMigration.key
  },
  { description: "Platform plans.", migrate: migratePlanModule, name: "platform.plan.foundation" },
  {
    description: "Tenant subscriptions.",
    migrate: migrateSubscriptionModule,
    name: "platform.subscription.foundation"
  },
  {
    description: "Industry registry.",
    migrate: migrateIndustryModule,
    name: "platform.industry.foundation"
  },
  {
    description: "Plan and tenant entitlements.",
    migrate: migrateEntitlementModule,
    name: "platform.entitlement.foundation"
  },
  {
    description: "Super Admin access control.",
    migrate: migrateAccessControlModule,
    name: "platform.access-control.foundation"
  },
  {
    description: "Platform activity history.",
    migrate: migratePlatformActivityModule,
    name: "platform.activity.foundation"
  },
  {
    description: "Database maintenance run lifecycle.",
    migrate: migrateDatabaseMaintenanceModule,
    name: "platform.database-maintenance.foundation"
  },
  {
    description: "Database-backed queue jobs.",
    migrate: migrateQueueManagerModule,
    name: "platform.queue-manager.foundation"
  },
  {
    description: credentialRecoveryMigration.description,
    migrate: migrateCredentialRecoveryModule,
    name: credentialRecoveryMigration.key
  },
  {
    description: "Storage objects and tenant storage roots.",
    migrate: migrateStorageManagerModule,
    name: "platform.storage-manager.foundation"
  },
  {
    description: taskManagerMigration.description,
    migrate: migrateTaskManagerModule,
    name: taskManagerMigration.key
  },
  {
    description: taskManagerVisibilityMigration.description,
    migrate: migrateTaskManagerVisibility,
    name: taskManagerVisibilityMigration.key
  },
  {
    description: taskManagerTitleOnlyMigration.description,
    migrate: migrateTaskManagerTitleOnly,
    name: taskManagerTitleOnlyMigration.key
  },
  {
    description: "Application orchestration process-local state policy.",
    migrate: async (_database: Kysely<PlatformDatabase>) => migrateAppOrchestrationModule(),
    name: "platform.app-orchestration.runtime-policy"
  }
] as const;

const platformTableNames = [
  "access_permissions",
  "access_roles",
  "access_users",
  "auth_sessions",
  "database_maintenance_runs",
  "entitlements",
  "industries",
  "password_reset_requests",
  "plans",
  "platform_activity",
  "platform_apps",
  "platform_auth_users",
  "queue_jobs",
  "queue_runtime_settings",
  "storage_objects",
  "subscriptions",
  "tenant_audit_events",
  "tenant_domains",
  "tenants"
] as const;

const platformPrefixPolicy = { include: platformTableNames, prefix: "app_" } as const;

export const platformMigrationBatch: MigrationBatch<PlatformDatabase> = {
  batch: 1,
  description: "Platform module-owned schema baseline through release 1.0.43.",
  scope: "platform",
  version: "1.0.43",
  steps: [
    {
      acceptedAppliedChecksums: [
        "ae0112ed9cca6070fe163bfbbcd71f9504a97552856fbe175fb57b3af1169e04",
        "53226db63b83aa898cabad04845721700f9c2aff8cb3596a999c24b1174dc75e"
      ],
      checksum: platformTableNames.join(","),
      description: "Rename legacy Platform tables without copying or dropping data.",
      down: (database) =>
        rollbackTablePrefixPolicy(database, platformPrefixPolicy).then(() => undefined),
      name: "platform.table-prefix-v1",
      up: (database) =>
        applyTablePrefixPolicy(database, platformPrefixPolicy).then(() => undefined),
      version: 1
    },
    ...platformMasterMigrationSteps.map(({ description, migrate, name }) => ({
      checksum: `${name}:v1`,
      description,
      name,
      up: migrate,
      version: 1
    })),
    {
      acceptedAppliedChecksums: [
        "8a2b38d131c32d89e4cfa300e531587910a2d529e8b217d0834a867cd41665cb",
        "c39109aacefaafdeeb45e30e8ae137d0fa0a649050e19f6fa638f01d056fbd96"
      ],
      checksum: `standard-columns:${platformTableNames.join(",")}`,
      description: "Backfill and validate standard Platform table identity and audit columns.",
      name: "platform.standard-columns-v1",
      up: (database) => ensureStandardTableColumns(database, platformTableNames),
      version: 1
    },
    {
      acceptedAppliedChecksums: [
        "0df884b26ba11151b06c2ad982af3701f0776f20b98fcc1657d5fec062b33f1b",
        "683cfbf4c13d34dd1c9df3665a446ddda90afb8bb991569d390c72494db41ea8"
      ],
      checksum: `uuid-defaults:${platformTableNames.join(",")}`,
      description: "Add database-generated UUID defaults for repeatable Platform writes.",
      name: "platform.uuid-defaults-v2",
      up: (database) => ensureStandardTableColumns(database, platformTableNames),
      version: 2
    },
    {
      checksum: `master-unprefix:${platformTableNames.join(",")}`,
      description:
        "Restore unprefixed Platform master tables without copying or dropping existing data.",
      down: (database) =>
        applyTablePrefixPolicy(database, platformPrefixPolicy).then(() => undefined),
      name: "platform.master-unprefix-v3",
      up: (database) =>
        rollbackTablePrefixPolicy(database, platformPrefixPolicy).then(() => undefined),
      version: 3
    }
  ]
};

export const platformMasterMigrationOrder = platformMasterMigrationSteps.map(({ name }) => name);

const platformMasterSeedSteps = [
  { name: "platform.app-registry", seed: seedAppRegistryModule },
  { name: "platform.plan", seed: seedPlanModule },
  { name: "platform.subscription", seed: seedSubscriptionModule },
  { name: "platform.industry", seed: seedIndustryModule },
  { name: "platform.entitlement", seed: seedEntitlementModule },
  { name: "platform.access-control", seed: seedAccessControlModule },
  { name: "platform.activity", seed: seedPlatformActivityModule },
  { name: "platform.database-maintenance", seed: seedDatabaseMaintenanceModule },
  { name: "platform.queue-manager", seed: seedQueueManagerModule },
  { name: "platform.credential-recovery", seed: seedCredentialRecoveryModule },
  { name: "platform.storage-manager", seed: seedStorageManagerModule },
  {
    name: "platform.task-manager",
    seed: seedTaskManagerModule
  },
  {
    name: "platform.app-orchestration",
    seed: async (_database: Kysely<PlatformDatabase>) => seedAppOrchestrationModule()
  }
] as const;

export const platformMasterSeedOrder = platformMasterSeedSteps.map(({ name }) => name);

export function platformDatabaseConfig() {
  return {
    database: platformDatabaseName(),
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    user: env.DB_USER
  };
}

export function platformDatabaseName() {
  return assertDatabaseName(env.DB_MASTER_NAME, "master database name");
}

export function getPlatformDatabase() {
  if (!platformDatabase) {
    platformDatabase = new Kysely<PlatformDatabase>({
      dialect: new MysqlDialect({
        pool: createPool({
          ...platformDatabaseConfig(),
          connectionLimit: 10,
          timezone: "Z"
        } satisfies PoolOptions)
      })
    });
  }

  return platformDatabase;
}

export async function bootstrapPlatformDatabase() {
  if (bootstrapped || process.env.CODEXSUN_DEV_SKIP_DB === "1") return bootstrapPlatformDatabaseLocked();
  return withCoordinatedMigration(bootstrapPlatformDatabaseLocked);
}

async function bootstrapPlatformDatabaseLocked() {
  if (bootstrapped || process.env.CODEXSUN_DEV_SKIP_DB === "1") {
    if (process.env.CODEXSUN_DEV_SKIP_DB === "1") {
      console.info("[database] bootstrap skipped because CODEXSUN_DEV_SKIP_DB=1");
    }
    return;
  }

  if (env.CODEXSUN_DB_FRESH_ON_START === "1") {
    const sessionFile = process.env.CODEXSUN_DB_FRESH_SESSION_FILE;
    if (!sessionFile || !existsSync(sessionFile)) {
      console.info("[database] fresh startup requested");
      await resetPlatformDatabases();
      if (sessionFile) writeFileSync(sessionFile, new Date().toISOString(), "utf8");
      return;
    }
    console.info("[database] fresh startup already completed for this dev session");
  }

  console.info("[database] bootstrap started");
  await migratePlatformDatabase();
  await seedPlatformDatabase();
  bootstrapped = true;
  console.info(`[database] bootstrap completed for master database "${platformDatabaseName()}"`);
}

export async function closePlatformDatabase() {
  if (platformDatabase) {
    await platformDatabase.destroy();
    platformDatabase = null;
  }
  bootstrapped = false;
}

export async function createMasterDatabase(verifyBackup?: () => Promise<void>) {
  const databaseName = platformDatabaseName();
  console.info(
    `[database] ensuring master database "${databaseName}" on ${env.DB_HOST}:${env.DB_PORT}`
  );
  const connection = await createConnection({
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    user: env.DB_USER,
    timezone: "Z"
  });
  try {
    await createMigrationDatabase(connection, databaseName, async () => {
      if (env.NODE_ENV !== "production") return;
      if (verifyBackup) await verifyBackup();
      else {
        const { verifyMasterMigrationBackup } = await import("../modules/database-maintenance/database-maintenance.migration-backup.js");
        await verifyMasterMigrationBackup();
      }
    });
    console.info(`[database] master database ready: "${databaseName}"`);
  } finally {
    await connection.end();
  }
}

export async function migratePlatformDatabase(verifyBackup?: () => Promise<void>) {
  return withCoordinatedMigration(() => migratePlatformDatabaseLocked(verifyBackup));
}

async function migratePlatformDatabaseLocked(verifyBackup?: () => Promise<void>) {
  console.info(`[database] migrating platform database "${platformDatabaseName()}"`);
  await createMasterDatabase(verifyBackup);
  const database = getPlatformDatabase();
  const result = await runMigrationBatch(database, platformMigrationBatch, { batchSize: 8 });
  await migrateDataMigrationDatabase(database as unknown as Kysely<unknown>);
  await migrateDataBridgeDatabase(database as unknown as Kysely<unknown>);
  await migrateZunoDatabase(database as unknown as Kysely<ZunoDatabase>);
  console.info(
    `[database] platform migration batch ${result.batch}: ${result.applied.length} applied, ${result.skipped.length} checksum-validated`
  );
}

export async function rollbackPlatformDatabase() {
  throw new Error(
    "Platform rollback is unavailable until all release scopes have a verified safe reverse plan."
  );
}

export async function seedPlatformDatabase() {
  const database = getPlatformDatabase();
  for (const step of platformMasterSeedSteps) {
    await step.seed(database);
    console.info(`[seeder] platform module seeded: ${step.name}`);
  }
}

export async function resetPlatformDatabases() {
  return withCoordinatedMigration(resetPlatformDatabasesLocked);
}

async function resetPlatformDatabasesLocked() {
  assertDestructiveDatabaseAction("fresh database startup");
  console.warn(`
DATABASE WARNING
Fresh database mode is enabled. CODEXSUN will drop configured tenant databases and the master database, then recreate and seed them.
`);
  await dropPlatformDatabases();
  await migratePlatformDatabase();
  await seedPlatformDatabase();
  bootstrapped = true;
}

export async function dropPlatformDatabases() {
  assertDestructiveDatabaseAction("drop database");
  await closePlatformDatabase();

  const connection = await createConnection({
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    user: env.DB_USER,
    timezone: "Z"
  });

  try {
    const masterName = platformDatabaseName();
    const tenantDatabaseNames = await listTenantDatabaseNames(connection, masterName);
    for (const tenantDatabaseName of tenantDatabaseNames) {
      if (tenantDatabaseName === masterName) {
        continue;
      }
      console.warn(`[database] dropping tenant database "${tenantDatabaseName}"`);
      await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(tenantDatabaseName)}`);
    }

    console.warn(`[database] dropping master database "${masterName}"`);
    await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(masterName)}`);
  } finally {
    await connection.end();
  }

  bootstrapped = false;
}

function assertDestructiveDatabaseAction(action: string) {
  if (env.CODEXSUN_DB_RESET_CONFIRM !== "DROP_DATABASES") {
    throw new Error(
      `${action} refused. Set CODEXSUN_DB_RESET_CONFIRM=DROP_DATABASES only when you intentionally want to delete configured databases.`
    );
  }

  if (env.NODE_ENV === "production" && env.CODEXSUN_ALLOW_PRODUCTION_DB_RESET !== "1") {
    throw new Error(
      `${action} refused in production. Set CODEXSUN_ALLOW_PRODUCTION_DB_RESET=1 and CODEXSUN_DB_RESET_CONFIRM=DROP_DATABASES to continue.`
    );
  }
}

async function listTenantDatabaseNames(
  connection: Awaited<ReturnType<typeof createConnection>>,
  masterName: string
) {
  const [databases] = await connection.query(`SHOW DATABASES LIKE ?`, [masterName]);
  if (!Array.isArray(databases) || databases.length === 0) {
    return [];
  }

  let rows: unknown;
  try {
    [rows] = await connection.query(`SELECT db_name FROM ${quoteIdentifier(masterName)}.tenants`);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) {
    return [];
  }

  const names = new Set<string>();
  for (const row of rows as Array<{ db_name?: unknown }>) {
    if (typeof row.db_name === "string" && row.db_name.trim()) {
      names.add(assertDatabaseName(row.db_name.trim(), "tenant database name"));
    }
  }

  return Array.from(names);
}
