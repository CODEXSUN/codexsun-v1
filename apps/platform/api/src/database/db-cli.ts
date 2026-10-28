import {
  crmPermissionTargets,
  existingTenantMigrationTargets,
} from "./migration-targets.js";
import { createConnection } from "mysql2/promise";
import { closeAllBillingDatabases } from "@codexsun/billing-api";
import { closeAllAccountsDatabases } from "@codexsun/accounts-api";
import { closeCoreDatabase } from "@codexsun/core-api";
import {
  closePlatformDatabase,
  dropPlatformDatabases,
  migratePlatformDatabase,
  platformDatabaseName,
  resetPlatformDatabases,
  seedPlatformDatabase,
} from "./platform-database.js";
import { TenantRepository } from "../modules/tenant/tenant.repository.js";
import {
  migrateTenantDatabase,
  seedDefaultTenant,
  seedTenantDatabase,
  syncTenantCrmPermissions,
} from "../modules/tenant/tenant.seed.js";
import { env } from "../env.js";
import { assertDatabaseName, quoteIdentifier } from "./database-utils.js";
import {
  verifyMigrationBackups,
  type MigrationBackupVerifier,
} from "../modules/database-maintenance/database-maintenance.migration-backup.js";
import { isolatedCliBackupVerifier } from "./isolated-backup-cli.js";
import { isolatedEvidenceRequested } from "./isolated-backup-options.js";
import { createMasterStartupProof } from "./master-startup-proof.js";
import { withCoordinatedMigration } from "./migration-coordination.js";
import {
  assertDistinctRollbackTargets,
  inspectRollbackLedger,
  type RollbackTargetIdentity,
} from "./rollback-assessment.js";
import { resolveTenantDatabasePassword } from "./tenant-database.js";

type DbCommand =
  | "migrate"
  | "seed"
  | "crm:permissions:sync"
  | "drop"
  | "fresh"
  | "migrations:list"
  | "migrations:preflight"
  | "migrations:run"
  | "migrations:rollback"
  | "migrations:test-local"
  | "dump:create"
  | "dump:download"
  | "restore:test"
  | "backup:verify"
  | "master:startup-proof";

const validCommands: DbCommand[] = [
  "migrate",
  "seed",
  "crm:permissions:sync",
  "drop",
  "fresh",
  "migrations:list",
  "migrations:preflight",
  "migrations:run",
  "migrations:rollback",
  "migrations:test-local",
  "dump:create",
  "dump:download",
  "restore:test",
  "backup:verify",
  "master:startup-proof",
];

const command = process.argv[2] as DbCommand | undefined;

async function main() {
  if (!command || !validCommands.includes(command)) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const isolated = isolatedEvidenceRequested(command, env.NODE_ENV, process.argv.slice(3));
  const verifier = isolated ? isolatedCliBackupVerifier() : undefined;

  try {
    console.info(`[database] db:${command} started`);
    if (command === "migrate") {
      await migrateAll(env.NODE_ENV === "production");
    }

    if (command === "seed") {
      await seedAll(verifier);
    }

    if (command === "crm:permissions:sync") {
      await syncExistingCrmPermissions();
    }

    if (command === "drop") {
      warnDestructive("Dropping master and tenant databases");
      await dropPlatformDatabases();
    }

    if (command === "fresh") {
      warnDestructive("Dropping and rebuilding master and tenant databases");
      await resetPlatformDatabases();
      await seedDefaultTenant();
    }

    if (command === "migrations:list") {
      await listMigrationState();
    }

    if (command === "migrations:preflight") {
      await runMigrationPreflight(verifier);
    }

    if (command === "migrations:run") {
      await migrateAll(true, verifier);
    }

    if (command === "migrations:rollback") {
      await rollbackAll();
    }

    if (command === "migrations:test-local") {
      await runLocalMigrationTest();
    }

    if (command === "dump:create" || command === "dump:download") {
      printExternalToolingRequired(command);
    }

    if (command === "restore:test") {
      await runRestoreTest();
    }

    if (command === "backup:verify") {
      await runBackupVerify();
    }
    if (command === "master:startup-proof") {
      await createMasterStartupProof();
    }

    console.log(`ok db:${command} completed`);
  } finally {
    await Promise.all([
      closeAllAccountsDatabases(),
      closeAllBillingDatabases(),
      closeCoreDatabase(),
      closePlatformDatabase(),
    ]);
  }
}

