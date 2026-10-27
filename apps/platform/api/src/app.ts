import { enquiryRelations } from "./enquiry-relations-host.js";
import { registerCrmFrappeBackground } from "./crm-frappe-background.js";
import { subscribeExternalChatMessages } from "./chat-event-transport.js";
import { AuthSessionRepository } from "./auth/auth-session.repository.js";
import { claimsMatchSession } from "./auth/auth-request-context.js";
import { registerFrappeAvailabilityRoutes } from "@codexsun/frappe-api";
import { registerFrappeAvailabilityReadiness } from "./modules/queue-manager/frappe-availability.readiness.js";
import {
  readCrmFrappeSyncAccess,
  canDispatchCrmFrappeSync,
  crmFrappeAvailability
} from "./crm-frappe-sync-access.js";
import { authorizeEnquiryWrite, registerCrmFrappeSyncCapabilities } from "@codexsun/crm-api";
import { registerMarketingHost } from "./marketing-host.js";
import { marketingApiModuleKeys } from "@codexsun/marketing-api";
import { sitesDeliveryHost } from "./sites-delivery-host.js";
import { canViewCrmEnquiryFrappeSync } from "./crm-enquiry-frappe-sync-access.js";
import { EnquirySyncStateReader } from "@codexsun/frappe-api";
import { getDefaultCompanyForDatabase, getCompanyForDatabase } from "@codexsun/core-api";
import { deliverDutyUpdate } from "@codexsun/crm-api";
import {
  workReportModule,
  recordWorkEvent,
  type WorkReportContext,
  type WorkReportDatabase
} from "@codexsun/crm-api";
import { writeWorkMessage } from "@codexsun/chat-api";
import { registerTconnectHost } from "./tconnect-host.js";
import { registerSportsclubHost } from "./sportsclub-host.js";
import { registerBillingComplianceHost } from "./billing-compliance-host.js";
import { codexsunApiModuleKeys } from "@codexsun/codexsun-api";
import {
  hrmsOverviewModule,
  employeeModule,
  attendanceModule,
  type EmployeeDatabase,
  type AttendanceDatabase
} from "@codexsun/hrms-api";
import {
  docsKnowledgeModule,
  KnowledgeService,
  type KnowledgeDatabase,
  docsOverviewModule
} from "@codexsun/docs-api";
import { himsxOverviewModule } from "@codexsun/himsx-api";
import { siteModule, sitesOverviewModule } from "@codexsun/sites-api";
import { createApiApp, registerHealthRoute, registerRequestLogging } from "@codexsun/framework/api";
import { randomBytes } from "node:crypto";
import { registerModules } from "@codexsun/framework/modules";
import { createMailModule } from "@codexsun/mail-api";
import { createNotesModule } from "@codexsun/notes-api";
import { createChatModule } from "@codexsun/chat-api";
import { telegramChatDependencies } from "./chat-host.js";
import { accountsApiModuleKeys, registerAccountsApi } from "@codexsun/accounts-api";
import {
  billingApiModuleKeys,
  closeAllBillingDatabases,
  lookupBillingPeriod,
  lookupCustomerOutstanding,
  lookupLongOutstandingSales,
  registerBillingApi
} from "@codexsun/billing-api";
import {
  closeCoreDatabase,
  coreApiModuleKeys,
  registerCoreApi,
  registerCoreTenantDatabaseConnection,
  getActiveContactForDatabase,
  lookupActiveContactsForDatabase,
  findContactIdentityForDatabase,
  findContactIdentityByIdForDatabase,
  resolveOrCreateCustomerForDatabase,
  resolveExternalContactForDatabase
} from "@codexsun/core-api";
import {
  enquiryModule,
  leadModule,
  type LeadContext,
  taskPermissionForRequest,
  activitiesModule,
  closureModule,
  enquiryLocationModule,
  callLogModule,
  crmContactModule,
  registerContact360Modules,
  listInModule,
  statusModule,
  priorityModule,
  sopModule,
  sopItemModule,
  dutyAssignmentModule,
  dutyReportModule,
  taskModule,
  schedulerModule,
  CrmFrappeSyncRepository,
  crmDutySyncIdempotencyKey,
  resolveListInForImport,
  lookupAssignedEnquirySummary,
  type EnquiryDatabase,
  type ActivitiesDatabase,
  type ListInDatabase,
  type StatusDatabase,
  type PriorityDatabase,
  type CrmFrappeSyncDatabase
} from "@codexsun/crm-api";
import {
  ecommerceOverviewModule,
  ecommerceModuleKeys,
  registerEcommerceStaffModules,
  registerEcommercePublicModules,
  runWithEcommerceRequestScope,
  type EcommerceDatabase
} from "@codexsun/ecommerce-api";
import { auditorClientModule, type AuditorClientDatabase } from "@codexsun/auditor-api";
import {
  frappeConnectionModule,
  requestContactExport,
  contactDeliveryStates,
  FrappeConnectionAccess,
  FrappeConnectionRepository,
  assertFrappeQueueWorkerEnabled,
  frappeEnquirySyncModule,
  previewFrappeCallLogs,
  pullFrappeCallLog,
  frappeContactImportModule,
  linkEnquiryCustomerIdentity,
  frappeActivityImportModule,
  frappeExportModule,
  FrappeExportService,
  FrappeLiveSyncService,
  frappeLiveSyncModule,
  frappeCallLogSyncModule,
  frappeEnquiryImportJobName,
  frappeUserMappingModule,
  mappedEmployeeCodeForLocalUser,
  mappedLocalUserForEmployeeCode,
  mappedLocalActorForEmployeeCode,
  mappedLocalActorForFrappeUser,
  frappeUserSyncModule,
  type FrappeDatabase,
  type ExportProgress,
  type ExportKind,
  type FrappeUserMappingDatabase
} from "@codexsun/frappe-api";
import { EnquiryRepository, EnquiryService } from "@codexsun/crm-api/enquiry-sync";
import {
  zetroChatModule,
  registerZetroAdminRoutes,
  zetroProviderModule,
  registerZetroProviderAdminRoutes,
  ZetroProviderRepository,
  type ZetroDatabase,
  type ZetroProviderConfig,
  type ZetroProviderDatabase
} from "@codexsun/zetro-api";
import { AppError } from "@codexsun/framework/errors";
import type { FastifyRequest } from "fastify";
import type { HealthCheck } from "@codexsun/framework/health";
import { registerAuthRoutes } from "./auth/auth.routes.js";
import { appRegistryModule } from "./modules/app-registry/index.js";
import { qCafeModule } from "./modules/qcafe/index.js";
import { tenantDomainModule } from "./modules/tenant-domain/index.js";
import { tenantModule } from "./modules/tenant/index.js";
import { TenantUserService, tenantUserModule } from "./modules/tenant-user/index.js";
import { tenantRoleModule } from "./modules/tenant-role/index.js";
import { tenantPermissionModule } from "./modules/tenant-permission/index.js";
import { tenantUserRoleModule } from "./modules/tenant-user-role/index.js";
import { tenantRolePermissionModule } from "./modules/tenant-role-permission/index.js";
import { planModule } from "./modules/plan/index.js";
import { subscriptionModule } from "./modules/subscription/index.js";
import { IndustryService, industryModule } from "./modules/industry/index.js";
import { entitlementModule } from "./modules/entitlement/index.js";
import { accessControlModule } from "./modules/access-control/index.js";
import { platformActivityModule } from "./modules/platform-activity/index.js";
import { databaseMaintenanceModule } from "./modules/database-maintenance/index.js";
import { queueManagerModule } from "./modules/queue-manager/index.js";
import {
  storageManagerModule,
  StorageManagerService,
  tenantPublicStorageRoot
} from "./modules/storage-manager/index.js";
import { taskManagerModule } from "./modules/task-manager/index.js";
import { credentialRecoveryModule } from "./modules/credential-recovery/index.js";
import { appOrchestrationModule } from "./modules/app-orchestration/index.js";
import { startQueueManagerWorker } from "./modules/queue-manager/queue-manager.runtime.js";
import { startCrmDutySyncRelay } from "./modules/queue-manager/crm-duty-sync.relay.js";
import {
  enqueueCrmEnquirySync,
  startCrmEnquirySyncRelay
} from "./modules/queue-manager/crm-enquiry-sync.relay.js";
import { QueueManagerService } from "./modules/queue-manager/queue-manager.service.js";
import { startFrappeLiveSyncScheduler } from "./modules/queue-manager/frappe-live-sync.scheduler.js";
import { platformReadinessChecks } from "./readiness.js";
import { resolvePublicStorefrontTenant } from "./modules/tenant/index.js";
import { requestHost, enforceBrowserRequestOrigin } from "./auth/auth-request-context.js";
import { tenantAccessContext } from "./auth/tenant-access-context.js";
import { recordTenantAccessAudit } from "./database/tenant-access-audit.js";
import { TenantRepository } from "./modules/tenant/tenant.repository.js";
import { getTenantDatabase, resolveTenantDatabasePassword } from "./database/tenant-database.js";
import { seedDefaultTenant } from "./modules/tenant/tenant.seed.js";
import { env } from "./env.js";
import { assertSingleTenantRegistry } from "./tenancy-mode.js";
import {
  bootstrapPlatformDatabase,
  closePlatformDatabase,
  getPlatformDatabase
} from "./database/platform-database.js";
import { closeAllTenantDatabases } from "./database/tenant-database.js";
import { registerAuthRequestContext } from "./auth/auth-request-context.js";
import { TenantDomainRepository } from "./modules/tenant-domain/tenant-domain.repository.js";
import { registerDataMigrationHost } from "./data-migration-host.js";
import { registerDataBridgeHost } from "./data-bridge-host.js";
import { registerZunoHost } from "./zuno-host.js";
import { registerCodexsunHost } from "./codexsun-host.js";
import { resolvePlatformApiUrl } from "./api-url.js";
import { zunoApiModuleKeys } from "@codexsun/zuno-api";
import {
  addonApiModuleKeys,
  activePlatformAddons,
  closePlatformAddons,
  registerPlatformAddons
} from "./addon-host.js";

