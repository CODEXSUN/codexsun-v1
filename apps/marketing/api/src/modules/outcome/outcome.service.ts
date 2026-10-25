import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { OutcomeRepository } from "./outcome.repository.js";
import type { OutcomeInput, OutcomeRecord } from "./outcome.types.js";
import { lookupLead } from "../lead/index.js";

export class OutcomeService {
  private readonly repository: OutcomeRepository;

  constructor(
    private readonly context: MarketingContext,
    private readonly validateParent: (input: OutcomeInput) => Promise<void> = async () => {}
  ) {
    this.repository = new OutcomeRepository(context);
  }

  async list(
    search: string,
    limit: number,
    offset: number,
    disposition = "all",
    leadUuid?: string,
    brandUuid?: string
  ) {
    await this.context.authorize("marketing.outcome.record.view");
    return this.repository.list(search, limit, offset, disposition, leadUuid, brandUuid);
  }

  async count(search: string, disposition = "all", leadUuid?: string, brandUuid?: string) {
    await this.context.authorize("marketing.outcome.record.view");
    return this.repository.count(search, disposition, leadUuid, brandUuid);
  }

  async get(uuid: string): Promise<OutcomeRecord> {
    await this.context.authorize("marketing.outcome.record.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Outcome was not found.");
    return record;
  }

  async getLatestForLead(leadUuid: string): Promise<OutcomeRecord | null> {
    await this.context.authorize("marketing.outcome.record.view");
    return this.repository.getLatestForLead(leadUuid);
  }

  async record(input: OutcomeInput, uuid?: string): Promise<OutcomeRecord> {
    await this.context.authorize("marketing.outcome.record." + (uuid ? "update" : "create"));

    const lead = await lookupLead(this.context, input.leadUuid);
    if (lead.brandUuid !== input.brandUuid) {
      throw AppError.validation("Lead does not belong to the selected brand.");
    }

    if (!uuid) {
      const existing = await this.repository.getLatestForLead(input.leadUuid);
      if (existing && !input.previousOutcomeUuid) {
        throw AppError.conflict(
          "An outcome already exists for this lead. Provide previousOutcomeUuid for deliberate correction."
        );
      }
      if (input.previousOutcomeUuid) {
        const previous = await this.get(input.previousOutcomeUuid);
        if (previous.leadUuid !== input.leadUuid) {
          throw AppError.validation("The referenced previous outcome does not belong to this lead.");
        }
      }
    } else {
      const current = await this.get(uuid);
      if (current.leadUuid !== input.leadUuid) {
        throw AppError.validation("The parent lead cannot be changed.");
      }
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
          if (!uuid && attempt < 2) continue;
          throw AppError.conflict("Outcome record conflict. Retry with refreshed data.");
        }
        throw error;
      }
    }
    throw AppError.conflict("Unable to reserve an outcome identity. Retry the request.");
  }

  async activity(uuid: string) {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }
}

export async function lookupOutcome(context: MarketingContext, uuid: string) {
  return new OutcomeService(context).get(uuid);
}
