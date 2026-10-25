import { randomBytes } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import { z } from "zod";
import type { MarketingContext } from "../../context.js";
import { ConsentRepository } from "./consent.repository.js";
import type {
  ConsentDependencies,
  EligibilityResult,
  ContactRestrictionChannel,
  PolicyResult
} from "./consent.types.js";

export const contactRestrictionChannelSchema = z.enum(["email", "phone", "all"]);

export const contactRestrictionSchema = z.strictObject({
  recipient: z
    .string()
    .trim()
    .min(1)
    .max(254)
    .transform((value) => value.toLowerCase()),
  channel: contactRestrictionChannelSchema.default("all"),
  blocked: z.boolean(),
  reason: z.string().trim().min(1).max(500)
});

export const eligibilityInputSchema = z.strictObject({
  brandUuid: z.string().regex(/^[a-f0-9]{8}$/),
  recipient: z
    .string()
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  channel: z.literal("email"),
  purpose: z.literal("promotional")
});

export const consentInputSchema = eligibilityInputSchema.extend({
  action: z.enum(["grant", "withdraw"]),
  noticeVersion: z.string().trim().min(1).max(80),
  evidence: z.string().trim().min(1).max(500),
  source: z.string().trim().min(1).max(160),
  occurredAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  requestKey: z.string().trim().min(8).max(80)
});

export class ConsentService {
  private readonly repository: ConsentRepository;

  constructor(
    private readonly context: MarketingContext,
    private readonly dependencies: ConsentDependencies
  ) {
    this.repository = new ConsentRepository(context);
  }

  async list(search: string, action: string, limit: number, offset: number) {
    await this.context.authorize("marketing.consent.record.view");
    return this.repository.list(search, action, limit, offset);
  }

  async count(search: string, action: string) {
    await this.context.authorize("marketing.consent.record.view");
    return { total: await this.repository.count(search, action) };
  }

  async get(uuid: string) {
    await this.context.authorize("marketing.consent.record.view");
    const row = await this.repository.get(uuid);
    if (!row) throw AppError.notFound("Consent evidence was not found.");
    return row;
  }

  async append(value: unknown) {
    await this.context.authorize("marketing.consent.record.create");
    await this.context.authorize("marketing.consent.record.view");
    const input = consentInputSchema.parse(value);
    const brand = await this.dependencies.brand(this.context, input.brandUuid);
    if (brand.status !== "active" && input.action === "grant")
      throw AppError.validation("Select an active brand.");
    if (input.action === "grant" && input.noticeVersion.toLowerCase() === "unknown")
      throw AppError.validation("A promotional grant requires a known notice version.");
    const occurred = Date.parse(input.occurredAt),
      expires = input.expiresAt ? Date.parse(input.expiresAt) : null;
    if (occurred > Date.now() || (expires !== null && expires <= occurred))
      throw AppError.validation("Consent evidence dates are invalid.");
    return this.get(await this.repository.append(input));
  }

  async eligibility(value: unknown): Promise<EligibilityResult> {
    await this.context.authorize("marketing.consent.record.view");
    const input = eligibilityInputSchema.parse(value);
    const brand = await this.dependencies.brand(this.context, input.brandUuid);
    const reasons: string[] = [];
    if (brand.status !== "active") reasons.push("brand_inactive");
    let latest = null;
    try {
      latest = await this.repository.latest(input);
    } catch {
      reasons.push("consent_unavailable");
    }
    if (!latest) reasons.push("consent_missing");
    else if (latest.action !== "grant") reasons.push("consent_withdrawn");
    else if (latest.expiresAt && Date.parse(latest.expiresAt) <= Date.now())
      reasons.push("consent_expired");

    // Marketing-owned contact restrictions (fail-closed)
    try {
      const restriction = await this.repository.checkRestriction(input.recipient, input.channel);
      if (restriction.allowed !== true) reasons.push("marketing:" + restriction.reason);
    } catch {
      reasons.push("restrictions_unavailable");
    }

    // Injected CRM dependency if supplied (for backward compatibility with existing test mocks)
    if (this.dependencies.crm) {
      try {
        const crmDecision = await this.dependencies.crm(this.context, input.recipient);
        if (crmDecision.allowed !== true) reasons.push("crm:" + crmDecision.reason);
      } catch {
        reasons.push("crm_unavailable");
      }
    }

    // Mail safety check (fail-closed)
    try {
      const mailDecision = await this.dependencies.mail(this.context, input.recipient);
      if (mailDecision.allowed !== true) reasons.push("mail:" + mailDecision.reason);
    } catch {
      reasons.push("mail_unavailable");
    }

    try {
      const current = await this.repository.latest(input);
      if (current?.uuid !== latest?.uuid) reasons.push("consent_changed");
      if (
        current?.expiresAt &&
        Date.parse(current.expiresAt) <= Date.now() &&
        !reasons.includes("consent_expired")
      )
        reasons.push("consent_expired");
      if (
        (await this.dependencies.brand(this.context, input.brandUuid)).status !== "active" &&
        !reasons.includes("brand_inactive")
      )
        reasons.push("brand_inactive");
    } catch {
      reasons.push("consent_unavailable");
    }
    await this.context.authorize("marketing.consent.record.view");
    return {
      eligible: reasons.length === 0,
      checkedAt: new Date().toISOString(),
      consentUuid: latest?.uuid ?? null,
      reasons
    };
  }

  // Contact Restrictions methods
  async recordRestriction(value: unknown) {
    await this.context.authorize("marketing.contact-restrictions.manage");
    const input = contactRestrictionSchema.parse(value);
    const uuid = randomBytes(4).toString("hex");
    await this.repository.recordRestriction(input, uuid);
    const record = await this.repository.getRestriction(uuid);
    if (!record) throw AppError.conflict("Unable to read recorded contact restriction.");
    return record;
  }

  async checkRestriction(
    recipient: string,
    channel: ContactRestrictionChannel = "all"
  ): Promise<PolicyResult> {
    await this.context.authorize("marketing.contact-restrictions.check");
    const normalized = recipient.trim().toLowerCase();
    try {
      return await this.repository.checkRestriction(normalized, channel);
    } catch {
      // Fail closed
      return { allowed: false, reason: "restrictions_unavailable" };
    }
  }

  async listRestrictions(search = "", channel = "all", limit = 50, offset = 0) {
    await this.context.authorize("marketing.contact-restrictions.view");
    return this.repository.listRestrictions(search, channel, limit, offset);
  }

  async countRestrictions(search = "", channel = "all") {
    await this.context.authorize("marketing.contact-restrictions.view");
    return { total: await this.repository.countRestrictions(search, channel) };
  }

  async getRestriction(uuid: string) {
    await this.context.authorize("marketing.contact-restrictions.view");
    const row = await this.repository.getRestriction(uuid);
    if (!row) throw AppError.notFound("Contact restriction was not found.");
    return row;
  }
}
