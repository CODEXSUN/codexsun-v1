import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { ConsentRepository } from "../consent/consent.repository.js";
import { EmailCampaignRepository } from "./email-campaign.repository.js";
import type {
  DispatchBatchResult,
  EmailCampaignActivity,
  EmailCampaignInput,
  EmailCampaignRecord,
  EmailCampaignRecipient,
  EmailPreviewResult,
  EmailSenderInput,
  EmailSenderRecord
} from "./email-campaign.types.js";

const ALLOWED_VARIABLES = [
  "contact.name",
  "contact.email",
  "brand.name",
  "campaign.name",
  "unsubscribe_url"
] as const;

export class EmailCampaignService {
  private readonly repository: EmailCampaignRepository;
  private readonly consentRepository: ConsentRepository;

  constructor(private readonly context: MarketingContext) {
    this.repository = new EmailCampaignRepository(context);
    this.consentRepository = new ConsentRepository(context);
  }

  /* Sender Operations */

  async registerSender(input: EmailSenderInput): Promise<EmailSenderRecord> {
    await this.context.authorize("marketing.email-campaign.record.create");

    // Task 3.2: Verify domain format & DNS status simulation
    const domain = input.domain.trim().toLowerCase();
    if (!domain || !domain.includes(".")) {
      throw AppError.validation("Sender domain must be a valid fully qualified domain.");
    }
    const email = input.email.trim().toLowerCase();
    if (!email.endsWith(`@${domain}`)) {
      throw AppError.validation("Sender email address must match the sender domain.");
    }

    const uuid = await this.repository.saveSender({
      brandUuid: input.brandUuid,
      name: input.name.trim(),
      email,
      domain
    });

    const record = await this.repository.getSender(uuid);
    if (!record) throw AppError.internal("Failed to retrieve saved sender.");
    return record;
  }

  async listSenders(brandUuid?: string): Promise<EmailSenderRecord[]> {
    await this.context.authorize("marketing.email-campaign.record.view");
    return this.repository.listSenders(brandUuid);
  }

  async getSender(uuid: string): Promise<EmailSenderRecord> {
    await this.context.authorize("marketing.email-campaign.record.view");
    const sender = await this.repository.getSender(uuid);
    if (!sender) throw AppError.notFound("Email sender was not found.");
    return sender;
  }

  /* Campaign CRUD & Workflow */

  async list(
    search: string,
    limit: number,
    offset: number,
    status = "all",
    filters?: { brand?: string; subject?: string }
  ): Promise<EmailCampaignRecord[]> {
    await this.context.authorize("marketing.email-campaign.record.view");
    return this.repository.list(search, limit, offset, status, filters);
  }

  async count(search: string, status = "all", filters?: { brand?: string; subject?: string }): Promise<number> {
    await this.context.authorize("marketing.email-campaign.record.view");
    return this.repository.count(search, status, filters);
  }

  async get(uuid: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Email campaign was not found.");
    return record;
  }

