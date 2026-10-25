import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { FollowUpRepository } from "./follow-up.repository.js";
import type { FollowUpInput, FollowUpRecord } from "./follow-up.types.js";
import { lookupLead } from "../lead/index.js";

export class FollowUpService {
  private readonly repository: FollowUpRepository;

  constructor(
    private readonly context: MarketingContext,
    private readonly validateParent: (input: FollowUpInput) => Promise<void> = async () => {}
  ) {
    this.repository = new FollowUpRepository(context);
  }

  async list(
    search: string,
    limit: number,
    offset: number,
    status = "all",
    leadUuid?: string,
    brandUuid?: string
  ) {
    await this.context.authorize("marketing.follow-up.record.view");
    return this.repository.list(search, limit, offset, status, leadUuid, brandUuid);
  }

  async count(search: string, status = "all", leadUuid?: string, brandUuid?: string) {
    await this.context.authorize("marketing.follow-up.record.view");
    return this.repository.count(search, status, leadUuid, brandUuid);
  }

  async get(uuid: string): Promise<FollowUpRecord> {
    await this.context.authorize("marketing.follow-up.record.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Follow-up was not found.");
    return record;
  }

  async save(input: FollowUpInput, uuid?: string): Promise<FollowUpRecord> {
    await this.context.authorize("marketing.follow-up.record." + (uuid ? "update" : "create"));

    const lead = await lookupLead(this.context, input.leadUuid);
    if (lead.brandUuid !== input.brandUuid) {
      throw AppError.validation("Lead does not belong to the selected brand.");
    }

    if (uuid) {
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
          throw AppError.conflict("Follow-up record conflict. Retry with refreshed data.");
        }
        throw error;
      }
    }
    throw AppError.conflict("Unable to reserve a follow-up identity. Retry the request.");
  }

  async complete(uuid: string, expectedRevision?: number | undefined): Promise<FollowUpRecord> {
    await this.context.authorize("marketing.follow-up.record.update");
    await this.get(uuid);
    await this.repository.complete(uuid, expectedRevision);
    return this.get(uuid);
  }

  async cancel(uuid: string, expectedRevision?: number | undefined): Promise<FollowUpRecord> {
    await this.context.authorize("marketing.follow-up.record.update");
    await this.get(uuid);
    await this.repository.cancel(uuid, expectedRevision);
    return this.get(uuid);
  }

  async activity(uuid: string) {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }
}

export async function lookupFollowUp(context: MarketingContext, uuid: string) {
  return new FollowUpService(context).get(uuid);
}
