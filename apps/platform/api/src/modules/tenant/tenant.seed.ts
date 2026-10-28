import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { getPlatformDatabase } from "../../database/platform-database.js";
import {
  createTenantDatabase,
  getTenantDatabase,
  closeTenantDatabase
} from "../../database/tenant-database.js";
import type { TenantDatabase } from "../../database/schema.js";
import { env } from "../../env.js";
import { syncCrmTenantPermissions } from "@codexsun/crm-api";
import {
  migrateSelectedTenantApps,
  seedSelectedTenantApps
} from "../../database/tenant-app-database.js";
import { migrateTenantRuntimeModule } from "./tenant.migration.js";
import { TenantRepository } from "./tenant.repository.js";
import { normalizeTenantDomain } from "../tenant-domain/tenant-domain.repository.js";
import { EntitlementAccessService } from "../entitlement/entitlement.access.js";
import { defaultTenantModuleKeys, platformAppRegistry } from "../app-registry/index.js";
import {
  ensureTenantStorage,
  tenantPrivateStorageRoot,
  tenantPublicStorageRoot,
  tenantStorageRoot
} from "../storage-manager/storage-manager.paths.js";
import type { Tenant, TenantSavePayload } from "./tenant.types.js";
import { seedTenantPermissionModule } from "../tenant-permission/index.js";
import { seedTenantRolePermissionModule } from "../tenant-role-permission/index.js";
import { seedTenantRoleModule } from "../tenant-role/index.js";
import { seedTenantUserRoleModule } from "../tenant-user-role/index.js";
import { seedTenantUserModule } from "../tenant-user/index.js";
import { withCoordinatedMigration } from "../../database/migration-coordination.js";

export const tenantSeed = {
  records: []
} as const;

export async function provisionTenantDatabase(tenant: Tenant) {
  return withCoordinatedMigration(() => provisionTenantDatabaseLocked(tenant));
}

async function provisionTenantDatabaseLocked(tenant: Tenant) {
  console.info(
    `[database] provisioning tenant database "${tenant.dbName}" for tenant "${tenant.tenantCode}"`
  );
  await createTenantDatabase(tenant);
  const database = getTenantDatabase(tenant);
  try {
    await migrateTenantRuntimeModule(database);
    const migrated = await migrateSelectedTenantApps(database, tenant);
    await seedTenantRuntimeModule(database, tenant);
    const seeded = await seedSelectedTenantApps(database, tenant);
    await seedTenantRolePermissionModule(database);
    console.info(`[database] tenant database provisioned: "${tenant.dbName}"`);
    return { ...migrated, ...seeded };
  } finally {
    await closeTenantDatabase(tenant);
  }
}

export async function migrateTenantDatabase(tenant: Tenant) {
  return withCoordinatedMigration(() => migrateTenantDatabaseLocked(tenant));
}

async function migrateTenantDatabaseLocked(tenant: Tenant) {
  await createTenantDatabase(tenant);
  const database = getTenantDatabase(tenant);
  try {
    await migrateTenantRuntimeModule(database);
    return await migrateSelectedTenantApps(database, tenant);
  } finally {
    await closeTenantDatabase(tenant);
  }
}

export async function seedTenantDatabase(tenant: Tenant) {
  return withCoordinatedMigration(() => seedTenantDatabaseLocked(tenant));
}

async function seedTenantDatabaseLocked(tenant: Tenant) {
  await createTenantDatabase(tenant);
  const database = getTenantDatabase(tenant);
  try {
    await migrateTenantRuntimeModule(database);
    await migrateSelectedTenantApps(database, tenant);
    await seedTenantRuntimeModule(database, tenant);
    const seeded = await seedSelectedTenantApps(database, tenant);
    await seedTenantRolePermissionModule(database);
    return seeded;
  } finally {
    await closeTenantDatabase(tenant);
  }
}

export async function syncTenantCrmPermissions(tenant: Tenant) {
  const database = getTenantDatabase(tenant);
  try {
    await syncCrmTenantPermissions(database as never);
  } finally {
    await closeTenantDatabase(tenant);
  }
}

export async function rollbackTenantDatabase(_tenant: Tenant) {
  throw new Error(
    "Tenant rollback is unavailable until all release scopes have a verified safe reverse plan."
  );
}

export async function provisionTenantStorage(tenant: Tenant) {
  const roots = await ensureTenantStorage(tenant.slug || tenant.tenantCode);
  await getPlatformDatabase()
    .updateTable("tenants")
    .set({
      storage_private_root: sql`CASE WHEN storage_private_root = '' THEN ${roots.privateRoot} ELSE storage_private_root END`,
      storage_public_root: sql`CASE WHEN storage_public_root = '' THEN ${roots.publicRoot} ELSE storage_public_root END`,
      storage_root: sql`CASE WHEN storage_root = '' THEN ${roots.root} ELSE storage_root END`
    })
    .where("id", "=", tenant.id)
    .execute();
  return roots;
}

