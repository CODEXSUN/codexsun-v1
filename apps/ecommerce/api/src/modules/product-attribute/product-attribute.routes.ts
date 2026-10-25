import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import { ProductAttributeService } from "./product-attribute.service.js";

const base = "/ecommerce/catalog/attributes";
const service = new ProductAttributeService();
const params = z.object({ id: z.coerce.number().int().positive() });
const productParams = z.object({ productInformationId: z.coerce.number().int().positive() });
const status = z.enum(["active", "inactive"]);
const dataType = z.enum(["text", "number", "boolean", "select", "color"]);
const payload = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(191),
  dataType,
  unit: z.string().trim().max(32).default(""),
  isFilterable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(1000),
  status: status.default("active")
});
const updatePayload = payload.extend({ expectedRevision: z.number().int().positive() });
const record = payload.extend({
  id: z.number(),
  uuid: z.string().length(8),
  valueCount: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const page = z.object({
  items: z.array(record),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  statusCounts: z.object({
    all: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    inactive: z.number().int().nonnegative()
  })
});
const assignment = z.object({
  attributeId: z.number(),
  code: z.string(),
  name: z.string(),
  dataType,
  unit: z.string(),
  values: z.array(z.string())
});
const assignmentPayload = z.object({
  values: z
    .array(
      z.object({
        attributeId: z.number().int().positive(),
        values: z.array(z.string()).max(50)
      })
    )
    .max(100)
});
const activity = z.object({
  id: z.number(),
  uuid: z.string().length(8),
  resourceType: z.enum(["attribute", "collection", "product-information", "specification"]),
  recordId: z.number(),
  action: z.string(),
  actorEmail: z.string(),
  summary: z.string(),
  createdAt: z.string()
});

export async function registerProductAttributeRoutes(
  app: FastifyInstance,
  resolveActorEmail: (request: FastifyRequest) => string = () => ""
) {
  registerContractRoute(app, {
    method: "GET",
    url: base,
    schemas: {
      querystring: z.object({
        search: z.string().max(191).optional(),
        status: status.optional(),
        code: z.string().max(191).optional(),
        name: z.string().max(191).optional(),
        dataType: z.string().max(32).optional(),
        values: z.string().max(32).optional(),
        sortOrder: z.string().max(32).optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().optional()
      }),
      response: z.union([z.array(record), page])
    },
    handler: ({ query }) =>
      service.list({
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.code === undefined ? {} : { code: query.code }),
        ...(query.name === undefined ? {} : { name: query.name }),
        ...(query.dataType === undefined ? {} : { dataType: query.dataType }),
        ...(query.values === undefined ? {} : { values: query.values }),
        ...(query.sortOrder === undefined ? {} : { sortOrder: query.sortOrder }),
        ...(query.page === undefined ? {} : { page: query.page }),
        ...(query.pageSize === undefined ? {} : { pageSize: query.pageSize })
      })
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/products`,
    schemas: { response: z.array(z.object({ id: z.number(), title: z.string() })) },
    handler: () => service.productOptions()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/assignments/:productInformationId`,
    schemas: { params: productParams, response: z.array(assignment) },
    handler: async ({ params }) => service.assignment(params.productInformationId)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${base}/assignments/:productInformationId`,
    schemas: {
      body: assignmentPayload,
      params: productParams,
      response: z.array(assignment)
    },
    handler: async ({ body, params, request }) =>
      service.replaceAssignment(params.productInformationId, body, resolveActorEmail(request))
  });
  registerContractRoute(app, {
    method: "DELETE",
    url: `${base}/assignments/:productInformationId`,
    schemas: { params: productParams, response: z.array(assignment) },
    handler: async ({ params, request }) =>
      service.replaceAssignment(
        params.productInformationId,
        { values: [] },
        resolveActorEmail(request)
      )
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/:id/activity`,
    schemas: { params, response: z.array(activity) },
    handler: async ({ params }) => service.activityFor(params.id)
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/:id`,
    schemas: { params, response: record },
    handler: async ({ params }) => required(await service.find(params.id))
  });
  registerContractRoute(app, {
    method: "POST",
    url: base,
    schemas: { body: payload, response: record },
    handler: async ({ body, request }) =>
      required(await service.create(body, resolveActorEmail(request)))
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${base}/:id`,
    schemas: { body: updatePayload, params, response: record },
    handler: async ({ body, params, request }) =>
      required(await service.update(params.id, body, resolveActorEmail(request)))
  });
  for (const [action, nextStatus] of [
    ["activate", "active"],
    ["deactivate", "inactive"]
  ] as const)
    registerContractRoute(app, {
      method: "POST",
      url: `${base}/:id/${action}`,
      schemas: { params, response: record },
      handler: async ({ params, request }) =>
        required(await service.setStatus(params.id, nextStatus, resolveActorEmail(request)))
    });
  registerContractRoute(app, {
    method: "DELETE",
    url: `${base}/:id`,
    schemas: { params, response: record },
    handler: async ({ params, request }) => service.remove(params.id, resolveActorEmail(request))
  });
}

function required<T>(value: T | null) {
  if (!value) throw AppError.notFound("Attribute was not found.");
  return value;
}
