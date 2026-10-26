import { randomBytes, createHash } from "node:crypto";
import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { LeadContext, LeadFilters, LeadInput, LeadIntake, LeadRecord } from "./lead.types.js";
const columns = sql.raw(`uuid,company_id AS companyId,submission_uuid AS submissionUuid,
  campaign_uuid AS campaignUuid,campaign_label AS campaignLabel,name,email,phone,message,source,
  assigned_to AS assignedTo,status,task_id AS taskId,contact_id AS contactId,enquiry_id AS enquiryId,revision,
  DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
  DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt`);
export class LeadRepository {
  constructor(private readonly context: LeadContext) {}
  async accept(input: LeadIntake) {
    const ctx = this.context,
      hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    await sql`INSERT INTO crm_leads(uuid,company_id,submission_uuid,campaign_uuid,campaign_label,name,email,phone,message,source,assigned_to,payload_hash)
  VALUES(${randomBytes(4).toString("hex")},${ctx.companyId},${input.submissionUuid},${input.campaignUuid},${input.campaignLabel},${input.name},${input.email},${input.phone},${input.message},${input.source},${ctx.actorEmail},${hash}) ON DUPLICATE KEY UPDATE id=id`.execute(
      ctx.database
    );
    const saved = (
      await sql<{
        payload_hash: string;
        assigned_to: string;
      }>`SELECT payload_hash,assigned_to FROM crm_leads WHERE company_id=${ctx.companyId} AND submission_uuid=${input.submissionUuid}`.execute(
        ctx.database
      )
    ).rows[0];
    if (!saved || saved.payload_hash !== hash || saved.assigned_to !== ctx.actorEmail)
      throw AppError.conflict("The intake identity was reused with different content or owner.");
    return this.getBySubmission(input.submissionUuid);
  }
  async getBySubmission(uuid: string) {
    return (
      (
        await sql<LeadRecord>`SELECT ${columns} FROM crm_leads WHERE company_id=${this.context.companyId} AND submission_uuid=${uuid} AND assigned_to=${this.context.actorEmail}`.execute(
          this.context.database
        )
      ).rows[0] ?? null
    );
  }
  async lock(uuid: string) {
    return (
      await sql<{
        uuid: string;
        taskId: number | null;
      }>`SELECT uuid,task_id AS taskId FROM crm_leads WHERE company_id=${this.context.companyId} AND submission_uuid=${uuid} AND assigned_to=${this.context.actorEmail} FOR UPDATE`.execute(
        this.context.database
      )
    ).rows[0];
  }
  async attachTask(uuid: string, taskId: number) {
    await sql`UPDATE crm_leads SET task_id=${taskId} WHERE uuid=${uuid} AND company_id=${this.context.companyId} AND assigned_to=${this.context.actorEmail}`.execute(
      this.context.database
    );
  }
  private scope() {
    return sql`company_id=${this.context.companyId} AND
      (${Boolean(this.context.canViewAll)} OR assigned_to=${this.context.actorEmail})`;
  }
  async campaigns(search: string) {
    const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const result = await sql<{ label: string }>`SELECT DISTINCT campaign_label AS label
      FROM crm_leads WHERE ${this.scope()} AND campaign_label <> ''
      AND campaign_label LIKE ${term} ORDER BY campaign_label LIMIT 30`.execute(
      this.context.database
    );
    const defaults = [
      "Walk-in",
      "Referral",
      "Website",
      "Google Ads",
      "Facebook",
      "Instagram",
      "WhatsApp",
      "Phone enquiry",
      "Email campaign",
      "Other"
    ];
    const labels = [
      ...result.rows.map((row) => row.label),
      ...defaults.filter((label) => label.toLowerCase().includes(search.toLowerCase()))
    ];
    return [...new Map(labels.map((label) => [label.toLowerCase(), { label }])).values()].slice(
      0,
      30
    );
  }
  async get(uuid: string, lock = false) {
    return (
      (
        await sql<LeadRecord>`SELECT ${columns} FROM crm_leads
      WHERE uuid=${uuid} AND ${this.scope()} ${lock ? sql`FOR UPDATE` : sql``}`.execute(
          this.context.database
        )
      ).rows[0] ?? null
    );
  }
  async list(filters?: LeadFilters) {
    if (!filters)
      return (
        await sql<LeadRecord>`SELECT ${columns} FROM crm_leads
      WHERE ${this.scope()} ORDER BY id DESC LIMIT 100`.execute(this.context.database)
      ).rows;
    return (await this.page(filters)).items;
  }
  async page(filters: LeadFilters) {
    const term = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
    const like = (value: string | undefined) => `%${(value ?? "").replace(/[\\%_]/g, "\\$&")}%`;
    const status =
      filters.status === "active"
        ? sql`status IN ('review','qualified')`
        : filters.status === "all"
          ? sql`TRUE`
          : sql`status=${filters.status}`;
    const from = filters.fromAt
      ? sql`AND created_at >= ${new Date(filters.fromAt).toISOString().replace("T", " ").replace("Z", "")}`
      : sql``;
    const to = filters.toAt
      ? sql`AND created_at < ${new Date(filters.toAt).toISOString().replace("T", " ").replace("Z", "")}`
      : sql``;
    const where = sql`${this.scope()} AND ${status} ${from} ${to}
      AND (name LIKE ${term} OR phone LIKE ${term} OR message LIKE ${term} OR campaign_label LIKE ${term})
      AND name LIKE ${like(filters.searchName)} AND phone LIKE ${like(filters.searchPhone)}
      AND message LIKE ${like(filters.searchMessage)} AND campaign_label LIKE ${like(filters.searchCampaign)}
      AND (CASE status WHEN 'review' THEN 'Needs review' ELSE status END) LIKE ${like(filters.searchStatus)}`;
    const items = (
      await sql<LeadRecord>`SELECT ${columns} FROM crm_leads WHERE ${where}
      ORDER BY id DESC LIMIT ${filters.pageSize} OFFSET ${(filters.page - 1) * filters.pageSize}`.execute(
        this.context.database
      )
    ).rows;
    const total = (
      await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_leads WHERE ${where}`.execute(
        this.context.database
      )
    ).rows[0];
    return { items, total: Number(total?.total ?? 0) };
  }
  async create(input: LeadInput) {
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO crm_leads(uuid,company_id,submission_uuid,campaign_uuid,campaign_label,
      name,email,phone,message,source,assigned_to,payload_hash,status,contact_id,created_at,updated_at)
      VALUES(${uuid},${this.context.companyId},${uuid},'00000000',${input.campaignLabel},
      ${input.name},${input.email},${input.phone},${input.message},'manual',${this.context.actorEmail},
      ${createHash("sha256").update(uuid).digest("hex")},${input.status},${input.contactId},UTC_TIMESTAMP(),UTC_TIMESTAMP())`.execute(
      this.context.database
    );
    return uuid;
  }
  async update(uuid: string, input: LeadInput) {
    await sql`UPDATE crm_leads SET name=${input.name},email=${input.email},phone=${input.phone},
      message=${input.message},campaign_label=${input.campaignLabel},contact_id=${input.contactId},
      status=${input.status},revision=revision+1,updated_at=UTC_TIMESTAMP()
      WHERE uuid=${uuid} AND ${this.scope()}`.execute(this.context.database);
  }
  async converted(uuid: string, enquiryId: number, contactId: number) {
    await sql`UPDATE crm_leads SET enquiry_id=${enquiryId},contact_id=${contactId},status='converted',
      revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE uuid=${uuid} AND ${this.scope()}`.execute(
      this.context.database
    );
  }
  async audit(uuid: string, action: string, details: string) {
    await sql`INSERT INTO crm_lead_activity(lead_uuid,company_id,action,actor,details,created_at)
      VALUES(${uuid},${this.context.companyId},${action},${this.context.actorEmail},${details},UTC_TIMESTAMP())`.execute(
      this.context.database
    );
  }
  async activity(uuid: string) {
    return (
      await sql<{ action: string; actor: string; details: string; createdAt: string }>`
      SELECT action,actor,details,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
      FROM crm_lead_activity WHERE lead_uuid=${uuid} AND company_id=${this.context.companyId}
      ORDER BY id DESC LIMIT 100`.execute(this.context.database)
    ).rows;
  }
}
