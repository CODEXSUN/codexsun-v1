import { AppError } from "@codexsun/framework/errors";
import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type { QualificationInput, QualificationRecord, QualificationActivity } from "./qualification.types.js";

export class QualificationRepository {
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
    decision = "all",
    leadUuid?: string,
    brandUuid?: string
  ): Promise<QualificationRecord[]> {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return (
      await sql<QualificationRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, reviewer, decision, criteria, reason, notes, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_qualifications
   WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${decision} = 'all' OR decision=${decision}) AND (reason LIKE ${"%" + search + "%"} OR criteria LIKE ${"%" + search + "%"} OR reviewer LIKE ${"%" + search + "%"}) ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`.execute(
        this.ctx.database
      )
    ).rows;
  }

  async count(search = "", decision = "all", leadUuid?: string, brandUuid?: string) {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return Number(
      (
        await sql<{
          total: number;
        }>`SELECT COUNT(*) AS total FROM marketing_qualifications WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${decision}='all' OR decision=${decision}) AND (reason LIKE ${"%" + search + "%"} OR criteria LIKE ${"%" + search + "%"} OR reviewer LIKE ${"%" + search + "%"})`.execute(
          this.ctx.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async get(uuid: string): Promise<QualificationRecord | null> {
    return (
      (
        await sql<QualificationRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, reviewer, decision, criteria, reason, notes, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_qualifications WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(
          this.ctx.database
        )
      ).rows[0] ?? null
    );
  }

  async getLatestForLead(leadUuid: string): Promise<QualificationRecord | null> {
    return (
      (
        await sql<QualificationRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, reviewer, decision, criteria, reason, notes, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_qualifications WHERE lead_uuid=${leadUuid} AND company_id=${this.ctx.companyId} ${this.scope()} ORDER BY id DESC LIMIT 1`.execute(
          this.ctx.database
        )
      ).rows[0] ?? null
    );
  }

  async save(input: QualificationInput, uuid?: string): Promise<string> {
    const identity = uuid ?? randomBytes(4).toString("hex");
    const criteria = input.criteria ?? "";
    const notes = input.notes ?? "";

    await this.ctx.database.transaction().execute(async (database) => {
      if (uuid) {
        const current = (
          await sql<{
            revision: number;
          }>`SELECT revision FROM marketing_qualifications WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
            database
          )
        ).rows[0];
        if (!current) throw AppError.notFound("Qualification record was not found.");
        if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) {
          throw AppError.conflict("This record changed. Refresh it before saving.");
        }
        await sql`UPDATE marketing_qualifications SET revision=revision+1, decision=${input.decision}, criteria=${criteria}, reason=${input.reason}, notes=${notes}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${identity} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);
      } else {
        await sql`INSERT INTO marketing_qualifications(uuid, company_id, brand_uuid, lead_uuid, reviewer, decision, criteria, reason, notes, created_by, updated_by)
    VALUES(${identity}, ${this.ctx.companyId}, ${input.brandUuid}, ${input.leadUuid}, ${this.ctx.actorEmail}, ${input.decision}, ${criteria}, ${input.reason}, ${notes}, ${this.ctx.actorEmail}, ${this.ctx.actorEmail})`.execute(
          database
        );
      }

      // Update parent lead status to match decision
      await sql`UPDATE marketing_leads SET status=${input.decision}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${input.leadUuid} AND company_id=${this.ctx.companyId}`.execute(database);

      await sql`INSERT INTO marketing_qualifications_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${identity}, ${this.ctx.companyId}, ${uuid ? "updated" : "created"}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });

    return identity;
  }

  async activity(uuid: string): Promise<QualificationActivity[]> {
    return (
      await sql<QualificationActivity>`SELECT action, actor, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.000Z') AS occurredAt FROM marketing_qualifications_activity WHERE company_id=${this.ctx.companyId} AND record_uuid=${uuid} ORDER BY id DESC LIMIT 100`.execute(
        this.ctx.database
      )
    ).rows;
  }
}
