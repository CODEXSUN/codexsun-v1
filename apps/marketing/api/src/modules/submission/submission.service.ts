import { lookupBrand } from "../brand/index.js";
import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { SubmissionRepository } from "./submission.repository.js";
import type { SubmissionInput, SubmissionDependencies } from "./submission.types.js";
import { processSubmissionHandoff } from "./submission.worker.js";

export class SubmissionService {
  private readonly repository: SubmissionRepository;
  constructor(
    private readonly ctx: MarketingContext,
    private readonly deps: SubmissionDependencies
  ) {
    this.repository = new SubmissionRepository(ctx);
  }
  async accept(input: SubmissionInput) {
    await this.ctx.authorize("marketing.submission.record.create");
    if (!input.email && !input.phone)
      throw AppError.validation("An email address or phone number is required.");
    const capture = await this.deps.capture(this.ctx, input.captureUuid);
    const brand = await lookupBrand(this.ctx, capture.brandUuid);
    if (brand.status !== "active") throw AppError.conflict("The capture brand is inactive.");
    const campaign = await this.deps.campaign(this.ctx, capture.campaignUuid);
    if (capture.status !== "active" || campaign.status !== "active")
      throw AppError.conflict("The capture form or campaign is inactive.");
    const saved = await this.repository.accept(input, capture, campaign.name);
    if (!saved) throw AppError.conflict("The submission could not be read.");
    if (saved.status === "pending") {
      try {
        await this.deps.enqueue(this.ctx, saved.uuid);
      } catch {
        /* The durable pending record is recovered by the server relay. */
      }
    }
    return saved;
  }
  async list(limit: number, offset: number, search = "", status = "all") {
    await this.ctx.authorize("marketing.submission.record.view");
    return this.repository.list(limit, offset, undefined, search, status);
  }
  async get(uuid: string) {
    await this.ctx.authorize("marketing.submission.record.view");
    const row = await this.repository.get(uuid);
    if (!row) throw AppError.notFound("Submission was not found.");
    return row;
  }
  async count(search: string, status: string) {
    await this.ctx.authorize("marketing.submission.record.view");
    return this.repository.count(search, status);
  }
  async retry(uuid: string) {
    await this.ctx.authorize("marketing.submission.record.create");
    const row = await this.repository.get(uuid);
    if (!row) throw AppError.notFound("Submission was not found.");
    if (row.status === "pending")
      await this.deps.enqueue({ ...this.ctx, actorEmail: row.createdBy }, uuid);
    return row;
  }
  async handoff(uuid: string) {
    return processSubmissionHandoff(this.ctx, uuid);
  }
}
