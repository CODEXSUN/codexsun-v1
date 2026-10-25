import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies, MarketingContext } from "../../context.js";
import type { FollowUpInput } from "./follow-up.types.js";
import { FollowUpService } from "./follow-up.service.js";

export const followUpActionTypeSchema = z.enum(["call", "email", "meeting", "review"]);
export const followUpStatusSchema = z.enum(["pending", "completed", "cancelled"]);

export const followUpInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive().optional(),
  brandUuid: z.string().regex(/^[a-f0-9]{8}$/),
  leadUuid: z.string().regex(/^[a-f0-9]{8}$/),
  actionType: followUpActionTypeSchema,
  subject: z.string().trim().min(1).max(200),
  notes: z.string().default(""),
  dueAt: z.string().datetime(),
  assignedTo: z.string().trim().min(1).max(191),
  status: followUpStatusSchema.default("pending")
});

export const followUpRecordSchema = z.strictObject({
  uuid: z.string(),
  revision: z.number().int().positive(),
  companyId: z.number(),
  brandUuid: z.string(),
  leadUuid: z.string(),
  actionType: followUpActionTypeSchema,
  subject: z.string(),
  notes: z.string(),
  dueAt: z.string(),
  assignedTo: z.string(),
  status: followUpStatusSchema,
  completedAt: z.union([z.string(), z.null()]),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerFollowUpRoutes(
  app: FastifyInstance,
  deps: MarketingDependencies,
  validateParent: (ctx: MarketingContext, input: FollowUpInput) => Promise<void>
) {
  const params = z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) });
  const service = async (request: import("fastify").FastifyRequest) => {
    const ctx = await deps.context(request);
    return new FollowUpService(ctx, (input) => validateParent(ctx, input));
  };

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/follow-ups/count",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        status: z.union([z.literal("all"), followUpStatusSchema]).default("all"),
        leadUuid: z.string().optional(),
        brandUuid: z.string().optional()
      }),
      response: z.object({ total: z.number() })
    },
    handler: async ({ request, query }) => ({
      total: await (await service(request)).count(query.search, query.status, query.leadUuid, query.brandUuid)
    })
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/follow-ups",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        status: z.union([z.literal("all"), followUpStatusSchema]).default("all"),
        leadUuid: z.string().optional(),
        brandUuid: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }),
      response: z.array(followUpRecordSchema)
    },
    handler: async ({ request, query }) =>
      (await service(request)).list(query.search, query.limit, query.offset, query.status, query.leadUuid, query.brandUuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/follow-ups/:uuid",
    schemas: { params, response: followUpRecordSchema },
    handler: async ({ request, params }) => (await service(request)).get(params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/follow-ups",
    schemas: { body: followUpInputSchema, response: followUpRecordSchema },
    handler: async ({ request, body }) => (await service(request)).save(body)
  });

  registerContractRoute(app, {
    method: "PUT",
    url: "/marketing/follow-ups/:uuid",
    schemas: { params, body: followUpInputSchema, response: followUpRecordSchema },
    handler: async ({ request, params, body }) => (await service(request)).save(body, params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/follow-ups/:uuid/complete",
    schemas: {
      params,
      body: z.strictObject({
        expectedRevision: z.number().int().positive().optional()
      }),
      response: followUpRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).complete(params.uuid, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/follow-ups/:uuid/cancel",
    schemas: {
      params,
      body: z.strictObject({
        expectedRevision: z.number().int().positive().optional()
      }),
      response: followUpRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).cancel(params.uuid, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/follow-ups/:uuid/activity",
    schemas: {
      params,
      response: z.array(z.object({ action: z.string(), actor: z.string(), occurredAt: z.string() }))
    },
    handler: async ({ request, params }) => (await service(request)).activity(params.uuid)
  });
}
