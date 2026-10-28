import {
  migrateMarketing,
  seedMarketing,
  marketingMigrationBatch,
} from "@codexsun/marketing-api";
import { seedTconnectPortalRole } from "../tconnect-identity.js";
import { seedSportsclubPortalRole } from "../sportsclub-identity.js";
import {
  migrateTconnect,
  seedTconnect,
  tconnectTenantMigrations,
} from "@codexsun/tconnect-api";
import {
  migrateSportsclubDatabase,
  sportsclubTenantMigrations,
} from "@codexsun/sportsclub-api/migration";
import { seedSportsclubDatabase } from "@codexsun/sportsclub-api/seed";
import {
  codexsunTenantMigrations,
  migrateCodexsunDatabase,
  seedCodexsunPermissions,
  type CodexsunDatabase,
} from "@codexsun/codexsun-api";
import {
  seedHrmsOverviewPermissions,
  seedEmployeePermissions,
  attendanceMigrations,
  migrateAttendanceDatabase,
  seedAttendancePermissions,
  type AttendanceDatabase,
  employeeMigrations,
  migrateEmployeeDatabase,
  type EmployeeDatabase,
  type HrmsPermissionDatabase,
} from "@codexsun/hrms-api";
import {
  migrateKnowledgeDatabase,
  knowledgeMigrations,
  seedKnowledgeDatabase,
  type KnowledgeDatabase,
  seedDocsOverviewPermissions,
  type DocsPermissionDatabase,
} from "@codexsun/docs-api";
import {
  seedHimsxOverviewPermissions,
  type HimsxPermissionDatabase,
} from "@codexsun/himsx-api";
import {
  migrateSiteModule,
  seedSiteModule,
  seedSitesOverviewPermissions,
  siteMigration,
  type SitesDatabase,
  type SitesPermissionDatabase,
} from "@codexsun/sites-api";
import {
  seedEcommerceOverviewPermissions,
  migrateEcommerceTenantDatabase,
  ecommerceTenantMigrations,
  seedEcommerceTenantModules,
  type EcommerceDatabase,
  type EcommercePermissionDatabase,
} from "@codexsun/ecommerce-api";
import {
  billingTenantMigrations,
  migrateBillingTenantDatabase,
  seedBillingTenantDatabase,
} from "@codexsun/billing-api";
import {
  accountsTenantMigrations,
  migrateAccountsTenantDatabase,
  seedAccountsTenantDatabase,
} from "@codexsun/accounts-api";
import {
  coreTenantMigrations,
  migrateCoreTenantDatabase,
  seedCoreTenantDatabase,
  setDefaultCompanyLandingAppForDatabase,
} from "@codexsun/core-api";
import {
  crmTenantMigrations,
  migrateCrmTenantDatabase,
  seedCrmTenantDatabase,
  type EnquiryDatabase,
} from "@codexsun/crm-api";
import {
  auditorMigrations,
  migrateAuditorDatabase,
  seedAuditorClientPermissions,
  type AuditorClientDatabase,
} from "@codexsun/auditor-api";
import {
  mailMigrationBatch,
  migrateMailModule,
  seedMailModule,
} from "@codexsun/mail-api";
import {
  migrateNotesModule,
  notesMigrationBatch,
  seedNotesModule,
} from "@codexsun/notes-api";
import {
  chatMigrationBatch,
  migrateChatModule,
  seedChatModule,
} from "@codexsun/chat-api";
import type { Kysely } from "kysely";
import {
  blogsMigrationBatch,
  migrateBlogsDatabase,
  seedBlogsDatabase,
  type BlogRequestContext,
} from "@codexsun/blog/api";
import { runMigrationBatch } from "@codexsun/framework/db";
import {
  frappeTenantMigrations,
  frappeUserMappingMigrations,
  seedFrappeConnectionPermissions,
  migrateFrappeTenantDatabase,
  migrateFrappeUserMappingDatabase,
  type FrappeDatabase,
  type FrappeUserMappingDatabase,
} from "@codexsun/frappe-api";
import {
  zetroChatMigrations,
  zetroProviderMigrations,
  migrateZetroChatDatabase,
  migrateZetroProviderDatabase,
  seedZetroChatPermissions,
  seedZetroProviderPermission,
  type ZetroDatabase,
  type ZetroProviderDatabase,
} from "@codexsun/zetro-api";
import type { TenantDatabase } from "./schema.js";
import {
  qcafeMigrationBatch,
  migrateQCafeWeb,
  seedQCafeWeb,
} from "@codexsun/qcafe-api/cloud";
import type { Tenant } from "../modules/tenant/tenant.types.js";
import { tenantRuntimeMigrations } from "../modules/tenant/tenant.migration.js";
import {
  migrateTaskManagerTenantModule,
  taskManagerTenantMigrationBatch,
} from "../modules/task-manager/task-manager.migration.js";
import { seedTaskManagerModule } from "../modules/task-manager/task-manager.seed.js";

