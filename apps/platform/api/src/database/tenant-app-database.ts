import { migrateMarketing, seedMarketing, marketingMigrationBatch } from "@codexsun/marketing-api";
import { seedTconnectPortalRole } from "../tconnect-identity.js";
import { seedSportsclubPortalRole } from "../sportsclub-identity.js";
import { migrateTconnect, seedTconnect, tconnectTenantMigrations } from "@codexsun/tconnect-api";
import {
  migrateSportsclubDatabase,
  sportsclubTenantMigrations
} from "@codexsun/sportsclub-api/migration";
import { seedSportsclubDatabase } from "@codexsun/sportsclub-api/seed";
import {
  codexsunTenantMigrations,
  migrateCodexsunDatabase,
  rollbackCodexsunDatabase,
  seedCodexsunPermissions,
  type CodexsunDatabase
} from "@codexsun/codexsun-api";
import {
  seedHrmsOverviewPermissions,
  seedEmployeePermissions,
  attendanceMigrations,
  migrateAttendanceDatabase,
  rollbackAttendanceDatabase,
  seedAttendancePermissions,
  type AttendanceDatabase,
  employeeMigrations,
  migrateEmployeeDatabase,
  rollbackEmployeeDatabase,
  type EmployeeDatabase,
  type HrmsPermissionDatabase
} from "@codexsun/hrms-api";
import {
  migrateKnowledgeDatabase,
  rollbackKnowledgeDatabase,
  knowledgeMigrations,
  seedKnowledgeDatabase,
  type KnowledgeDatabase,
  seedDocsOverviewPermissions,
  type DocsPermissionDatabase
} from "@codexsun/docs-api";
import { seedHimsxOverviewPermissions, type HimsxPermissionDatabase } from "@codexsun/himsx-api";
import {
  migrateSiteModule,
  rollbackSiteModule,
  seedSiteModule,
  seedSitesOverviewPermissions,
  siteMigration,
  type SitesDatabase,
  type SitesPermissionDatabase
} from "@codexsun/sites-api";
import {
  seedEcommerceOverviewPermissions,
  migrateEcommerceTenantDatabase,
  rollbackEcommerceTenantDatabase,
  ecommerceTenantMigrations,
  seedEcommerceTenantModules,
  type EcommerceDatabase,
  type EcommercePermissionDatabase
} from "@codexsun/ecommerce-api";
import {
  billingTenantMigrations,
  migrateBillingTenantDatabase,
  rollbackBillingTenantDatabase,
  seedBillingTenantDatabase
} from "@codexsun/billing-api";
import {
  accountsTenantMigrations,
  migrateAccountsTenantDatabase,
  rollbackAccountsTenantDatabase,
  seedAccountsTenantDatabase
} from "@codexsun/accounts-api";
import {
  coreTenantMigrations,
  migrateCoreTenantDatabase,
  rollbackCoreTenantDatabase,
  seedCoreTenantDatabase,
  setDefaultCompanyLandingAppForDatabase
} from "@codexsun/core-api";
import {
  crmTenantMigrations,
  migrateCrmTenantDatabase,
  rollbackCrmTenantDatabase,
  seedCrmTenantDatabase,
  type EnquiryDatabase
} from "@codexsun/crm-api";
import {
  auditorMigrations,
  migrateAuditorDatabase,
  rollbackAuditorDatabase,
  seedAuditorClientPermissions,
  type AuditorClientDatabase
} from "@codexsun/auditor-api";
import {
  mailMigrationBatch,
  migrateMailModule,
  rollbackMailModule,
  seedMailModule
} from "@codexsun/mail-api";
import {
  migrateNotesModule,
  notesMigrationBatch,
  rollbackNotesModule,
  seedNotesModule
} from "@codexsun/notes-api";
import {
  chatMigrationBatch,
  migrateChatModule,
  rollbackChatModule,
  seedChatModule
} from "@codexsun/chat-api";
import { sql, type Kysely } from "kysely";
import {
  blogsMigrationBatch,
  migrateBlogsDatabase,
  seedBlogsDatabase,
  type BlogRequestContext
} from "@codexsun/blog/api";
import { runMigrationBatch } from "@codexsun/framework/db";
import {
  frappeTenantMigrations,
  frappeUserMappingMigrations,
  seedFrappeConnectionPermissions,
  migrateFrappeTenantDatabase,
  migrateFrappeUserMappingDatabase,
  rollbackFrappeTenantDatabase,
  rollbackFrappeUserMappingDatabase,
  type FrappeDatabase,
  type FrappeUserMappingDatabase
} from "@codexsun/frappe-api";
import {
  zetroChatMigrations,
  zetroProviderMigrations,
  migrateZetroChatDatabase,
  migrateZetroProviderDatabase,
  rollbackZetroChatDatabase,
  rollbackZetroProviderDatabase,
  seedZetroChatPermissions,
  seedZetroProviderPermission,
  type ZetroDatabase,
  type ZetroProviderDatabase
} from "@codexsun/zetro-api";
import type { TenantDatabase } from "./schema.js";
import { qcafeMigrationBatch, migrateQCafeWeb, seedQCafeWeb } from "@codexsun/qcafe-api/cloud";
import type { Tenant } from "../modules/tenant/tenant.types.js";
import { tenantRuntimeMigrations } from "../modules/tenant/tenant.migration.js";
import {
  migrateTaskManagerTenantModule,
  rollbackTaskManagerTenantModule,
  taskManagerTenantMigrationBatch
} from "../modules/task-manager/task-manager.migration.js";
import { seedTaskManagerModule } from "../modules/task-manager/task-manager.seed.js";