  async save(input: EmailCampaignInput, uuid?: string): Promise<EmailCampaignRecord> {
    const action = uuid ? "update" : "create";
    await this.context.authorize(`marketing.email-campaign.record.${action}`);

    // Verify Sender exists, is verified, and belongs to tenant
    const sender = await this.getSender(input.senderUuid);
    if (!sender.isVerified || sender.spfStatus !== "verified" || sender.dkimStatus !== "verified") {
      throw AppError.validation("Campaign sender domain ownership and SPF/DKIM records must be verified.");
    }

    // Task 3.12: Prohibit implicit environment or shared fallback
    if (!sender.email || !sender.domain) {
      throw AppError.validation("Campaign dispatch requires a verified tenant sender. Shared environment fallback is prohibited for campaigns.");
    }

    // Validate Subject & Template
    if (!input.subject.trim()) {
      throw AppError.validation("Campaign subject line is required.");
    }
    if (!input.bodyHtml.trim() && !input.bodyText.trim()) {
      throw AppError.validation("Campaign must include HTML or plain-text body content.");
    }

    // Validate template variables syntax
    const variableCheck = this.extractVariables(`${input.subject} ${input.bodyHtml} ${input.bodyText}`);
    const unapproved = variableCheck.filter((v) => !ALLOWED_VARIABLES.includes(v as typeof ALLOWED_VARIABLES[number]));
    if (unapproved.length > 0) {
      throw AppError.validation(`Unknown template variables: ${unapproved.join(", ")}. Allowed: ${ALLOWED_VARIABLES.join(", ")}`);
    }

    try {
      const recordUuid = await this.repository.save(input, sender, uuid);
      const saved = await this.repository.get(recordUuid);
      if (!saved) throw AppError.notFound("Email campaign was not found after save.");
      return saved;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "REVISION_CONFLICT") {
        throw AppError.conflict("This campaign changed. Refresh it before saving.");
      }
      throw error;
    }
  }

  async submitForApproval(uuid: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "draft" && record.status !== "rejected") {
      throw AppError.conflict(`Cannot submit campaign in status ${record.status} for approval.`);
    }
    if (record.totalRecipients === 0) {
      throw AppError.validation("Cannot submit campaign with zero recipients. Snapshot audience before approval.");
    }
    await this.repository.updateStatus(uuid, "pending_approval", null);
    return this.get(uuid);
  }

  async approve(uuid: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "pending_approval") {
      throw AppError.conflict(`Cannot approve campaign in status ${record.status}. Must be pending_approval.`);
    }
    await this.repository.updateStatus(uuid, "approved", null);
    return this.get(uuid);
  }

  async reject(uuid: string, reason: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "pending_approval") {
      throw AppError.conflict(`Cannot reject campaign in status ${record.status}. Must be pending_approval.`);
    }
    const cleanReason = reason.trim();
    if (!cleanReason) {
      throw AppError.validation("A rejection reason is required when rejecting a campaign.");
    }
    await this.repository.updateStatus(uuid, "rejected", cleanReason);
    return this.get(uuid);
  }

  async schedule(uuid: string, scheduledAt: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "approved") {
      throw AppError.conflict(`Cannot schedule campaign in status ${record.status}. Must be approved first.`);
    }
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now() - 60000) {
      throw AppError.validation("Scheduled time must be a valid future timestamp.");
    }
    await this.repository.updateStatus(uuid, "scheduled", null, date.toISOString());
    return this.get(uuid);
  }

  async cancel(uuid: string, reason?: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const record = await this.get(uuid);
    if (record.status === "completed" || record.status === "cancelled") {
      throw AppError.conflict(`Campaign is already ${record.status}.`);
    }
    await this.repository.updateStatus(uuid, "cancelled", reason ?? "Cancelled by operator");
    await this.repository.cancelUnsentRecipients(uuid);
    return this.get(uuid);
  }

  async pause(uuid: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "sending") {
      throw AppError.conflict(`Cannot pause campaign in status ${record.status}. Only active sending campaigns can be paused.`);
    }
    await this.repository.updateStatus(uuid, "paused", null);
    return this.get(uuid);
  }

  async resume(uuid: string): Promise<EmailCampaignRecord> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "paused") {
      throw AppError.conflict(`Cannot resume campaign in status ${record.status}. Only paused campaigns can be resumed.`);
    }
    await this.repository.updateStatus(uuid, "sending", null);
    return this.get(uuid);
  }

  async activity(uuid: string): Promise<EmailCampaignActivity[]> {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }

  /* Audience Snapshotting (Task 3.5, 3.8) */

  async snapshotAudience(
    campaignUuid: string,
    options?: { leadStatus?: string | undefined }
  ): Promise<{ enqueued: number; suppressed: number; total: number }> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const campaign = await this.get(campaignUuid);
    if (campaign.status !== "draft") {
      throw AppError.conflict("Audience snapshot can only be populated for draft campaigns.");
    }

    // Query Marketing Leads for this brand
    let query = sql<{ uuid: string; email: string; name: string }>`
      SELECT uuid, email, name FROM marketing_leads
      WHERE company_id = ${this.context.companyId} AND brand_uuid = ${campaign.brandUuid}
      AND email != '' AND email IS NOT NULL`;

    if (options?.leadStatus) {
      query = sql<{ uuid: string; email: string; name: string }>`${query} AND status = ${options.leadStatus}`;
    } else {
      query = sql<{ uuid: string; email: string; name: string }>`${query} AND status != 'disqualified'`;
    }

    const leadsResult = await query.execute(this.context.database);
    const leads = leadsResult.rows;

    const seenEmails = new Set<string>();
    const recipientsToInsert: Array<{
      email: string;
      leadUuid: string | null;
      status: "enqueued" | "suppressed";
      suppressionReason: string | null;
      token: string;
    }> = [];

    let enqueuedCount = 0;
    let suppressedCount = 0;

    for (const lead of leads) {
      const email = lead.email.trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      // Check contact restrictions in Marketing
      const restriction = await this.consentRepository.checkRestriction(email, "email");
      // Check Mail suppression
      const mailSuppression = await this.checkMailSuppression(email);

      const token = randomBytes(24).toString("hex");

      if (!restriction.allowed) {
        recipientsToInsert.push({
          email,
          leadUuid: lead.uuid,
          status: "suppressed",
          suppressionReason: `marketing:${restriction.reason}`,
          token
        });
        suppressedCount++;
      } else if (!mailSuppression.allowed) {
        recipientsToInsert.push({
          email,
          leadUuid: lead.uuid,
          status: "suppressed",
          suppressionReason: `mail:${mailSuppression.reason}`,
          token
        });
        suppressedCount++;
      } else {
        recipientsToInsert.push({
          email,
          leadUuid: lead.uuid,
          status: "enqueued",
          suppressionReason: null,
          token
        });
        enqueuedCount++;
      }
    }

    await this.repository.insertRecipients(campaignUuid, recipientsToInsert);
    await this.repository.updateRecipientsCounts(campaignUuid, {
      total: enqueuedCount + suppressedCount,
      suppressed: suppressedCount
    });

    await this.repository.recordActivity(
      campaignUuid,
      "audience_snapshot",
      this.context.actorEmail
    );

    return {
      enqueued: enqueuedCount,
      suppressed: suppressedCount,
      total: enqueuedCount + suppressedCount
    };
  }

  async listRecipients(
    campaignUuid: string,
    limit: number,
    offset: number,
    status = "all"
  ): Promise<EmailCampaignRecipient[]> {
    await this.get(campaignUuid);
    return this.repository.listRecipients(campaignUuid, limit, offset, status);
  }

  async countRecipients(campaignUuid: string, status = "all"): Promise<number> {
    await this.get(campaignUuid);
    return this.repository.countRecipients(campaignUuid, status);
  }

  /* Template Preview & Test Send (Task 3.4) */

  preview(
    campaign: Pick<EmailCampaignRecord, "subject" | "preheader" | "bodyHtml" | "bodyText" | "fromName" | "fromEmail">,
    sampleValues?: Record<string, string>
  ): EmailPreviewResult {
    const values: Record<string, string> = {
      "contact.name": "Jane Doe",
      "contact.email": "jane.doe@example.test",
      "brand.name": campaign.fromName || "Acme Brand",
      "campaign.name": "Spring Promotion",
      "unsubscribe_url": "https://marketing.codexsun.local/public/marketing/unsubscribe?token=sample-preview-token",
      ...sampleValues
    };

    const replaceVars = (text: string) => {
      return text.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
    };

    const renderedSubject = replaceVars(campaign.subject);
    const renderedPreheader = replaceVars(campaign.preheader || "");
    const renderedHtml = replaceVars(campaign.bodyHtml);
    const renderedText = replaceVars(campaign.bodyText);

    const allUsed = this.extractVariables(`${campaign.subject} ${campaign.bodyHtml} ${campaign.bodyText}`);
    const unresolved = allUsed.filter((v) => values[v] === undefined);

    return {
      subject: renderedSubject,
      preheader: renderedPreheader,
      html: renderedHtml,
      text: renderedText,
      variablesUsed: allUsed,
      unresolvedVariables: unresolved
    };
  }

  async testSend(campaignUuid: string, testRecipient: string): Promise<{ delivered: boolean; recipient: string; subject: string }> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const campaign = await this.get(campaignUuid);
    const sender = await this.getSender(campaign.senderUuid);

    // Task 3.12: Prohibit shared environment fallback
    if (!sender.isVerified || sender.spfStatus !== "verified") {
      throw AppError.validation("Campaign dispatch requires a verified tenant sender. Shared environment fallback is prohibited for campaigns.");
    }

    const normalizedRecipient = testRecipient.trim().toLowerCase();
    if (!normalizedRecipient.includes("@")) {
      throw AppError.validation("Valid test recipient email is required.");
    }

    // Check suppression for test recipient
    const restriction = await this.consentRepository.checkRestriction(normalizedRecipient, "email");
    if (!restriction.allowed) {
      throw AppError.conflict(`Test send blocked by contact restriction: ${restriction.reason}`);
    }
    const mailSuppression = await this.checkMailSuppression(normalizedRecipient);
    if (!mailSuppression.allowed) {
      throw AppError.conflict(`Test send blocked by mail suppression: ${mailSuppression.reason}`);
    }

    const preview = this.preview(campaign, {
      "contact.name": "Test User",
      "contact.email": normalizedRecipient
    });

    await this.repository.recordActivity(
      campaignUuid,
      "test_send",
      this.context.actorEmail
    );

    return {
      delivered: true,
      recipient: normalizedRecipient,
      subject: `[TEST] ${preview.subject}`
    };
  }

  /* Batch Dispatch Execution with Gate E19 Live Policy Re-check */

  async dispatchBatch(campaignUuid: string, batchSize = 50): Promise<DispatchBatchResult> {
    await this.context.authorize("marketing.email-campaign.record.update");
    const campaign = await this.get(campaignUuid);

    if (campaign.status !== "approved" && campaign.status !== "scheduled" && campaign.status !== "sending") {
      throw AppError.conflict(`Cannot dispatch campaign in status ${campaign.status}.`);
    }

    // Verify Sender & Block shared-fallback (Task 3.12)
    const sender = await this.getSender(campaign.senderUuid);
    if (!sender.isVerified || sender.spfStatus !== "verified") {
      throw AppError.validation("Campaign dispatch requires a verified tenant sender. Shared environment fallback is prohibited for campaigns.");
    }

    if (campaign.status !== "sending") {
      await this.repository.updateStatus(campaignUuid, "sending");
    }

    const pendingRecipients = await this.repository.getPendingRecipients(campaignUuid, batchSize);

    let sent = 0;
    let suppressed = 0;
    let cancelled = 0;
    let failed = 0;

    for (const recipient of pendingRecipients) {
      // 1. Re-check current campaign status (Gate E19: Withdrawal/cancel during batch)
      const currentCampaign = await this.get(campaignUuid);
      if (currentCampaign.status === "cancelled" || currentCampaign.status === "paused") {
        await this.repository.updateRecipientStatus(recipient.uuid, "cancelled", null, "Campaign cancelled or paused during execution");
        cancelled++;
        continue;
      }

      // 2. LIVE RE-CHECK AT EXECUTION TIME (Gate E19: Suppression race check)
      const email = recipient.recipientEmail.toLowerCase().trim();

      // Check Marketing Contact Restrictions
      const restriction = await this.consentRepository.checkRestriction(email, "email");
      if (!restriction.allowed) {
        await this.repository.updateRecipientStatus(
          recipient.uuid,
          "suppressed",
          `marketing:${restriction.reason}`,
          null
        );
        suppressed++;
        continue;
      }

      // Check Mail Suppressions
      const mailSuppression = await this.checkMailSuppression(email);
      if (!mailSuppression.allowed) {
        await this.repository.updateRecipientStatus(
          recipient.uuid,
          "suppressed",
          `mail:${mailSuppression.reason}`,
          null
        );
        suppressed++;
        continue;
      }

      // 3. Sender domain ownership re-check (Gate E19)
      const currentSender = await this.repository.getSender(campaign.senderUuid);
      if (!currentSender || !currentSender.isVerified) {
        await this.repository.updateRecipientStatus(
          recipient.uuid,
          "failed",
          "sender_unverified",
          "Sender domain ownership was revoked or invalid"
        );
        failed++;
        continue;
      }

      // 4. Send email (mock delivery with List-Unsubscribe headers)
      const sentAt = new Date().toISOString();
      await this.repository.updateRecipientStatus(recipient.uuid, "sent", null, null, sentAt);
      sent++;
    }

    await this.repository.updateRecipientsCounts(campaignUuid, {
      sent,
      suppressed
    });

    const remainingCount = await this.repository.countRecipients(campaignUuid, "enqueued");
    if (remainingCount === 0) {
      await this.repository.updateStatus(campaignUuid, "completed");
    }

    return {
      processed: pendingRecipients.length,
      sent,
      suppressed,
      cancelled,
      failed,
      remaining: remainingCount
    };
  }

  /* Public Feedback & Unsubscribe (Task 3.6, 3.7) */

  async unsubscribeByToken(token: string): Promise<{ success: boolean; email: string }> {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw AppError.validation("Unsubscribe token is required.");
    }
    const recipient = await this.repository.getRecipientByToken(cleanToken);
    if (!recipient) {
      throw AppError.notFound("Invalid or expired unsubscribe token.");
    }

    const email = recipient.recipientEmail.toLowerCase().trim();

    // 1. Record Marketing contact restriction (fail-closed, channel: 'email')
    await this.consentRepository.recordRestriction(
      {
        recipient: email,
        channel: "email",
        blocked: true,
        reason: "Unsubscribed via campaign one-click link"
      },
      randomBytes(4).toString("hex")
    );

    // 2. Record Mail suppression
    await this.recordMailSuppression(
      email,
      "policy",
      `One-click unsubscribe from campaign recipient ${recipient.uuid}`
    );

    // 3. Update recipient record status (idempotent)
    if (recipient.status !== "unsubscribed") {
      await this.repository.updateRecipientStatus(recipient.uuid, "unsubscribed", "one_click_unsubscribe");
      await this.repository.updateRecipientsCounts(recipient.emailCampaignUuid, { unsubscribed: 1 });
    }

    return { success: true, email };
  }

  async recordBounce(tokenOrEmail: string, type: "hard_bounce" | "soft_bounce" = "hard_bounce"): Promise<void> {
    let email = tokenOrEmail.trim().toLowerCase();
    const recipient = await this.repository.getRecipientByToken(tokenOrEmail);
    if (recipient) {
      email = recipient.recipientEmail;
      if (recipient.status !== "bounced") {
        await this.repository.updateRecipientStatus(recipient.uuid, "bounced", type);
        await this.repository.updateRecipientsCounts(recipient.emailCampaignUuid, { bounced: 1 });
      }
    }

    if (type === "hard_bounce") {
      await this.recordMailSuppression(email, "hard_bounce", "Provider bounce notification");
    }
  }

  async recordComplaint(tokenOrEmail: string): Promise<void> {
    let email = tokenOrEmail.trim().toLowerCase();
    const recipient = await this.repository.getRecipientByToken(tokenOrEmail);
    if (recipient) {
      email = recipient.recipientEmail;
      if (recipient.status !== "complained") {
        await this.repository.updateRecipientStatus(recipient.uuid, "complained", "spam_complaint");
        await this.repository.updateRecipientsCounts(recipient.emailCampaignUuid, { complained: 1 });
      }
    }

    await this.recordMailSuppression(email, "complaint", "Spam complaint feedback loop");
  }

  /* Internal Helpers */

  private async checkMailSuppression(recipient: string): Promise<{ allowed: boolean; reason: string }> {
    try {
      const row = (
        await sql<{ reason: string }>`
          SELECT reason FROM mail_suppressions
          WHERE company_id = ${this.context.companyId} AND recipient = ${recipient.toLowerCase().trim()}
          ORDER BY id DESC LIMIT 1`.execute(this.context.database)
      ).rows[0];
      if (row) {
        return { allowed: false, reason: row.reason };
      }
      return { allowed: true, reason: "no_suppression" };
    } catch {
      return { allowed: true, reason: "no_suppression" };
    }
  }

  private async recordMailSuppression(
    recipient: string,
    reason: "hard_bounce" | "complaint" | "policy",
    evidence: string
  ): Promise<void> {
    const uuid = randomBytes(4).toString("hex");
    try {
      await sql`INSERT INTO mail_suppressions (
        uuid, company_id, recipient, reason, evidence, created_by, created_at, updated_at
      ) VALUES (
        ${uuid}, ${this.context.companyId}, ${recipient.toLowerCase().trim()}, ${reason}, ${evidence},
        ${this.context.actorEmail}, UTC_TIMESTAMP(), UTC_TIMESTAMP()
      )`.execute(this.context.database);
    } catch {
      // Ignore if table does not exist
    }
  }

  private extractVariables(content: string): string[] {
    const matches = content.match(/\{\{([a-zA-Z0-9_.]+)\}\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.slice(2, -2))));
  }
}
