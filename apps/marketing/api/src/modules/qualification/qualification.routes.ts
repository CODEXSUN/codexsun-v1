import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies, MarketingContext } from "../../context.js";
import type { QualificationInput } from "./qualification.types.js";
import { QualificationService } from "./qualification.service.js";

export const qualificationDecisionSchema = z.enum(["qualified", "disqualified", "deferred"]);

export const qualificationInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive().optional(),
  brandUuid: z.string().regex(/^[a-f0-9]{8}$/),
  leadUuid: z.string().regex(/^[a-f0-9]{8}$/),
  decision: qualificationDecisionSchema,
  criteria: z.string().max(500).default(""),
  reason: z.string().trim().min(1).max(500),
  notes: z.string().default("")
});

export const qualificationRecordSchema = z.strictObject({
  uuid: z.string(),
  revision: z.number().int().positive(),
  companyId: z.number(),
  brandUuid: z.string(),
  leadUuid: z.string(),
  reviewer: z.string(),
  decision: qualificationDecisionSchema,
  criteria: z.string(),
  reason: z.string(),
  notes: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerQualificationRoutes(
  app: FastifyInstance,
  deps: MarketingDependencies,
  validateParent: (ctx: MarketingContext, input: QualificationInput) => Promise<void>
) {
  const params = z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) });
  const service = async (request: import("fastify").FastifyRequest) => {
    const ctx = await deps.context(request);
    return new QualificationService(ctx, (input) => validateParent(ctx, input));
  };

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/qualifications/count",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        decision: z.union([z.literal("all"), qualificationDecisionSchema]).default("all"),
        leadUuid: z.string().optional(),
        brandUuid: z.string().optional()
      }),
      response: z.object({ total: z.number() })
    },
    handler: async ({ request, query }) => ({
      total: await (await service(request)).count(query.search, query.decision, query.leadUuid, query.brandUuid)
    })
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/qualifications",
    schemas: {
      querystring: z.object({
        search: z.string().max(160).default(""),
        decision: z.union([z.literal("all"), qualificationDecisionSchema]).default("all"),
        leadUuid: z.string().optional(),
        brandUuid: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }),
      response: z.array(qualificationRecordSchema)
    },
    handler: async ({ request, query }) =>
      (await service(request)).list(query.search, query.limit, query.offset, query.decision, query.leadUuid, query.brandUuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/qualifications/:uuid",
    schemas: { params, response: qualificationRecordSchema },
    handler: async ({ request, params }) => (await service(request)).get(params.uuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/qualifications/lead/:leadUuid",
    schemas: {
      params: z.object({ leadUuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: z.union([qualificationRecordSchema, z.null()])
    },
    handler: async ({ request, params }) => (await service(request)).getLatestForLead(params.leadUuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/qualifications",
    schemas: { body: qualificationInputSchema, response: qualificationRecordSchema },
    handler: async ({ request, body }) => (await service(request)).save(body)
  });

  registerContractRoute(app, {
    method: "PUT",
    url: "/marketing/qualifications/:uuid",
    schemas: { params, body: qualificationInputSchema, response: qualificationRecordSchema },
    handler: async ({ request, params, body }) => (await service(request)).save(body, params.uuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/qualifications/:uuid/activity",
    schemas: {
      params,
      response: z.array(z.object({ action: z.string(), actor: z.string(), occurredAt: z.string() }))
    },
    handler: async ({ request, params }) => (await service(request)).activity(params.uuid)
  });
}
