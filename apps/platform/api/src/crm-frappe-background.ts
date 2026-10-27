import { readCrmFrappeSyncAccess } from "./crm-frappe-sync-access.js";

import {
  CrmFrappeSyncRepository,
  resolveListInForImport,
  type EnquiryDatabase,
  type ListInDatabase,
  type CrmFrappeSyncDatabase
} from "@codexsun/crm-api";

import {
  processContactExport,
  FrappeConnectionAccess,
  FrappeConnectionRepository,
  importFrappeCallLogs,
  linkEnquiryCustomerIdentity,
  FrappeExportService,
  processFrappeExportJob,
  FrappeLiveSyncService,
  frappeEnquiryImportJobName,
  processFrappeEnquiryImportJob,
  processLocalEnquirySync,
  frappeCrmDutySyncModule,
  mappedEmployeeCodeForLocalUser,
  mappedLocalUserForEmployeeCode,
  mappedLocalActorForEmployeeCode,
  mappedLocalActorForFrappeUser,
  type FrappeDatabase,
  type ExportKind,
  type FrappeUserMappingDatabase
} from "@codexsun/frappe-api";
import {
  EnquiryRepository,
  EnquiryService,
  EnquirySyncRepository
} from "@codexsun/crm-api/enquiry-sync";
import { AppError } from "@codexsun/framework/errors";

import { enqueueCrmEnquirySync } from "./modules/queue-manager/crm-enquiry-sync.relay.js";
import { QueueManagerService } from "./modules/queue-manager/queue-manager.service.js";
import { registerQueueJobProcessor } from "./modules/queue-manager/queue-manager.worker.js";

import { TenantRepository } from "./modules/tenant/tenant.repository.js";
import { getTenantDatabase } from "./database/tenant-database.js";
import type { TenantDatabase } from "./database/schema.js";
import { env } from "./env.js";

