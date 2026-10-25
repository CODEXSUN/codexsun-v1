import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies, MarketingContext } from "../../context.js";
import type { ContentInput } from "./content.types.js";
import { ContentService } from "./content.service.js";

export const contentStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "cancelled"
]);

export const contentChannelSchema = z.enum([
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "threads",
  "pinterest",
  "youtube",
  "telegram"
]);

export const contentPublishModeSchema = z.enum(["api", "manual"]);

export const contentInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive().optional(),
  brandUuid: z.string().regex(/^[a-f0-9]{8}$/),
  campaignUuid: z.string().regex(/^[a-f0-9]{8}$/).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50000),
  channel: contentChannelSchema,
  publishMode: contentPublishModeSchema.default("api"),
  scheduledAt: z.union([z.literal(""), z.string().datetime(), z.null()]).optional(),
  mediaUrls: z.array(z.string().url()).default([]),
  status: contentStatusSchema.default("draft"),
  rejectionReason: z.string().max(500).nullable().optional(),
  manualTaskNotes: z.string().max(5000).nullable().optional()
});

export const contentRecordSchema = z.object({
  uuid: z.string(),
  revision: z.number().int().positive(),
  companyId: z.number(),
  brandUuid: z.string(),
  campaignUuid: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  channel: contentChannelSchema,
  publishMode: contentPublishModeSchema,
  status: contentStatusSchema,
  scheduledAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  mediaUrls: z.array(z.string()),
  rejectionReason: z.string().nullable(),
  manualTaskNotes: z.string().nullable(),
  manualCompletedAt: z.string().nullable(),
  manualCompletedBy: z.string().nullable(),
  externalPostId: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerContentRoutes(
  app: FastifyInstance,
  deps: MarketingDependencies,
  validateParent: (
    ctx: MarketingContext,
    input: { brandUuid: string; campaignUuid?: string | null | undefined }
  ) => Promise<void>
) {
  const params = z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) });
  const service = async (request: import("fastify").FastifyRequest) => {
    const ctx = await deps.context(request);
    return new ContentService(ctx, (input) => validateParent(ctx, input));
  };

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/contents/count",
    schemas: {
      querystring: z.object({
        search: z.string().max(200).default(""),
        status: z.union([contentStatusSchema, z.literal("all")]).default("all"),
        channel: z.union([contentChannelSchema, z.literal("all")]).default("all"),
        brandUuid: z.string().regex(/^[a-f0-9]{8}$/).optional(),
        campaignUuid: z.string().regex(/^[a-f0-9]{8}$/).optional()
      }),
      response: z.object({ total: z.number() })
    },
    handler: async ({ request, query }) => ({
      total: await (
        await service(request)
      ).count(query.search, query.status, query.channel, query.brandUuid, query.campaignUuid)
    })
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/contents",
    schemas: {
      querystring: z.object({
        search: z.string().max(200).default(""),
        status: z.union([contentStatusSchema, z.literal("all")]).default("all"),
        channel: z.union([contentChannelSchema, z.literal("all")]).default("all"),
        brandUuid: z.string().regex(/^[a-f0-9]{8}$/).optional(),
        campaignUuid: z.string().regex(/^[a-f0-9]{8}$/).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }),
      response: z.array(contentRecordSchema)
    },
    handler: async ({ request, query }) =>
      (await service(request)).list(
        query.search,
        query.limit,
        query.offset,
        query.status,
        query.channel,
        query.brandUuid,
        query.campaignUuid
      )
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/contents/:uuid",
    schemas: { params, response: contentRecordSchema },
    handler: async ({ request, params }) => (await service(request)).get(params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents",
    schemas: { body: contentInputSchema, response: contentRecordSchema },
    handler: async ({ request, body }) => (await service(request)).create(body as ContentInput)
  });

  registerContractRoute(app, {
    method: "PUT",
    url: "/marketing/contents/:uuid",
    schemas: { params, body: contentInputSchema, response: contentRecordSchema },
    handler: async ({ request, params, body }) =>
      (await service(request)).update(params.uuid, body as ContentInput)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents/:uuid/submit-approval",
    schemas: {
      params,
      body: z.object({ expectedRevision: z.number().int().positive().optional() }).optional(),
      response: contentRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).submitForApproval(params.uuid, body?.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents/:uuid/approve",
    schemas: {
      params,
      body: z.object({ expectedRevision: z.number().int().positive().optional() }).optional(),
      response: contentRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).approve(params.uuid, body?.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents/:uuid/reject",
    schemas: {
      params,
      body: z.strictObject({
        reason: z.string().trim().min(1).max(500),
        expectedRevision: z.number().int().positive().optional()
      }),
      response: contentRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).reject(params.uuid, body.reason, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents/:uuid/schedule",
    schemas: {
      params,
      body: z.strictObject({
        scheduledAt: z.string().datetime(),
        expectedRevision: z.number().int().positive().optional()
      }),
      response: contentRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).schedule(params.uuid, body.scheduledAt, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents/:uuid/cancel",
    schemas: {
      params,
      body: z.object({ expectedRevision: z.number().int().positive().optional() }).optional(),
      response: contentRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).cancel(params.uuid, body?.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents/:uuid/publish",
    schemas: {
      params,
      body: z.object({ expectedRevision: z.number().int().positive().optional() }).optional(),
      response: contentRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).publish(params.uuid, body?.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contents/:uuid/complete-manual",
    schemas: {
      params,
      body: z.strictObject({
        notes: z.string().max(5000).optional(),
        expectedRevision: z.number().int().positive().optional()
      }),
      response: contentRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).completeManualPublish(params.uuid, body.notes, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/contents/:uuid/activity",
    schemas: {
      params,
      response: z.array(
        z.object({ action: z.string(), actor: z.string(), occurredAt: z.string() })
      )
    },
    handler: async ({ request, params }) => (await service(request)).activity(params.uuid)
  });
}
