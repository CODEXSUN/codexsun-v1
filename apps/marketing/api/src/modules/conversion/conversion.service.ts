import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { ConversionRepository } from "./conversion.repository.js";
import type { ConversionInput, ConversionRecord } from "./conversion.types.js";
import { lookupLead } from "../lead/index.js";
import { lookupQualification } from "../qualification/index.js";

export class ConversionService {
  private readonly repository: ConversionRepository;

  constructor(
    private readonly context: MarketingContext,
    private readonly validateParent: (input: ConversionInput) => Promise<void> = async () => {}
  ) {
    this.repository = new ConversionRepository(context);
  }

  async list(
    search: string,
    limit: number,
    offset: number,
    status = "all",
    leadUuid?: string,
    brandUuid?: string
  ) {
    await this.context.authorize("marketing.conversion.record.view");
    return this.repository.list(search, limit, offset, status, leadUuid, brandUuid);
  }

  async count(search: string, status = "all", leadUuid?: string, brandUuid?: string) {
    await this.context.authorize("marketing.conversion.record.view");
    return this.repository.count(search, status, leadUuid, brandUuid);
  }

  async get(uuid: string): Promise<ConversionRecord> {
    await this.context.authorize("marketing.conversion.record.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Conversion was not found.");
    return record;
  }

  async getByLead(leadUuid: string): Promise<ConversionRecord | null> {
    await this.context.authorize("marketing.conversion.record.view");
    return this.repository.getByLead(leadUuid);
  }

  async convert(input: ConversionInput, uuid?: string): Promise<ConversionRecord> {
    await this.context.authorize("marketing.conversion.record." + (uuid ? "update" : "create"));

    // Idempotent retry: if converting and conversion already exists for this lead
    if (!uuid) {
      const existing = await this.repository.getByLead(input.leadUuid);
      if (existing) {
        if (existing.status === "converted") {
          return existing;
        }
        throw AppError.conflict(
          `Lead was already converted with status ${existing.status}.`
        );
      }
    }

    // Verify parent lead is qualified
    const lead = await lookupLead(this.context, input.leadUuid);
    if (lead.status !== "qualified") {
      throw AppError.conflict("Only a qualified lead can be converted.");
    }

    // Verify qualification decision is qualified
    const qualification = await lookupQualification(this.context, input.qualificationUuid);
    if (qualification.decision !== "qualified" || qualification.leadUuid !== input.leadUuid) {
      throw AppError.conflict("A valid qualified qualification decision is required to convert.");
    }

    await this.validateParent(input);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const recordUuid = await this.repository.save(input, uuid);
        return await this.get(recordUuid);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ER_DUP_ENTRY"
        ) {
          if (!uuid) {
            const existing = await this.repository.getByLead(input.leadUuid);
            if (existing) return existing;
          }
          throw AppError.conflict("Conversion record conflict. Retry with refreshed data.");
        }
        throw error;
      }
    }
    throw AppError.conflict("Unable to reserve a conversion identity. Retry the request.");
  }

  async cancel(
    uuid: string,
    reason: string,
    expectedRevision?: number | undefined
  ): Promise<ConversionRecord> {
    await this.context.authorize("marketing.conversion.record.update");
    const current = await this.get(uuid);
    if (current.status !== "converted") {
      throw AppError.validation(`Cannot cancel a conversion with status ${current.status}.`);
    }
    await this.repository.setStatus(uuid, "cancelled", reason, expectedRevision);
    return this.get(uuid);
  }

  async reverse(
    uuid: string,
    reason: string,
    expectedRevision?: number | undefined
  ): Promise<ConversionRecord> {
    await this.context.authorize("marketing.conversion.record.update");
    const current = await this.get(uuid);
    if (current.status !== "converted") {
      throw AppError.validation(`Cannot reverse a conversion with status ${current.status}.`);
    }
    await this.repository.setStatus(uuid, "reversed", reason, expectedRevision);
    return this.get(uuid);
  }

  async activity(uuid: string) {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }
}

export async function lookupConversion(context: MarketingContext, uuid: string) {
  return new ConversionService(context).get(uuid);
}
