import { canDispatchCrmFrappeSync } from "../../crm-frappe-sync-access.js";
import { sql, type Kysely } from "kysely";
import {
  crmDutySyncIdempotencyKey,
  type CrmFrappeSyncDatabase,
  type EnquiryDatabase
} from "@codexsun/crm-api";
import {
  FrappeLiveSyncService,
  recoverContactExports,
  type FrappeDatabase
} from "@codexsun/frappe-api";
import type { TenantDatabase } from "../../database/schema.js";
import { TenantRepository } from "../tenant/tenant.repository.js";
import { getTenantDatabase } from "../../database/tenant-database.js";
import type { QueueManagerService } from "./queue-manager.service.js";

export function startCrmDutySyncRelay(queue: QueueManagerService) {
  let running = false;
  const dispatch = async () => {
    if (running) return;
    running = true;
    try {
      for (const tenant of await new TenantRepository().list()) {
        if (tenant.status !== "active" || !tenant.enabledModuleKeys.includes("crm")) continue;
        const database = getTenantDatabase(tenant) as unknown as Kysely<
          EnquiryDatabase & CrmFrappeSyncDatabase & TenantDatabase & FrappeDatabase
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
          if (!(await canDispatchCrmFrappeSync(getTenantDatabase(tenant)))) continue;
          const live = await new FrappeLiveSyncService(database).settings();
          const contactsEnabled =
            live.enabled &&
            !live.paused &&
            live.direction === "bidirectional" &&
            live.modules.contacts;
          if (contactsEnabled) await recoverContactExports(database);
          await sql`UPDATE crm_frappe_sync_queue SET status='pending', available_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP(), last_error='Worker stopped before finishing this sync.' WHERE status='processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)`.execute(
            database
          );
          const events = await sql<{
            id: number;
            uuid: string;
            entity_type: string;
            local_record_id: number;
            actor_email: string;
            attempts: number;
            dispatch_revision: number;
          }>`SELECT id,uuid,entity_type,local_record_id,actor_email,attempts,dispatch_revision FROM crm_frappe_sync_queue WHERE status='pending' AND available_at<=UTC_TIMESTAMP() AND attempts<5 ORDER BY id LIMIT 50`.execute(
            database
          );
          for (const event of events.rows) {
            if (event.entity_type === "contact" && !contactsEnabled) continue;
            try {
              await queue.enqueue({
                dispatchImmediately: true,
                actorEmail: event.actor_email,
                correlationId: `crm-duty-sync:${event.uuid}`,
                idempotencyKey: crmDutySyncIdempotencyKey(
                  tenant.uuid,
                  event.uuid,
                  event.attempts,
                  event.dispatch_revision
                ),
                jobName:
                  event.entity_type === "contact"
                    ? "crm.contact.frappe-sync"
                    : "crm.sop.frappe-sync",
                maxAttempts: 1,
                payload: { tenantDatabase: tenant.dbName, queueId: event.id },
                queueName: "crm",
                sourceModule: "crm.frappe-sync",
                tenantId: tenant.uuid
              });
            } catch (error) {
              console.warn("[crm-duty-sync] queue dispatch deferred", {
                tenantId: tenant.uuid,
                eventId: event.id,
                message: error instanceof Error ? error.message : "Queue dispatch failed."
              });
            }
          }
        } catch (error) {
          console.warn("[crm-duty-sync] tenant outbox scan deferred", {
            tenantId: tenant.uuid,
            message: error instanceof Error ? error.message : "Outbox scan failed."
          });
        }
      }
    } catch (error) {
      console.warn("[crm-duty-sync] relay pass deferred", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void dispatch(), 5000);
  timer.unref?.();
  void dispatch();
  return () => clearInterval(timer);
}