import { enquiryRelations } from "./enquiry-relations-host.js";
export function registerCrmFrappeBackground(queueService: QueueManagerService) {
  const frappeSettings = {
    baseUrl: env.CODEXSUN_FRAPPE_BASE_URL,
    apiKey: env.CODEXSUN_FRAPPE_APP_KEY,
    apiSecret: env.CODEXSUN_FRAPPE_APP_SECRET,
    enabled: env.CODEXSUN_FRAPPE_ENABLED === "1"
  };
  const ensureFrappeImportOpen = async (database: import("kysely").Kysely<FrappeDatabase>) => {
    if ((await new FrappeConnectionRepository(database).importState()).completedAt)
      throw AppError.conflict("Frappe import is complete. Use local CRM records now.");
  };
  registerQueueJobProcessor("frappe.export", async (job, report) => {
    const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
    if (!tenant || tenant.dbName !== job.payload.tenantDatabase)
      throw new Error("The Frappe export tenant no longer exists.");
    const access = await readCrmFrappeSyncAccess(getTenantDatabase(tenant));
    if (!access.enabled || (job.payload.mode === "export" && !access.outbound))
      return { skipped: true, reason: "Frappe sync is disabled for this tenant or direction." };
    const database = getTenantDatabase(tenant);
    const enabled = await database
      .selectFrom("app_module_settings")
      .select("module_key")
      .where("module_key", "in", ["crm", "frappe"])
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .execute();
    if (enabled.length !== 2) throw new Error("CRM and Frappe must be enabled for export.");
    return processFrappeExportJob(
      database as unknown as import("kysely").Kysely<FrappeDatabase>,
      env.JWT_SECRET,
      frappeSettings,
      job.payload,
      tenant.dbName,
      report
    );
  });
  registerQueueJobProcessor("frappe.live-sync", async (job, report) => {
    const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
    const kind = job.payload.kind as ExportKind;
    if (!tenant || tenant.dbName !== job.payload.tenantDatabase)
      throw new Error("The Frappe live sync tenant is invalid.");
    const database = getTenantDatabase(
      tenant
    ) as unknown as import("kysely").Kysely<FrappeDatabase>;
    if (!(await readCrmFrappeSyncAccess(getTenantDatabase(tenant))).outbound)
      return { scanned: 0, exported: 0, failed: 0, failures: [], results: [] };
    const settings = await new FrappeLiveSyncService(database).settings();
    if (!settings.modules[kind])
      return { scanned: 0, exported: 0, failed: 0, failures: [], results: [] };
    const baseUrl =
      (
        await new FrappeConnectionAccess(
          database,
          env.JWT_SECRET,
          frappeSettings
        ).exportCredentials()
      )?.baseUrl ?? "";
    if (!baseUrl) throw new Error("Enable and verify the Frappe connection before live sync.");
    return new FrappeExportService(database, env.JWT_SECRET, frappeSettings).liveSync(
      kind,
      baseUrl,
      report
    );
  });
  frappeCrmDutySyncModule.register((jobName, processCrmDutySync) => {
    registerQueueJobProcessor(jobName, async (job) => {
      const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
      if (
        !tenant ||
        tenant.dbName !== job.payload.tenantDatabase ||
        typeof job.payload.queueId !== "number"
      )
        throw new Error("CRM duty sync tenant or queue event is invalid.");
      const database = getTenantDatabase(
        tenant
      ) as unknown as import("kysely").Kysely<FrappeDatabase>;
      if (!(await readCrmFrappeSyncAccess(getTenantDatabase(tenant))).outbound) {
        await new CrmFrappeSyncRepository(
          database as unknown as import("kysely").Kysely<CrmFrappeSyncDatabase>
        ).deferDispatch(job.payload.queueId);
        return { eventId: job.payload.queueId, status: "skipped" };
      }
      const connection = await new FrappeConnectionAccess(
        database,
        env.JWT_SECRET,
        frappeSettings
      ).credentials();
      if (!connection) {
        const message = "Verify the Frappe connection before processing CRM duty sync.";
        await new CrmFrappeSyncRepository(
          database as unknown as import("kysely").Kysely<CrmFrappeSyncDatabase>
        ).recordDispatchError(job.payload.queueId, message);
        throw AppError.conflict(message);
      }
      return processCrmDutySync(
        database as unknown as import("kysely").Kysely<
          import("@codexsun/crm-api").DutyReportDatabase & CrmFrappeSyncDatabase & FrappeDatabase
        >,
        job.payload.queueId,
        connection,
        (email, baseUrl) =>
          mappedEmployeeCodeForLocalUser(
            database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            email,
            baseUrl
          )
      );
    });
  });
  registerQueueJobProcessor("crm.contact.frappe-sync", async (job) => {
    const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
    if (
      !tenant ||
      tenant.dbName !== job.payload.tenantDatabase ||
      typeof job.payload.queueId !== "number"
    )
      throw AppError.conflict("Contact export tenant or queue event is invalid.");
    if (!(await readCrmFrappeSyncAccess(getTenantDatabase(tenant))).outbound) {
      await new CrmFrappeSyncRepository(
        getTenantDatabase(tenant) as unknown as import("kysely").Kysely<CrmFrappeSyncDatabase>
      ).deferDispatch(job.payload.queueId);
      return { eventId: job.payload.queueId, status: "skipped" };
    }
    return processContactExport(
      getTenantDatabase(tenant) as unknown as import("kysely").Kysely<
        import("@codexsun/frappe-api").ContactExportDatabase
      >,
      job.payload.queueId,
      env.JWT_SECRET,
      frappeSettings
    );
  });
  registerQueueJobProcessor("crm.enquiry.frappe-sync", async (job) => {
    const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
    const eventId = Number(job.payload.eventId);
    if (
      !tenant ||
      tenant.dbName !== job.payload.tenantDatabase ||
      !Number.isSafeInteger(eventId) ||
      eventId < 1
    )
      throw new Error("The CRM enquiry sync tenant or outbox event is invalid.");
    const database = getTenantDatabase(tenant) as unknown as import("kysely").Kysely<
      FrappeDatabase & TenantDatabase
    >;
    if (!(await readCrmFrappeSyncAccess(getTenantDatabase(tenant))).outbound) {
      await new EnquirySyncRepository(
        database as unknown as import("kysely").Kysely<EnquiryDatabase>
      ).deferDelivery(eventId);
      return { eventId, status: "skipped" };
    }
    const live = await new FrappeLiveSyncService(database).settings();
    if (live.direction === "inbound" || !live.enabled || live.paused || !live.modules.enquiries)
      throw AppError.conflict("Automatic enquiry export is paused: Frappe → CRM only.");
    const sync = new EnquirySyncRepository(
      database as unknown as import("kysely").Kysely<EnquiryDatabase>
    );
    try {
      const enabled = await database
        .selectFrom("app_module_settings")
        .select("module_key")
        .where("module_key", "in", ["crm", "frappe"])
        .where("enabled", "=", true)
        .where("status", "=", "active")
        .execute();
      if (enabled.length !== 2)
        throw AppError.conflict("CRM and Frappe must both be enabled for enquiry export.");
      const result = await processLocalEnquirySync(
        database as unknown as import("kysely").Kysely<FrappeDatabase>,
        eventId,
        env.JWT_SECRET,
        frappeSettings
      );
      if (result.status === "synced") {
        const current = await sync.getEvent(eventId);
        const next = current ? (await sync.dispatchableEvents(1, current.enquiry_id))[0] : null;
        if (next)
          await enqueueCrmEnquirySync(queueService, {
            tenantId: tenant.uuid,
            tenantDatabase: tenant.dbName,
            eventId: next.id,
            actorEmail: next.actor_email,
            attempts: next.attempts,
            correlationId: next.correlation_id
          });
      }
      return result;
    } catch (error) {
      const currentSettings = await new FrappeLiveSyncService(database).settings();
      if (
        currentSettings.direction === "inbound" ||
        !currentSettings.enabled ||
        currentSettings.paused ||
        !currentSettings.modules.enquiries
      )
        throw error;
      const event = await sync.getEvent(eventId);
      if (!event) throw error;
      if (event.status === "synced" || event.status === "failed")
        return { eventId, status: event.status, remoteName: event.remote_name };
      const message = error instanceof Error ? error.message : "Frappe enquiry sync failed.";
      await sync.markFailed(eventId, event.attempts, message);
      return { eventId, status: "retry" as const, remoteName: event.remote_name, error: message };
    }
  });
  registerQueueJobProcessor("crm.call-log.frappe-sync", async (job) => ({
    eventId: Number(job.payload.eventId),
    status: "stopped"
  }));
  registerQueueJobProcessor("frappe.call-logs.import", async (job, report) => {
    const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
    if (
      !tenant ||
      tenant.dbName !== job.payload.tenantDatabase ||
      typeof job.payload.baseUrl !== "string"
    )
      throw new Error("The Frappe call log import tenant or connection is invalid.");
    if (!(await readCrmFrappeSyncAccess(getTenantDatabase(tenant))).enabled)
      return { scanned: 0, created: 0, skipped: 0, failed: 0, failures: [] };
    await ensureFrappeImportOpen(
      getTenantDatabase(tenant) as unknown as import("kysely").Kysely<FrappeDatabase>
    );
    return importFrappeCallLogs(
      getTenantDatabase(tenant) as unknown as import("kysely").Kysely<FrappeDatabase>,
      env.JWT_SECRET,
      job.payload.baseUrl,
      report,
      (remoteUser, baseUrl) =>
        mappedLocalActorForFrappeUser(
          getTenantDatabase(
            tenant
          ) as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
          remoteUser,
          baseUrl
        )
    );
  });
  registerQueueJobProcessor(frappeEnquiryImportJobName, async (job, report) => {
    const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
    if (
      !tenant ||
      tenant.dbName !== job.payload.tenantDatabase ||
      typeof job.payload.baseUrl !== "string"
    )
      throw new Error("The Frappe enquiry backfill tenant or connection is no longer valid.");
    const database = getTenantDatabase(tenant);
    if (!(await readCrmFrappeSyncAccess(database)).enabled)
      return { scanned: 0, created: 0, skipped: 0, failed: 0, failures: [] };
    if (
      typeof job.payload.modifiedAfter !== "string" &&
      typeof job.payload.checkpointAt !== "string"
    )
      await ensureFrappeImportOpen(database as unknown as import("kysely").Kysely<FrappeDatabase>);
    else {
      const liveSync = await new FrappeLiveSyncService(
        database as unknown as import("kysely").Kysely<FrappeDatabase>
      ).settings();
      if (!liveSync.enabled || liveSync.paused || !liveSync.modules.enquiries)
        return { scanned: 0, created: 0, skipped: 0, failed: 0, failures: [] };
    }
    const enabled = await database
      .selectFrom("app_module_settings")
      .select("module_key")
      .where("module_key", "in", ["crm", "frappe"])
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .execute();
    if (enabled.length !== 2) throw new Error("CRM and Frappe must be enabled for backfill.");
    const enquiries = new EnquiryService(
      new EnquiryRepository(database as unknown as import("kysely").Kysely<EnquiryDatabase>),
      enquiryRelations({ database, tenantDatabase: tenant.dbName }),
      { actorEmail: job.actorEmail ?? "system:frappe-import", actorUserId: null, canViewAll: true }
    );
    return processFrappeEnquiryImportJob(
      {
        database: database as unknown as import("kysely").Kysely<FrappeDatabase>,
        createEnquiry: (input) => enquiries.create(input, job.actorEmail ?? "system:frappe-import"),
        createImportedEnquiry: (input, source) =>
          enquiries.createImported(input, job.actorEmail ?? "system:frappe-import", source),
        updateImportedEnquiry: (id, input, source) =>
          enquiries.updateImported(id, input, job.actorEmail ?? "system:frappe-import", source),
        importComment: (id, comment) => enquiries.importComment(id, comment),
        linkCustomerIdentity: (sourceKey, remoteName, localContactId) =>
          linkEnquiryCustomerIdentity(
            database as unknown as import("kysely").Kysely<FrappeDatabase>,
            sourceKey,
            remoteName,
            localContactId
          ),
        localActorForFrappeUser: (remoteUser, baseUrl) =>
          mappedLocalActorForFrappeUser(
            database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            remoteUser,
            baseUrl
          ),
        localActorForEmployee: (employeeCode, baseUrl) =>
          mappedLocalActorForEmployeeCode(
            database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            employeeCode,
            baseUrl
          ),
        updateEnquiry: (id, input) =>
          enquiries.update(id, input, job.actorEmail ?? "system:frappe-import"),
        localUserForEmployee: (code, baseUrl) =>
          mappedLocalUserForEmployeeCode(
            database as unknown as import("kysely").Kysely<FrappeUserMappingDatabase>,
            code,
            baseUrl
          ),
        listInForName: (name) =>
          resolveListInForImport(
            database as unknown as import("kysely").Kysely<ListInDatabase>,
            name
          )
      },
      frappeSettings,
      env.JWT_SECRET,
      job.payload.baseUrl,
      typeof job.payload.modifiedAfter === "string" ? job.payload.modifiedAfter : undefined,
      report,
      typeof job.payload.checkpointAt === "string" ? job.payload.checkpointAt : undefined
    );
  });
}
