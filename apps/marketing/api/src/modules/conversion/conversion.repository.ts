import { AppError } from "@codexsun/framework/errors";
import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type { ConversionInput, ConversionRecord, ConversionActivity, ConversionStatus } from "./conversion.types.js";

type ConversionDbRow = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  leadUuid: string;
  qualificationUuid: string;
  status: ConversionStatus;
  declaredValue: number | string | null;
  currency: string;
  cancellationReason: string;
  notes: string;
  convertedAt: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export class ConversionRepository {
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
  ): Promise<ConversionRecord[]> {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    const rows = (
      await sql<ConversionDbRow>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, qualification_uuid AS qualificationUuid, status, declared_value AS declaredValue, currency, cancellation_reason AS cancellationReason, notes, DATE_FORMAT(converted_at, '%Y-%m-%dT%H:%i:%s.000Z') AS convertedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_conversions
   WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${status} = 'all' OR status=${status}) AND (currency LIKE ${"%" + search + "%"} OR cancellation_reason LIKE ${"%" + search + "%"}) ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`.execute(
        this.ctx.database
      )
    ).rows;

    return rows.map((r) => ({
      ...r,
      declaredValue: Number(r.declaredValue ?? 0)
    }));
  }

  async count(search = "", status = "all", leadUuid?: string, brandUuid?: string) {
    const leadFilter = leadUuid ? sql`AND lead_uuid=${leadUuid}` : sql``;
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    return Number(
      (
        await sql<{
          total: number;
        }>`SELECT COUNT(*) AS total FROM marketing_conversions WHERE company_id=${this.ctx.companyId} ${this.scope()} ${leadFilter} ${brandFilter} AND (${status}='all' OR status=${status}) AND (currency LIKE ${"%" + search + "%"} OR cancellation_reason LIKE ${"%" + search + "%"})`.execute(
          this.ctx.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async get(uuid: string): Promise<ConversionRecord | null> {
    const row = (
      await sql<ConversionDbRow>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, qualification_uuid AS qualificationUuid, status, declared_value AS declaredValue, currency, cancellation_reason AS cancellationReason, notes, DATE_FORMAT(converted_at, '%Y-%m-%dT%H:%i:%s.000Z') AS convertedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_conversions WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(
        this.ctx.database
      )
    ).rows[0];

    if (!row) return null;
    return {
      ...row,
      declaredValue: Number(row.declaredValue ?? 0)
    };
  }

  async getByLead(leadUuid: string): Promise<ConversionRecord | null> {
    const row = (
      await sql<ConversionDbRow>`SELECT uuid, revision, company_id AS companyId, brand_uuid AS brandUuid, lead_uuid AS leadUuid, qualification_uuid AS qualificationUuid, status, declared_value AS declaredValue, currency, cancellation_reason AS cancellationReason, notes, DATE_FORMAT(converted_at, '%Y-%m-%dT%H:%i:%s.000Z') AS convertedAt, created_by AS createdBy, updated_by AS updatedBy, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_conversions WHERE lead_uuid=${leadUuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(
        this.ctx.database
      )
    ).rows[0];

    if (!row) return null;
    return {
      ...row,
      declaredValue: Number(row.declaredValue ?? 0)
    };
  }

  async save(input: ConversionInput, uuid?: string): Promise<string> {
    const identity = uuid ?? randomBytes(4).toString("hex");
    const declaredValue = input.declaredValue ?? 0.0;
    const currency = input.currency ?? "INR";
    const notes = input.notes ?? "";

    await this.ctx.database.transaction().execute(async (database) => {
      if (uuid) {
        const current = (
          await sql<{
            revision: number;
          }>`SELECT revision FROM marketing_conversions WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
            database
          )
        ).rows[0];
        if (!current) throw AppError.notFound("Conversion record was not found.");
        if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) {
          throw AppError.conflict("This record changed. Refresh it before saving.");
        }
        await sql`UPDATE marketing_conversions SET revision=revision+1, declared_value=${declaredValue}, currency=${currency}, notes=${notes}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${identity} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);
      } else {
        await sql`INSERT INTO marketing_conversions(uuid, company_id, brand_uuid, lead_uuid, qualification_uuid, status, declared_value, currency, cancellation_reason, notes, created_by, updated_by)
    VALUES(${identity}, ${this.ctx.companyId}, ${input.brandUuid}, ${input.leadUuid}, ${input.qualificationUuid}, 'converted', ${declaredValue}, ${currency}, '', ${notes}, ${this.ctx.actorEmail}, ${this.ctx.actorEmail})`.execute(
          database
        );
      }

      await sql`INSERT INTO marketing_conversions_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${identity}, ${this.ctx.companyId}, ${uuid ? "updated" : "converted"}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });

    return identity;
  }

  async setStatus(
    uuid: string,
    status: ConversionStatus,
    reason: string,
    expectedRevision?: number
  ): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{
          revision: number;
        }>`SELECT revision FROM marketing_conversions WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
          database
        )
      ).rows[0];
      if (!current) throw AppError.notFound("Conversion record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_conversions SET revision=revision+1, status=${status}, cancellation_reason=${reason}, updated_by=${this.ctx.actorEmail}
    WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_conversions_activity(uuid, record_uuid, company_id, action, actor)
    VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, ${status + ":" + reason}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async activity(uuid: string): Promise<ConversionActivity[]> {
    return (
      await sql<ConversionActivity>`SELECT action, actor, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.000Z') AS occurredAt FROM marketing_conversions_activity WHERE company_id=${this.ctx.companyId} AND record_uuid=${uuid} ORDER BY id DESC LIMIT 100`.execute(
        this.ctx.database
      )
    ).rows;
  }
}
