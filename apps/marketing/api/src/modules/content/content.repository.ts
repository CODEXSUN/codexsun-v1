import { AppError } from "@codexsun/framework/errors";
import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type {
  ContentInput,
  ContentRecord,
  ContentActivity,
  ContentStatus,
  ContentPublishMode
} from "./content.types.js";

function mapRecord(row: Record<string, unknown>): ContentRecord {
  let mediaUrls: string[] = [];
  if (Array.isArray(row.mediaUrls)) {
    mediaUrls = row.mediaUrls as string[];
  } else if (typeof row.mediaUrls === "string" && row.mediaUrls.trim()) {
    try {
      const parsed = JSON.parse(row.mediaUrls);
      if (Array.isArray(parsed)) mediaUrls = parsed;
    } catch {
      mediaUrls = [];
    }
  }
  return {
    uuid: String(row.uuid),
    revision: Number(row.revision),
    companyId: Number(row.companyId),
    brandUuid: String(row.brandUuid),
    campaignUuid: row.campaignUuid ? String(row.campaignUuid) : null,
    title: String(row.title),
    body: String(row.body),
    channel: row.channel as ContentRecord["channel"],
    publishMode: (row.publishMode as ContentPublishMode) ?? "api",
    status: (row.status as ContentStatus) ?? "draft",
    scheduledAt: row.scheduledAt ? String(row.scheduledAt) : null,
    publishedAt: row.publishedAt ? String(row.publishedAt) : null,
    mediaUrls,
    rejectionReason: row.rejectionReason ? String(row.rejectionReason) : null,
    manualTaskNotes: row.manualTaskNotes ? String(row.manualTaskNotes) : null,
    manualCompletedAt: row.manualCompletedAt ? String(row.manualCompletedAt) : null,
    manualCompletedBy: row.manualCompletedBy ? String(row.manualCompletedBy) : null,
    externalPostId: row.externalPostId ? String(row.externalPostId) : null,
    approvedBy: row.approvedBy ? String(row.approvedBy) : null,
    approvedAt: row.approvedAt ? String(row.approvedAt) : null,
    createdBy: String(row.createdBy),
    updatedBy: String(row.updatedBy),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

export class ContentRepository {
  constructor(private readonly ctx: MarketingContext) {}

  private scope() {
    const ctx = this.ctx;
    if (ctx.allBrands) return sql``;
    return ctx.allowedBrands.length
      ? sql`AND brand_uuid IN (${sql.join(ctx.allowedBrands)})`
      : sql`AND 1=0`;
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
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    const campaignFilter = campaignUuid ? sql`AND campaign_uuid=${campaignUuid}` : sql``;
    const statusFilter = status !== "all" ? sql`AND status=${status}` : sql``;
    const channelFilter = channel !== "all" ? sql`AND channel=${channel}` : sql``;
    const searchFilter = search ? sql`AND (title LIKE ${"%" + search + "%"} OR body LIKE ${"%" + search + "%"})` : sql``;

    const rows = (
      await sql<Record<string, unknown>>`SELECT
        uuid, revision, company_id AS companyId, brand_uuid AS brandUuid,
        campaign_uuid AS campaignUuid, title, body, channel,
        publish_mode AS publishMode, status,
        DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z') AS scheduledAt,
        DATE_FORMAT(published_at, '%Y-%m-%dT%H:%i:%s.000Z') AS publishedAt,
        media_urls AS mediaUrls,
        rejection_reason AS rejectionReason,
        manual_task_notes AS manualTaskNotes,
        DATE_FORMAT(manual_completed_at, '%Y-%m-%dT%H:%i:%s.000Z') AS manualCompletedAt,
        manual_completed_by AS manualCompletedBy,
        external_post_id AS externalPostId,
        approved_by AS approvedBy,
        DATE_FORMAT(approved_at, '%Y-%m-%dT%H:%i:%s.000Z') AS approvedAt,
        created_by AS createdBy, updated_by AS updatedBy,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
        DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt
      FROM marketing_contents
      WHERE company_id=${this.ctx.companyId} ${this.scope()}
        ${brandFilter} ${campaignFilter} ${statusFilter} ${channelFilter} ${searchFilter}
      ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`.execute(this.ctx.database)
    ).rows;

    return rows.map(mapRecord);
  }

  async count(
    search = "",
    status = "all",
    channel = "all",
    brandUuid?: string,
    campaignUuid?: string
  ): Promise<number> {
    const brandFilter = brandUuid ? sql`AND brand_uuid=${brandUuid}` : sql``;
    const campaignFilter = campaignUuid ? sql`AND campaign_uuid=${campaignUuid}` : sql``;
    const statusFilter = status !== "all" ? sql`AND status=${status}` : sql``;
    const channelFilter = channel !== "all" ? sql`AND channel=${channel}` : sql``;
    const searchFilter = search ? sql`AND (title LIKE ${"%" + search + "%"} OR body LIKE ${"%" + search + "%"})` : sql``;

    return Number(
      (
        await sql<{ total: number }>`SELECT COUNT(*) AS total
        FROM marketing_contents
        WHERE company_id=${this.ctx.companyId} ${this.scope()}
          ${brandFilter} ${campaignFilter} ${statusFilter} ${channelFilter} ${searchFilter}`.execute(
          this.ctx.database
        )
      ).rows[0]?.total ?? 0
    );
  }

  async get(uuid: string): Promise<ContentRecord | null> {
    const row = (
      await sql<Record<string, unknown>>`SELECT
        uuid, revision, company_id AS companyId, brand_uuid AS brandUuid,
        campaign_uuid AS campaignUuid, title, body, channel,
        publish_mode AS publishMode, status,
        DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z') AS scheduledAt,
        DATE_FORMAT(published_at, '%Y-%m-%dT%H:%i:%s.000Z') AS publishedAt,
        media_urls AS mediaUrls,
        rejection_reason AS rejectionReason,
        manual_task_notes AS manualTaskNotes,
        DATE_FORMAT(manual_completed_at, '%Y-%m-%dT%H:%i:%s.000Z') AS manualCompletedAt,
        manual_completed_by AS manualCompletedBy,
        external_post_id AS externalPostId,
        approved_by AS approvedBy,
        DATE_FORMAT(approved_at, '%Y-%m-%dT%H:%i:%s.000Z') AS approvedAt,
        created_by AS createdBy, updated_by AS updatedBy,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
        DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt
      FROM marketing_contents
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(
        this.ctx.database
      )
    ).rows[0];

    return row ? mapRecord(row) : null;
  }

  async save(input: ContentInput, uuid?: string): Promise<string> {
    const identity = uuid ?? randomBytes(4).toString("hex");
    const mediaJson = JSON.stringify(input.mediaUrls ?? []);
    const publishMode = input.publishMode ?? "api";
    const status = input.status ?? "draft";
    const campaignUuid = input.campaignUuid || null;
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;

    await this.ctx.database.transaction().execute(async (database) => {
      if (uuid) {
        const current = (
          await sql<{ revision: number }>`SELECT revision FROM marketing_contents
          WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(
            database
          )
        ).rows[0];
        if (!current) throw AppError.notFound("Content record was not found.");
        if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) {
          throw AppError.conflict("This record changed. Refresh it before saving.");
        }
        await sql`UPDATE marketing_contents SET
          revision=revision+1,
          campaign_uuid=${campaignUuid},
          title=${input.title},
          body=${input.body},
          channel=${input.channel},
          publish_mode=${publishMode},
          status=${status},
          scheduled_at=${scheduledAt},
          media_urls=${mediaJson},
          rejection_reason=${input.rejectionReason ?? null},
          manual_task_notes=${input.manualTaskNotes ?? null},
          updated_by=${this.ctx.actorEmail}
        WHERE uuid=${identity} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);
      } else {
        await sql`INSERT INTO marketing_contents(
          uuid, company_id, brand_uuid, campaign_uuid, title, body, channel,
          publish_mode, status, scheduled_at, media_urls, rejection_reason,
          manual_task_notes, created_by, updated_by
        ) VALUES(
          ${identity}, ${this.ctx.companyId}, ${input.brandUuid}, ${campaignUuid},
          ${input.title}, ${input.body}, ${input.channel}, ${publishMode}, ${status},
          ${scheduledAt}, ${mediaJson}, ${input.rejectionReason ?? null},
          ${input.manualTaskNotes ?? null}, ${this.ctx.actorEmail}, ${this.ctx.actorEmail}
        )`.execute(database);
      }

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${identity}, ${this.ctx.companyId}, ${uuid ? "updated" : "created"}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });

    return identity;
  }

  async submitForApproval(uuid: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number; status: string }>`SELECT revision, status FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status='pending_approval',
        rejection_reason=NULL,
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'submitted_for_approval', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async approve(uuid: string, approvedBy: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number }>`SELECT revision FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status='approved',
        approved_by=${approvedBy},
        approved_at=CURRENT_TIMESTAMP,
        rejection_reason=NULL,
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'approved', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async reject(uuid: string, reason: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number }>`SELECT revision FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status='rejected',
        rejection_reason=${reason},
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'rejected', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async schedule(uuid: string, scheduledAt: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number }>`SELECT revision FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status='scheduled',
        scheduled_at=${new Date(scheduledAt)},
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'scheduled', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async cancel(uuid: string, expectedRevision?: number): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number }>`SELECT revision FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status='cancelled',
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'cancelled', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async markPublished(
    uuid: string,
    externalPostId: string | null,
    expectedRevision?: number
  ): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number }>`SELECT revision FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status='published',
        published_at=CURRENT_TIMESTAMP,
        external_post_id=${externalPostId},
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'published', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async completeManualPublish(
    uuid: string,
    completedBy: string,
    notes?: string,
    expectedRevision?: number
  ): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number; manual_task_notes: string | null }>`SELECT revision, manual_task_notes FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      const taskNotes = notes ?? current.manual_task_notes;
      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status='published',
        published_at=CURRENT_TIMESTAMP,
        manual_completed_at=CURRENT_TIMESTAMP,
        manual_completed_by=${completedBy},
        manual_task_notes=${taskNotes},
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, 'manual_published', ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async updateStatus(
    uuid: string,
    data: {
      status: ContentStatus;
      publishMode?: ContentPublishMode;
      manualTaskNotes?: string | null;
      action: string;
    },
    expectedRevision?: number
  ): Promise<void> {
    await this.ctx.database.transaction().execute(async (database) => {
      const current = (
        await sql<{ revision: number }>`SELECT revision FROM marketing_contents
        WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()} FOR UPDATE`.execute(database)
      ).rows[0];
      if (!current) throw AppError.notFound("Content record was not found.");
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw AppError.conflict("This record changed. Refresh it before saving.");
      }
      const publishMode = data.publishMode ? sql`, publish_mode=${data.publishMode}` : sql``;
      const notes = data.manualTaskNotes !== undefined ? sql`, manual_task_notes=${data.manualTaskNotes}` : sql``;

      await sql`UPDATE marketing_contents SET
        revision=revision+1,
        status=${data.status}
        ${publishMode}
        ${notes},
        updated_by=${this.ctx.actorEmail}
      WHERE uuid=${uuid} AND company_id=${this.ctx.companyId} ${this.scope()}`.execute(database);

      await sql`INSERT INTO marketing_contents_activity(uuid, record_uuid, company_id, action, actor)
      VALUES(${randomBytes(4).toString("hex")}, ${uuid}, ${this.ctx.companyId}, ${data.action}, ${this.ctx.actorEmail})`.execute(
        database
      );
    });
  }

  async activity(uuid: string): Promise<ContentActivity[]> {
    return (
      await sql<ContentActivity>`SELECT
        action, actor,
        DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.000Z') AS occurredAt
      FROM marketing_contents_activity
      WHERE company_id=${this.ctx.companyId} AND record_uuid=${uuid}
      ORDER BY id DESC LIMIT 100`.execute(this.ctx.database)
    ).rows;
  }
}