const mailTenantMigrations = mailMigrationBatch.steps.map(({ description, name }) => ({
  description,
  name
}));

const notesTenantMigrations = notesMigrationBatch.steps.map(({ description, name }) => ({
  description,
  name
}));

const chatTenantMigrations = chatMigrationBatch.steps.map(({ description, name }) => ({
  description,
  name
}));

export function tenantDatabaseMigrationsFor(_tenant: Tenant) {
  return [
    ...qcafeMigrationBatch.steps.map(({ name, description }) => ({
      name,
      description,
      statements: [`RUN ${name}`]
    })),
    ...tenantRuntimeMigrations.map(({ description, name, statements }) => ({
      description,
      name,
      statements
    })),
    ...marketingMigrationBatch.steps.map(({ description, name }) => ({
      description,
      name,
      statements: [`RUN ${name}`]
    })),
    ...coreTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...tconnectTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...sportsclubTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...ecommerceTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...crmTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...frappeTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...frappeUserMappingMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...auditorMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...zetroChatMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...zetroProviderMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...billingTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...employeeMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...attendanceMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...knowledgeMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...accountsTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...mailTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...notesTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...chatTenantMigrations.map((migration) => ({
      ...migration,
      statements: [`RUN ${migration.name}`]
    })),
    ...taskManagerTenantMigrationBatch.steps.map(({ description, name }) => ({
      description,
      name,
      statements: [`RUN ${name}`]
    })),
    ...codexsunTenantMigrations.map(({ description, name }) => ({
      description,
      name,
      statements: [`RUN ${name}`]
    })),
    ...blogsMigrationBatch.steps.map(({ description, name }) => ({
      description,
      name,
      statements: [`RUN ${name}`]
    })),
    {
      description: siteMigration.description,
      name: siteMigration.name,
      statements: [`RUN ${siteMigration.name}`]
    }
  ];
}

export async function migrateSelectedTenantApps(database: Kysely<TenantDatabase>, tenant: Tenant) {
  const provisionedApps = ["application"];
  await migrateQCafeWeb(database as never);
  provisionedApps.push("qcafe");

  await migrateCoreTenantDatabase(tenant.dbName);
  await migrateMarketing(database as never);
  provisionedApps.push("marketing");
  await migrateEmployeeDatabase(database as unknown as Kysely<EmployeeDatabase>);
  await migrateAttendanceDatabase(database as unknown as Kysely<AttendanceDatabase>);
  provisionedApps.push("hrms");
  if (tenant.enabledModuleKeys.includes("docs")) {
    await migrateKnowledgeDatabase(database as unknown as Kysely<KnowledgeDatabase>);
    provisionedApps.push("docs");
  }
  if (tenant.enabledModuleKeys.includes("sites")) {
    await migrateSiteModule(database as unknown as Kysely<SitesDatabase>);
    provisionedApps.push("sites");
  }
  await migrateEcommerceTenantDatabase(database as unknown as Kysely<EcommerceDatabase>);
  provisionedApps.push("ecommerce");
  await migrateTconnect(database as never);
  provisionedApps.push("tconnect");
  if (tenant.enabledModuleKeys.includes("sportsclub")) {
    await migrateSportsclubDatabase(database as never);
    provisionedApps.push("sportsclub");
  }
  await migrateCrmTenantDatabase(database as unknown as Kysely<EnquiryDatabase>);
  provisionedApps.push("crm");
  await migrateFrappeTenantDatabase(database as unknown as Kysely<FrappeDatabase>);
  await migrateFrappeUserMappingDatabase(database as unknown as Kysely<FrappeUserMappingDatabase>);
  provisionedApps.push("frappe");
  await migrateAuditorDatabase(database as unknown as Kysely<AuditorClientDatabase>);
  provisionedApps.push("auditor");
  await migrateZetroChatDatabase(database as unknown as Kysely<ZetroDatabase>);
  await migrateZetroProviderDatabase(database as unknown as Kysely<ZetroProviderDatabase>);
  provisionedApps.push("zetro");
  await migrateBillingTenantDatabase(tenant.dbName);
  provisionedApps.push("billing");
  await migrateAccountsTenantDatabase(tenant.dbName);
  provisionedApps.push("accounts");
  await migrateMailModule(database as never);
  provisionedApps.push("mail");
  await migrateNotesModule(database as never);
  provisionedApps.push("notes");
  await migrateChatModule(database as never);
  provisionedApps.push("chat");
  await migrateTaskManagerTenantModule(database as never);
  provisionedApps.push("task-manager");
  await migrateCodexsunDatabase(database as unknown as Kysely<CodexsunDatabase>);
  provisionedApps.push("codexsun");
  await migrateBlogsDatabase(database as never, runMigrationBatch);
  provisionedApps.push("blog");

  return {
    migrationOrder: tenantDatabaseMigrationsFor(tenant).map((migration) => migration.name),
    provisionedApps
  };
}

