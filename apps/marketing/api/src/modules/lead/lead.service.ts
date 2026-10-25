import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { LeadRepository } from "./lead.repository.js";
import type { LeadInput, LeadStatus, LeadRecord } from "./lead.types.js";

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["new", "contacted", "qualified", "disqualified", "deferred"],
  contacted: ["contacted", "qualified", "disqualified", "deferred"],
  qualified: ["qualified", "disqualified", "deferred"],
  disqualified: ["disqualified", "deferred", "new"],
  deferred: ["deferred", "new", "contacted", "qualified", "disqualified"]
};

export class LeadService {
  private readonly repository: LeadRepository;

  constructor(
    private readonly context: MarketingContext,
    private readonly validateParent: (input: LeadInput) => Promise<void> = async () => {}
  ) {
    this.repository = new LeadRepository(context);
  }

  async list(search: string, limit: number, offset: number, status = "all", brandUuid?: string) {
    await this.context.authorize("marketing.lead.record.view");
    return this.repository.list(search, limit, offset, status, brandUuid);
  }

  async count(search: string, status = "all", brandUuid?: string) {
    await this.context.authorize("marketing.lead.record.view");
    return this.repository.count(search, status, brandUuid);
  }

  async get(uuid: string): Promise<LeadRecord> {
    await this.context.authorize("marketing.lead.record.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Lead was not found.");
    return record;
  }

  async save(input: LeadInput, uuid?: string): Promise<LeadRecord> {
    await this.context.authorize("marketing.lead.record." + (uuid ? "update" : "create"));
    if (uuid) {
      const previous = await this.get(uuid);
      if (previous.brandUuid !== input.brandUuid) {
        throw AppError.validation("The parent brand cannot be changed.");
      }
      if (input.status && input.status !== previous.status) {
        const allowed = VALID_TRANSITIONS[previous.status] ?? [];
        if (!allowed.includes(input.status)) {
          throw AppError.validation(
            `Cannot transition lead status from ${previous.status} to ${input.status}.`
          );
        }
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
            "Lead identity or constraint conflict. Retry with refreshed data."
          );
        }
        throw error;
      }
    }
    throw AppError.conflict("Unable to reserve a lead identity. Retry the request.");
  }

  async intake(submission: {
    brandUuid: string;
    campaignUuid?: string;
    captureUuid?: string;
    uuid: string;
    name: string;
    email?: string;
    phone?: string;
    message?: string;
    sourceKey?: string;
  }): Promise<{ uuid: string }> {
    await this.context.authorize("marketing.lead.record.create");
    const existing = await this.repository.getBySubmissionUuid(submission.uuid);
    if (existing) {
      return { uuid: existing.uuid };
    }

    const input: LeadInput = {
      brandUuid: submission.brandUuid,
      campaignUuid: submission.campaignUuid ?? "",
      captureUuid: submission.captureUuid ?? "",
      submissionUuid: submission.uuid,
      source: "submission",
      sourceReference: submission.sourceKey ?? "",
      name: submission.name,
      email: submission.email ?? "",
      phone: submission.phone ?? "",
      notes: submission.message ?? "",
      status: "new"
    };

    const leadUuid = await this.repository.save(input);
    return { uuid: leadUuid };
  }

  async assign(uuid: string, assignedTo: string, expectedRevision?: number): Promise<LeadRecord> {
    await this.context.authorize("marketing.lead.record.update");
    await this.get(uuid);
    await this.repository.assign(uuid, assignedTo, expectedRevision);
    return this.get(uuid);
  }

  async updateStatus(
    uuid: string,
    status: LeadStatus,
    expectedRevision?: number
  ): Promise<LeadRecord> {
    await this.context.authorize("marketing.lead.record.update");
    const current = await this.get(uuid);
    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      throw AppError.validation(
        `Cannot transition lead status from ${current.status} to ${status}.`
      );
    }
    await this.repository.updateStatus(uuid, status, expectedRevision);
    return this.get(uuid);
  }

  async activity(uuid: string) {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }
}

export async function lookupLead(context: MarketingContext, uuid: string) {
  return new LeadService(context).get(uuid);
}
