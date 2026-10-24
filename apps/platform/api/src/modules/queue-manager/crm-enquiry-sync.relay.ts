import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { EnquirySyncRepository, type EnquiryDatabase } from "@codexsun/crm-api/enquiry-sync";
import { FrappeLiveSyncService, type FrappeDatabase } from "@codexsun/frappe-api";
import type { TenantDatabase } from "../../database/schema.js";
import { TenantRepository } from "../tenant/tenant.repository.js";
import { getTenantDatabase, getTenantDatabaseByName } from "../../database/tenant-database.js";
import type { QueueManagerService } from "./queue-manager.service.js";

export function crmEnquiryDeliveryKey(
  tenantId: string,
  event: {
    id: number;
    attempts: number;
    correlation_id: string;
  }
) {
  const generation = createHash("sha256").update(event.correlation_id).digest("hex").slice(0, 24);
  return `crm-enquiry-sync:${tenantId}:${event.id}:${event.attempts}:${generation}`;
}

export async function enqueueCrmEnquirySync(
  queue: QueueManagerService,
  input: {
    tenantId: string;
    tenantDatabase: string;
    eventId: number;
    actorEmail: string;
    attempts?: number;
    correlationId?: string;
  }
) {
  const sync = new EnquirySyncRepository(
    getTenantDatabaseByName(input.tenantDatabase) as unknown as Kysely<EnquiryDatabase>
  );
  const event = await sync.getEvent(input.eventId);
  if (
    !event ||
    !(await sync.dispatchableEvents(1, event.enquiry_id)).some((row) => row.id === input.eventId)
  )
    return null;
  return queue.enqueue({
    dispatchImmediately: true,
    actorEmail: input.actorEmail,
    correlationId: event.correlation_id,
    idempotencyKey: crmEnquiryDeliveryKey(input.tenantId, event),
    jobName: "crm.enquiry.frappe-sync",
    maxAttempts: 6,
    payload: { eventId: input.eventId, tenantDatabase: input.tenantDatabase },
    queueName: "crm",
    sourceModule: "crm.enquiry",
    tenantId: input.tenantId
  });
}

export function startCrmEnquirySyncRelay(queue: QueueManagerService) {
  let running = false;
  const dispatch = async () => {
    if (running) return;
    running = true;
    try {
      const tenants = await new TenantRepository().list();
      for (const tenant of tenants) {
        if (tenant.status !== "active") continue;
        const database = getTenantDatabase(tenant) as unknown as Kysely<
          EnquiryDatabase & TenantDatabase & FrappeDatabase
        >;
        try {
          const enabled = await database
            .selectFrom("app_module_settings")
            .select("module_key")
            .where("module_key", "in", ["crm", "frappe"])
            .where("enabled", "=", true)
            .where("status", "=", "active")
            .execute();
          if (enabled.length !== 2) continue;
          const connection = await database
            .selectFrom("frappe_connection_settings")
            .select(["enabled", "verification_status"])
            .where("id", "=", 1)
            .executeTakeFirst();
          if (!connection?.enabled || connection.verification_status !== "verified") continue;
          const live = await new FrappeLiveSyncService(database).settings();
          if (
            live.direction === "inbound" ||
            !live.enabled ||
            live.paused ||
            !live.modules.enquiries
          )
            continue;
          const sync = new EnquirySyncRepository(database);
          await sync.requeueStaleProcessing();
          const events = await sync.dispatchableEvents();
          for (const event of events) {
            try {
              await enqueueCrmEnquirySync(queue, {
                tenantId: tenant.uuid,
                tenantDatabase: tenant.dbName,
                eventId: event.id,
                actorEmail: event.actor_email,
                attempts: event.attempts,
                correlationId: event.correlation_id
              });
            } catch (error) {
              console.warn("[crm-enquiry-sync] outbox dispatch deferred", {
                tenantId: tenant.uuid,
                eventId: event.id,
                message: error instanceof Error ? error.message : "Queue dispatch failed."
              });
            }
          }
          await sql`UPDATE crm_call_log_sync_events SET status='retry', attempts=attempts+1,
            last_error='Sync worker stopped before recording a result.', available_at=UTC_TIMESTAMP(),
            updated_at=UTC_TIMESTAMP()
            WHERE status='processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)`.execute(
            database
          );
          const callEvents = await sql<{ id: number; attempts: number; actor_email: string }>`
            SELECT event.id, event.attempts, log.created_by AS actor_email
            FROM crm_call_log_sync_events event
            INNER JOIN crm_call_logs log ON log.id=event.call_log_id
            WHERE event.status IN ('pending','retry') AND event.available_at <= UTC_TIMESTAMP()
            ORDER BY event.id LIMIT 50`.execute(database);
          for (const event of callEvents.rows) {
            try {
              await queue.enqueue({
                actorEmail: event.actor_email,
                correlationId: `crm-call-log:${event.id}`,
                idempotencyKey: `crm-call-log-sync:${tenant.uuid}:${event.id}:${event.attempts}`,
                jobName: "crm.call-log.frappe-sync",
                maxAttempts: 6,
                payload: { eventId: event.id, tenantDatabase: tenant.dbName },
                queueName: "crm",
                sourceModule: "crm.call-log",
                tenantId: tenant.uuid
              });
            } catch (error) {
              console.warn("[crm-call-log-sync] outbox dispatch deferred", {
                tenantId: tenant.uuid,
                eventId: event.id,
                message: error instanceof Error ? error.message : "Queue dispatch failed."
              });
            }
          }
        } catch (error) {
          // Tenants without the CRM sync migration are not eligible for outbox dispatch.
          if (tenant.enabledModuleKeys.includes("crm"))
            console.warn("[crm-enquiry-sync] tenant outbox scan deferred", {
              tenantId: tenant.uuid,
              message: error instanceof Error ? error.message : "Outbox scan failed."
            });
        }
      }
    } catch (error) {
      console.warn("[crm-enquiry-sync] relay pass deferred", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void dispatch(), 5000);
  timer.unref?.();
  void dispatch();
  return () => clearInterval(timer);
}