export async function seedDefaultTenant() {
  if (env.ENABLE_DEFAULT_TENANT_SEED !== "1") {
    console.info(
      "[seeder] default tenant seed skipped because ENABLE_DEFAULT_TENANT_SEED is not 1"
    );
    return null;
  }

  const input = defaultTenant();
  console.info(`[seeder] default tenant seed started for "${input.tenantCode}"`);
  const repository = new TenantRepository();
  const existing = await repository.findByIdOrCode(input.tenantCode);
  const reconciledTenant = existing
    ? await reconcileDefaultTenantModules(repository, existing)
    : await repository.create(input);
  if (!reconciledTenant) {
    throw new Error("Default tenant seed failed.");
  }
  const tenant = {
    ...reconciledTenant,
    primaryDomain: await repository.ensurePrimaryDomain(
      reconciledTenant.id,
      input.primaryDomain ?? defaultTenantDomain()
    )
  };
  console.info(
    `[seeder] default tenant ${existing ? "configuration preserved" : "created"}: ${tenant.tenantCode}`
  );
  console.info(`[seeder] default tenant domain ready: ${tenant.primaryDomain}`);

  await seedDefaultTenantSubscription(tenant);
  const accessTenant = await new EntitlementAccessService().refreshTenantAccess(tenant.id);
  await provisionTenantStorage(accessTenant ?? tenant);
  await provisionTenantDatabase(accessTenant ?? tenant);
  console.info(`[seeder] default tenant seed completed for "${tenant.tenantCode}"`);
  return accessTenant ?? tenant;
}

export async function seedTenantRuntimeModule(database: Kysely<TenantDatabase>, tenant: Tenant) {
  const enabledKeys = new Set(
    ["platform.application", ...tenant.enabledModuleKeys]
      .map((key) => (key === "accounts.accounting" ? "accounts.overview" : key))
      .filter(
        (key) => key !== "devkit" && key !== "project-manager"
      )
  );
  const moduleKeys = Array.from(
    new Set([...platformAppRegistry.map(({ moduleKey }) => moduleKey), ...enabledKeys])
  ).filter((key) => key !== "devkit" && key !== "project-manager");
  console.info(
    `[seeder] seeding tenant "${tenant.tenantCode}" app modules (${moduleKeys.length} modules)`
  );

  await database
    .updateTable("app_module_settings")
    .set({ enabled: false, status: "inactive", updated_at: sql`CURRENT_TIMESTAMP` })
    .where("module_key", "=", "devkit")
    .execute();
  await database
    .updateTable("app_module_settings")
    .set({ enabled: false, status: "inactive", updated_at: sql`CURRENT_TIMESTAMP` })
    .where("module_key", "=", "project-manager")
    .execute();
  await database
    .updateTable("app_module_settings")
    .set({ enabled: false, status: "inactive", updated_at: sql`CURRENT_TIMESTAMP` })
    .where("module_key", "=", "accounts.accounting")
    .execute();

  for (const moduleKey of moduleKeys) {
    const enabled = enabledKeys.has(moduleKey);
    const settingsJson = JSON.stringify({
      defaultLandingApp: tenant.defaultLandingApp,
      tenantCode: tenant.tenantCode
    });

    await database
      .insertInto("app_module_settings")
      .values({
        enabled,
        module_key: moduleKey,
        settings_json: settingsJson,
        status: enabled ? "active" : "inactive",
        uuid: stableUuid(`${tenant.uuid}:${moduleKey}`)
      })
      .onDuplicateKeyUpdate({
        enabled,
        status: enabled ? "active" : "inactive",
        updated_at: sql`CURRENT_TIMESTAMP`
      })
      .execute();
    console.info(`[seeder] tenant app module ready: ${moduleKey}`);
  }

  await seedTenantRoleModule(database);
  await seedTenantPermissionModule(database);
  await seedTenantUserModule(database);
  await seedTenantUserRoleModule(database);
  await seedTenantRolePermissionModule(database);
  console.info(`[seeder] tenant runtime seed completed for "${tenant.tenantCode}"`);
}

function defaultTenant(): TenantSavePayload {
  const tenantCode = requiredSeedValue("DEFAULT_TENANT_CORPORATE_ID").toUpperCase();
  const slug = normalizeSlug(requiredSeedValue("DEFAULT_TENANT_SLUG"));
  const moduleKeys = defaultSeedModuleKeys();
  return {
    corporateId: tenantCode,
    dbHost: env.DB_HOST,
    dbName: requiredSeedValue("DEFAULT_TENANT_DB_NAME"),
    dbPort: env.DB_PORT,
    dbSecretRef: "DB_PASSWORD",
    dbType: env.DB_DRIVER,
    dbUser: env.DB_USER,
    defaultLandingApp: "application",
    enabledModuleKeys: moduleKeys,
    mobile: null,
    payloadSettings: {
      apps: {
        enabled: moduleKeys
      },
      landing: {
        app: "application",
        mode: "tenant"
      },
      seed: {
        source: "default-tenant",
        tenantCode
      }
    },
    primaryDomain: defaultTenantDomain(),
    slug,
    status: "active",
    storagePrivateRoot: tenantPrivateStorageRoot(slug),
    storagePublicRoot: tenantPublicStorageRoot(slug),
    storageRoot: tenantStorageRoot(slug),
    tenantCode,
    tenantName: requiredSeedValue("DEFAULT_TENANT_NAME"),
    uuid: stableUuid(tenantCode)
  };
}

