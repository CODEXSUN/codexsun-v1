import { checkMailSuppression, registerMailSuppressionRoutes } from "@codexsun/mail-api";
import { checkContactRestrictions, registerContactRestrictionRoutes } from "@codexsun/crm-api";
import {
  claimProviderAccount,
  releaseProviderAccount
} from "./modules/app-registry/app-registry.account-claims.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "@codexsun/framework/errors";
import {
  getCompanyForDatabase,
  contactIdsForEmailPolicy,
  getDefaultCompanyForDatabase,
  registerCoreTenantDatabaseConnection
} from "@codexsun/core-api";
import {
  registerMarketing,
  marketingBrandScope,
  lookupCapture,
  lookupCampaign,
  lookupBrand,
  createSubmissionHandoffJob,
  pendingSubmissionHandoffs,
  processSubmissionHandoff,
  LeadService,
  type MarketingContext,
  type SubmissionDependencies,
  submissionRouting,
  registerConnectionAuthorization,
  GoogleChannelConnector,
  registerPublicCapture
} from "@codexsun/marketing-api";
import { tenantAccessContext, authorizeTenantUser } from "./auth/tenant-access-context.js";
import { getTenantDatabase, resolveTenantDatabasePassword } from "./database/tenant-database.js";
import { TenantRepository } from "./modules/tenant/tenant.repository.js";
import { EntitlementRepository } from "./modules/entitlement/entitlement.repository.js";
import { registerQueueJobProcessor } from "./modules/queue-manager/queue-manager.worker.js";
import type { QueueManagerService } from "./modules/queue-manager/queue-manager.service.js";
import { env } from "./env.js";

async function tenantIdentity(tenantId: string, actorEmail: string, moduleKey: string) {
  const tenant = await new TenantRepository().findByIdOrCode(tenantId);
  if (!tenant || tenant.status !== "active") throw AppError.forbidden("The tenant is unavailable.");
  const modules = await new EntitlementRepository().resolveTenantModuleKeys(tenant.id);
  if (!modules.includes(moduleKey))
    throw AppError.forbidden(moduleKey + " is not enabled for this tenant.");
  const database = getTenantDatabase(tenant);
  registerCoreTenantDatabaseConnection({
    database: tenant.dbName,
    host: tenant.dbHost,
    password: resolveTenantDatabasePassword(tenant),
    port: tenant.dbPort,
    user: tenant.dbUser
  });
  const active = await database
    .selectFrom("app_module_settings")
    .select("id")
    .where("module_key", "=", moduleKey)
    .where("enabled", "=", true)
    .where("status", "=", "active")
    .executeTakeFirst();
  if (!active) throw AppError.forbidden(moduleKey + " is not active.");
  return {
    tenant,
    database,
    actorEmail,
    authorize: (key: string) => authorizeTenantUser(database as never, actorEmail, key)
  };
}

async function companyScope(
  tenantId: string,
  actorEmail: string,
  companyId?: number
): Promise<MarketingContext> {
  const identity = await tenantIdentity(tenantId, actorEmail, "marketing");
  const selected =
    companyId ?? (await getDefaultCompanyForDatabase(identity.tenant.dbName))?.companyId;
  const company = selected ? await getCompanyForDatabase(identity.tenant.dbName, selected) : null;
  if (!company || !selected || company.status !== "active")
    throw AppError.validation("Configure an active application default company.");
  let allBrands = false;
  try {
    await identity.authorize("marketing.brand.record.manage-all");
    allBrands = true;
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
  }
  const context: MarketingContext = {
    database: identity.database as never,
    tenantId,
    companyId: selected,
    actorEmail,
    authorize: identity.authorize,
    allBrands,
    allowedBrands: []
  };
  context.allowedBrands = await marketingBrandScope(context);
  return context;
}

export async function marketingContext(request: FastifyRequest) {
  if (!request.authContext)
    throw AppError.forbidden("An authenticated tenant session is required.");
  const access = tenantAccessContext(request);
  const identity = await tenantIdentity(access.tenantId, access.actorEmail, "marketing");
  if (identity.tenant.dbName !== access.tenantDatabase)
    throw AppError.forbidden("The tenant database does not match the session.");
  return companyScope(access.tenantId, access.actorEmail);
}