export async function createApp() {
  registerFrappeAvailabilityReadiness();
  console.info("[platform.boot] bootstrap started");
  await bootstrapPlatformDatabase();
  await assertSingleTenantRegistry(true);
  await seedDefaultTenant();
  await assertSingleTenantRegistry(false);

  const app = await createApiApp({
    appName: "CODEXSUN Platform API",
    cookieSecret: env.JWT_SECRET,
    corsOrigins: await platformWebOrigins(),
    environment: env.NODE_ENV,
    rewriteUrl: resolvePlatformApiUrl,
    shutdownHooks: [
      async () => {
        console.info("[shutdown] closing Billing tenant MariaDB pools");
        await closeAllBillingDatabases();
      },
      async () => {
        console.info("[shutdown] closing Core tenant MariaDB pools");
        await closeCoreDatabase();
      },
      async () => {
        console.info("[shutdown] closing tenant MariaDB pools");
        await closeAllTenantDatabases();
      },
      async () => {
        console.info("[shutdown] closing platform MariaDB pools");
        await closePlatformDatabase();
      },
      async () => {
        console.info("[shutdown] closing add-on runtimes");
        await closePlatformAddons();
      }
    ]
  });
  const queueService = new QueueManagerService();
  registerCrmFrappeBackground(queueService);
  registerBillingComplianceHost(app, queueService);
  registerAuthRequestContext(app);
  await registerMarketingHost(app, queueService);
  const dataMigrationHost = await registerDataMigrationHost(app);
  await registerDataBridgeHost(app, dataMigrationHost);
  await registerZunoHost(app);
  await registerCodexsunHost(app);
  console.info("[platform.routes] Project Manager package ready");
  const mailModule = createMailModule({
    enqueue: (payload) => queueService.enqueue(payload),
    resolveContext: mailContext,
    secretKey: env.JWT_SECRET
  });
  const notesModule = createNotesModule({ resolveContext: notesContext });
  const chatModule = createChatModule({
    resolveContext: chatContext,
    telegram: telegramChatDependencies(queueService),
    telegramExecution: queueService.canExecute(),
    ...(env.CODEXSUN_QUEUE_EXECUTION_HOST === "worker"
      ? { subscribeExternalMessages: subscribeExternalChatMessages }
      : {}),
    audit: (context, action, uuid) =>
      recordTenantAccessAudit({
        action,
        actorEmail: context.actorEmail,
        moduleKey: "chat.telegram",
        recordId: 0,
        recordLabel: "Telegram connection",
        recordUuid: uuid,
        tenantId: context.tenantId
      })
  });

  const healthChecks: HealthCheck[] = [
    {
      name: "platform-api",
      check: () => ({
        details: {
          modules: [
            ...coreApiModuleKeys,
            ...marketingApiModuleKeys,
            enquiryModule.key,
            auditorClientModule.key,
            ecommerceOverviewModule.key,
            hrmsOverviewModule.key,
            employeeModule.key,
            attendanceModule.key,
            docsOverviewModule.key,
            ...codexsunApiModuleKeys,
            docsKnowledgeModule.key,
            himsxOverviewModule.key,
            sitesOverviewModule.key,
            siteModule.key,

            ...ecommerceModuleKeys,
            zetroChatModule.key,
            ...billingApiModuleKeys,
            ...accountsApiModuleKeys,
            ...zunoApiModuleKeys,
            ...addonApiModuleKeys,
            qCafeModule.key,
            appRegistryModule.key,
            tenantModule.key,
            tenantUserModule.key,
            tenantRoleModule.key,
            tenantPermissionModule.key,
            tenantUserRoleModule.key,
            tenantRolePermissionModule.key,
            tenantDomainModule.key,
            planModule.key,
            subscriptionModule.key,
            industryModule.key,
            entitlementModule.key,
            accessControlModule.key,
            platformActivityModule.key,
            databaseMaintenanceModule.key,
            queueManagerModule.key,
            credentialRecoveryModule.key,
            storageManagerModule.key,
            taskManagerModule.key,
            appOrchestrationModule.key,
            mailModule.key,
            notesModule.key,
            chatModule.key
          ],
          addons: activePlatformAddons(),
          runtime: "platform-foundation"
        },
        status: "ok"
      })
    }
  ];

  registerRequestLogging(app);
  registerHealthRoute(app, healthChecks);
  registerHealthRoute(app, platformReadinessChecks(queueService), "/ready");
  app.get("/public/runtime-config", async (_request, reply) => {
    reply.header("Cache-Control", "private, max-age=60");
    return {
      data: {
        VITE_DEV_AUTO_TENANT_LOGIN: env.DEV_AUTO_TENANT_LOGIN,
        VITE_PLATFORM_API_URL: "/api/app",
        VITE_TENANT_NAME: env.DEFAULT_TENANT_NAME,
        VITE_TENANCY_MODE: env.CODEXSUN_TENANCY_MODE
      },
      success: true
    };
  });
  console.info("[platform.routes] health ready");
  await registerAuthRoutes(app);
  console.info("[platform.routes] auth ready");
  const industryService = new IndustryService();
  await registerCoreApi(app, {
    resolveIndustryName: (industryId) => industryService.resolveActiveIndustryName(industryId)
  });
  console.info("[platform.routes] Core package ready");
  // Tenant provider settings override this deployment fallback at request time.
  const zetroFallbackProvider: ZetroProviderConfig = {
    apiKey: env.CODEXSUN_ZETRO_API_KEY,
    baseUrl: env.CODEXSUN_ZETRO_BASE_URL,
    kind: /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/u.test(env.CODEXSUN_ZETRO_BASE_URL)
      ? "local"
      : "openai",
    model: env.CODEXSUN_ZETRO_MODEL
  };
  zetroChatModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "zetro")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Zetro is not enabled for this tenant.");
    await context.authorize("zetro.chat.use");
    const billingLookupScope = async () => {
      const billingEnabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "=", "billing.sales")
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!billingEnabled) throw AppError.forbidden("Billing is not enabled for this tenant.");
      const defaults = request.authContext?.session.context.defaultCompany;
      if (!defaults) throw AppError.validation("Select a default company and financial year.");
      return {
        tenantDatabase: context.tenantDatabase,
        actorEmail: context.actorEmail,
        companyId: defaults.companyId,
        financialYearId: defaults.financialYearId
      };
    };
    return {
      actorEmail: context.actorEmail,
      database: context.database as unknown as import("kysely").Kysely<ZetroDatabase>,
      provider: await new ZetroProviderRepository(
        context.database as unknown as import("kysely").Kysely<ZetroProviderDatabase>,
        env.JWT_SECRET,
        context.tenantId,
        zetroFallbackProvider
      ).resolve(),
      lookupDeveloperDocs: async (query: string) => {
        const enabled = await context.database
          .selectFrom("app_module_settings")
          .select("id")
          .where("module_key", "=", "docs")
          .where("enabled", "=", true)
          .where("status", "=", "active")
          .executeTakeFirst();
        if (!enabled) throw AppError.forbidden("Docs is not enabled for this tenant.");
        return new KnowledgeService({
          database: context.database as unknown as import("kysely").Kysely<KnowledgeDatabase>,
          actorEmail: context.actorEmail,
          authorize: context.authorize
        }).references(query);
      },
      lookupOutstanding: async (contact: string) =>
        lookupCustomerOutstanding({ ...(await billingLookupScope()), contact }),
      lookupBillingPeriod: async (period: "today" | "month") =>
        lookupBillingPeriod({ ...(await billingLookupScope()), period }),
      lookupLongOutstandingSales: async () =>
        lookupLongOutstandingSales(await billingLookupScope()),
      lookupAssignedEnquiries: async () => {
        const crmEnabled = await context.database
          .selectFrom("app_module_settings")
          .select("id")
          .where("module_key", "=", "crm")
          .where("enabled", "=", true)
          .where("status", "=", "active")
          .executeTakeFirst();
        if (!crmEnabled) throw AppError.forbidden("CRM is not enabled for this tenant.");
        await context.authorize("crm.enquiry.view");
        const actor = await context.database
          .selectFrom("app_users")
          .select("id")
          .where("email", "=", context.actorEmail)
          .where("status", "=", "active")
          .executeTakeFirst();
        const summary = await lookupAssignedEnquirySummary({
          database: context.database as unknown as import("kysely").Kysely<EnquiryDatabase>,
          actorEmail: context.actorEmail,
          actorUserId: actor?.id ?? null
        });
        return { source: "local" as const, ...summary };
      },
      audit: (action: string, conversation: import("@codexsun/zetro-api").ZetroConversation) =>
        recordTenantAccessAudit({
          action,
          actorEmail: context.actorEmail,
          moduleKey: "zetro.chat",
          recordId: conversation.id,
          recordLabel: "Zetro conversation",
          recordUuid: conversation.uuid,
          tenantId: context.tenantId
        })
    };
  });
  // Provider routes use the signed tenant context and tenant UUID for local Codex login.
  zetroProviderModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "=", "zetro")
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!enabled) throw AppError.forbidden("Zetro is not enabled for this tenant.");
      await context.authorize("zetro.provider.manage");
      return {
        actorEmail: context.actorEmail,
        database: context.database as unknown as import("kysely").Kysely<ZetroProviderDatabase>,
        tenantId: context.tenantId,
        audit: (action) =>
          recordTenantAccessAudit({
            action:
              action === "device-login"
                ? "zetro.provider.device-login"
                : action === "disconnect"
                  ? "zetro.provider.disconnect"
                  : action === "bind-local"
                    ? "zetro.provider.bind-local"
                    : "zetro.provider.update",
            actorEmail: context.actorEmail,
            moduleKey: "zetro.provider",
            recordId: 1,
            recordLabel: "Zetro provider settings",
            recordUuid: "settings",
            tenantId: context.tenantId
          })
      };
    },
    zetroFallbackProvider,
    env.JWT_SECRET
  );
  registerZetroAdminRoutes(app, async (request, tenantId) => {
    if (request.authContext?.payload.userType !== "super_admin") {
      throw AppError.forbidden("Super Admin permission is required for Zetro review.");
    }
    const tenant = await new TenantRepository().findByIdOrCode(tenantId);
    if (!tenant) throw AppError.notFound("Tenant was not found.");
    if (!tenant.enabledModuleKeys.includes("zetro")) {
      throw AppError.forbidden("Zetro is not enabled for this tenant.");
    }
    const actorEmail = request.authContext.payload.email ?? request.authContext.session.userEmail;
    await recordTenantAccessAudit({
      action: "zetro.admin.access",
      actorEmail,
      moduleKey: "zetro.chat",
      recordId: tenant.id,
      recordLabel: "Zetro tenant review",
      recordUuid: tenant.uuid,
      tenantId: tenant.uuid
    });
    return {
      actorEmail,
      database: getTenantDatabase(tenant) as unknown as import("kysely").Kysely<ZetroDatabase>
    };
  });
  registerZetroProviderAdminRoutes(
    app,
    async (request, tenantId) => {
      if (request.authContext?.payload.userType !== "super_admin") {
        throw AppError.forbidden("Super Admin permission is required for Zetro settings.");
      }
      const tenant = await new TenantRepository().findByIdOrCode(tenantId);
      if (!tenant) throw AppError.notFound("Tenant was not found.");
      if (!tenant.enabledModuleKeys.includes("zetro")) {
        throw AppError.forbidden("Zetro is not enabled for this tenant.");
      }
      const actorEmail = request.authContext.payload.email ?? request.authContext.session.userEmail;
      await recordTenantAccessAudit({
        action: "zetro.provider.admin.access",
        actorEmail,
        moduleKey: "zetro.provider",
        recordId: tenant.id,
        recordLabel: "Zetro provider settings",
        recordUuid: tenant.uuid,
        tenantId: tenant.uuid
      });
      return {
        actorEmail,
        database: getTenantDatabase(
          tenant
        ) as unknown as import("kysely").Kysely<ZetroProviderDatabase>,
        tenantId: tenant.uuid,
        audit: () =>
          recordTenantAccessAudit({
            action: "zetro.provider.admin.update",
            actorEmail,
            moduleKey: "zetro.provider",
            recordId: tenant.id,
            recordLabel: "Zetro provider settings",
            recordUuid: tenant.uuid,
            tenantId: tenant.uuid
          })
      };
    },
    zetroFallbackProvider,
    env.JWT_SECRET
  );
  const crmAccess = async (request: FastifyRequest, resource: string, collection: string) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "crm")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("CRM is not enabled for this tenant.");
    const path = request.url.split("?")[0] ?? "";
    const isCallLogWrite =
      resource === "call-log" &&
      request.method === "POST" &&
      /^\/crm\/(?:mobile\/)?call-logs(?:\/CL-\d+\/comments)?$/u.test(path);
    const taskAction = resource === "task" ? taskPermissionForRequest(request.method, path) : null;
    const enquiryWorkAction =
      resource === "enquiry" &&
      request.method === "POST" &&
      /^\/crm\/(?:mobile\/)?enquiries\/\d+\/(?:locations|comments|open-new-call)$/u.test(path)
        ? "work"
        : null;
    const action =
      taskAction ??
      (resource === "lead" && request.method === "POST" && /\/convert$/u.test(path)
        ? "convert"
        : null) ??
      enquiryWorkAction ??
      (request.method === "GET" || /^\/crm\/enquiries\/alerts\/\d+\/read$/u.test(path)
        ? "view"
        : request.method === "DELETE" && !/^\/crm\/enquiries\/live\//u.test(path)
          ? "delete"
          : request.method === "POST" &&
              (path === collection ||
                path === `${collection}/live` ||
                /^\/crm\/enquiries\/options\/(list-in|status|priority)$/u.test(path))
            ? "create"
            : request.method === "POST" && /^\/crm\/contacts\/lookups\//u.test(path)
              ? "create"
              : isCallLogWrite
                ? "create"
                : "update");
    if (action === "view" && ["list-in", "status", "priority"].includes(resource)) {
      try {
        await context.authorize(`crm.${resource}.view`);
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
        await context.authorize("crm.enquiry.view");
      }
    } else {
      await context.authorize(`crm.${resource}.${action}`);
    }
    if (resource === "enquiry")
      await authorizeEnquiryWrite(request.method, path, {
        ...context,
        database: context.database as unknown as import("kysely").Kysely<EnquiryDatabase>
      });
    return context;
  };
  await listInModule.register(app, async (request) => {
    const context = await crmAccess(request, "list-in", "/crm/list-in");
    return {
      actorEmail: context.actorEmail,
      database: context.database as unknown as import("kysely").Kysely<ListInDatabase>
    };
  });
  await statusModule.register(app, async (request) => {
    const context = await crmAccess(request, "status", "/crm/statuses");
    return {
      actorEmail: context.actorEmail,
      database: context.database as unknown as import("kysely").Kysely<StatusDatabase>
    };
  });
  await priorityModule.register(app, async (request) => {
    const context = await crmAccess(request, "priority", "/crm/priorities");
    return {
      actorEmail: context.actorEmail,
      database: context.database as unknown as import("kysely").Kysely<PriorityDatabase>
    };
  });
  await activitiesModule.register(app, async (request) => {
    const context = await crmAccess(request, "enquiry", "/crm/enquiries");
    const actor = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    let canViewAll = false;
    try {
      await context.authorize("crm.enquiry.view-all");
      canViewAll = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    return {
      database: context.database as unknown as import("kysely").Kysely<ActivitiesDatabase>,
      actorEmail: context.actorEmail,
      actorUserId: actor?.id ?? null,
      canViewAll
    };
  });
  await closureModule.register(app, async (request) => {
    const context = await crmAccess(request, "enquiry", "/crm/enquiries");
    const actor = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    let canViewAll = false;
    try {
      await context.authorize("crm.enquiry.view-all");
      canViewAll = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    let canReview = false;
    try {
      await context.authorize("crm.closure.review");
      canReview = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    const reportContext = request.method === "GET" ? null : await workReportContext(request);
    return {
      database: context.database as unknown as import("kysely").Kysely<
        import("@codexsun/crm-api").ClosureDatabase
      >,
      workEvent: async (transaction, enquiryId, action, body) => {
        if (!reportContext) throw AppError.forbidden("A work action context is required.");
        await recordWorkEvent(
          reportContext,
          transaction as never,
          { enquiryId, taskId: null },
          action,
          body
        );
      },
      actorEmail: context.actorEmail,
      actorUserId: actor?.id ?? null,
      canViewAll,
      canReview
    };
  });
  await enquiryLocationModule.register(app, async (request) => {
    const context = await crmAccess(request, "enquiry", "/crm/enquiries");
    if (request.method === "POST") await context.authorize("crm.enquiry.work");
    const reportContext = request.method === "POST" ? await workReportContext(request) : null;
    const actor = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    let canViewAll = false;
    try {
      await context.authorize("crm.enquiry.view-all");
      canViewAll = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    return {
      database: context.database as unknown as import("kysely").Kysely<
        import("@codexsun/crm-api").EnquiryLocationDatabase
      >,
      actorEmail: context.actorEmail,
      actorUserId: actor?.id ?? null,
      canViewAll,
      workEvent: async (transaction, enquiryId, action, body) => {
        if (!reportContext) throw AppError.forbidden("A work action context is required.");
        await recordWorkEvent(
          reportContext,
          transaction as never,
          { enquiryId, taskId: null },
          action,
          body
        );
      }
    };
  });
  const workReportContext = async (request: FastifyRequest): Promise<WorkReportContext> => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "crm")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("CRM is not enabled for this tenant.");
    const actor = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!actor) throw AppError.forbidden("An active tenant user is required.");
    const chat = await chatContext(request);
    return {
      database: context.database as unknown as import("kysely").Kysely<WorkReportDatabase>,
      actorEmail: context.actorEmail,
      actorUserId: actor.id,
      authorize: context.authorize,
      sendMessage: async (transaction, message) =>
        writeWorkMessage(transaction as never, {
          ...message,
          actorEmail: context.actorEmail,
          companyId: chat.companyId
        })
    };
  };
  workReportModule.register(app, workReportContext);
  const frappeSettings = {
    baseUrl: env.CODEXSUN_FRAPPE_BASE_URL,
    apiKey: env.CODEXSUN_FRAPPE_APP_KEY,
    apiSecret: env.CODEXSUN_FRAPPE_APP_SECRET,
    enabled: env.CODEXSUN_FRAPPE_ENABLED === "1"
  };
  registerCrmFrappeSyncCapabilities(app, async (request) => {
    const context = tenantAccessContext(request);
    const access = await readCrmFrappeSyncAccess(context.database);
    return { enabled: access.enabled };
  });
  await leadModule.register(app, async (request): Promise<LeadContext> => {
    const context = await crmAccess(request, "lead", "/crm/leads");
    const companyId = Number(request.headers["x-company-id"]);
    if (!Number.isSafeInteger(companyId) || companyId < 1)
      throw AppError.validation("Select a valid company.");
    const company = await getCompanyForDatabase(context.tenantDatabase, companyId);
    if (!company || company.status !== "active")
      throw AppError.validation("Select an active company.");
    let canViewAll = false;
    try {
      await context.authorize("crm.lead.view-all");
      canViewAll = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    return {
      database: context.database as unknown as LeadContext["database"],
      companyId,
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      canViewAll,
      contact: async (id) => {
        const contact = await getActiveContactForDatabase(context.tenantDatabase, id);
        return contact ? { id, ...contact } : null;
      },
      contacts: async (search) => {
        await context.authorize("crm.contact.view");
        return lookupActiveContactsForDatabase(context.tenantDatabase, search);
      },
      resolveContact: async (transaction, lead) => {
        if (lead.contactId) {
          const contact = await getActiveContactForDatabase(context.tenantDatabase, lead.contactId);
          if (!contact) throw AppError.validation("The linked contact is no longer active.");
          return lead.contactId;
        }
        const contact = await resolveOrCreateCustomerForDatabase(
          context.tenantDatabase,
          { name: lead.name, mobile: lead.phone },
          transaction as never
        );
        return contact.id;
      }
    };
  });
  await enquiryModule.register(app, async (request) => {
    const context = await crmAccess(request, "enquiry", "/crm/enquiries");
    const actor = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    let canViewAll = false;
    try {
      await context.authorize("crm.enquiry.view-all");
      canViewAll = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    let canViewFrappeSync = false;
    canViewFrappeSync =
      (await readCrmFrappeSyncAccess(context.database)).enabled &&
      (await canViewCrmEnquiryFrappeSync(context.actorEmail, () =>
        context.authorize("crm.enquiry.frappe-sync.view")
      ));
    const reportContext = request.method === "GET" ? null : await workReportContext(request);
    return {
      workEvent: async (transaction, enquiryId, action, body) => {
        if (!reportContext) throw AppError.forbidden("A work action context is required.");
        await recordWorkEvent(
          reportContext,
          transaction as never,
          { enquiryId, taskId: null },
          action,
          body
        );
      },
      actorEmail: context.actorEmail,
      actorUserId: actor?.id ?? null,
      canViewAll,
      canViewFrappeSync,
      readFrappeSync: (ids: number[]) =>
        new EnquirySyncStateReader(
          context.database as unknown as import("kysely").Kysely<FrappeDatabase>
        ).read(ids),
      database: context.database as unknown as import("kysely").Kysely<EnquiryDatabase>,
      relations: enquiryRelations(context),
      listUsers: () =>
        context.database
          .selectFrom("app_users")
          .select(["id", "name", "email", "status"])
          .where("status", "=", "active")
          .execute(),
      pendingClosureLookup: async (enquiryIds) => {
        if (enquiryIds.length === 0) return new Set<number>();
        const closureDatabase = context.database as unknown as import("kysely").Kysely<
          import("@codexsun/crm-api").ClosureDatabase
        >;
        const pending = await closureDatabase
          .selectFrom("crm_closure_requests")
          .select("enquiry_id")
          .where("status", "=", "pending")
          .where("enquiry_id", "in", enquiryIds)
          .execute();
        return new Set(pending.map((row) => row.enquiry_id));
      },
      dispatchFrappeSync: async (eventId) => {
        const enabled = await context.database
          .selectFrom("app_module_settings")
          .select("module_key")
          .where("module_key", "in", ["crm", "frappe"])
          .where("enabled", "=", true)
          .where("status", "=", "active")
          .execute();
        if (enabled.length !== 2) return;
        const database = context.database as unknown as import("kysely").Kysely<FrappeDatabase>;
        const live = await new FrappeLiveSyncService(database).settings();
        if (live.direction === "inbound" || !live.enabled || live.paused || !live.modules.enquiries)
          return;
        await enqueueCrmEnquirySync(queueService, {
          tenantId: context.tenantId,
          tenantDatabase: context.tenantDatabase,
          eventId,
          actorEmail: context.actorEmail,
          correlationId: request.id
        });
      }
    };
  });
  crmContactModule.register(
    app,
    async (request) => {
      await crmAccess(request, "contact", "/crm/contacts");
    },
    async (request, id) => {
      const context = tenantAccessContext(request);
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "=", "frappe")
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!enabled) return;
      const database = context.database as unknown as import("kysely").Kysely<
        import("@codexsun/frappe-api").ContactExportDatabase
      >;
      const live = await new FrappeLiveSyncService(database).settings();
      if (
        !live.enabled ||
        live.paused ||
        live.direction !== "bidirectional" ||
        !live.modules.contacts
      )
        return;
      const sync = await requestContactExport(database, id, context.actorEmail);
      if (!sync) return;
      if (!(await readCrmFrappeSyncAccess(context.database)).outbound) return;
      try {
        await queueService.enqueue({
          dispatchImmediately: false,
          actorEmail: context.actorEmail,
          correlationId: request.id,
          idempotencyKey: crmDutySyncIdempotencyKey(
            context.tenantId,
            sync.uuid,
            sync.attempts,
            sync.dispatch_revision
          ),
          jobName: "crm.contact.frappe-sync",
          maxAttempts: 1,
          queueName: "crm",
          sourceModule: "frappe.contact-export",
          payload: { tenantDatabase: context.tenantDatabase, queueId: sync.id },
          tenantId: context.tenantId
        });
      } catch (error) {
        await new CrmFrappeSyncRepository(database).recordDispatchError(
          sync.id,
          error instanceof Error ? error.message : "Contact export could not be dispatched."
        );
      }
    }
  );
  registerContact360Modules(app, async (request, resource) => {
    const context = await crmAccess(request, resource, `/crm/${resource}`);
    return {
      database: context.database as unknown as import("kysely").Kysely<EnquiryDatabase>,
      actorEmail: context.actorEmail,
      customerExists: async (id: number) =>
        Boolean(await getActiveContactForDatabase(context.tenantDatabase, id)),
      industryExists: async (id: number) =>
        Boolean(await industryService.resolveActiveIndustryName(id))
    };
  });
  frappeConnectionModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "in", ["crm", "frappe"])
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .execute();
      if (enabled.length !== 2)
        throw AppError.forbidden("CRM and Frappe must be enabled for this tenant.");
      const path = request.url.split("?")[0] ?? "";
      const permission =
        (path.startsWith("/frappe/connection") ||
          path.startsWith("/frappe/data-sources") ||
          path.startsWith("/frappe/import-state")) &&
        request.method !== "GET"
          ? "frappe.connection.manage"
          : request.method === "POST" && path.endsWith("/sync")
            ? "crm.enquiry.update"
            : "crm.enquiry.view";
      await context.authorize(permission);
      if (path === "/frappe/import-state/complete" && request.method === "POST") {
        const active = (
          await queueService.listJobs({ tenantId: context.tenantId, queueName: "reports" })
        ).some(
          (job) =>
            ["frappe.enquiries.import", "frappe.call-logs.import"].includes(job.jobName) &&
            ["pending", "running"].includes(job.status) &&
            job.payload.tenantDatabase === context.tenantDatabase
        );
        if (active)
          throw AppError.conflict(
            "Wait for active Frappe imports to finish before switching to local only."
          );
      }
      const actor = await context.database
        .selectFrom("app_users")
        .select("id")
        .where("email", "=", context.actorEmail)
        .where("status", "=", "active")
        .executeTakeFirst();
      let canViewAll = false;
      try {
        await context.authorize("crm.enquiry.view-all");
        canViewAll = true;
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
      }
      return {
        database: context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        actorEmail: context.actorEmail,
        viewer: { actorEmail: context.actorEmail, actorUserId: actor?.id ?? null, canViewAll },
        mappedEmployeeCode: (localEmail: string, baseUrl: string) =>
          mappedEmployeeCodeForLocalUser(
            context.database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            localEmail,
            baseUrl
          ),
        loadEnquiry: async (id: number) => {
          const repository = new EnquiryRepository(
            context.database as unknown as import("kysely").Kysely<EnquiryDatabase>
          );
          const record = await repository.get(id);
          if (!record) throw AppError.notFound("Local enquiry was not found.");
          if (
            !canViewAll &&
            record.createdBy.toLowerCase() !== context.actorEmail.toLowerCase() &&
            record.assignedUserId !== actor?.id
          ) {
            await context.authorize("crm.enquiry.view-all");
          }
          return record;
        }
      };
    },
    {
      baseUrl: env.CODEXSUN_FRAPPE_BASE_URL,
      apiKey: env.CODEXSUN_FRAPPE_APP_KEY,
      apiSecret: env.CODEXSUN_FRAPPE_APP_SECRET,
      enabled: env.CODEXSUN_FRAPPE_ENABLED === "1"
    },
    env.JWT_SECRET,
    env.CODEXSUN_QUEUE_WORKER_ENABLED === "1"
  );

  frappeExportModule.register(app, {
    preview: async (request, kind, page) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      await context.authorize(frappeExportReadPermission(kind));
      return new FrappeExportService(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        env.JWT_SECRET,
        frappeSettings
      ).preview(kind, page);
    },
    enqueue: async (request, kind, ids, mode, verifiedJobId) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      await context.authorize(frappeExportReadPermission(kind));
      if (mode === "export") {
        await context.authorize(kind === "contacts" ? "crm.contact.update" : "crm.enquiry.update");
      }
      assertFrappeQueueWorkerEnabled(env.CODEXSUN_QUEUE_WORKER_ENABLED === "1");
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("module_key")
        .where("module_key", "in", ["crm", "frappe"])
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .execute();
      if (enabled.length !== 2)
        throw AppError.forbidden("CRM and Frappe must be enabled for export.");
      const access = await readCrmFrappeSyncAccess(context.database);
      if (!access.enabled || (mode === "export" && !access.outbound))
        throw AppError.conflict(
          "Enable Frappe sync in the required direction for this tenant first."
        );
      const validated = await new FrappeExportService(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        env.JWT_SECRET,
        frappeSettings
      ).validateSelection(kind, ids);
      if (mode === "export") {
        const verification = await queueService.findJob(verifiedJobId!);
        const verificationAge = verification
          ? ((await queueService.ageMilliseconds(verification.id)) ?? Number.NaN)
          : Number.NaN;
        const results = verification?.result?.results;
        const allowed = new Set(
          Array.isArray(results)
            ? results
                .filter(
                  (item): item is { id: number; outcome: string } =>
                    typeof item === "object" &&
                    item !== null &&
                    typeof item.id === "number" &&
                    ["new", "matched", "linked"].includes(String(item.outcome))
                )
                .map((item) => item.id)
            : []
        );
        if (
          !verification ||
          verification.jobName !== "frappe.export" ||
          verification.status !== "completed" ||
          verification.tenantId !== context.tenantId ||
          verification.payload.tenantDatabase !== context.tenantDatabase ||
          verification.payload.baseUrl !== validated.baseUrl ||
          verification.payload.kind !== kind ||
          verification.payload.mode !== "verify" ||
          !Number.isFinite(verificationAge) ||
          verificationAge < 0 ||
          verificationAge > 10 * 60_000 ||
          !validated.ids.every((id) => allowed.has(id))
        )
          throw AppError.conflict("Verify these records again before exporting.");
      }
      const active = (
        await queueService.listJobs({ tenantId: context.tenantId, queueName: "reports" })
      ).find(
        (job) =>
          job.jobName === "frappe.export" &&
          job.payload.tenantDatabase === context.tenantDatabase &&
          job.payload.kind === kind &&
          ["pending", "running"].includes(job.status) &&
          Array.isArray(job.payload.ids) &&
          validated.ids.some((id) => (job.payload.ids as unknown[]).includes(id))
      );
      if (active) throw AppError.conflict("One of these records is already in the export queue.");
      const job = await queueService.enqueue({
        actorEmail: context.actorEmail,
        correlationId: request.id,
        jobName: "frappe.export",
        maxAttempts: 1,
        payload: {
          tenantDatabase: context.tenantDatabase,
          baseUrl: validated.baseUrl,
          kind,
          mode,
          ids: validated.ids
        },
        queueName: "reports",
        sourceModule: "frappe.export",
        tenantId: context.tenantId
      });
      if (!job) throw AppError.conflict("Export could not be queued.");
      return { jobId: job.id, status: job.status };
    },
    status: async (request, jobId) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      const job = await queueService.findJob(jobId);
      if (
        !job ||
        job.jobName !== "frappe.export" ||
        job.tenantId !== context.tenantId ||
        job.payload.tenantDatabase !== context.tenantDatabase
      )
        throw AppError.notFound("Frappe export job was not found.");
      if (!isFrappeExportKind(job.payload.kind))
        throw AppError.notFound("Frappe export job was not found.");
      await context.authorize(frappeExportReadPermission(job.payload.kind));
      const result = job.result;
      const progress = typeof result.scanned === "number" ? (result as ExportProgress) : null;
      return { jobId, status: job.status, progress, errorMessage: job.errorMessage };
    },
    recordStatuses: async (request, kind, ids) => {
      const context = tenantAccessContext(request);
      if (kind !== "contacts") await context.authorize("frappe.connection.manage");
      await context.authorize(frappeExportReadPermission(kind));
      if (!(await readCrmFrappeSyncAccess(context.database)).enabled) return [];
      const validated = await new FrappeExportService(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        env.JWT_SECRET,
        frappeSettings
      ).validateRecordIds(kind, ids);
      const statuses = new Map<
        number,
        "pending" | "processing" | "failed" | "synced" | "unlinked"
      >();
      const messages = new Map<number, string | null>();
      if (kind === "contacts") {
        const states = await contactDeliveryStates(
          context.database as unknown as import("kysely").Kysely<
            import("@codexsun/frappe-api").ContactExportDatabase
          >,
          validated
        );
        for (const state of states) {
          statuses.set(state.id, state.message ? "failed" : state.status);
          messages.set(state.id, state.message);
        }
      }
      const requested = new Set(validated);
      const jobs = await queueService.listJobs({
        jobName: "frappe.export",
        queueName: "reports",
        tenantId: context.tenantId
      });
      for (const job of jobs) {
        if (
          job.payload.tenantDatabase !== context.tenantDatabase ||
          job.payload.kind !== kind ||
          !Array.isArray(job.payload.ids)
        )
          continue;
        if (job.result.skipped === true) continue;
        const jobIds = job.payload.ids.filter(
          (id): id is number => typeof id === "number" && requested.has(id)
        );
        for (const id of jobIds) {
          if (statuses.has(id)) continue;
          if (job.status === "pending") {
            statuses.set(id, "pending");
            continue;
          }
          if (job.status === "running") {
            statuses.set(id, "processing");
            continue;
          }
          if (job.status === "failed" || job.status === "cancelled") {
            statuses.set(id, "failed");
            messages.set(id, job.errorMessage);
            continue;
          }
          const results = Array.isArray(job.result.results) ? job.result.results : [];
          const result = results.find(
            (item) => typeof item === "object" && item !== null && item.id === id
          ) as { outcome?: unknown; message?: string | null } | undefined;
          messages.set(id, result?.message ?? null);
          if (
            result?.outcome === "linked" ||
            result?.outcome === "matched" ||
            result?.outcome === "exported"
          )
            statuses.set(id, "synced");
          else if (result?.outcome === "new") statuses.set(id, "unlinked");
          else statuses.set(id, "failed");
        }
      }
      return validated.map((id) => ({
        id,
        status: statuses.get(id) ?? null,
        message: messages.get(id) ?? null
      }));
    }
  });

  registerFrappeAvailabilityRoutes(app, async (request) => {
    const context = tenantAccessContext(request);
    await context.authorize("frappe.connection.manage");
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("module_key")
      .where("module_key", "=", "frappe")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Frappe is not enabled for this tenant.");
    return { service: crmFrappeAvailability(context.database), actor: context.actorEmail };
  });
  frappeLiveSyncModule.register(app, {
    settings: async (request) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      const settings = await new FrappeLiveSyncService(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      ).settings();
      return { ...settings, backgroundWorkerEnabled: env.CODEXSUN_QUEUE_WORKER_ENABLED === "1" };
    },
    save: async (request, input) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      const settings = await new FrappeLiveSyncService(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      ).save(input, context.actorEmail);
      return { ...settings, backgroundWorkerEnabled: env.CODEXSUN_QUEUE_WORKER_ENABLED === "1" };
    },
    queue: async (request, kind) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      assertFrappeQueueWorkerEnabled(env.CODEXSUN_QUEUE_WORKER_ENABLED === "1");
      const database = context.database as unknown as import("kysely").Kysely<FrappeDatabase>;
      const settings = await new FrappeLiveSyncService(database).settings();
      if (
        !(await readCrmFrappeSyncAccess(context.database)).enabled ||
        settings.paused ||
        !settings.modules[kind]
      )
        throw AppError.conflict("Enable and resume Frappe live sync for this module first.");
      const inbound = settings.direction === "inbound";
      if (inbound && kind !== "enquiries")
        throw AppError.conflict("Only enquiries support scheduled Frappe-to-CRM import.");
      const connection = await new FrappeConnectionAccess(
        database,
        env.JWT_SECRET,
        frappeSettings
      ).credentials();
      if (!connection) throw AppError.conflict("Verify and enable the Frappe connection first.");
      if (inbound && (!settings.enabled || settings.paused || !settings.modules.enquiries))
        throw AppError.conflict("Enable and resume enquiry live sync before importing history.");
      const job = await queueService.enqueue({
        actorEmail: context.actorEmail,
        correlationId: request.id,
        idempotencyKey: `frappe-live-sync:${context.tenantId}:${kind}:${Date.now()}`,
        jobName: inbound ? frappeEnquiryImportJobName : "frappe.live-sync",
        maxAttempts: 3,
        payload: inbound
          ? {
              tenantDatabase: context.tenantDatabase,
              baseUrl: connection.baseUrl,
              checkpointAt: new Date().toISOString()
            }
          : { tenantDatabase: context.tenantDatabase, kind, manual: true },
        queueName: "reports",
        sourceModule: "frappe.live-sync",
        tenantId: context.tenantId
      });
      if (!job) throw AppError.conflict("Live sync could not be queued.");
      return { id: job.id };
    },
    jobs: async (request) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      return (await queueService.listJobs({ tenantId: context.tenantId, queueName: "reports" }))
        .filter(
          (job) =>
            ["frappe.live-sync", frappeEnquiryImportJobName].includes(job.jobName) &&
            job.payload.tenantDatabase === context.tenantDatabase
        )
        .map((job) => ({
          id: job.id,
          kind:
            job.jobName === frappeEnquiryImportJobName
              ? ("enquiries" as const)
              : (job.payload.kind as ExportKind),
          direction:
            job.jobName === frappeEnquiryImportJobName
              ? ("inbound" as const)
              : ("outbound" as const),
          status: job.status,
          createdAt: job.createdAt,
          errorMessage: job.errorMessage,
          progress: typeof job.result.scanned === "number" ? job.result : null
        }));
    }
  });
  const ensureFrappeImportOpen = async (database: import("kysely").Kysely<FrappeDatabase>) => {
    if ((await new FrappeConnectionRepository(database).importState()).completedAt)
      throw AppError.conflict("Frappe import is complete. Use local CRM records now.");
  };
  frappeContactImportModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      if (request.method !== "GET" && !(await readCrmFrappeSyncAccess(context.database)).enabled)
        throw AppError.conflict("Enable Frappe live sync for this tenant first.");
      await context.authorize("frappe.connection.manage");
      await context.authorize(
        request.method === "POST" ? "crm.contact.create" : "crm.contact.view"
      );
      await ensureFrappeImportOpen(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      );
      return {
        database: context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        resolveContact: async (input: {
          externalKey: string;
          externalCode: string;
          name: string;
          mobile: string;
          contactType?: "Customer" | "Supplier";
          existingContactId?: number;
        }) => {
          const customer = await resolveExternalContactForDatabase(context.tenantDatabase, input);
          await recordTenantAccessAudit({
            action: "imported",
            actorEmail: context.actorEmail,
            moduleKey: "frappe.contact-import",
            recordId: customer.id,
            recordUuid: customer.uuid,
            recordLabel: input.name,
            tenantId: context.tenantId
          });
          return customer;
        },
        findContactByCode: (code: string) =>
          findContactIdentityForDatabase(context.tenantDatabase, code),
        findContactById: (id: number) =>
          findContactIdentityByIdForDatabase(context.tenantDatabase, id)
      };
    },
    frappeSettings,
    env.JWT_SECRET
  );
  frappeActivityImportModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      if (request.method !== "GET" && !(await readCrmFrappeSyncAccess(context.database)).enabled)
        throw AppError.conflict("Enable Frappe live sync for this tenant first.");
      await context.authorize("frappe.connection.manage");
      await context.authorize(
        request.method === "POST" ? "crm.enquiry.update" : "crm.enquiry.view-all"
      );
      await ensureFrappeImportOpen(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      );
      return {
        database: context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        resolveActor: (remoteUser: string, baseUrl: string) =>
          mappedLocalActorForFrappeUser(
            context.database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            remoteUser,
            baseUrl
          )
      };
    },
    frappeSettings,
    env.JWT_SECRET
  );
  await callLogModule.register(app, async (request) => {
    const context = await crmAccess(request, "call-log", "/crm/call-logs");
    return {
      database: context.database as unknown as import("kysely").Kysely<unknown>,
      actorEmail: context.actorEmail
    };
  });
  const crmDutyContext = async (request: FastifyRequest) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "crm")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("CRM is not enabled for this tenant.");
    const user = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    return {
      database: context.database as never,
      actorEmail: context.actorEmail,
      actorUserId: user?.id ?? null,
      authorize: context.authorize,
      notifyWork: async (
        transaction: import("kysely").Transaction<import("@codexsun/crm-api").DutyReportDatabase>,
        assignmentId: number,
        body: string
      ) => {
        const chat = await chatContext(request);
        await deliverDutyUpdate(
          transaction as unknown as import("kysely").Kysely<
            import("@codexsun/crm-api").DutyAssignmentDatabase
          >,
          assignmentId,
          context.actorEmail,
          body,
          (message) =>
            writeWorkMessage(transaction as never, {
              ...message,
              actorEmail: context.actorEmail,
              companyId: chat.companyId
            })
        );
      },
      queueSync: async (entity: "sop-item" | "duty-assignment" | "duty-report", id: number) => {
        if (!(await canDispatchCrmFrappeSync(context.database))) return;
        const sync = await new CrmFrappeSyncRepository(
          context.database as unknown as import("kysely").Kysely<CrmFrappeSyncDatabase>
        ).find(entity, id);
        if (!sync || sync.status === "synced") return;
        try {
          if (env.CODEXSUN_QUEUE_WORKER_ENABLED !== "1")
            throw new Error("The background queue worker is disabled.");
          await queueService.enqueue({
            actorEmail: context.actorEmail,
            correlationId: request.id,
            idempotencyKey: crmDutySyncIdempotencyKey(
              context.tenantId,
              sync.uuid,
              sync.attempts + (sync.status === "processing" ? 1 : 0),
              sync.dispatch_revision
            ),
            jobName: "crm.sop.frappe-sync",
            dispatchImmediately: true,
            maxAttempts: 1,
            payload: { tenantDatabase: context.tenantDatabase, queueId: sync.id },
            queueName: "crm",
            sourceModule: "frappe.crm-duty-sync",
            tenantId: context.tenantId
          });
        } catch (error) {
          await new CrmFrappeSyncRepository(
            context.database as unknown as import("kysely").Kysely<CrmFrappeSyncDatabase>
          ).recordDispatchError(
            sync.id,
            error instanceof Error ? error.message : "Duty export could not be dispatched."
          );
          request.log.warn({ error, syncId: sync.id }, "CRM duty sync dispatch deferred to relay");
        }
      }
    };
  };
  await sopModule.register(app, crmDutyContext);
  await sopItemModule.register(app, crmDutyContext);
  await dutyAssignmentModule.register(app, crmDutyContext);
  await dutyReportModule.register(app, crmDutyContext);
  await schedulerModule.register(app, async (request) => {
    const context = await tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "crm")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("CRM is not enabled for this tenant.");
    const user = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!user) throw AppError.forbidden("An active CRM user is required.");
    const hasPermission = async (permission: string) => {
      try {
        await context.authorize(permission);
        return true;
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
        return false;
      }
    };
    return {
      database: context.database as unknown as import("kysely").Kysely<
        import("@codexsun/crm-api").SchedulerDatabase
      >,
      actorEmail: context.actorEmail,
      actorUserId: Number(user.id),
      authorize: context.authorize,
      hasPermission
    };
  });
  await taskModule.register(app, async (request) => {
    const context = await crmAccess(request, "task", "/crm/tasks");
    const actor = await context.database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", context.actorEmail)
      .where("status", "=", "active")
      .executeTakeFirst();
    let canViewAll = false;
    try {
      await context.authorize("crm.task.view-all");
      canViewAll = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    const taskChat = request.method === "GET" ? null : await chatContext(request);
    return {
      database: context.database as unknown as import("kysely").Kysely<
        import("@codexsun/crm-api").TaskDatabase
      >,
      workEvent: async (transaction, taskId, action, body) => {
        if (!taskChat) throw AppError.forbidden("A work action context is required.");
        const workContext: WorkReportContext = {
          database: transaction as never,
          actorEmail: context.actorEmail,
          actorUserId: actor?.id ?? null,
          authorize: context.authorize,
          sendMessage: async (trx, message) =>
            writeWorkMessage(trx as never, {
              ...message,
              actorEmail: context.actorEmail,
              companyId: taskChat.companyId
            })
        };
        await recordWorkEvent(
          workContext,
          transaction as never,
          { enquiryId: null, taskId },
          action,
          body
        );
      },
      actorEmail: context.actorEmail,
      actorUserId: actor?.id ?? null,
      canViewAll,
      resolveContact: async (
        input: {
          contactId?: number | null | undefined;
          capturedName?: string | null | undefined;
          capturedPhone?: string | null | undefined;
        },
        transaction: import("kysely").Transaction<import("@codexsun/crm-api").TaskDatabase>
      ) => {
        if (input.contactId) {
          if (!(await getActiveContactForDatabase(context.tenantDatabase, input.contactId)))
            throw AppError.validation("Select an active Core contact.");
          return input.contactId;
        }
        if (input.capturedName?.trim() || input.capturedPhone?.trim()) {
          const contact = await resolveOrCreateCustomerForDatabase(
            context.tenantDatabase,
            { name: input.capturedName ?? null, mobile: input.capturedPhone ?? null },
            transaction as unknown as Parameters<typeof resolveOrCreateCustomerForDatabase>[2]
          );
          return contact.id;
        }
        return input.contactId;
      },
      authorize: context.authorize
    };
  });

  frappeCallLogSyncModule.register(app, {
    preview: async (request, page) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      await context.authorize("crm.call-log.view");
      await ensureFrappeImportOpen(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      );
      return previewFrappeCallLogs(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        env.JWT_SECRET,
        page
      );
    },
    pull: async (request, remoteName) => {
      const context = tenantAccessContext(request);
      if (!(await readCrmFrappeSyncAccess(context.database)).enabled)
        throw AppError.conflict("Enable Frappe live sync for this tenant first.");
      await context.authorize("frappe.connection.manage");
      await context.authorize("crm.call-log.create");
      await ensureFrappeImportOpen(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      );
      return pullFrappeCallLog(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        env.JWT_SECRET,
        remoteName,
        (remoteUser, baseUrl) =>
          mappedLocalActorForFrappeUser(
            context.database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            remoteUser,
            baseUrl
          )
      );
    },
    retry: async (request, eventId) => {
      void request;
      void eventId;
      throw AppError.conflict("Sending CRM call logs to Frappe is disabled.");
    },
    start: async (request) => {
      const context = tenantAccessContext(request);
      if (!(await readCrmFrappeSyncAccess(context.database)).enabled)
        throw AppError.conflict("Enable Frappe live sync for this tenant first.");
      await context.authorize("frappe.connection.manage");
      await context.authorize("crm.call-log.view");
      assertFrappeQueueWorkerEnabled(env.CODEXSUN_QUEUE_WORKER_ENABLED === "1");
      await ensureFrappeImportOpen(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      );
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("module_key")
        .where("module_key", "in", ["crm", "frappe"])
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .execute();
      if (enabled.length !== 2)
        throw AppError.forbidden("CRM and Frappe must be enabled for import.");
      const connection = await new FrappeConnectionAccess(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        env.JWT_SECRET,
        frappeSettings
      ).credentials();
      if (!connection) throw AppError.conflict("Verify the Frappe connection before import.");
      const active = (
        await queueService.listJobs({ tenantId: context.tenantId, queueName: "reports" })
      ).find(
        (job) =>
          job.jobName === "frappe.call-logs.import" && ["pending", "running"].includes(job.status)
      );
      if (active) return { jobId: active.id, status: active.status };
      const job = await queueService.enqueue({
        actorEmail: context.actorEmail,
        correlationId: request.id,
        jobName: "frappe.call-logs.import",
        maxAttempts: 2,
        payload: { tenantDatabase: context.tenantDatabase, baseUrl: connection.baseUrl },
        queueName: "reports",
        sourceModule: "frappe.call-log-sync",
        tenantId: context.tenantId
      });
      if (!job) throw AppError.conflict("Call log import could not be queued.");
      return { jobId: job.id, status: job.status };
    },
    status: async (request, jobId) => {
      const context = tenantAccessContext(request);
      await context.authorize("frappe.connection.manage");
      await context.authorize("crm.call-log.view");
      const job = await queueService.findJob(jobId);
      if (
        !job ||
        job.jobName !== "frappe.call-logs.import" ||
        job.tenantId !== context.tenantId ||
        job.payload.tenantDatabase !== context.tenantDatabase
      )
        throw AppError.notFound("Call log import job was not found.");
      const result = job.result;
      const progress =
        typeof result.scanned === "number"
          ? (result as import("@codexsun/frappe-api").CallLogImportProgress)
          : null;
      return { jobId, status: job.status, progress, errorMessage: job.errorMessage };
    }
  });

  frappeEnquirySyncModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      if (request.method !== "GET" && !(await readCrmFrappeSyncAccess(context.database)).enabled)
        throw AppError.conflict("Enable Frappe live sync for this tenant first.");
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "in", ["crm", "frappe"])
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .execute();
      if (enabled.length !== 2)
        throw AppError.forbidden("CRM and Frappe must be enabled for this tenant.");
      await context.authorize("frappe.connection.manage");
      if (!request.url.startsWith("/frappe/enquiries/sync-queue"))
        await ensureFrappeImportOpen(
          context.database as unknown as import("kysely").Kysely<FrappeDatabase>
        );
      await context.authorize("crm.enquiry.view-all");
      if (request.method === "POST") {
        const path = request.url.split("?")[0];
        if (/^\/frappe\/enquiries\/sync-queue\/\d+\/retry$/u.test(path ?? ""))
          await context.authorize("crm.enquiry.update");
        if (path === "/frappe/enquiries/pull") {
          await context.authorize("crm.enquiry.create");
          await context.authorize("crm.enquiry.update");
        } else if (path === "/frappe/enquiries/import" || path === "/frappe/enquiries/backfill") {
          await context.authorize("crm.enquiry.create");
        }
      }
      const enquiries = new EnquiryService(
        new EnquiryRepository(
          context.database as unknown as import("kysely").Kysely<EnquiryDatabase>
        ),
        enquiryRelations(context),
        { actorEmail: context.actorEmail, actorUserId: null, canViewAll: true }
      );
      return {
        database: context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        createEnquiry: (input) => enquiries.create(input, context.actorEmail),
        createImportedEnquiry: (input, source) =>
          enquiries.createImported(input, context.actorEmail, source),
        updateImportedEnquiry: (id, input, source) =>
          enquiries.updateImported(id, input, context.actorEmail, source),
        importComment: (id, comment) => enquiries.importComment(id, comment),
        linkCustomerIdentity: (sourceKey, remoteName, localContactId) =>
          linkEnquiryCustomerIdentity(
            context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
            sourceKey,
            remoteName,
            localContactId
          ),
        localActorForFrappeUser: (remoteUser, baseUrl) =>
          mappedLocalActorForFrappeUser(
            context.database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            remoteUser,
            baseUrl
          ),
        localActorForEmployee: (employeeCode, baseUrl) =>
          mappedLocalActorForEmployeeCode(
            context.database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            employeeCode,
            baseUrl
          ),
        updateEnquiry: (id, input) => enquiries.update(id, input, context.actorEmail),
        localUserForEmployee: (code, baseUrl) =>
          mappedLocalUserForEmployeeCode(
            context.database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            code,
            baseUrl
          ),
        listInForName: (name) =>
          resolveListInForImport(
            context.database as unknown as import("kysely").Kysely<ListInDatabase>,
            name
          )
      };
    },
    frappeSettings,
    env.JWT_SECRET,
    {
      start: async (request) => {
        const context = tenantAccessContext(request);
        await ensureFrappeImportOpen(
          context.database as unknown as import("kysely").Kysely<FrappeDatabase>
        );
        assertFrappeQueueWorkerEnabled(env.CODEXSUN_QUEUE_WORKER_ENABLED === "1");
        const connection = await new FrappeConnectionAccess(
          context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
          env.JWT_SECRET,
          frappeSettings
        ).credentials();
        if (!connection) throw AppError.conflict("Verify the Frappe connection before backfill.");
        const active = (
          await queueService.listJobs({ tenantId: context.tenantId, queueName: "reports" })
        ).find(
          (job) =>
            job.jobName === frappeEnquiryImportJobName &&
            ["pending", "running"].includes(job.status)
        );
        if (active) return { jobId: active.id, status: active.status };
        const job = await queueService.enqueue({
          actorEmail: context.actorEmail,
          correlationId: request.id,
          jobName: frappeEnquiryImportJobName,
          maxAttempts: 2,
          payload: { tenantDatabase: context.tenantDatabase, baseUrl: connection.baseUrl },
          queueName: "reports",
          sourceModule: "frappe.enquiry-sync",
          tenantId: context.tenantId
        });
        if (!job) throw AppError.conflict("Frappe backfill could not be queued.");
        return { jobId: job.id, status: job.status };
      },
      status: async (request, jobId) => {
        const context = tenantAccessContext(request);
        const job = await queueService.findJob(jobId);
        if (
          !job ||
          job.jobName !== frappeEnquiryImportJobName ||
          job.tenantId !== context.tenantId ||
          job.payload.tenantDatabase !== context.tenantDatabase
        )
          throw AppError.notFound("Frappe backfill job was not found.");
        const result = job.result;
        const progress =
          typeof result.scanned === "number"
            ? (result as import("@codexsun/frappe-api").ImportProgress)
            : null;
        return { jobId, status: job.status, progress, errorMessage: job.errorMessage };
      },
      latest: async (request) => {
        const context = tenantAccessContext(request);
        const jobs = await queueService.listJobs({
          tenantId: context.tenantId,
          queueName: "reports"
        });
        const job = jobs.find(
          (candidate) =>
            candidate.jobName === frappeEnquiryImportJobName &&
            candidate.payload.tenantDatabase === context.tenantDatabase
        );
        if (!job) return null;
        const result = job.result;
        const progress =
          typeof result.scanned === "number"
            ? (result as import("@codexsun/frappe-api").ImportProgress)
            : null;
        return {
          jobId: job.id,
          status: job.status,
          progress,
          errorMessage: job.errorMessage
        };
      }
    }
  );
  frappeUserSyncModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "=", "frappe")
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!enabled) throw AppError.forbidden("Frappe must be enabled for this tenant.");
      await context.authorize("frappe.connection.manage");
      if (!request.url.split("?")[0]?.endsWith("/frappe/user-mappings/audit"))
        await ensureFrappeImportOpen(
          context.database as unknown as import("kysely").Kysely<FrappeDatabase>
        );
      const users = new TenantUserService(context);
      return {
        database: context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
        localUsers: async () =>
          (await users.list()).map(({ id, email, status }) => ({ id, email, status })),
        importUser: (user: { name: string; email: string; password?: string }) =>
          users.importFromFrappe(user)
      };
    },
    {
      baseUrl: env.CODEXSUN_FRAPPE_BASE_URL,
      apiKey: env.CODEXSUN_FRAPPE_APP_KEY,
      apiSecret: env.CODEXSUN_FRAPPE_APP_SECRET,
      enabled: env.CODEXSUN_FRAPPE_ENABLED === "1"
    },
    env.JWT_SECRET
  );
  frappeUserMappingModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "=", "frappe")
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!enabled) throw AppError.forbidden("Frappe must be enabled for this tenant.");
      await context.authorize("frappe.connection.manage");
      await ensureFrappeImportOpen(
        context.database as unknown as import("kysely").Kysely<FrappeDatabase>
      );
      const users = new TenantUserService(context);
      return {
        database: context.database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
        localUsers: async () =>
          (await users.list()).map(({ id, uuid, name, email, status }) => ({
            id,
            uuid,
            name,
            email,
            status
          })),
        audit: (
          action: "linked" | "updated" | "unlinked",
          user: { id: number; uuid: string; name: string },
          remoteId: string
        ) =>
          recordTenantAccessAudit({
            action,
            actorEmail: context.actorEmail,
            moduleKey: "frappe.user-mapping",
            recordId: user.id,
            recordLabel: `${user.name} -> ${remoteId}`,
            recordUuid: user.uuid,
            tenantId: context.tenantId
          })
      };
    },
    {
      baseUrl: env.CODEXSUN_FRAPPE_BASE_URL,
      apiKey: env.CODEXSUN_FRAPPE_APP_KEY,
      apiSecret: env.CODEXSUN_FRAPPE_APP_SECRET,
      enabled: env.CODEXSUN_FRAPPE_ENABLED === "1"
    },
    env.JWT_SECRET
  );
  console.info("[platform.routes] CRM package ready");
  await auditorClientModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "auditor")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Auditor is not enabled for this tenant.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      database: context.database as unknown as import("kysely").Kysely<AuditorClientDatabase>,
      secretKey: env.JWT_SECRET,
      audit: async (action, record) => {
        await writeAuditorAuditEvent(
          context.tenantId,
          context.actorEmail,
          `auditor.client.${action}:${record.id}`
        );
        request.log.info(
          { action, actorEmail: context.actorEmail, clientId: record.id, module: "auditor.client" },
          "Auditor client changed"
        );
      },
      auditCredential: async (action, clientId, portal) => {
        await writeAuditorAuditEvent(
          context.tenantId,
          context.actorEmail,
          `auditor.client.credentials.${action}:${clientId}:${portal}`
        );
        request.log.info(
          {
            action,
            actorEmail: context.actorEmail,
            clientId,
            portal,
            module: "auditor.client.credentials"
          },
          "Auditor client credential accessed"
        );
      }
    };
  });
  console.info("[platform.routes] Auditor package ready");
  await app.register(async (scoped) => {
    scoped.addHook("onRequest", (request, _reply, done) => {
      void (async () => {
        if (request.method !== "GET") enforceBrowserRequestOrigin(request);
        const tenant = await resolvePublicStorefrontTenant(requestHost(request));
        registerCoreTenantDatabaseConnection({
          database: tenant.dbName,
          host: tenant.dbHost,
          port: tenant.dbPort,
          user: tenant.dbUser,
          password: resolveTenantDatabasePassword(tenant)
        });
        const database = getTenantDatabase(tenant);
        const enabled = await database
          .selectFrom("app_module_settings")
          .select("module_key")
          .where("module_key", "in", ["ecommerce", "frappe", "crm"])
          .where("enabled", "=", true)
          .where("status", "=", "active")
          .execute();
        const modules = new Set(enabled.map((row) => row.module_key));
        if (!modules.has("ecommerce")) throw AppError.notFound("Storefront is not available.");
        return {
          database,
          databaseName: tenant.dbName,
          tenantKey: tenant.uuid,
          publicStorageRoot: tenantPublicStorageRoot(tenant.slug || tenant.tenantCode),
          frappeEnabled: modules.has("frappe") && modules.has("crm")
        };
      })().then(
        ({ database, databaseName, tenantKey, frappeEnabled, publicStorageRoot }) =>
          runWithEcommerceRequestScope(
            database as unknown as import("kysely").Kysely<EcommerceDatabase>,
            tenantKey,
            done,
            databaseName,
            frappeEnabled,
            publicStorageRoot
          ),
        done
      );
    });
    await registerEcommercePublicModules(
      scoped,
      env.JWT_SECRET,
      frappeSettings,
      (tenantKey, companyId, variant) =>
        new StorageManagerService().readCompanyLogo(tenantKey, companyId, variant)
    );
  });
  await app.register(async (scoped) => {
    scoped.addHook("onRequest", (request, _reply, done) => {
      void (async () => {
        const context = tenantAccessContext(request);
        const enabled = await context.database
          .selectFrom("app_module_settings")
          .select("module_key")
          .where("module_key", "in", ["ecommerce", "frappe", "crm"])
          .where("enabled", "=", true)
          .where("status", "=", "active")
          .execute();
        const modules = new Set(enabled.map((row) => row.module_key));
        if (!modules.has("ecommerce"))
          throw AppError.forbidden("Ecommerce is not enabled for this tenant.");
        const frappeEnabled = modules.has("frappe") && modules.has("crm");
        const area = request.url.startsWith("/ecommerce/storefront/") ? "storefront" : "catalog";
        const action =
          request.method === "GET" ? "view" : area === "storefront" ? "manage" : "edit";
        await context.authorize(`ecommerce.${area}.${action}`);
        const frappeOperation =
          request.url.startsWith("/ecommerce/settings/data-source/frappe-items") ||
          request.url.startsWith("/ecommerce/settings/data-source/sync/");
        if (frappeOperation) {
          if (!frappeEnabled) throw AppError.forbidden("Frappe is not enabled for this tenant.");
          await context.authorize("frappe.connection.manage");
        }
        const tenant = await new TenantRepository().findByIdOrCode(context.tenantId);
        if (!tenant) throw AppError.notFound("Tenant was not found.");
        return {
          context,
          frappeEnabled,
          publicStorageRoot: tenantPublicStorageRoot(tenant.slug || tenant.tenantCode)
        };
      })().then(
        ({ context, frappeEnabled, publicStorageRoot }) =>
          runWithEcommerceRequestScope(
            context.database as unknown as import("kysely").Kysely<EcommerceDatabase>,
            context.tenantId,
            done,
            context.tenantDatabase,
            frappeEnabled,
            publicStorageRoot
          ),
        done
      );
    });
    await registerEcommerceStaffModules(
      scoped,
      env.JWT_SECRET,
      frappeSettings,
      (request) => tenantAccessContext(request).actorEmail
    );
  });
  await employeeModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "hrms")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("HRMS is not enabled for this tenant.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      database: context.database as unknown as import("kysely").Kysely<EmployeeDatabase>,
      users: {
        list: async () =>
          (
            await context.database
              .selectFrom("app_users")
              .select(["id", "name", "email", "status"])
              .orderBy("name")
              .execute()
          ).map((user) => ({ ...user, id: Number(user.id) })),
        find: async (id) => {
          const user = await context.database
            .selectFrom("app_users")
            .select(["id", "name", "email", "status"])
            .where("id", "=", id)
            .executeTakeFirst();
          return user ? { ...user, id: Number(user.id) } : null;
        }
      }
    };
  });
  await attendanceModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "hrms")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("HRMS is not enabled for this tenant.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      database: context.database as unknown as import("kysely").Kysely<AttendanceDatabase>
    };
  });
  await hrmsOverviewModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "hrms")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("HRMS is not enabled for this tenant.");
    const tenant = await new TenantRepository().findByIdOrCode(context.tenantId);
    if (!tenant) throw AppError.notFound("Tenant was not found.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      tenant: { code: tenant.tenantCode, name: tenant.tenantName },
      database: context.database as unknown as import("kysely").Kysely<AttendanceDatabase>
    };
  });
  await docsKnowledgeModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "docs")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Docs is not enabled for this tenant.");
    return {
      database: context.database as unknown as import("kysely").Kysely<KnowledgeDatabase>,
      actorEmail: context.actorEmail,
      authorize: context.authorize
    };
  });
  await docsOverviewModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "docs")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Docs is not enabled for this tenant.");
    const tenant = await new TenantRepository().findByIdOrCode(context.tenantId);
    if (!tenant) throw AppError.notFound("Tenant was not found.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      tenant: { code: tenant.tenantCode, name: tenant.tenantName }
    };
  });
  await himsxOverviewModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "himsx")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Himsx is not enabled for this tenant.");
    const tenant = await new TenantRepository().findByIdOrCode(context.tenantId);
    if (!tenant) throw AppError.notFound("Tenant was not found.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      tenant: { code: tenant.tenantCode, name: tenant.tenantName }
    };
  });
  await sitesOverviewModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "sites")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Sites is not enabled for this tenant.");
    const tenant = await new TenantRepository().findByIdOrCode(context.tenantId);
    if (!tenant) throw AppError.notFound("Tenant was not found.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      tenant: { code: tenant.tenantCode, name: tenant.tenantName }
    };
  });
  await siteModule.register(
    app,
    async (request) => {
      const context = tenantAccessContext(request);
      const enabled = await context.database
        .selectFrom("app_module_settings")
        .select("id")
        .where("module_key", "=", "sites")
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (!enabled) throw AppError.forbidden("Sites is not enabled for this tenant.");
      return {
        actorEmail: context.actorEmail,
        database: context.database,
        tenantId: context.tenantId
      };
    },
    sitesDeliveryHost(app, queueService)
  );

  await ecommerceOverviewModule.register(app, async (request) => {
    const context = tenantAccessContext(request);
    const enabled = await context.database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "ecommerce")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) throw AppError.forbidden("Ecommerce is not enabled for this tenant.");
    const tenant = await new TenantRepository().findByIdOrCode(context.tenantId);
    if (!tenant) throw AppError.notFound("Tenant was not found.");
    return {
      actorEmail: context.actorEmail,
      authorize: context.authorize,
      tenant: { code: tenant.tenantCode, name: tenant.tenantName }
    };
  });
  await registerBillingApi(app);
  console.info("[platform.routes] Billing package ready");
  await registerAccountsApi(app);
  console.info("[platform.routes] Accounts package ready");
  await registerTconnectHost(app);
  await registerSportsclubHost(app);
  await registerPlatformAddons(app);
  console.info("[platform.routes] add-on packages ready");
  await registerModules(
    [
      appRegistryModule,
      qCafeModule,
      tenantModule,
      tenantUserModule,
      tenantRoleModule,
      tenantPermissionModule,
      tenantUserRoleModule,
      tenantRolePermissionModule,
      tenantDomainModule,
      planModule,
      subscriptionModule,
      industryModule,
      entitlementModule,
      accessControlModule,
      platformActivityModule,
      databaseMaintenanceModule,
      queueManagerModule,
      credentialRecoveryModule,
      storageManagerModule,
      taskManagerModule,
      appOrchestrationModule,
      mailModule,
      notesModule,
      chatModule
    ],
    { app },
    {
      onRegister: (module) => console.info(`[module.register] ${module.key}`),
      onReady: (module) => console.info(`[module.ready] ${module.key}`)
    }
  );
  startQueueManagerWorker(app, queueService);
  if (queueService.canExecute()) {
    const stops = [
      startCrmEnquirySyncRelay(queueService),
      startCrmDutySyncRelay(queueService),
      startFrappeLiveSyncScheduler(queueService)
    ];
    app.addHook("onClose", async () => {
      for (const stop of stops) await stop();
    });
  }
  console.info("[platform.worker] queue manager ready");
  console.info("[platform.boot] bootstrap completed");

  return app;
}