const mailTenantMigrations = mailMigrationBatch.steps.map(
  ({ description, name }) => ({
    description,
    name,
  }),
);

const notesTenantMigrations = notesMigrationBatch.steps.map(
  ({ description, name }) => ({
    description,
    name,
  }),
);

const chatTenantMigrations = chatMigrationBatch.steps.map(
  ({ description, name }) => ({
    description,
    name,
  }),
);

type TenantMigrationStage = {
  app?: string;
  steps: readonly { name: string; description: string }[];
  run: () => Promise<unknown>;
};

function tenantMigrationStages(
  database: Kysely<TenantDatabase>,
  tenant: Tenant,
): TenantMigrationStage[] {
  return [
    {
      app: "qcafe",
      steps: qcafeMigrationBatch.steps,
      run: () => migrateQCafeWeb(database as never),
    },
    {
      steps: coreTenantMigrations,
      run: () => migrateCoreTenantDatabase(tenant.dbName),
    },
    {
      app: "marketing",
      steps: marketingMigrationBatch.steps,
      run: () => migrateMarketing(database as never),
    },
    {
      steps: employeeMigrations,
      run: () =>
        migrateEmployeeDatabase(
          database as unknown as Kysely<EmployeeDatabase>,
        ),
    },
    {
      app: "hrms",
      steps: attendanceMigrations,
      run: () =>
        migrateAttendanceDatabase(
          database as unknown as Kysely<AttendanceDatabase>,
        ),
    },
    {
      app: "docs",
      steps: knowledgeMigrations,
      run: () =>
        migrateKnowledgeDatabase(
          database as unknown as Kysely<KnowledgeDatabase>,
        ),
    },
    {
      app: "sites",
      steps: [siteMigration],
      run: () =>
        migrateSiteModule(database as unknown as Kysely<SitesDatabase>),
    },
    {
      app: "ecommerce",
      steps: ecommerceTenantMigrations,
      run: () =>
        migrateEcommerceTenantDatabase(
          database as unknown as Kysely<EcommerceDatabase>,
        ),
    },
    {
      app: "tconnect",
      steps: tconnectTenantMigrations,
      run: () => migrateTconnect(database as never),
    },
    {
      app: "sportsclub",
      steps: sportsclubTenantMigrations,
      run: () => migrateSportsclubDatabase(database as never),
    },
    {
      app: "crm",
      steps: crmTenantMigrations,
      run: () =>
        migrateCrmTenantDatabase(
          database as unknown as Kysely<EnquiryDatabase>,
        ),
    },
    {
      steps: frappeTenantMigrations,
      run: () =>
        migrateFrappeTenantDatabase(
          database as unknown as Kysely<FrappeDatabase>,
        ),
    },
    {
      app: "frappe",
      steps: frappeUserMappingMigrations,
      run: () =>
        migrateFrappeUserMappingDatabase(
          database as unknown as Kysely<FrappeUserMappingDatabase>,
        ),
    },
    {
      app: "auditor",
      steps: auditorMigrations,
      run: () =>
        migrateAuditorDatabase(
          database as unknown as Kysely<AuditorClientDatabase>,
        ),
    },
    {
      steps: zetroChatMigrations,
      run: () =>
        migrateZetroChatDatabase(database as unknown as Kysely<ZetroDatabase>),
    },
    {
      app: "zetro",
      steps: zetroProviderMigrations,
      run: () =>
        migrateZetroProviderDatabase(
          database as unknown as Kysely<ZetroProviderDatabase>,
        ),
    },
    {
      app: "billing",
      steps: billingTenantMigrations,
      run: () => migrateBillingTenantDatabase(tenant.dbName),
    },
    {
      app: "accounts",
      steps: accountsTenantMigrations,
      run: () => migrateAccountsTenantDatabase(tenant.dbName),
    },
    {
      app: "mail",
      steps: mailTenantMigrations,
      run: () => migrateMailModule(database as never),
    },
    {
      app: "notes",
      steps: notesTenantMigrations,
      run: () => migrateNotesModule(database as never),
    },
    {
      app: "chat",
      steps: chatTenantMigrations,
      run: () => migrateChatModule(database as never),
    },
    {
      app: "task-manager",
      steps: taskManagerTenantMigrationBatch.steps,
      run: () => migrateTaskManagerTenantModule(database as never),
    },
    {
      app: "codexsun",
      steps: codexsunTenantMigrations,
      run: () =>
        migrateCodexsunDatabase(
          database as unknown as Kysely<CodexsunDatabase>,
        ),
    },
    {
      app: "blog",
      steps: blogsMigrationBatch.steps,
      run: () => migrateBlogsDatabase(database as never, runMigrationBatch),
    },
  ];
}

export function tenantDatabaseMigrationsFor(tenant: Tenant) {
  const runtime = tenantRuntimeMigrations.map(
    ({ description, name, statements }) => ({
      description,
      name,
      statements,
    }),
  );
  const stages = tenantMigrationStages(
    null as unknown as Kysely<TenantDatabase>,
    tenant,
  );
  return [
    ...runtime,
    ...stages.flatMap(({ steps }) =>
      steps.map(({ name, description }) => ({
        name,
        description,
        statements: [`RUN ${name}`],
      })),
    ),
  ];
}