async function migrateAll(preflight = false, verifier?: MigrationBackupVerifier) {
  await withCoordinatedMigration(async () => {
    if (preflight) await runMigrationPreflight(verifier);
    console.info("[database] running master and tenant migrations");
    await migratePlatformDatabase(verifier?.master);
    await migrateTenantAppDatabases(verifier);
  });
}

async function rollbackAll() {
  if (
    env.NODE_ENV === "production" &&
    process.env.CODEXSUN_MIGRATION_ROLLBACK_CONFIRM !== "ROLLBACK"
  ) {
    throw new Error(
      "production rollback refused. Set CODEXSUN_MIGRATION_ROLLBACK_CONFIRM=ROLLBACK after verifying the backup and rollback plan.",
    );
  }
  await withCoordinatedMigration(async () => {
    await runMigrationPreflight();
    await assessRollbackTargets();
    throw new Error(
      "Release-wide rollback is unavailable: the release manifest and verified safe reverse plan are incomplete. Restore verified backups or prepare corrective forward migrations.",
    );
  });
}

async function assessRollbackTargets() {
  const tenants = await existingUpgradeTargets();
  const targets = [
    {
      label: "platform",
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: platformDatabaseName(),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    ...tenants.map((tenant) => ({
      label: `tenant ${tenant.tenantCode}`,
      host: tenant.dbHost || env.DB_HOST,
      port: tenant.dbPort || env.DB_PORT,
      database: tenant.dbName,
      user: tenant.dbUser || env.DB_USER,
      password: resolveTenantDatabasePassword(tenant),
    })),
  ];
  assertDistinctRollbackTargets(targets);
  const resolved: RollbackTargetIdentity[] = [];
  for (const target of targets) {
    const connection = await createConnection({
      host: target.host,
      port: target.port,
      user: target.user,
      password: target.password,
      database: target.database,
      timezone: "Z",
    });
    try {
      const [rows] = await connection.query<
        import("mysql2/promise").RowDataPacket[]
      >(
        "SELECT @@hostname AS serverHost, @@port AS serverPort, DATABASE() AS schemaName",
      );
      const identity = rows[0];
      if (
        !identity ||
        typeof identity.serverHost !== "string" ||
        typeof identity.schemaName !== "string" ||
        identity.schemaName.toLowerCase() !== target.database.toLowerCase()
      ) {
        throw new Error(
          `Rollback assessment cannot verify database identity for ${target.label}.`,
        );
      }
      resolved.push({
        label: target.label,
        host: identity.serverHost,
        port: Number(identity.serverPort),
        database: identity.schemaName,
      });
      const assessment = await inspectRollbackLedger(target.label, connection);
      console.info(
        `[database] rollback assessment ${assessment.target}: ${assessment.applied} applied, ${assessment.incomplete} incomplete`,
      );
      for (const scope of assessment.byScope) {
        console.info(
          `[database]   ${scope.scope}: ${scope.applied} applied, ${scope.incomplete} incomplete`,
        );
      }
    } finally {
      await connection.end();
    }
  }
  assertDistinctRollbackTargets(resolved);
}

async function seedAll(verifier?: MigrationBackupVerifier) {
  await withCoordinatedMigration(async () => {
    if (env.NODE_ENV === "production") await runMigrationPreflight(verifier);
    console.info("[seeder] running master and tenant seeders");
    await migratePlatformDatabase(verifier?.master);
    await seedPlatformDatabase();
    const defaultTenant = await seedDefaultTenant();
    await seedTenantAppDatabases(defaultTenant?.id, verifier);
  });
}

async function migrateTenantAppDatabases(verifier?: MigrationBackupVerifier) {
  const tenants = await existingUpgradeTargets();
  console.info(`[database] tenant app migration targets: ${tenants.length}`);
  for (const tenant of tenants) {
    console.info(
      `[database] migrating tenant app modules for "${tenant.tenantCode}" (${tenant.dbName})`,
    );
    await migrateTenantDatabase(tenant, verifier?.tenant);
  }
}

async function seedTenantAppDatabases(alreadySeededTenantId?: number, verifier?: MigrationBackupVerifier) {
  const tenants = await existingUpgradeTargets();
  console.info(`[seeder] tenant app seed targets: ${tenants.length}`);
  for (const tenant of tenants) {
    if (tenant.id === alreadySeededTenantId) continue;
    console.info(
      `[seeder] seeding tenant app modules for "${tenant.tenantCode}" (${tenant.dbName})`,
    );
    await seedTenantDatabase(tenant, verifier?.tenant);
  }
}

async function syncExistingCrmPermissions() {
  const tenants = crmPermissionTargets(await new TenantRepository().list());
  console.info(`[database] CRM permission targets: ${tenants.length}`);
  for (const tenant of tenants) {
    console.info(
      `[database] syncing CRM permissions for "${tenant.tenantCode}"`,
    );
    await syncTenantCrmPermissions(tenant);
  }
}

async function existingUpgradeTargets() {
  return existingTenantMigrationTargets(await new TenantRepository().list(), async (tenant) => {
    const connection = await createConnection({
      database: tenant.dbName,
      host: tenant.dbHost || env.DB_HOST,
      port: tenant.dbPort || env.DB_PORT,
      user: tenant.dbUser || env.DB_USER,
      password: resolveTenantDatabasePassword(tenant),
      timezone: "Z",
    });
    await connection.end();
  });
}

async function listMigrationState() {
  const masterName = platformDatabaseName();
  console.info(
    `[database] migration state for platform database "${masterName}"`,
  );
  const connection = await createConnection({
    database: masterName,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    user: env.DB_USER,
    timezone: "Z",
  });

  try {
    const [platformRows] = await connection.query(
      "SELECT scope,batch,version,name,checksum,status,applied_at,rolled_back_at FROM migration_schema ORDER BY batch,id",
    );
    console.table(platformRows);
  } catch (error) {
    console.warn(
      `[database] platform migration table is not readable yet: ${formatError(error)}`,
    );
  } finally {
    await connection.end();
  }

  const tenants = await existingUpgradeTargets();
  console.info(`[database] tenant migration targets: ${tenants.length}`);
  for (const tenant of tenants) {
    const tenantConnection = await createConnection({
      database: tenant.dbName,
      host: tenant.dbHost || env.DB_HOST,
      password: env.DB_PASSWORD,
      port: tenant.dbPort || env.DB_PORT,
      user: tenant.dbUser || env.DB_USER,
      timezone: "Z",
    });
    try {
      const [tenantRows] = await tenantConnection.query(
        "SELECT scope,batch,version,name,checksum,status,applied_at,rolled_back_at FROM migration_schema ORDER BY scope,batch,id",
      );
      console.info(
        `[database] tenant "${tenant.tenantCode}" (${tenant.dbName})`,
      );
      console.table(tenantRows);
    } catch (error) {
      console.warn(
        `[database] tenant "${tenant.tenantCode}" migration table is not readable yet: ${formatError(error)}`,
      );
    } finally {
      await tenantConnection.end();
    }
  }
}

async function runMigrationPreflight(verifier?: MigrationBackupVerifier) {
  const masterName = platformDatabaseName();
  console.info(
    `[database] preflight target: ${env.NODE_ENV} ${env.DB_HOST}:${env.DB_PORT}/${masterName}`,
  );
  assertDatabaseName(masterName, "master database name");

  const tenants = await existingUpgradeTargets();
  for (const tenant of tenants) {
    assertDatabaseName(
      tenant.dbName,
      `tenant database name for ${tenant.tenantCode}`,
    );
  }

  if (env.NODE_ENV === "production") await verifyMigrationBackups(tenants, verifier);

  console.info(
    `[database] preflight checked ${tenants.length} tenant database target(s)`,
  );
}

async function runLocalMigrationTest() {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "local restored-dump migration test refused in production.",
    );
  }

  if (process.env.CODEXSUN_RESTORED_DUMP_TEST !== "1") {
    throw new Error(
      "local migration test requires CODEXSUN_RESTORED_DUMP_TEST=1 after restoring a dump into the configured local databases.",
    );
  }

  await runMigrationPreflight();
  await migrateAll();
  console.info(
    "[database] local restored-dump migration test completed. Run affected app/API tests before promoting the migration.",
  );
}

