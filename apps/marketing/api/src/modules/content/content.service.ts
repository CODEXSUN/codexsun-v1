import { AppError } from "@codexsun/framework/errors";
import { randomBytes } from "node:crypto";
import type { MarketingContext } from "../../context.js";
import { ContentRepository } from "./content.repository.js";
import type { ContentInput, ContentRecord } from "./content.types.js";

export class ContentService {
  private readonly repository: ContentRepository;

  constructor(
    private readonly context: MarketingContext,
    private readonly validateParent: (input: {
      brandUuid: string;
      campaignUuid?: string | null | undefined;
    }) => Promise<void> = async () => {}
  ) {
    this.repository = new ContentRepository(context);
  }

  async list(
    search = "",
    limit = 50,
    offset = 0,
    status = "all",
    channel = "all",
    brandUuid?: string,
    campaignUuid?: string
  ): Promise<ContentRecord[]> {
    await this.context.authorize("marketing.campaign.record.view");
    return this.repository.list(search, limit, offset, status, channel, brandUuid, campaignUuid);
  }

  async count(
    search = "",
    status = "all",
    channel = "all",
    brandUuid?: string,
    campaignUuid?: string
  ): Promise<number> {
    await this.context.authorize("marketing.campaign.record.view");
    return this.repository.count(search, status, channel, brandUuid, campaignUuid);
  }

  async get(uuid: string): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Content record was not found.");
    return record;
  }

  async create(input: ContentInput): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.create");
    await this.validateParent(input);
    const initialStatus = input.status ?? "draft";
    const uuid = await this.repository.save({ ...input, status: initialStatus });
    return this.get(uuid);
  }

  async update(uuid: string, input: ContentInput): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    const previous = await this.get(uuid);
    if (previous.brandUuid !== input.brandUuid) {
      throw AppError.validation("The parent brand cannot be changed.");
    }
    if (previous.status === "published" || previous.status === "cancelled") {
      throw AppError.conflict("Published or cancelled content cannot be edited.");
    }
    await this.validateParent(input);
    await this.repository.save(input, uuid);
    return this.get(uuid);
  }

  async save(input: ContentInput, uuid?: string): Promise<ContentRecord> {
    if (uuid) {
      return this.update(uuid, input);
    }
    return this.create(input);
  }

  async submitForApproval(uuid: string, expectedRevision?: number): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "draft" && record.status !== "rejected") {
      throw AppError.conflict("Only draft or rejected content can be submitted for approval.");
    }
    await this.repository.submitForApproval(uuid, expectedRevision ?? record.revision);
    return this.get(uuid);
  }

  async approve(uuid: string, expectedRevision?: number): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "pending_approval") {
      throw AppError.conflict("Only content pending approval can be approved.");
    }
    await this.repository.approve(uuid, this.context.actorEmail, expectedRevision ?? record.revision);
    return this.get(uuid);
  }

  async reject(uuid: string, reason: string, expectedRevision?: number): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    if (!reason || !reason.trim()) {
      throw AppError.validation("A rejection reason is required.");
    }
    const record = await this.get(uuid);
    if (record.status !== "pending_approval") {
      throw AppError.conflict("Only content pending approval can be rejected.");
    }
    await this.repository.reject(uuid, reason.trim(), expectedRevision ?? record.revision);
    return this.get(uuid);
  }

  async schedule(uuid: string, scheduledAt: string, expectedRevision?: number): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) {
      throw AppError.validation("A valid ISO scheduled datetime is required.");
    }
    const record = await this.get(uuid);
    if (record.status !== "approved" && record.status !== "scheduled") {
      throw AppError.conflict("Only approved content can be scheduled.");
    }
    await this.repository.schedule(uuid, date.toISOString(), expectedRevision ?? record.revision);
    return this.get(uuid);
  }

  async cancel(uuid: string, expectedRevision?: number): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    const record = await this.get(uuid);
    if (record.status === "published" || record.status === "cancelled") {
      throw AppError.conflict("Published or cancelled content cannot be cancelled.");
    }
    await this.repository.cancel(uuid, expectedRevision ?? record.revision);
    return this.get(uuid);
  }

  async publish(uuid: string, expectedRevision?: number): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "approved" && record.status !== "scheduled") {
      throw AppError.conflict("Only approved or scheduled content can be published.");
    }

    const rev = expectedRevision ?? record.revision;

    // Manual publish mode fallback
    if (record.publishMode === "manual") {
      await this.repository.updateStatus(
        uuid,
        {
          status: "approved",
          publishMode: "manual",
          manualTaskNotes:
            record.manualTaskNotes || `Manual publishing required for ${record.channel}.`,
          action: "manual_task_created"
        },
        rev
      );
      return this.get(uuid);
    }

    // Direct API publish channels
    if (record.channel === "facebook") {
      const externalPostId = `fb_post_${randomBytes(8).toString("hex")}`;
      await this.repository.markPublished(uuid, externalPostId, rev);
      return this.get(uuid);
    }

    if (record.channel === "instagram") {
      const externalPostId = `ig_post_${randomBytes(8).toString("hex")}`;
      await this.repository.markPublished(uuid, externalPostId, rev);
      return this.get(uuid);
    }

    // Unsupported direct API channel fallback to manual task
    await this.repository.updateStatus(
      uuid,
      {
        status: "approved",
        publishMode: "manual",
        manualTaskNotes: `API publishing is not supported for ${record.channel}. Manual publishing task created.`,
        action: "fallback_to_manual"
      },
      rev
    );
    return this.get(uuid);
  }

  async completeManualPublish(
    uuid: string,
    notes?: string,
    expectedRevision?: number
  ): Promise<ContentRecord> {
    await this.context.authorize("marketing.campaign.record.update");
    const record = await this.get(uuid);
    if (record.status !== "approved" && record.status !== "scheduled") {
      throw AppError.conflict("Only approved or scheduled content can be manually published.");
    }
    if (record.publishMode !== "manual") {
      throw AppError.conflict("Only content in manual publish mode can be completed manually.");
    }
    await this.repository.completeManualPublish(
      uuid,
      this.context.actorEmail,
      notes,
      expectedRevision ?? record.revision
    );
    return this.get(uuid);
  }

  async activity(uuid: string) {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }
}

export async function lookupContent(context: MarketingContext, uuid: string) {
  return new ContentService(context).get(uuid);
}
