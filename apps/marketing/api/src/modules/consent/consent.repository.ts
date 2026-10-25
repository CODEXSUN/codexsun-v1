import { createHash, randomBytes } from "node:crypto";
import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import type {
  ConsentInput,
  ConsentRecord,
  EligibilityInput,
  ContactRestrictionInput,
  ContactRestrictionRecord,
  ContactRestrictionChannel,
  PolicyResult
} from "./consent.types.js";

type RestrictionDbRow = {
  uuid: string;
  companyId: number;
  recipient: string;
  channel: ContactRestrictionChannel;
  blocked: number | boolean;
  reason: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export class ConsentRepository {
  constructor(private readonly context: MarketingContext) {}

  private projection() {
    return sql`uuid,company_id AS companyId,brand_uuid AS brandUuid,recipient,channel,purpose,action,
      notice_version AS noticeVersion,evidence,source,request_key AS requestKey,created_by AS createdBy,
      DATE_FORMAT(occurred_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt,
      DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS expiresAt,
      DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt`;
  }

  private scope() {
    const c = this.context;
    return c.allowedBrands.length ? sql`brand_uuid IN (${sql.join(c.allowedBrands)})` : sql`FALSE`;
  }

  async list(search: string, action: string, limit: number, offset: number) {
    return (
      await sql<ConsentRecord>`SELECT ${this.projection()} FROM marketing_consent_events
      WHERE company_id=${this.context.companyId} AND ${this.scope()}
      AND (${action}='all' OR action=${action}) AND recipient LIKE ${"%" + search + "%"}
      ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`.execute(this.context.database)
    ).rows;
  }

  async count(search: string, action: string) {
    return Number(
      (
        await sql<{ total: number }>`SELECT COUNT(*) AS total FROM marketing_consent_events
      WHERE company_id=${this.context.companyId} AND ${this.scope()}
      AND (${action}='all' OR action=${action}) AND recipient LIKE ${"%" + search + "%"}`.execute(
          this.context.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async get(uuid: string) {
    return (
      (
        await sql<ConsentRecord>`SELECT ${this.projection()} FROM marketing_consent_events
      WHERE uuid=${uuid} AND company_id=${this.context.companyId} AND ${this.scope()}`.execute(
          this.context.database
        )
      ).rows[0] ?? null
    );
  }

  async latest(input: EligibilityInput) {
    return (
      (
        await sql<ConsentRecord>`SELECT ${this.projection()} FROM marketing_consent_events
      WHERE company_id=${this.context.companyId} AND brand_uuid=${input.brandUuid}
      AND recipient=${input.recipient} AND channel=${input.channel} AND purpose=${input.purpose}
      ORDER BY id DESC LIMIT 1`.execute(this.context.database)
      ).rows[0] ?? null
    );
  }

  async append(input: ConsentInput) {
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.context.database.transaction().execute(async (database) => {
      // Serialize changes for this brand so a withdrawal cannot race a grant.
      await sql`SELECT id FROM marketing_brands WHERE uuid=${input.brandUuid} AND company_id=${this.context.companyId} FOR UPDATE`.execute(
        database
      );
      const existing = (
        await sql<{
          uuid: string;
          payloadHash: string;
        }>`SELECT uuid,payload_hash AS payloadHash FROM marketing_consent_events WHERE company_id=${this.context.companyId} AND request_key=${input.requestKey}`.execute(
          database
        )
      ).rows[0];
      if (existing) {
        if (existing.payloadHash !== hash)
          throw AppError.conflict(
            "This request key was already used for different consent evidence."
          );
        return existing.uuid;
      }
      if (input.action === "grant") {
        const latest = (
          await sql<{
            occurredAt: string;
          }>`SELECT DATE_FORMAT(occurred_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt FROM marketing_consent_events WHERE company_id=${this.context.companyId} AND brand_uuid=${input.brandUuid} AND recipient=${input.recipient} AND channel=${input.channel} AND purpose=${input.purpose} ORDER BY id DESC LIMIT 1`.execute(
            database
          )
        ).rows[0];
        if (latest && new Date(latest.occurredAt).getTime() >= Date.parse(input.occurredAt))
          throw AppError.conflict("New consent requires evidence later than the previous entry.");
      }
      const uuid = randomBytes(4).toString("hex");
      await sql`INSERT INTO marketing_consent_events(uuid,company_id,brand_uuid,recipient,channel,purpose,action,notice_version,evidence,source,occurred_at,expires_at,request_key,payload_hash,created_by,created_at,updated_at)
        VALUES(${uuid},${this.context.companyId},${input.brandUuid},${input.recipient},${input.channel},${input.purpose},${input.action},${input.noticeVersion},${input.evidence},${input.source},${utcDatabaseTime(input.occurredAt)},${input.expiresAt ? utcDatabaseTime(input.expiresAt) : null},${input.requestKey},${hash},${this.context.actorEmail},UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`.execute(
        database
      );
      return uuid;
    });
  }

  // Contact Restrictions
  async listRestrictions(
    search = "",
    channel = "all",
    limit = 50,
    offset = 0
  ): Promise<ContactRestrictionRecord[]> {
    const channelFilter = channel === "all" ? sql`` : sql`AND channel=${channel}`;
    const rows = (
      await sql<RestrictionDbRow>`SELECT uuid, company_id AS companyId, recipient, channel, blocked, reason, status, created_by AS createdBy, DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_contact_restrictions
      WHERE company_id=${this.context.companyId} ${channelFilter} AND (recipient LIKE ${"%" + search + "%"} OR reason LIKE ${"%" + search + "%"})
      ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`.execute(this.context.database)
    ).rows;

    return rows.map((r) => ({
      ...r,
      blocked: Boolean(r.blocked)
    }));
  }

  async countRestrictions(search = "", channel = "all"): Promise<number> {
    const channelFilter = channel === "all" ? sql`` : sql`AND channel=${channel}`;
    return Number(
      (
        await sql<{ total: number }>`SELECT COUNT(*) AS total FROM marketing_contact_restrictions
      WHERE company_id=${this.context.companyId} ${channelFilter} AND (recipient LIKE ${"%" + search + "%"} OR reason LIKE ${"%" + search + "%"})`.execute(
          this.context.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async getRestriction(uuid: string): Promise<ContactRestrictionRecord | null> {
    const row = (
      await sql<RestrictionDbRow>`SELECT uuid, company_id AS companyId, recipient, channel, blocked, reason, status, created_by AS createdBy, DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.000Z') AS createdAt, DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt FROM marketing_contact_restrictions
      WHERE uuid=${uuid} AND company_id=${this.context.companyId}`.execute(this.context.database)
    ).rows[0];

    if (!row) return null;
    return {
      ...row,
      blocked: Boolean(row.blocked)
    };
  }

  async recordRestriction(input: ContactRestrictionInput, uuid: string): Promise<string> {
    await sql`INSERT INTO marketing_contact_restrictions(uuid, company_id, recipient, channel, blocked, reason, status, created_by, created_at, updated_at)
    VALUES(${uuid}, ${this.context.companyId}, ${input.recipient}, ${input.channel}, ${input.blocked}, ${input.reason}, 'active', ${this.context.actorEmail}, UTC_TIMESTAMP(), UTC_TIMESTAMP())`.execute(
      this.context.database
    );
    return uuid;
  }

  async checkRestriction(
    recipient: string,
    channel: ContactRestrictionChannel = "all"
  ): Promise<PolicyResult> {
    const channelFilter =
      channel === "all"
        ? sql``
        : sql`AND (channel=${channel} OR channel='all')`;

    const row = (
      await sql<{ blocked: number; reason: string }>`SELECT blocked, reason FROM marketing_contact_restrictions
      WHERE company_id=${this.context.companyId} AND recipient=${recipient} ${channelFilter}
      ORDER BY id DESC LIMIT 1`.execute(this.context.database)
    ).rows[0];

    if (row && Boolean(row.blocked)) {
      return { allowed: false, reason: row.reason || "do_not_contact" };
    }
    return { allowed: true, reason: "no_restriction" };
  }
}

function utcDatabaseTime(value: string) {
  return new Date(value).toISOString().slice(0, 23).replace("T", " ");
}
