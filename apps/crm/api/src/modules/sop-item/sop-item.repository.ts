import { randomUUID } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type {
  SopItemDatabase,
  SopItemInput,
  SopItemRecord,
  SopItemRevision,
  SopRevisionInput,
  SelectedSopItemRow,
  SelectedSopItemRevisionRow
} from "./sop-item.types.js";
import { enqueueCrmFrappeSync } from "../frappe-sync/index.js";
import type { CrmFrappeSyncDatabase } from "../frappe-sync/index.js";

export class SopItemRepository {
  constructor(private readonly database: Kysely<SopItemDatabase>) {}

  async list(search = "") {
    let query = this.database
      .selectFrom("crm_sop_items as item")
      .innerJoin("crm_sops as sop", "sop.id", "item.sop_id")
      .leftJoin("crm_frappe_sync_queue as sync", (join) =>
        join.onRef("sync.local_record_id", "=", "item.id").on("sync.entity_type", "=", "sop-item")
      )
      .select([
        "item.id",
        "item.uuid",
        "item.sop_id",
        "item.code",
        "item.title",
        "item.department",
        "item.frequency",
        "item.sort_order",
        "item.status",
        "item.created_by",
        "item.updated_by",
        "item.created_at",
        "item.updated_at",
        "sync.status as frappe_sync_status"
      ])
      .where("sop.status", "=", "active");
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("item.code", "like", term),
          eb("item.title", "like", term),
          eb("item.department", "like", term),
          eb("sop.title", "like", term)
        ])
      );
    }
    const rows = await query.orderBy("item.sop_id").orderBy("item.sort_order").execute();
    return Promise.all(rows.map((row) => this.withRevision(mapItem(row))));
  }

  async get(id: number) {
    const row = await this.database
      .selectFrom("crm_sop_items as item")
      .leftJoin("crm_frappe_sync_queue as sync", (join) =>
        join.onRef("sync.local_record_id", "=", "item.id").on("sync.entity_type", "=", "sop-item")
      )
      .selectAll("item")
      .select("sync.status as frappe_sync_status")
      .where("item.id", "=", id)
      .executeTakeFirst();
    return row ? this.withRevision(mapItem(row)) : null;
  }

  async create(input: SopItemInput, actor: string, revision: SopRevisionInput) {
    const id = await this.database.transaction().execute(async (trx) => {
      const sop = await trx
        .selectFrom("crm_sops")
        .select(["id", "status"])
        .where("id", "=", input.sopId)
        .executeTakeFirst();
      if (!sop || sop.status !== "active")
        throw AppError.validation("The selected SOP is not active.");
      const inserted = await trx
        .insertInto("crm_sop_items")
        .values({
          uuid: randomUUID(),
          sop_id: input.sopId,
          code: input.code,
          title: input.title,
          department: input.department,
          frequency: input.frequency,
          sort_order: input.sortOrder,
          status: "active",
          created_by: actor,
          updated_by: actor
        })
        .executeTakeFirstOrThrow();
      const id = Number(inserted.insertId);
      await trx
        .insertInto("crm_sop_item_revisions")
        .values({
          uuid: randomUUID(),
          sop_item_id: id,
          revision: 1,
          instructions: revision.instructions,
          evidence_guidance: revision.evidenceGuidance,
          status: "draft",
          effective_from: null,
          author: actor
        })
        .execute();
      return id;
    });
    return (await this.get(id))!;
  }

  async update(id: number, input: SopItemInput, actor: string) {
    await this.database.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom("crm_sop_items")
        .select("frequency")
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (current.frequency !== input.frequency) {
        const assigned =
          await sql`SELECT id FROM crm_duty_assignments WHERE sop_item_id = ${id} LIMIT 1`.execute(
            trx
          );
        if (assigned.rows.length)
          throw AppError.conflict(
            "An assigned SOP Item's frequency cannot change. Create a new SOP Item for a different recurrence."
          );
      }
      await trx
        .updateTable("crm_sop_items")
        .set({
          sop_id: input.sopId,
          code: input.code,
          title: input.title,
          department: input.department,
          frequency: input.frequency,
          sort_order: input.sortOrder,
          updated_by: actor,
          updated_at: sql`UTC_TIMESTAMP()`
        })
        .where("id", "=", id)
        .execute();
      const published = await trx
        .selectFrom("crm_sop_item_revisions")
        .select("id")
        .where("sop_item_id", "=", id)
        .where("status", "=", "published")
        .executeTakeFirst();
      if (published)
        await enqueueCrmFrappeSync(
          trx as unknown as Kysely<CrmFrappeSyncDatabase>,
          "sop-item",
          id,
          actor
        );
    });
    return this.get(id);
  }

  async revisions(itemId: number) {
    const rows = await this.database
      .selectFrom("crm_sop_item_revisions")
      .selectAll()
      .where("sop_item_id", "=", itemId)
      .orderBy("revision", "desc")
      .execute();
    return rows.map(mapRevision);
  }

  async createRevision(itemId: number, input: SopRevisionInput, actor: string) {
    const latest = await this.database
      .selectFrom("crm_sop_item_revisions")
      .select(({ fn }) => fn.max<number>("revision").as("revision"))
      .where("sop_item_id", "=", itemId)
      .executeTakeFirstOrThrow();
    await this.database
      .insertInto("crm_sop_item_revisions")
      .values({
        uuid: randomUUID(),
        sop_item_id: itemId,
        revision: Number(latest.revision ?? 0) + 1,
        instructions: input.instructions,
        evidence_guidance: input.evidenceGuidance,
        status: "draft",
        effective_from: null,
        author: actor
      })
      .execute();
    return (await this.revisions(itemId))[0]!;
  }

  async updateRevision(itemId: number, revisionId: number, input: SopRevisionInput) {
    const result = await this.database
      .updateTable("crm_sop_item_revisions")
      .set(inputToRevision(input))
      .where("id", "=", revisionId)
      .where("sop_item_id", "=", itemId)
      .where("status", "=", "draft")
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      const current = (await this.revisions(itemId)).find((row) => row.id === revisionId);
      return current?.status === "draft" ? current : null;
    }
    return (await this.revisions(itemId)).find((row) => row.id === revisionId) ?? null;
  }

  async publish(itemId: number, revisionId: number, actor: string) {
    return this.database.transaction().execute(async (trx) => {
      const revision = await trx
        .selectFrom("crm_sop_item_revisions")
        .selectAll()
        .where("id", "=", revisionId)
        .where("sop_item_id", "=", itemId)
        .executeTakeFirst();
      if (!revision || revision.status !== "draft") return null;
      await trx
        .updateTable("crm_sop_item_revisions")
        .set({ status: "superseded" })
        .where("sop_item_id", "=", itemId)
        .where("status", "=", "published")
        .execute();
      await trx
        .updateTable("crm_sop_item_revisions")
        .set({
          status: "published",
          effective_from: sql`UTC_DATE()`,
          published_at: sql`UTC_TIMESTAMP()`
        })
        .where("id", "=", revisionId)
        .execute();
      await enqueueCrmFrappeSync(
        trx as unknown as Kysely<CrmFrappeSyncDatabase>,
        "sop-item",
        itemId,
        actor
      );
      return mapRevision(
        await trx
          .selectFrom("crm_sop_item_revisions")
          .selectAll()
          .where("id", "=", revisionId)
          .executeTakeFirstOrThrow()
      );
    });
  }

  private async withRevision(item: SopItemRecord) {
    const row = await this.database
      .selectFrom("crm_sop_item_revisions")
      .selectAll()
      .where("sop_item_id", "=", item.id)
      .where("status", "in", ["draft", "published"])
      .orderBy("revision", "desc")
      .executeTakeFirst();
    return { ...item, currentRevision: row ? mapRevision(row) : null };
  }
}

function mapItem(
  row: SelectedSopItemRow & {
    frappe_sync_status?: "pending" | "processing" | "failed" | "synced" | null;
  }
): SopItemRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    sopId: row.sop_id,
    code: row.code,
    title: row.title,
    department: row.department,
    frequency: row.frequency,
    sortOrder: row.sort_order,
    status: row.status,
    frappeSyncStatus: row.frappe_sync_status ?? null,
    currentRevision: null,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}
function mapRevision(row: SelectedSopItemRevisionRow): SopItemRevision {
  return {
    id: row.id,
    uuid: row.uuid,
    sopItemId: row.sop_item_id,
    revision: row.revision,
    instructions: row.instructions,
    evidenceGuidance: row.evidence_guidance,
    status: row.status,
    effectiveFrom: row.effective_from ? String(row.effective_from).slice(0, 10) : null,
    author: row.author,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  };
}
function inputToRevision(input: SopRevisionInput) {
  return { instructions: input.instructions, evidence_guidance: input.evidenceGuidance };
}