export async function seedSelectedTenantApps(database: Kysely<TenantDatabase>, tenant: Tenant) {
  const enabled = new Set(tenant.enabledModuleKeys);
  const seededApps = ["application"];
  if (enabled.has("marketing")) {
    await seedMarketing(database as never);
    seededApps.push("marketing");
  }
  if (enabled.has("codexsun")) {
    await seedCodexsunPermissions(database as unknown as Kysely<CodexsunDatabase>);
    seededApps.push("codexsun");
  }
  if (enabled.has("hrms")) {
    await seedHrmsOverviewPermissions(database as unknown as Kysely<HrmsPermissionDatabase>);
    await seedEmployeePermissions(database as unknown as Kysely<HrmsPermissionDatabase>);
    await seedAttendancePermissions(database as unknown as Kysely<HrmsPermissionDatabase>);
    seededApps.push("hrms");
  }
  if (enabled.has("docs")) {
    await seedDocsOverviewPermissions(database as unknown as Kysely<DocsPermissionDatabase>);
    await seedKnowledgeDatabase(database as unknown as Kysely<KnowledgeDatabase>);
    seededApps.push("docs");
  }
  if (enabled.has("himsx")) {
    await seedHimsxOverviewPermissions(database as unknown as Kysely<HimsxPermissionDatabase>);
    seededApps.push("himsx");
  }
  if (enabled.has("sites")) {
    await seedSitesOverviewPermissions(database as unknown as Kysely<SitesPermissionDatabase>);
    await seedSiteModule(database as unknown as Kysely<SitesDatabase>);
    seededApps.push("sites");
  }

  await seedCoreTenantDatabase(tenant.dbName);
  if (enabled.has("crm")) {
    await seedCrmTenantDatabase(database as unknown as Kysely<EnquiryDatabase>);
    seededApps.push("crm");
  }
  if (enabled.has("crm") && enabled.has("frappe")) {
    await seedFrappeConnectionPermissions(database as unknown as Kysely<FrappeDatabase>);
    seededApps.push("frappe");
  }
  if (enabled.has("auditor")) {
    await seedAuditorClientPermissions(database as unknown as Kysely<AuditorClientDatabase>);
    seededApps.push("auditor");
  }
  if (enabled.has("tconnect")) {
    await seedTconnect(database as never);
    await seedTconnectPortalRole(database);
    seededApps.push("tconnect");
  }
  if (enabled.has("sportsclub")) {
    await seedSportsclubDatabase(database as never);
    await seedSportsclubPortalRole(database);
    seededApps.push("sportsclub");
  }
  if (enabled.has("ecommerce")) {
    await seedEcommerceOverviewPermissions(
      database as unknown as Kysely<EcommercePermissionDatabase>
    );
    await seedEcommerceTenantModules(database as unknown as Kysely<EcommerceDatabase>, tenant.uuid);
    seededApps.push("ecommerce");
  }
  if (enabled.has("zetro")) {
    await seedZetroChatPermissions(database as unknown as Kysely<ZetroDatabase>);
    await seedZetroProviderPermission(database as unknown as Kysely<ZetroProviderDatabase>);
    seededApps.push("zetro");
  }
  try {
    await setDefaultCompanyLandingAppForDatabase(tenant.dbName, tenant.defaultLandingApp);
  } catch {
    await setDefaultCompanyLandingAppForDatabase(tenant.dbName, "application");
  }

  if (enabled.has("billing.sales")) {
    await seedBillingTenantDatabase(tenant.dbName);
    seededApps.push("billing");
  }

  if (enabled.has("accounts.overview") || enabled.has("accounts.accounting")) {
    await seedAccountsTenantDatabase(tenant.dbName);
    seededApps.push("accounts");
  }

  if (enabled.has("mail")) {
    await seedMailModule(database as never);
    seededApps.push("mail");
  }

  if (enabled.has("notes")) {
    await seedNotesModule(database as never);
    seededApps.push("notes");
  }

  if (enabled.has("qcafe")) {
    await seedQCafeWeb(database as never);
    seededApps.push("qcafe");
  }

  if (enabled.has("chat")) {
    await seedChatModule(database as never);
    seededApps.push("chat");
  }

  if (enabled.has("platform.task-manager")) {
    await seedTaskManagerModule(database, {
      importLegacyJson: false,
      scopeKey: taskManagerTenantScope(tenant)
    });
    seededApps.push("task-manager");
  }
  if (enabled.has("blog")) {
    await seedBlogsDatabase(blogContext(database, tenant));
    seededApps.push("blog");
  }
  return { seededApps };
}

