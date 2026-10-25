import { AppError } from "@codexsun/framework/errors";
import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type { FollowUpInput, FollowUpRecord, FollowUpActivity } from "./follow-up.types.js";

export class FollowUpRepository {
  constructor(private readonly ctx: MarketingContext) {}

  private scope() {
    const ctx = this.ctx;
    if (ctx.allBrands) return sql``;
    return ctx.allowedBrands.length
      ? sql`AND brand_uuid IN (${sql.join(ctx.allowedBrands)})`
      : sql`AND 1=0`;
  }

  async list(
    search = "",
    limit = 50,
    offset = 0,
    status = "all",
    leadUuid?: string,
    brandUuid?: string
  ): Promise<FollowUpRecord[]> {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return (
      await sql<FollowUpRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, action_type AS actionType, subject, notes, DATE_FORMAT(due_at, '%Y-%m-%dT%H:%i:%s.000Z') AS dueAt, assigned_to AS assignedTo, status, DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%s.000Z') AS completedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_follow_ups
   WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${status} = 'all' OR status=${status}) AND (subject LIKE ${"%" + search + "%"} OR notes LIKE ${"%" + search + "%"} OR assigned_to LIKE ${"%" + search + "%"}) ORDER BY due_at ASC, id DESC LIMIT ${limit} OFFSET ${offset}`.execute(
        this.ctx.database
      )
    ).rows;
  }

  async count(search = "", status = "all", leadUuid?: string, brandUuid?: string) {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return Number(
      (
        await sql<{
          total: number;
        }>`SELECT COUNT(*) AS total FROM marketing_follow_ups WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${status}='all' OR status=${status}) AND (subject LIKE ${"%" + search + "%"} OR notes LIKE ${"%" + search + "%"} OR assigned_to LIKE ${"%" + search + "%"})`.execute(
          this.ctx.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async get(uuid: string): Promise<FollowUpRecord | null> {
    return (
      (
        await sql<FollowUpRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, action_type AS actionType, subject, notes, DATE_FORMAT(due_at, '%Y-%m-%dT%H:%i:%s.000Z') AS dueAt, assigned_to AS assignedTo, status, DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%s.000Z') AS completedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_follow_ups WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(
          this.ctx.database
        )
      ).rows[0] ?? null
    );
  }

  async save(input: FollowUpInput, uuid?: string): Promise<string> {
    const identity = uuid ?? randomBytes(4).toString("hex");
    const notes = input.notes ?? "";
    const status = input.status ?? "pending";

    await this.ctx.database.transaction().execute(async (database) => {
      if (uuid) {
        const current = (
          await sql<{
            revision: number;
          }>`SELECT revision FROM marketing_follow_ups WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
            database
          )
        ).rows[0];
        if (!current) throw AppError.notFound("Follow-up was not found.");
        if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) {
          throw AppError.conflict("This record changed. Refresh it before saving.");
        }
        await sql`UPDATE marketing_follow_ups SET revision=revision+1, action_type=${input.actionType}, subject=${input.subject}, notes=${notes}, due_at=${input.dueAt}, assigned_to=${input.assignedTo}, status=${status}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${identity} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);
      } else {
        await sql`INSERT INTO marketing_follow_ups(uuid, company_id, brand_uuid, lead_uuid, action_type, subject, notes, due_at, assigned_to, status, created_by, updated_by)
    VALUES(${identity}, ${this.ctx.companyId}, ${input.brandUuid}, ${input.leadUuid}, ${input.actionType}, ${input.subject}, ${notes}, ${input.dueAt}, ${input.assignedTo}, ${status}, ${this.ctx.actorEmail}, ${this.ctx.actorEmail})`.execute(
          database
        );
      }

      await sql`INSERT INTO marketing_follow_ups_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${identity}, ${this.ctx.companyId}, ${uuid ? "updated" : "created"}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });

    return identity;
  }

  async complete(uuid: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{
          revision: number;
        }>`SELECT revision FROM marketing_follow_ups WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
          database
        )
      ).rows[0];
      if (!current) throw AppError.notFound("Follow-up was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_follow_ups SET revision=revision+1, status='completed', completed_at=UTC_TIMESTAMP(), updated_by=${this.ctx.actorEmail}
    WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_follow_ups_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'completed', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async cancel(uuid: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{
          revision: number;
        }>`SELECT revision FROM marketing_follow_ups WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
          database
        )
      ).rows[0];
      if (!current) throw AppError.notFound("Follow-up was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_follow_ups SET revision=revision+1, status='cancelled', updated_by=${this.ctx.actorEmail}
    WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_follow_ups_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'cancelled', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async activity(uuid: string): Promise<FollowUpActivity[]> {
    return (
      await sql<FollowUpActivity>`SELECT action, actor, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.000Z') AS occurredAt FROM marketing_follow_ups_activity WHERE company_id=${this.ctx.companyId} AND record_uuid=${uuid} ORDER BY id DESC LIMIT 100`.execute(
        this.ctx.database
      )
    ).rows;
  }
}