function isFrappeExportKind(value: unknown): value is ExportKind {
  return (
    value === "contacts" || value === "enquiries" || value === "activities" || value === "call-logs"
  );
}

function frappeExportReadPermission(kind: ExportKind) {
  if (kind === "contacts") return "crm.contact.view";
  if (kind === "call-logs") return "crm.call-log.view";
  return "crm.enquiry.view-all";
}

async function writeAuditorAuditEvent(tenantUuid: string, actorEmail: string, eventName: string) {
  const database = getPlatformDatabase();
  const tenant = await database
    .selectFrom("tenants")
    .select("id")
    .where("uuid", "=", tenantUuid)
    .executeTakeFirstOrThrow();
  await database
    .insertInto("tenant_audit_events")
    .values({
      actor_email: actorEmail,
      event_name: eventName,
      tenant_id: tenant.id,
      uuid: randomBytes(4).toString("hex")
    })
    .execute();
}

async function platformWebOrigins() {
  const configuredOrigins = [env.PLATFORM_WEB_ORIGIN];
  const verifiedDomains = (await new TenantDomainRepository().listAll())
    .filter((domain) => domain.status === "active" && domain.verificationStatus === "verified")
    .map((domain) => `https://${domain.domain}`);
  configuredOrigins.push(...verifiedDomains);
  if (env.NODE_ENV !== "production") {
    configuredOrigins.push(
      `http://127.0.0.1:${env.PLATFORM_WEB_PORT}`,
      `http://localhost:${env.PLATFORM_WEB_PORT}`
    );
  }

  return Array.from(
    new Set(
      configuredOrigins
        .map((origin) => origin.trim())
        .filter(Boolean)
        .flatMap(localOriginAliases)
        .map((origin) => origin.trim().replace(/\/$/u, ""))
    )
  );
}

