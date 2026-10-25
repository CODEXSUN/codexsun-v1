import { sql, type Kysely } from "kysely";
import type { CrmFrappeSyncDatabase } from "./frappe-sync.migration.js";
import type { CrmFrappeSyncType } from "./frappe-sync.types.js";
export class CrmFrappeSyncRepository {
  constructor(private readonly db: Kysely<CrmFrappeSyncDatabase>) {}
  async deferDispatch(id: number) {
    await this.db
      .updateTable("crm_frappe_sync_queue")
      .set({ dispatch_revision: sql`dispatch_revision + 1` })
      .where("id", "=", id)
      .where("status", "=", "pending")
      .execute();
  }
  async recordDispatchError(id: number, message: string) {
    await this.db
      .updateTable("crm_frappe_sync_queue")
      .set({ last_error: message.slice(0, 2000) })
      .where("id", "=", id)
      .where("status", "=", "pending")
      .execute();
  }
  find(type: CrmFrappeSyncType, id: number) {
    return this.db
      .selectFrom("crm_frappe_sync_queue")
      .selectAll()
      .where("entity_type", "=", type)
      .where("local_record_id", "=", id)
      .executeTakeFirst();
  }
}

export function crmDutySyncIdempotencyKey(
  tenantId: string,
  eventUuid: string,
  attempts: number,
  revision?: number
) {
  return `crm-duty-sync:${tenantId}:${eventUuid}:${attempts}${revision === undefined ? "" : `:${revision}`}`;
}

export async function enqueueCrmFrappeSync(
  database: Kysely<CrmFrappeSyncDatabase>,
  entity: CrmFrappeSyncType,
  id: number,
  actorEmail: string,
  sourceUpdatedAt?: string
) {
  const source = sourceUpdatedAt ? { source_updated_at: sourceUpdatedAt } : {};
  await database
    .insertInto("crm_frappe_sync_queue")
    .values({
      entity_type: entity,
      local_record_id: id,
      actor_email: actorEmail,
      status: "pending",
      attempts: 0,
      available_at: sql`UTC_TIMESTAMP()`,
      remote_name: null,
      last_error: null,
      ...source
    })
    .onDuplicateKeyUpdate({
      actor_email: actorEmail,
      dispatch_revision: sql`dispatch_revision+1`,
      attempts: sql`CASE WHEN status='processing' THEN attempts ELSE 0 END`,
      status: sql`CASE WHEN status = 'processing' THEN status ELSE 'pending' END`,
      available_at: sql`CASE WHEN status = 'processing' THEN available_at ELSE UTC_TIMESTAMP() END`,
      last_error: sql`CASE WHEN status = 'processing' THEN last_error ELSE NULL END`,
      ...source
    })
    .execute();
}
