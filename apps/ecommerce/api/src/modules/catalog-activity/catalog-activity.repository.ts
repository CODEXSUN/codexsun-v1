import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import type {
  CatalogActivityInput,
  CatalogActivityRecord,
  CatalogActivityResource
} from "./catalog-activity.types.js";

type Row = Record<string, unknown> & {
  id: number | string;
  resource_type: CatalogActivityResource;
  record_id: number | string;
};

export class CatalogActivityRepository {
  async list(resourceType: CatalogActivityResource, recordId: number) {
    const result = await sql<Row>`SELECT * FROM ecommerce_staff_catalog_activity
      WHERE resource_type=${resourceType} AND record_id=${recordId}
      ORDER BY created_at DESC, id DESC LIMIT 100`.execute(getEcommerceDatabase());
    return result.rows.map(toRecord);
  }

  async record(input: CatalogActivityInput) {
    await sql`INSERT INTO ecommerce_staff_catalog_activity
      (created_by,uuid,resource_type,record_id,action,actor_email,summary)
      VALUES (${input.actorEmail},${randomBytes(4).toString("hex")},${input.resourceType},
        ${input.recordId},${input.action},${input.actorEmail},${input.summary})`.execute(
      getEcommerceDatabase()
    );
  }
}

function toRecord(row: Row): CatalogActivityRecord {
  return {
    id: Number(row.id),
    uuid: String(row.uuid),
    resourceType: row.resource_type,
    recordId: Number(row.record_id),
    action: String(row.action),
    actorEmail: String(row.actor_email),
    summary: String(row.summary ?? ""),
    createdAt: new Date(row.created_at as string).toISOString()
  };
}