async function reconcileDefaultTenantModules(repository: TenantRepository, tenant: Tenant) {
  const seed = isRecord(tenant.payloadSettings.seed) ? tenant.payloadSettings.seed : {};
  if (seed.source !== "default-tenant") return tenant;

  const apps = isRecord(tenant.payloadSettings.apps) ? tenant.payloadSettings.apps : {};
  const configuredApps = stringArray(apps.enabled);
  const moduleKeys = defaultSeedModuleKeys();
  if (
    moduleKeys.every((key) => tenant.enabledModuleKeys.includes(key)) &&
    moduleKeys.every((key) => configuredApps.includes(key)) &&
    !tenant.enabledModuleKeys.includes("devkit") &&
    !configuredApps.includes("devkit") &&
    !tenant.enabledModuleKeys.includes("project-manager") &&
    !configuredApps.includes("project-manager")
  ) {
    return tenant;
  }

  return (
    (await repository.update(String(tenant.id), {
      ...tenant,
      enabledModuleKeys: Array.from(
        new Set(
          [...moduleKeys, ...tenant.enabledModuleKeys].filter(
            (key) =>
              key !== "devkit" && key !== "project-manager"
          )
        )
      ).sort(),
      payloadSettings: {
        ...tenant.payloadSettings,
        apps: {
          ...apps,
          enabled: Array.from(
            new Set(
              [...moduleKeys, ...configuredApps].filter(
                (key) =>
                  key !== "devkit" && key !== "project-manager"
              )
            )
          ).sort()
        }
      }
    })) ?? tenant
  );
}

function defaultSeedModuleKeys() {
  return Array.from(defaultTenantModuleKeys);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

async function seedDefaultTenantSubscription(tenant: Tenant) {
  const database = getPlatformDatabase();
  const existing = await database
    .selectFrom("subscriptions")
    .select("id")
    .where("tenant_id", "=", tenant.id)
    .where("status", "in", ["active", "trial"])
    .executeTakeFirst();
  if (existing) {
    console.info(`[seeder] default tenant subscription already active for "${tenant.tenantCode}"`);
    return;
  }

  const starterPlan = await database
    .selectFrom("plans")
    .select(["id", "code"])
    .where("code", "=", "starter")
    .executeTakeFirst();
  if (!starterPlan) {
    console.info(
      "[seeder] default tenant subscription skipped because starter plan is not available"
    );
    return;
  }

  await database
    .insertInto("subscriptions")
    .values({
      billing_cycle: "monthly",
      ends_on: null,
      plan_id: Number(starterPlan.id),
      starts_on: new Date().toISOString().slice(0, 10),
      status: "trial",
      tenant_id: tenant.id,
      uuid: stableUuid(`subscription:${tenant.uuid}:${starterPlan.code}`)
    })
    .onDuplicateKeyUpdate({
      billing_cycle: "monthly",
      ends_on: null,
      plan_id: Number(starterPlan.id),
      starts_on: new Date().toISOString().slice(0, 10),
      status: "trial",
      tenant_id: tenant.id,
      updated_at: sql`CURRENT_TIMESTAMP`
    })
    .execute();
  console.info(
    `[seeder] default tenant subscription ready: ${tenant.tenantCode} -> ${starterPlan.code}`
  );
}

function defaultTenantDomain() {
  const domain = normalizeTenantDomain(env.DEFAULT_TENANT_DOMAIN || "localhost");
  if (!domain) {
    throw new Error(
      "DEFAULT_TENANT_DOMAIN must resolve to a non-empty domain when ENABLE_DEFAULT_TENANT_SEED=1."
    );
  }

  return domain;
}

function requiredSeedValue(
  name:
    | "DEFAULT_TENANT_CORPORATE_ID"
    | "DEFAULT_TENANT_DB_NAME"
    | "DEFAULT_TENANT_NAME"
    | "DEFAULT_TENANT_SLUG"
) {
  const value = env[name].trim();
  if (!value) {
    throw new Error(`${name} is required when ENABLE_DEFAULT_TENANT_SEED=1.`);
  }

  return value;
}

function normalizeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("DEFAULT_TENANT_SLUG must resolve to a non-empty slug.");
  }

  return slug;
}

function stableUuid(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
