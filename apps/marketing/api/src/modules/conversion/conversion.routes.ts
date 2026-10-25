import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies, MarketingContext } from "../../context.js";
import type { ConversionInput } from "./conversion.types.js";
import { ConversionService } from "./conversion.service.js";

export const conversionStatusSchema = z.enum(["converted", "cancelled", "reversed"]);

export const conversionInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive().optional(),
  brandUuid: z.string().regex(/^[a-f0-9]{8}$/),
  leadUuid: z.string().regex(/^[a-f0-9]{8}$/),
  qualificationUuid: z.string().regex(/^[a-f0-9]{8}$/),
  declaredValue: z.number().min(0).default(0),
  currency: z.string().trim().length(3).default("INR"),
  notes: z.string().default("")
});

export const conversionRecordSchema = z.strictObject({
  uuid: z.string(),
  revision: z.number().int().positive(),
  companyId: z.number(),
  brandUuid: z.string(),
  leadUuid: z.string(),
  qualificationUuid: z.string(),
  status: conversionStatusSchema,
  declaredValue: z.number(),
  currency: z.string(),
  cancellationReason: z.string(),
  notes: z.string(),
  convertedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerConversionRoutes(
  app: FastifyInstance,
  deps: MarketingDependencies,
  validateParent: (ctx: MarketingContext, input: ConversionInput) => Promise<void>
) {
  const params = z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) });
  const service = async (request: import("fastify").FastifyRequest) => {
    const ctx = await deps.context(request);
    return new ConversionService(ctx, (input) => validateParent(ctx, input));
  };

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversions/count",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        status: z.union([z.literal("all"), conversionStatusSchema]).default("all"),
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
    url: "/marketing/conversions",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        status: z.union([z.literal("all"), conversionStatusSchema]).default("all"),
        leadUuid: z.string().optional(),
        brandUuid: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }),
      response: z.array(conversionRecordSchema)
    },
    handler: async ({ request, query }) =>
      (await service(request)).list(query.search, query.limit, query.offset, query.status, query.leadUuid, query.brandUuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversions/:uuid",
    schemas: { params, response: conversionRecordSchema },
    handler: async ({ request, params }) => (await service(request)).get(params.uuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversions/lead/:leadUuid",
    schemas: {
      params: z.object({ leadUuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: z.union([conversionRecordSchema, z.null()])
    },
    handler: async ({ request, params }) => (await service(request)).getByLead(params.leadUuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversions",
    schemas: { body: conversionInputSchema, response: conversionRecordSchema },
    handler: async ({ request, body }) => (await service(request)).convert(body)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversions/:uuid/cancel",
    schemas: {
      params,
      body: z.strictObject({
        reason: z.string().trim().min(1).max(500),
        expectedRevision: z.number().int().positive().optional()
      }),
      response: conversionRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).cancel(params.uuid, body.reason, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversions/:uuid/reverse",
    schemas: {
      params,
      body: z.strictObject({
        reason: z.string().trim().min(1).max(500),
        expectedRevision: z.number().int().positive().optional()
      }),
      response: conversionRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).reverse(params.uuid, body.reason, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversions/:uuid/activity",
    schemas: {
      params,
      response: z.array(z.object({ action: z.string(), actor: z.string(), occurredAt: z.string() }))
    },
    handler: async ({ request, params }) => (await service(request)).activity(params.uuid)
  });
}
