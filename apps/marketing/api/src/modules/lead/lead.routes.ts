import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies, MarketingContext } from "../../context.js";
import type { LeadInput } from "./lead.types.js";
import { LeadService } from "./lead.service.js";

export const leadStatusSchema = z.enum(["new", "contacted", "qualified", "disqualified", "deferred"]);

export const leadInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive().optional(),
  brandUuid: z.string().regex(/^[a-f0-9]{8}$/),
  campaignUuid: z.string().default(""),
  captureUuid: z.string().default(""),
  submissionUuid: z.string().default(""),
  source: z.string().max(80).default("direct"),
  sourceReference: z.string().max(191).default(""),
  name: z.string().trim().min(1).max(160),
  email: z.union([z.literal(""), z.string().email().max(254)]).default(""),
  phone: z.string().max(50).default(""),
  companyName: z.string().max(160).default(""),
  notes: z.string().default(""),
  status: leadStatusSchema.default("new"),
  assignedTo: z.string().max(191).default(""),
  score: z.number().int().default(0)
});

export const leadRecordSchema = leadInputSchema.extend({
  uuid: z.string(),
  revision: z.number().int().positive(),
  companyId: z.number(),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerLeadRoutes(
  app: FastifyInstance,
  deps: MarketingDependencies,
  validateParent: (ctx: MarketingContext, input: LeadInput) => Promise<void>
) {
  const params = z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) });
  const service = async (request: import("fastify").FastifyRequest) => {
    const ctx = await deps.context(request);
    return new LeadService(ctx, (input) => validateParent(ctx, input));
  };

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/leads/count",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        status: z.union([z.literal("all"), leadStatusSchema]).default("all"),
        brandUuid: z.string().optional()
      }),
      response: z.object({ total: z.number() })
    },
    handler: async ({ request, query }) => ({
      total: await (await service(request)).count(query.search, query.status, query.brandUuid)
    })
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/leads",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        status: z.union([z.literal("all"), leadStatusSchema]).default("all"),
        brandUuid: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }),
      response: z.array(leadRecordSchema)
    },
    handler: async ({ request, query }) =>
      (await service(request)).list(query.search, query.limit, query.offset, query.status, query.brandUuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/leads/:uuid",
    schemas: { params, response: leadRecordSchema },
    handler: async ({ request, params }) => (await service(request)).get(params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/leads",
    schemas: { body: leadInputSchema, response: leadRecordSchema },
    handler: async ({ request, body }) => (await service(request)).save(body)
  });

  registerContractRoute(app, {
    method: "PUT",
    url: "/marketing/leads/:uuid",
    schemas: { params, body: leadInputSchema, response: leadRecordSchema },
    handler: async ({ request, params, body }) => (await service(request)).save(body, params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/leads/:uuid/assign",
    schemas: {
      params,
      body: z.strictObject({
        assignedTo: z.string().max(191),
        expectedRevision: z.number().int().positive().optional()
      }),
      response: leadRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).assign(params.uuid, body.assignedTo, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/leads/:uuid/status",
    schemas: {
      params,
      body: z.strictObject({
        status: leadStatusSchema,
        expectedRevision: z.number().int().positive().optional()
      }),
      response: leadRecordSchema
    },
    handler: async ({ request, params, body }) =>
      (await service(request)).updateStatus(params.uuid, body.status, body.expectedRevision)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/leads/:uuid/activity",
    schemas: {
      params,
      response: z.array(z.object({ action: z.string(), actor: z.string(), occurredAt: z.string() }))
    },
    handler: async ({ request, params }) => (await service(request)).activity(params.uuid)
  });
}