export async function rollbackSelectedTenantApps(database: Kysely<TenantDatabase>, tenant: Tenant) {
  const legacySchemes = await sql<{ present: number }>`
    SELECT 1 AS present FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name IN ('logicx_erp_schemes', 'logicx_erp_scheme_activity')
    LIMIT 1
  `.execute(database);
  if (legacySchemes.rows.length) {
    throw new Error("Tenant rollback requires review of existing retired LogicX ERP scheme tables.");
  }
  await rollbackEmployeeDatabase(database as unknown as Kysely<EmployeeDatabase>);
  await rollbackAttendanceDatabase(database as unknown as Kysely<AttendanceDatabase>);
  const enabled = new Set(tenant.enabledModuleKeys);
  if (enabled.has("codexsun"))
    await rollbackCodexsunDatabase(database as unknown as Kysely<CodexsunDatabase>);
  if (enabled.has("docs"))
    await rollbackKnowledgeDatabase(database as unknown as Kysely<KnowledgeDatabase>);
  if (enabled.has("sites")) await rollbackSiteModule(database as unknown as Kysely<SitesDatabase>);
  if (enabled.has("platform.task-manager"))
    await rollbackTaskManagerTenantModule(database as never);
  if (enabled.has("mail")) await rollbackMailModule(database as never);
  if (enabled.has("notes")) await rollbackNotesModule(database as never);
  if (enabled.has("chat")) await rollbackChatModule(database as never);
  if (enabled.has("crm") && enabled.has("frappe")) {
    await rollbackFrappeUserMappingDatabase(
      database as unknown as Kysely<FrappeUserMappingDatabase>
    );
    await rollbackFrappeTenantDatabase(database as unknown as Kysely<FrappeDatabase>);
  }
  if (enabled.has("crm")) {
    await rollbackCrmTenantDatabase(database as unknown as Kysely<EnquiryDatabase>);
  }
  if (enabled.has("auditor"))
    await rollbackAuditorDatabase(database as unknown as Kysely<AuditorClientDatabase>);
  if (enabled.has("zetro")) {
    await rollbackZetroProviderDatabase(database as unknown as Kysely<ZetroProviderDatabase>);
    await rollbackZetroChatDatabase(database as unknown as Kysely<ZetroDatabase>);
  }
  if (enabled.has("billing.sales")) await rollbackBillingTenantDatabase(tenant.dbName);
  if (enabled.has("accounts.overview") || enabled.has("accounts.accounting"))
    await rollbackAccountsTenantDatabase(tenant.dbName);
  if (enabled.has("ecommerce"))
    await rollbackEcommerceTenantDatabase(database as unknown as Kysely<EcommerceDatabase>);
  await rollbackCoreTenantDatabase(tenant.dbName);
}

export async function provisionSelectedTenantApps(
  database: Kysely<TenantDatabase>,
  tenant: Tenant
) {
  const migrated = await migrateSelectedTenantApps(database, tenant);
  const seeded = await seedSelectedTenantApps(database, tenant);
  return { ...migrated, ...seeded };
}

export function taskManagerTenantScope(tenant: Pick<Tenant, "uuid">) {
  return `tenant:${tenant.uuid}`;
}

function blogContext(database: Kysely<TenantDatabase>, tenant: Tenant): BlogRequestContext {
  return {
    actorId: null,
    database: database as unknown as BlogRequestContext["database"],
    host: "codexsun",
    origin: "",
    scopeId: tenant.uuid
  };
}
