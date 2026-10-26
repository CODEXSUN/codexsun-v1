import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import { LeadService } from "./lead.service.js";
import type { LeadContext } from "./lead.types.js";
export const leadIntakeSchema = z.strictObject({
  submissionUuid: z.string().regex(/^[a-f0-9]{8}$/),
  campaignUuid: z.string().regex(/^[a-f0-9]{8}$/),
  campaignLabel: z.string().max(160),
  name: z.string().trim().min(1).max(160),
  email: z.union([z.literal(""), z.email().max(254)]),
  phone: z.string().max(40),
  message: z.string().max(10000),
  source: z.string().max(160)
});
export const leadRecordSchema = leadIntakeSchema.extend({
  name: z.string().max(160),
  uuid: z.string(),
  companyId: z.number(),
  assignedTo: z.string(),
  status: z.enum(["review", "qualified", "lost", "converted"]),
  taskId: z.number().nullable(),
  contactId: z.number().nullable(),
  enquiryId: z.number().nullable(),
  revision: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export const leadInputSchema = z.strictObject({
  name: z.string().trim().max(160),
  email: z.union([z.literal(""), z.email().max(254)]),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number."),
  message: z.string().trim().max(10000),
  campaignLabel: z.string().trim().max(160),
  contactId: z.number().int().positive().nullable(),
  status: z.enum(["review", "qualified", "lost"]),
  revision: z.number().int().positive().optional()
});
const params = z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) });
export function registerLeadRoutes(
  app: FastifyInstance,
  context: (request: FastifyRequest) => Promise<LeadContext>
) {
  const filters = z
    .object({
      search: z.string().trim().max(200).default(""),
      status: z.enum(["all", "active", "review", "qualified", "lost", "converted"]).default("all"),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      fromAt: z.iso.datetime({ offset: true }).optional(),
      toAt: z.iso.datetime({ offset: true }).optional(),
      searchName: z.string().trim().max(191).optional(),
      searchPhone: z.string().trim().max(191).optional(),
      searchMessage: z.string().trim().max(191).optional(),
      searchCampaign: z.string().trim().max(191).optional(),
      searchStatus: z.string().trim().max(191).optional()
    })
    .refine(
      (value) => !value.fromAt || !value.toAt || Date.parse(value.fromAt) < Date.parse(value.toAt),
      "The end of the date range must follow its start."
    );
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/leads/campaigns",
    schemas: {
      querystring: z.object({ search: z.string().trim().max(160).default("") }),
      response: z.array(z.object({ label: z.string() }))
    },
    handler: async ({ request, query }) =>
      new LeadService(await context(request)).campaigns(query.search)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/leads/options",
    schemas: {
      response: z.object({
        canCreate: z.boolean(),
        canUpdate: z.boolean(),
        canConvert: z.boolean()
      })
    },
    handler: async ({ request }) => new LeadService(await context(request)).capabilities()
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/leads/page",
    schemas: {
      querystring: filters,
      response: z.object({ items: z.array(leadRecordSchema), total: z.number() })
    },
    handler: async ({ request, query }) => new LeadService(await context(request)).page(query)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/leads/contacts",
    schemas: {
      querystring: z.object({ search: z.string().trim().max(160).default("") }),
      response: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          primaryPhone: z.string().nullable().optional()
        })
      )
    },
    handler: async ({ request, query }) =>
      new LeadService(await context(request)).contacts(query.search)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/leads",
    schemas: { body: leadInputSchema, response: leadRecordSchema },
    handler: async ({ request, body }) => new LeadService(await context(request)).save(body)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/crm/leads/:uuid",
    schemas: { params, body: leadInputSchema, response: leadRecordSchema },
    handler: async ({ request, body, params }) =>
      new LeadService(await context(request)).save(body, params.uuid)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/leads/:uuid/convert",
    schemas: { params, body: z.strictObject({}), response: leadRecordSchema },
    handler: async ({ request, params }) =>
      new LeadService(await context(request)).convert(params.uuid)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/leads/:uuid/activity",
    schemas: {
      params,
      response: z.array(
        z.object({
          action: z.string(),
          actor: z.string(),
          details: z.string(),
          createdAt: z.string()
        })
      )
    },
    handler: async ({ request, params }) =>
      new LeadService(await context(request)).activity(params.uuid)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/leads/:uuid",
    schemas: {
      params: z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: leadRecordSchema
    },
    handler: async ({ request, params }) => new LeadService(await context(request)).get(params.uuid)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/leads",
    schemas: { response: z.array(leadRecordSchema) },
    handler: async ({ request }) => new LeadService(await context(request)).list()
  });
}