function localOriginAliases(origin: string) {
  const origins = [origin];
  const url = new URL(origin);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
    origins.push(url.origin);
  } else if (url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
    origins.push(url.origin);
  }
  return origins;
}

async function mailContext(request: FastifyRequest) {
  const context = tenantAccessContext(request);
  const header = request.headers["x-company-id"];
  const companyId = Number(Array.isArray(header) ? header[0] : header);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw AppError.validation("x-company-id is required for Mail access.");
  }
  return { ...context, companyId, database: context.database as never };
}

async function notesContext(request: FastifyRequest) {
  const context = tenantAccessContext(request);
  const header = request.headers["x-company-id"];
  const companyId = Number(Array.isArray(header) ? header[0] : header);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw AppError.validation("x-company-id is required for Notes access.");
  }
  return { ...context, companyId, database: context.database as never };
}

async function chatContext(request: FastifyRequest) {
  const context = tenantAccessContext(request);
  const defaults = await getDefaultCompanyForDatabase(context.tenantDatabase);
  const requested = request.headers["x-company-id"];
  const header = Number(Array.isArray(requested) ? requested[0] : requested);
  const companyId = Number.isInteger(header) && header > 0 ? header : defaults?.companyId;
  const company = companyId ? await getCompanyForDatabase(context.tenantDatabase, companyId) : null;
  if (!companyId || !company || company.status !== "active") {
    throw AppError.validation("Configure an active default company for work conversations.");
  }
  const authentication = request.authContext;
  return {
    ...context,
    companyId,
    database: context.database as never,
    authorize: async (permission: string) => {
      if (
        !authentication ||
        !claimsMatchSession(
          authentication.payload,
          await new AuthSessionRepository().findActive(authentication.payload.jti)
        )
      )
        throw AppError.unauthorized("Chat session expired. Sign in again.");
      const tenant = await new TenantRepository().findByIdOrCode(context.tenantId);
      if (
        !tenant ||
        tenant.status !== "active" ||
        tenant.dbName !== context.tenantDatabase ||
        !tenant.enabledModuleKeys.includes("chat")
      )
        throw AppError.forbidden("Chat tenant access is unavailable.");
      await context.authorize(permission);
    }
  };
}
