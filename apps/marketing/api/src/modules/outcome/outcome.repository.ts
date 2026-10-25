import { AppError } from "@codexsun/framework/errors";
import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type { OutcomeInput, OutcomeRecord, OutcomeActivity } from "./outcome.types.js";

export class OutcomeRepository {
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
    disposition = "all",
    leadUuid?: string,
    brandUuid?: string
  ): Promise<OutcomeRecord[]> {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return (
      await sql<OutcomeRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, qualification_uuid AS qualificationUuid, conversion_uuid AS conversionUuid, disposition, reason, previous_outcome_uuid AS previousOutcomeUuid, notes, DATE_FORMAT(decided_at, '%Y-%m-%dT%H:%i:%s.000Z') AS decidedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_outcomes
   WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${disposition} = 'all' OR disposition=${disposition}) AND (reason LIKE ${"%" + search + "%"} OR notes LIKE ${"%" + search + "%"}) ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`.execute(
        this.ctx.database
      )
    ).rows;
  }

  async count(search = "", disposition = "all", leadUuid?: string, brandUuid?: string) {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return Number(
      (
        await sql<{
          total: number;
        }>`SELECT COUNT(*) AS total FROM marketing_outcomes WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${disposition}='all' OR disposition=${disposition}) AND (reason LIKE ${"%" + search + "%"} OR notes LIKE ${"%" + search + "%"})`.execute(
          this.ctx.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async get(uuid: string): Promise<OutcomeRecord | null> {
    return (
      (
        await sql<OutcomeRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, qualification_uuid AS qualificationUuid, conversion_uuid AS conversionUuid, disposition, reason, previous_outcome_uuid AS previousOutcomeUuid, notes, DATE_FORMAT(decided_at, '%Y-%m-%dT%H:%i:%s.000Z') AS decidedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_outcomes WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(
          this.ctx.database
        )
      ).rows[0] ?? null
    );
  }

  async getLatestForLead(leadUuid: string): Promise<OutcomeRecord | null> {
    return (
      (
        await sql<OutcomeRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, qualification_uuid AS qualificationUuid, conversion_uuid AS conversionUuid, disposition, reason, previous_outcome_uuid AS previousOutcomeUuid, notes, DATE_FORMAT(decided_at, '%Y-%m-%dT%H:%i:%s.000Z') AS decidedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_outcomes WHERE lead_uuid=${leadUuid} AND company_id=${this.ctx.companyId} ${this.scope()} ORDER BY id DESC LIMIT 1`.execute(
          this.ctx.database
        )
      ).rows[0] ?? null
    );
  }

  async save(input: OutcomeInput, uuid?: string): Promise<string> {
    const identity = uuid ?? randomBytes(4).toString("hex");
    const qualificationUuid = input.qualificationUuid ?? "";
    const conversionUuid = input.conversionUuid ?? "";
    const previousOutcomeUuid = input.previousOutcomeUuid ?? null;
    const notes = input.notes ?? "";

    await this.ctx.database.transaction().execute(async (database) => {
      if (uuid) {
        const current = (
          await sql<{
            revision: number;
          }>`SELECT revision FROM marketing_outcomes WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
            database
          )
        ).rows[0];
        if (!current) throw AppError.notFound("Outcome was not found.");
        if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) {
          throw AppError.conflict("This record changed. Refresh it before saving.");
        }
        await sql`UPDATE marketing_outcomes SET revision=revision+1, disposition=${input.disposition}, reason=${input.reason}, notes=${notes}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${identity} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);
      } else {
        await sql`INSERT INTO marketing_outcomes(uuid, company_id, brand_uuid, lead_uuid, qualification_uuid, conversion_uuid, disposition, reason, previous_outcome_uuid, notes, created_by, updated_by)
    VALUES(${identity}, ${this.ctx.companyId}, ${input.brandUuid}, ${input.leadUuid}, ${qualificationUuid}, ${conversionUuid}, ${input.disposition}, ${input.reason}, ${previousOutcomeUuid}, ${notes}, ${this.ctx.actorEmail}, ${this.ctx.actorEmail})`.execute(
          database
        );
      }

      await sql`INSERT INTO marketing_outcomes_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${identity}, ${this.ctx.companyId}, ${previousOutcomeUuid ? "corrected:" + input.disposition : (uuid ? "updated" : "recorded:" + input.disposition)}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });

    return identity;
  }

  async activity(uuid: string): Promise<OutcomeActivity[]> {
    return (
      await sql<OutcomeActivity>`SELECT action, actor, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.000Z') AS occurredAt FROM marketing_outcomes_activity WHERE company_id=${this.ctx.companyId} AND record_uuid=${uuid} ORDER BY id DESC LIMIT 100`.execute(
        this.ctx.database
      )
    ).rows;
  }
}
