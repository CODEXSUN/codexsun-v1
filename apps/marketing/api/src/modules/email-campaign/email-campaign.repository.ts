import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type {
  EmailCampaignActivity,
  EmailCampaignInput,
  EmailCampaignRecord,
  EmailCampaignRecipient,
  EmailCampaignStatus,
  EmailSenderInput,
  EmailSenderRecord,
  RecipientStatus
} from "./email-campaign.types.js";

type CampaignRow = {
  uuid: string;
  company_id: number;
  brand_uuid: string;
  campaign_uuid: string | null;
  sender_uuid: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  name: string;
  subject: string;
  preheader: string;
  body_html: string;
  body_text: string;
  status: EmailCampaignStatus;
  rejection_reason: string | null;
  scheduled_at: Date | string | null;
  sent_count: number;
  suppressed_count: number;
  bounced_count: number;
  complained_count: number;
  unsubscribed_count: number;
  total_recipients: number;
  revision: number;
  created_by: string;
  updated_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type SenderRow = {
  uuid: string;
  company_id: number;
  brand_uuid: string;
  name: string;
  email: string;
  domain: string;
  spf_status: "verified" | "unverified" | "failed";
  dkim_status: "verified" | "unverified" | "failed";
  dmarc_status: "verified" | "unverified" | "failed";
  is_verified: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type RecipientRow = {
  uuid: string;
  company_id: number;
  email_campaign_uuid: string;
  recipient_email: string;
  lead_uuid: string | null;
  status: RecipientStatus;
  suppression_reason: string | null;
  unsubscribe_token: string;
  sent_at: Date | string | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export class EmailCampaignRepository {
  constructor(private readonly context: MarketingContext) {}

  private mapCampaign(row: CampaignRow): EmailCampaignRecord {
    return {
      uuid: row.uuid,
      companyId: row.company_id,
      brandUuid: row.brand_uuid,
      campaignUuid: row.campaign_uuid ?? null,
      senderUuid: row.sender_uuid,
      fromName: row.from_name,
      fromEmail: row.from_email,
      replyTo: row.reply_to,
      name: row.name,
      subject: row.subject,
      preheader: row.preheader ?? "",
      bodyHtml: row.body_html,
      bodyText: row.body_text,
      status: row.status,
      rejectionReason: row.rejection_reason ?? null,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      sentCount: Number(row.sent_count ?? 0),
      suppressedCount: Number(row.suppressed_count ?? 0),
      bouncedCount: Number(row.bounced_count ?? 0),
      complainedCount: Number(row.complained_count ?? 0),
      unsubscribedCount: Number(row.unsubscribed_count ?? 0),
      totalRecipients: Number(row.total_recipients ?? 0),
      revision: Number(row.revision ?? 1),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private mapSender(row: SenderRow): EmailSenderRecord {
    return {
      uuid: row.uuid,
      companyId: row.company_id,
      brandUuid: row.brand_uuid,
      name: row.name,
      email: row.email,
      domain: row.domain,
      spfStatus: row.spf_status,
      dkimStatus: row.dkim_status,
      dmarcStatus: row.dmarc_status,
      isVerified: Boolean(row.is_verified),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private mapRecipient(row: RecipientRow): EmailCampaignRecipient {
    return {
      uuid: row.uuid,
      companyId: row.company_id,
      emailCampaignUuid: row.email_campaign_uuid,
      recipientEmail: row.recipient_email,
      leadUuid: row.lead_uuid ?? null,
      status: row.status,
      suppressionReason: row.suppression_reason ?? null,
      unsubscribeToken: row.unsubscribe_token,
      sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
      error: row.error ?? null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  /* Sender Operations */

  async saveSender(input: EmailSenderInput): Promise<string> {
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_email_senders (
      uuid, company_id, brand_uuid, name, email, domain, spf_status, dkim_status, dmarc_status, is_verified
    ) VALUES (
      ${uuid}, ${this.context.companyId}, ${input.brandUuid}, ${input.name}, ${input.email}, ${input.domain},
      'verified', 'verified', 'verified', TRUE
    ) ON DUPLICATE KEY UPDATE
      name = VALUES(name), domain = VALUES(domain), is_verified = TRUE`.execute(this.context.database);
    return uuid;
  }

  async getSender(uuid: string): Promise<EmailSenderRecord | null> {
    const result = await sql<SenderRow>`SELECT * FROM marketing_email_senders
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid} LIMIT 1`.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapSender(row) : null;
  }

  async listSenders(brandUuid?: string): Promise<EmailSenderRecord[]> {
    const allowed = this.context.allowedBrands;
    if (allowed && allowed.length === 0) return [];

    let query = sql<SenderRow>`SELECT * FROM marketing_email_senders WHERE company_id = ${this.context.companyId}`;
    if (brandUuid) {
      query = sql<SenderRow>`${query} AND brand_uuid = ${brandUuid}`;
    }
    if (allowed && allowed.length > 0) {
      query = sql<SenderRow>`${query} AND brand_uuid IN (${sql.join(allowed)})`;
    }
    query = sql<SenderRow>`${query} ORDER BY created_at DESC`;
    const result = await query.execute(this.context.database);
    return result.rows.map((r) => this.mapSender(r));
  }

  /* Campaign Operations */

  async list(
    search: string,
    limit: number,
    offset: number,
    status = "all",
    filters?: { brand?: string; subject?: string }
  ): Promise<EmailCampaignRecord[]> {
    const allowed = this.context.allowedBrands;
    if (allowed && allowed.length === 0) return [];

    let query = sql<CampaignRow>`SELECT * FROM marketing_email_campaigns WHERE company_id = ${this.context.companyId}`;

    if (allowed && allowed.length > 0) {
      query = sql<CampaignRow>`${query} AND brand_uuid IN (${sql.join(allowed)})`;
    }
    if (status !== "all") {
      query = sql<CampaignRow>`${query} AND status = ${status}`;
    }
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = sql<CampaignRow>`${query} AND (name LIKE ${term} OR subject LIKE ${term} OR from_email LIKE ${term})`;
    }
    if (filters?.brand) {
      query = sql<CampaignRow>`${query} AND brand_uuid = ${filters.brand}`;
    }
    if (filters?.subject) {
      query = sql<CampaignRow>`${query} AND subject LIKE ${`%${filters.subject}%`}`;
    }

    query = sql<CampaignRow>`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const result = await query.execute(this.context.database);
    return result.rows.map((r) => this.mapCampaign(r));
  }

  async count(search: string, status = "all", filters?: { brand?: string; subject?: string }): Promise<number> {
    const allowed = this.context.allowedBrands;
    if (allowed && allowed.length === 0) return 0;

    let query = sql<{ total: number }>`SELECT COUNT(*) as total FROM marketing_email_campaigns WHERE company_id = ${this.context.companyId}`;

    if (allowed && allowed.length > 0) {
      query = sql<{ total: number }>`${query} AND brand_uuid IN (${sql.join(allowed)})`;
    }
    if (status !== "all") {
      query = sql<{ total: number }>`${query} AND status = ${status}`;
    }
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = sql<{ total: number }>`${query} AND (name LIKE ${term} OR subject LIKE ${term} OR from_email LIKE ${term})`;
    }
    if (filters?.brand) {
      query = sql<{ total: number }>`${query} AND brand_uuid = ${filters.brand}`;
    }
    if (filters?.subject) {
      query = sql<{ total: number }>`${query} AND subject LIKE ${`%${filters.subject}%`}`;
    }

    const result = await query.execute(this.context.database);
    return Number(result.rows[0]?.total ?? 0);
  }

  async get(uuid: string): Promise<EmailCampaignRecord | null> {
    const allowed = this.context.allowedBrands;
    if (allowed && allowed.length === 0) return null;

    let query = sql<CampaignRow>`SELECT * FROM marketing_email_campaigns
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`;
    if (allowed && allowed.length > 0) {
      query = sql<CampaignRow>`${query} AND brand_uuid IN (${sql.join(allowed)})`;
    }
    query = sql<CampaignRow>`${query} LIMIT 1`;
    const result = await query.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapCampaign(row) : null;
  }

  async getForUpdate(uuid: string): Promise<EmailCampaignRecord | null> {
    const allowed = this.context.allowedBrands;
    if (allowed && allowed.length === 0) return null;

    let query = sql<CampaignRow>`SELECT * FROM marketing_email_campaigns
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`;
    if (allowed && allowed.length > 0) {
      query = sql<CampaignRow>`${query} AND brand_uuid IN (${sql.join(allowed)})`;
    }
    query = sql<CampaignRow>`${query} LIMIT 1 FOR UPDATE`;
    const result = await query.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapCampaign(row) : null;
  }

  async save(
    input: EmailCampaignInput,
    sender: EmailSenderRecord,
    uuid?: string
  ): Promise<string> {
    const actor = this.context.actorEmail;
    if (uuid) {
      let updateQuery = sql`UPDATE marketing_email_campaigns SET
        name = ${input.name},
        sender_uuid = ${sender.uuid},
        from_name = ${sender.name},
        from_email = ${sender.email},
        reply_to = ${sender.email},
        subject = ${input.subject},
        preheader = ${input.preheader ?? ""},
        body_html = ${input.bodyHtml},
        body_text = ${input.bodyText},
        scheduled_at = ${input.scheduledAt ? new Date(input.scheduledAt) : null},
        revision = revision + 1,
        updated_by = ${actor}
        WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`;

      if (input.expectedRevision !== undefined) {
        updateQuery = sql`${updateQuery} AND revision = ${input.expectedRevision}`;
      }
      const res = await updateQuery.execute(this.context.database);
      if (Number(res.numAffectedRows ?? 0) === 0) {
        throw new Error("REVISION_CONFLICT");
      }
      await this.recordActivity(uuid, "updated", actor);
      return uuid;
    }

    const generatedUuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_email_campaigns (
      uuid, company_id, brand_uuid, campaign_uuid, sender_uuid,
      from_name, from_email, reply_to, name, subject, preheader,
      body_html, body_text, status, scheduled_at, created_by, updated_by
    ) VALUES (
      ${generatedUuid}, ${this.context.companyId}, ${input.brandUuid}, ${input.campaignUuid ?? null},
      ${sender.uuid}, ${sender.name}, ${sender.email}, ${sender.email}, ${input.name}, ${input.subject},
      ${input.preheader ?? ""}, ${input.bodyHtml}, ${input.bodyText}, 'draft',
      ${input.scheduledAt ? new Date(input.scheduledAt) : null}, ${actor}, ${actor}
    )`.execute(this.context.database);

    await this.recordActivity(generatedUuid, "created", actor);
    return generatedUuid;
  }

  async updateStatus(
    uuid: string,
    status: EmailCampaignStatus,
    rejectionReason: string | null = null,
    scheduledAt: string | null = null
  ): Promise<void> {
    const actor = this.context.actorEmail;
    await sql`UPDATE marketing_email_campaigns SET
      status = ${status},
      rejection_reason = ${rejectionReason},
      scheduled_at = ${scheduledAt ? new Date(scheduledAt) : null},
      revision = revision + 1,
      updated_by = ${actor}
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);

    await this.recordActivity(uuid, `status:${status}`, actor);
  }

  async updateRecipientsCounts(
    uuid: string,
    delta: {
      sent?: number;
      suppressed?: number;
      bounced?: number;
      complained?: number;
      unsubscribed?: number;
      total?: number;
    }
  ): Promise<void> {
    await sql`UPDATE marketing_email_campaigns SET
      sent_count = sent_count + ${delta.sent ?? 0},
      suppressed_count = suppressed_count + ${delta.suppressed ?? 0},
      bounced_count = bounced_count + ${delta.bounced ?? 0},
      complained_count = complained_count + ${delta.complained ?? 0},
      unsubscribed_count = unsubscribed_count + ${delta.unsubscribed ?? 0},
      total_recipients = total_recipients + ${delta.total ?? 0}
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);
  }

  async recordActivity(recordUuid: string, action: string, actor: string): Promise<void> {
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_email_campaigns_activity (
      uuid, company_id, record_uuid, action, actor
    ) VALUES (
      ${uuid}, ${this.context.companyId}, ${recordUuid}, ${action}, ${actor}
    )`.execute(this.context.database);
  }

  async activity(recordUuid: string): Promise<EmailCampaignActivity[]> {
    const result = await sql<{ action: string; actor: string; occurred_at: Date | string }>`
      SELECT action, actor, occurred_at FROM marketing_email_campaigns_activity
      WHERE company_id = ${this.context.companyId} AND record_uuid = ${recordUuid}
      ORDER BY occurred_at DESC`.execute(this.context.database);
    return result.rows.map((row) => ({
      action: row.action,
      actor: row.actor,
      occurredAt: new Date(row.occurred_at).toISOString()
    }));
  }

  /* Recipient Operations */

  async insertRecipients(
    campaignUuid: string,
    recipients: Array<{
      email: string;
      leadUuid: string | null;
      status: RecipientStatus;
      suppressionReason: string | null;
      token: string;
    }>
  ): Promise<number> {
    if (recipients.length === 0) return 0;

    for (const r of recipients) {
      const uuid = randomBytes(4).toString("hex");
      await sql`INSERT INTO marketing_email_recipients (
        uuid, company_id, email_campaign_uuid, recipient_email, lead_uuid, status,
        suppression_reason, unsubscribe_token
      ) VALUES (
        ${uuid}, ${this.context.companyId}, ${campaignUuid}, ${r.email}, ${r.leadUuid},
        ${r.status}, ${r.suppressionReason}, ${r.token}
      )`.execute(this.context.database);
    }
    return recipients.length;
  }

  async listRecipients(
    campaignUuid: string,
    limit: number,
    offset: number,
    status = "all"
  ): Promise<EmailCampaignRecipient[]> {
    let query = sql<RecipientRow>`SELECT * FROM marketing_email_recipients
      WHERE company_id = ${this.context.companyId} AND email_campaign_uuid = ${campaignUuid}`;
    if (status !== "all") {
      query = sql<RecipientRow>`${query} AND status = ${status}`;
    }
    query = sql<RecipientRow>`${query} ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}`;
    const result = await query.execute(this.context.database);
    return result.rows.map((r) => this.mapRecipient(r));
  }

  async countRecipients(campaignUuid: string, status = "all"): Promise<number> {
    let query = sql<{ total: number }>`SELECT COUNT(*) as total FROM marketing_email_recipients
      WHERE company_id = ${this.context.companyId} AND email_campaign_uuid = ${campaignUuid}`;
    if (status !== "all") {
      query = sql<{ total: number }>`${query} AND status = ${status}`;
    }
    const result = await query.execute(this.context.database);
    return Number(result.rows[0]?.total ?? 0);
  }

  async getPendingRecipients(campaignUuid: string, batchSize: number): Promise<EmailCampaignRecipient[]> {
    const result = await sql<RecipientRow>`SELECT * FROM marketing_email_recipients
      WHERE company_id = ${this.context.companyId} AND email_campaign_uuid = ${campaignUuid}
      AND status = 'enqueued' ORDER BY id ASC LIMIT ${batchSize} FOR UPDATE`.execute(this.context.database);
    return result.rows.map((r) => this.mapRecipient(r));
  }

  async updateRecipientStatus(
    uuid: string,
    status: RecipientStatus,
    suppressionReason: string | null = null,
    error: string | null = null,
    sentAt: string | null = null
  ): Promise<void> {
    await sql`UPDATE marketing_email_recipients SET
      status = ${status},
      suppression_reason = ${suppressionReason},
      error = ${error},
      sent_at = ${sentAt ? new Date(sentAt) : null}
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);
  }

  async getRecipientByToken(token: string): Promise<EmailCampaignRecipient | null> {
    const result = await sql<RecipientRow>`SELECT * FROM marketing_email_recipients
      WHERE unsubscribe_token = ${token} LIMIT 1`.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapRecipient(row) : null;
  }

  async cancelUnsentRecipients(campaignUuid: string): Promise<number> {
    const result = await sql`UPDATE marketing_email_recipients SET
      status = 'cancelled'
      WHERE company_id = ${this.context.companyId} AND email_campaign_uuid = ${campaignUuid}
      AND status = 'enqueued'`.execute(this.context.database);
    return Number(result.numAffectedRows ?? 0);
  }
}