export async function migrateSelectedTenantApps(
  database: Kysely<TenantDatabase>,
  tenant: Tenant,
) {
  const provisionedApps = ["application"];
  for (const stage of tenantMigrationStages(database, tenant)) {
    await stage.run();
    if (stage.app) provisionedApps.push(stage.app);
  }
  return {
    migrationOrder: tenantDatabaseMigrationsFor(tenant).map(
      (migration) => migration.name,
    ),
    provisionedApps,
  };
}

export async function seedSelectedTenantApps(
  database: Kysely<TenantDatabase>,
  tenant: Tenant,
) {
  const enabled = new Set(tenant.enabledModuleKeys);
  const seededApps = ["application"];
  if (enabled.has("marketing")) {
    await seedMarketing(database as never);
    seededApps.push("marketing");
  }
  if (enabled.has("codexsun")) {
    await seedCodexsunPermissions(
      database as unknown as Kysely<CodexsunDatabase>,
    );
    seededApps.push("codexsun");
  }
  if (enabled.has("hrms")) {
    await seedHrmsOverviewPermissions(
      database as unknown as Kysely<HrmsPermissionDatabase>,
    );
    await seedEmployeePermissions(
      database as unknown as Kysely<HrmsPermissionDatabase>,
    );
    await seedAttendancePermissions(
      database as unknown as Kysely<HrmsPermissionDatabase>,
    );
    seededApps.push("hrms");
  }
  if (enabled.has("docs")) {
    await seedDocsOverviewPermissions(
      database as unknown as Kysely<DocsPermissionDatabase>,
    );
    await seedKnowledgeDatabase(
      database as unknown as Kysely<KnowledgeDatabase>,
    );
    seededApps.push("docs");
  }
  if (enabled.has("himsx")) {
    await seedHimsxOverviewPermissions(
      database as unknown as Kysely<HimsxPermissionDatabase>,
    );
    seededApps.push("himsx");
  }
  if (enabled.has("sites")) {
    await seedSitesOverviewPermissions(
      database as unknown as Kysely<SitesPermissionDatabase>,
    );
    await seedSiteModule(database as unknown as Kysely<SitesDatabase>);
    seededApps.push("sites");
  }

  await seedCoreTenantDatabase(tenant.dbName);
  if (enabled.has("crm")) {
    await seedCrmTenantDatabase(database as unknown as Kysely<EnquiryDatabase>);
    seededApps.push("crm");
  }
  if (enabled.has("crm") && enabled.has("frappe")) {
    await seedFrappeConnectionPermissions(
      database as unknown as Kysely<FrappeDatabase>,
    );
    seededApps.push("frappe");
  }
  if (enabled.has("auditor")) {
    await seedAuditorClientPermissions(
      database as unknown as Kysely<AuditorClientDatabase>,
    );
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
      database as unknown as Kysely<EcommercePermissionDatabase>,
    );
    await seedEcommerceTenantModules(
      database as unknown as Kysely<EcommerceDatabase>,
      tenant.uuid,
    );
    seededApps.push("ecommerce");
  }
  if (enabled.has("zetro")) {
    await seedZetroChatPermissions(
      database as unknown as Kysely<ZetroDatabase>,
    );
    await seedZetroProviderPermission(
      database as unknown as Kysely<ZetroProviderDatabase>,
    );
    seededApps.push("zetro");
  }
  try {
    await setDefaultCompanyLandingAppForDatabase(
      tenant.dbName,
      tenant.defaultLandingApp,
    );
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
      scopeKey: taskManagerTenantScope(tenant),
    });
    seededApps.push("task-manager");
  }
  if (enabled.has("blog")) {
    await seedBlogsDatabase(blogContext(database, tenant));
    seededApps.push("blog");
  }
  return { seededApps };
}

export async function rollbackSelectedTenantApps(
  _database: Kysely<TenantDatabase>,
  _tenant: Tenant,
) {
  throw new Error(
    "Tenant app rollback is unavailable until every applied release step has a verified safe reverse plan.",
  );
}

export async function provisionSelectedTenantApps(
  database: Kysely<TenantDatabase>,
  tenant: Tenant,
) {
  const migrated = await migrateSelectedTenantApps(database, tenant);
  const seeded = await seedSelectedTenantApps(database, tenant);
  return { ...migrated, ...seeded };
}

export function taskManagerTenantScope(tenant: Pick<Tenant, "uuid">) {
  return `tenant:${tenant.uuid}`;
}

function blogContext(
  database: Kysely<TenantDatabase>,
  tenant: Tenant,
): BlogRequestContext {
  return {
    actorId: null,
    database: database as unknown as BlogRequestContext["database"],
    host: "codexsun",
    origin: "",
    scopeId: tenant.uuid,
  };
}