export async function registerMarketingHost(app: FastifyInstance, queue: QueueManagerService) {
  const submissions: SubmissionDependencies = {
    capture: lookupCapture,
    campaign: lookupCampaign,
    enqueue: async (context, uuid) => {
      await queue.enqueue(createSubmissionHandoffJob(context, uuid));
    }
  };
  await registerMarketing(app, { context: marketingContext }, submissions, {
    brand: lookupBrand,
    crm: async (context, recipient) => {
      const identity = await tenantIdentity(context.tenantId, context.actorEmail, "crm");
      const ids = await contactIdsForEmailPolicy(identity.tenant.dbName, recipient);
      return checkContactRestrictions(
        { ...identity, database: identity.database as never, companyId: context.companyId },
        recipient,
        ids
      );
    },
    mail: async (context, recipient) => {
      const identity = await tenantIdentity(context.tenantId, context.actorEmail, "mail");
      return checkMailSuppression(
        { ...identity, database: identity.database as never, companyId: context.companyId },
        recipient
      );
    }
  });
  const ownerContext = async (request: FastifyRequest, moduleKey: string) => {
    const access = tenantAccessContext(request);
    const identity = await tenantIdentity(access.tenantId, access.actorEmail, moduleKey);
    if (identity.tenant.dbName !== access.tenantDatabase)
      throw AppError.forbidden("The tenant database does not match the session.");
    const companyId = (await getDefaultCompanyForDatabase(identity.tenant.dbName))?.companyId;
    const company = companyId
      ? await getCompanyForDatabase(identity.tenant.dbName, companyId)
      : null;
    if (!companyId || company?.status !== "active")
      throw AppError.validation("Select an active application default company.");
    return { ...identity, database: identity.database as never, companyId };
  };
  registerContactRestrictionRoutes(app, (request) => ownerContext(request, "crm"));
  registerMailSuppressionRoutes(app, (request) => ownerContext(request, "mail"));
  registerPublicCapture(app, marketingContext, {
    secret: env.JWT_SECRET,
    submissions,
    resolve: (binding) => companyScope(binding.tenantId, binding.actorEmail, binding.companyId),
    verifyOrigin: async (context, origin) => {
      const tenant = await new TenantRepository().findByDomain(new URL(origin).hostname);
      if (!tenant || tenant.status !== "active" || tenant.uuid !== context.tenantId)
        throw AppError.forbidden(
          "Verify this website domain for the current tenant before publishing capture."
        );
    }
  });
  registerConnectionAuthorization(app, marketingContext, async (request) => {
    const ctx = await marketingContext(request);
    const clientId = process.env.CODEXSUN_MARKETING_GOOGLE_CLIENT_ID ?? "",
      clientSecret = process.env.CODEXSUN_MARKETING_GOOGLE_CLIENT_SECRET ?? "",
      redirectUri = process.env.CODEXSUN_MARKETING_GOOGLE_REDIRECT_URI ?? "";
    return {
      secret: env.JWT_SECRET,
      sessionIdentity: request.authContext!.session.uuid,
      google:
        clientId && clientSecret && redirectUri
          ? new GoogleChannelConnector({ clientId, clientSecret, redirectUri })
          : null,
      claim: (provider, account, connection) =>
        claimProviderAccount(provider, account, ctx.tenantId, connection),
      release: (provider, account, connection) =>
        releaseProviderAccount(provider, account, ctx.tenantId, connection)
    };
  });
  registerMarketingBackground(app, queue);
}

export function registerMarketingBackground(app: FastifyInstance, queue: QueueManagerService) {
  registerQueueJobProcessor("marketing.submission.handoff", async (job) => {
    if (
      !job.tenantId ||
      typeof job.payload.uuid !== "string" ||
      !/^[a-f0-9]{8}$/.test(job.payload.uuid)
    )
      throw AppError.validation("Invalid Marketing handoff job.");
    const identity = await tenantIdentity(job.tenantId, job.actorEmail ?? "", "marketing");
    const route = await submissionRouting(identity.database as never, job.payload.uuid);
    if (!route || route.actorEmail !== job.actorEmail || route.companyId !== job.payload.companyId)
      throw AppError.forbidden("The handoff job does not match its persisted owner.");
    const context = await companyScope(job.tenantId, route.actorEmail, route.companyId);
    return processSubmissionHandoff(context, job.payload.uuid, async (row) => {
      const capture = await lookupCapture(context, row.captureUuid);
      const brand = await lookupBrand(context, capture.brandUuid);
      const campaign = await lookupCampaign(context, row.campaignUuid);
      if (capture.status !== "active" || brand.status !== "active" || campaign.status !== "active")
        throw AppError.conflict("The capture source is inactive.");
      return new LeadService(context).intake(row);
    });
  });
  if (!queue.canExecute()) return;
  let running = false;
  let activeRelay: Promise<void> | undefined;
  const relayCursors = new Map<string, number>();
  const relay = async () => {
    if (running) return;
    running = true;
    try {
      await queue.expireRunningJobs(["marketing.submission.handoff"], 5 * 60 * 1000);
      for (const tenant of await new TenantRepository().list()) {
        if (tenant.status !== "active") continue;
        try {
          const enabled = await new EntitlementRepository().resolveTenantModuleKeys(tenant.id);
          if (!enabled.includes("marketing")) continue;
          const identity = await tenantIdentity(tenant.uuid, "", "marketing");
          const pending = await pendingSubmissionHandoffs(
            identity.database as never,
            relayCursors.get(tenant.uuid) ?? 0
          );
          relayCursors.set(tenant.uuid, pending.length === 100 ? pending.at(-1)!.id : 0);
          for (const row of pending) {
            try {
              const context = await companyScope(tenant.uuid, row.actorEmail, row.companyId);
              await queue.enqueue(createSubmissionHandoffJob(context, row.uuid));
            } catch {
              app.log.warn(
                { tenantId: tenant.uuid, submissionUuid: row.uuid },
                "Marketing handoff awaits valid activation and grants."
              );
            }
          }
        } catch (error) {
          if (!(error instanceof AppError && error.code === "FORBIDDEN"))
            app.log.warn({ tenantId: tenant.uuid }, "Marketing handoff tenant is unavailable.");
        }
      }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => {
    if (!activeRelay)
      activeRelay = relay()
        .catch(() => app.log.error("Marketing handoff relay failed."))
        .finally(() => {
          activeRelay = undefined;
        });
  }, 15000);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await activeRelay;
  });
}
