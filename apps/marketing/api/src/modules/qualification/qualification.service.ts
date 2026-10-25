import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { QualificationRepository } from "./qualification.repository.js";
import type { QualificationInput, QualificationRecord } from "./qualification.types.js";

export class QualificationService {
  private readonly repository: QualificationRepository;

  constructor(
    private readonly context: MarketingContext,
    private readonly validateParent: (input: QualificationInput) => Promise<void> = async () => {}
  ) {
    this.repository = new QualificationRepository(context);
  }

  async list(
    search: string,
    limit: number,
    offset: number,
    decision = "all",
    leadUuid?: string,
    brandUuid?: string
  ) {
    await this.context.authorize("marketing.qualification.record.view");
    return this.repository.list(search, limit, offset, decision, leadUuid, brandUuid);
  }

  async count(search: string, decision = "all", leadUuid?: string, brandUuid?: string) {
    await this.context.authorize("marketing.qualification.record.view");
    return this.repository.count(search, decision, leadUuid, brandUuid);
  }

  async get(uuid: string): Promise<QualificationRecord> {
    await this.context.authorize("marketing.qualification.record.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Qualification was not found.");
    return record;
  }

  async getLatestForLead(leadUuid: string): Promise<QualificationRecord | null> {
    await this.context.authorize("marketing.qualification.record.view");
    return this.repository.getLatestForLead(leadUuid);
  }

  async save(input: QualificationInput, uuid?: string): Promise<QualificationRecord> {
    await this.context.authorize("marketing.qualification.record." + (uuid ? "update" : "create"));
    if (uuid) {
      const previous = await this.get(uuid);
      if (previous.brandUuid !== input.brandUuid) {
        throw AppError.validation("The parent brand cannot be changed.");
      }
      if (previous.leadUuid !== input.leadUuid) {
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
          throw AppError.conflict(
            "Qualification record conflict. Retry with refreshed data."
          );
        }
        throw error;
      }
    }
    throw AppError.conflict("Unable to reserve a qualification identity. Retry the request.");
  }

  async activity(uuid: string) {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }
}

export async function lookupQualification(context: MarketingContext, uuid: string) {
  return new QualificationService(context).get(uuid);
}
