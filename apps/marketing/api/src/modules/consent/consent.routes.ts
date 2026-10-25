import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies } from "../../context.js";
import {
  ConsentService,
  consentInputSchema,
  eligibilityInputSchema,
  contactRestrictionSchema,
  contactRestrictionChannelSchema
} from "./consent.service.js";
import type { ConsentDependencies } from "./consent.types.js";

const record = consentInputSchema.extend({
  uuid: z.string(),
  companyId: z.number(),
  createdBy: z.string(),
  createdAt: z.string()
});

export const contactRestrictionRecordSchema = z.strictObject({
  uuid: z.string(),
  companyId: z.number(),
  recipient: z.string(),
  channel: contactRestrictionChannelSchema,
  blocked: z.boolean(),
  reason: z.string(),
  status: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerConsentRoutes(
  app: FastifyInstance,
  deps: MarketingDependencies,
  policies: ConsentDependencies
) {
  const service = async (request: import("fastify").FastifyRequest) =>
    new ConsentService(await deps.context(request), policies);
  const query = z.strictObject({
    search: z.string().max(160).default(""),
    action: z.enum(["all", "grant", "withdraw"]).default("all"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/consents",
    schemas: { querystring: query, response: z.array(record) },
    handler: async ({ request, query }) =>
      (await service(request)).list(query.search, query.action, query.limit, query.offset)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/consents/count",
    schemas: { querystring: query, response: z.object({ total: z.number() }) },
    handler: async ({ request, query }) =>
      (await service(request)).count(query.search, query.action)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/consents/:uuid",
    schemas: {
      params: z.strictObject({ uuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: record
    },
    handler: async ({ request, params }) => (await service(request)).get(params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/consents",
    schemas: { body: consentInputSchema, response: record },
    handler: async ({ request, body }) => (await service(request)).append(body)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/consents/eligibility",
    schemas: {
      body: eligibilityInputSchema,
      response: z.strictObject({
        eligible: z.boolean(),
        checkedAt: z.string(),
        consentUuid: z.string().nullable(),
        reasons: z.array(z.string())
      })
    },
    handler: async ({ request, body }) => (await service(request)).eligibility(body)
  });

  // Contact Restrictions routes
  const restrictionQuery = z.strictObject({
    search: z.string().max(160).default(""),
    channel: z.union([z.literal("all"), contactRestrictionChannelSchema]).default("all"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/contact-restrictions",
    schemas: {
      querystring: restrictionQuery,
      response: z.array(contactRestrictionRecordSchema)
    },
    handler: async ({ request, query }) =>
      (await service(request)).listRestrictions(query.search, query.channel, query.limit, query.offset)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/contact-restrictions/count",
    schemas: {
      querystring: restrictionQuery,
      response: z.object({ total: z.number() })
    },
    handler: async ({ request, query }) =>
      (await service(request)).countRestrictions(query.search, query.channel)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/contact-restrictions/:uuid",
    schemas: {
      params: z.strictObject({ uuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: contactRestrictionRecordSchema
    },
    handler: async ({ request, params }) => (await service(request)).getRestriction(params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contact-restrictions",
    schemas: {
      body: contactRestrictionSchema,
      response: contactRestrictionRecordSchema
    },
    handler: async ({ request, body }) => (await service(request)).recordRestriction(body)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/contact-restrictions/check",
    schemas: {
      body: z.strictObject({
        recipient: z.string().trim().min(1).max(254),
        channel: contactRestrictionChannelSchema.default("all")
      }),
      response: z.strictObject({
        allowed: z.boolean(),
        reason: z.string()
      })
    },
    handler: async ({ request, body }) =>
      (await service(request)).checkRestriction(body.recipient, body.channel)
  });
}
