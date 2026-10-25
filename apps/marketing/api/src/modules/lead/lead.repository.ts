import { AppError } from "@codexsun/framework/errors";
import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type { LeadInput, LeadRecord, LeadActivity, LeadStatus } from "./lead.types.js";

export class LeadRepository {
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
    brandUuid?: string
  ): Promise<LeadRecord[]> {
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return (
      await sql<LeadRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, campaign_uuid AS campaignUuid, capture_uuid AS captureUuid, submission_uuid AS submissionUuid, source, source_reference AS sourceReference, name, email, phone, company_name AS companyName, notes, status, assigned_to AS assignedTo, score, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_leads
   WHERE company_id=${this.ctx.companyId} ${this.scope()} ${brandFilter} AND (${status} = 'all' OR status=${status}) AND (name LIKE ${"%" + search + "%"} OR email LIKE ${"%" + search + "%"} OR phone LIKE ${"%" + search + "%"}) ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`.execute(
        this.ctx.database
      )
    ).rows;
  }

  async count(search = "", status = "all", brandUuid?: string) {
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return Number(
      (
        await sql<{
          total: number;
        }>`SELECT COUNT(*) AS total FROM marketing_leads WHERE company_id=${this.ctx.companyId} ${this.scope()} ${brandFilter} AND (${status}='all' OR status=${status}) AND (name LIKE ${"%" + search + "%"} OR email LIKE ${"%" + search + "%"} OR phone LIKE ${"%" + search + "%"})`.execute(
          this.ctx.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async get(uuid: string): Promise<LeadRecord | null> {
    return (
      (
        await sql<LeadRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, campaign_uuid AS campaignUuid, capture_uuid AS captureUuid, submission_uuid AS submissionUuid, source, source_reference AS sourceReference, name, email, phone, company_name AS companyName, notes, status, assigned_to AS assignedTo, score, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_leads WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(
          this.ctx.database
        )
      ).rows[0] ?? null
    );
  }

  async getBySubmissionUuid(submissionUuid: string): Promise<LeadRecord | null> {
    return (
      (
        await sql<LeadRecord>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, campaign_uuid AS campaignUuid, capture_uuid AS captureUuid, submission_uuid AS submissionUuid, source, source_reference AS sourceReference, name, email, phone, company_name AS companyName, notes, status, assigned_to AS assignedTo, score, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_leads WHERE submission_uuid=${submissionUuid} AND company_id=${this.ctx.companyId} ${this.scope()} ORDER BY id DESC LIMIT 1`.execute(
          this.ctx.database
        )
      ).rows[0] ?? null
    );
  }

  async save(input: LeadInput, uuid?: string): Promise<string> {
    const identity = uuid ?? randomBytes(4).toString("hex");
    const status = input.status ?? "new";
    const campaignUuid = input.campaignUuid ?? "";
    const captureUuid = input.captureUuid ?? "";
    const submissionUuid = input.submissionUuid ?? "";
    const source = input.source ?? "direct";
    const sourceReference = input.sourceReference ?? "";
    const email = input.email ?? "";
    const phone = input.phone ?? "";
    const companyName = input.companyName ?? "";
    const notes = input.notes ?? "";
    const assignedTo = input.assignedTo ?? "";
    const score = input.score ?? 0;

    await this.ctx.database.transaction().execute(async (database) => {
      if (uuid) {
        const current = (
          await sql<{
            revision: number;
          }>`SELECT revision FROM marketing_leads WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
            database
          )
        ).rows[0];
        if (!current) throw AppError.notFound("Lead was not found.");
        if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) {
          throw AppError.conflict("This record changed. Refresh it before saving.");
        }
        await sql`UPDATE marketing_leads SET revision=revision+1, name=${input.name}, email=${email}, phone=${phone}, company_name=${companyName}, notes=${notes}, status=${status}, assigned_to=${assignedTo}, score=${score}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${identity} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);
      } else {
        await sql`INSERT INTO marketing_leads(uuid, company_id, brand_uuid, campaign_uuid, capture_uuid, submission_uuid, source, source_reference, name, email, phone, company_name, notes, status, assigned_to, score, created_by, updated_by)
    VALUES(${identity}, ${this.ctx.companyId}, ${input.brandUuid}, ${campaignUuid}, ${captureUuid}, ${submissionUuid}, ${source}, ${sourceReference}, ${input.name}, ${email}, ${phone}, ${companyName}, ${notes}, ${status}, ${assignedTo}, ${score}, ${this.ctx.actorEmail}, ${this.ctx.actorEmail})`.execute(
          database
        );
      }

      await sql`INSERT INTO marketing_leads_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${identity}, ${this.ctx.companyId}, ${uuid ? "updated" : "created"}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });

    return identity;
  }

  async assign(uuid: string, assignedTo: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{
          revision: number;
        }>`SELECT revision FROM marketing_leads WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
          database
        )
      ).rows[0];
      if (!current) throw AppError.notFound("Lead was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_leads SET revision=revision+1, assigned_to=${assignedTo}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_leads_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, ${"assigned:" + assignedTo}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async updateStatus(uuid: string, status: LeadStatus, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{
          revision: number;
        }>`SELECT revision FROM marketing_leads WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
          database
        )
      ).rows[0];
      if (!current) throw AppError.notFound("Lead was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_leads SET revision=revision+1, status=${status}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_leads_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, ${"status:" + status}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async activity(uuid: string): Promise<LeadActivity[]> {
    return (
      await sql<LeadActivity>`SELECT action, actor, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.000Z') AS occurredAt FROM marketing_leads_activity WHERE company_id=${this.ctx.companyId} AND record_uuid=${uuid} ORDER BY id DESC LIMIT 100`.execute(
        this.ctx.database
      )
    ).rows;
  }
}