async function runRestoreTest() {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "restore test refused in production. Restore into a sandbox environment first.",
    );
  }

  const restoreDatabaseName = process.env.CODEXSUN_RESTORE_TEST_DB_NAME;
  if (!restoreDatabaseName) {
    throw new Error(
      "restore test requires CODEXSUN_RESTORE_TEST_DB_NAME set to an explicit sandbox database name.",
    );
  }

  const sandboxName = assertDatabaseName(
    restoreDatabaseName,
    "restore test database name",
  );
  if (sandboxName === platformDatabaseName()) {
    throw new Error(
      "restore test database must not be the configured platform master database.",
    );
  }

  const connection = await createConnection({
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    user: env.DB_USER,
    timezone: "Z",
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(sandboxName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    const [rows] = await connection.query(
      `SHOW TABLES FROM ${quoteIdentifier(sandboxName)}`,
    );
    console.info(
      `[database] restore-test sandbox "${sandboxName}" is reachable with ${Array.isArray(rows) ? rows.length : 0} table(s)`,
    );
  } finally {
    await connection.end();
  }
}

async function runBackupVerify() {
  const backupId = process.env.CODEXSUN_BACKUP_VERIFY_ID;
  if (!backupId) {
    throw new Error(
      "backup verification requires CODEXSUN_BACKUP_VERIFY_ID set to the backup artifact/run id being verified.",
    );
  }
  console.info(
    `[database] backup verification marker accepted for "${backupId}". Run db:restore:test against its sandbox restore before marking it verified.`,
  );
}

function printExternalToolingRequired(
  commandName: "dump:create" | "dump:download",
) {
  console.info(
    `[database] ${commandName} is reserved as the stable CODEXSUN operator command.`,
  );
  console.info(
    "[database] Wire this command to the deployment provider dump/export tool before production use; every dump must be permission-checked and audited.",
  );
}

function warnDestructive(message: string) {
  console.warn(`
DATABASE WARNING
${message}.

This deletes configured database data. Required guards:
  CODEXSUN_DB_RESET_CONFIRM=DROP_DATABASES
  CODEXSUN_ALLOW_PRODUCTION_DB_RESET=1 when NODE_ENV=production
`);
}

function printHelp() {
  console.log(`
CODEXSUN database CLI

Usage:
  tsx src/database/db-cli.ts migrate
  tsx src/database/db-cli.ts seed
  tsx src/database/db-cli.ts crm:permissions:sync
  tsx src/database/db-cli.ts drop
  tsx src/database/db-cli.ts fresh
  tsx src/database/db-cli.ts migrations:list
  tsx src/database/db-cli.ts migrations:preflight
  tsx src/database/db-cli.ts migrations:run
  tsx src/database/db-cli.ts migrations:rollback
  tsx src/database/db-cli.ts migrations:test-local
  tsx src/database/db-cli.ts dump:create
  tsx src/database/db-cli.ts dump:download
  tsx src/database/db-cli.ts restore:test
  tsx src/database/db-cli.ts backup:verify

Root npm commands:
  npm run db:migrate
  npm run db:seed
  npm run db:drop
  npm run dbmigrate:fresh
  npm run db:migrations:list
  npm run db:migrations:preflight
  npm run db:migrations:run
  npm run db:migrations:rollback
  npm run db:migrations:test-local
  npm run db:dump:create
  npm run db:dump:download
  npm run db:restore:test
  npm run db:backup:verify
`);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

await main();
