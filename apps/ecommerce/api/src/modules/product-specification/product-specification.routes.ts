import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import { ProductSpecificationService } from "./product-specification.service.js";

const base = "/ecommerce/catalog/specifications";
const service = new ProductSpecificationService();
const params = z.object({ id: z.coerce.number().int().positive() });
const status = z.enum(["active", "inactive"]);
const payload = z.object({
  productInformationId: z.number().int().positive(),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().min(0).default(1000),
  status: status.default("active")
});
const updatePayload = payload.extend({ expectedRevision: z.number().int().positive() });
const record = payload.extend({
  id: z.number(),
  uuid: z.string().length(8),
  productTitle: z.string(),
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

export async function registerProductSpecificationRoutes(
  app: FastifyInstance,
  resolveActorEmail: (request: FastifyRequest) => string = () => ""
) {
  registerContractRoute(app, {
    method: "GET",
    url: base,
    schemas: {
      querystring: z.object({
        productInformationId: z.coerce.number().int().positive().optional(),
        search: z.string().max(191).optional(),
        status: status.optional(),
        product: z.string().max(191).optional(),
        label: z.string().max(191).optional(),
        value: z.string().max(191).optional(),
        sortOrder: z.string().max(32).optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().optional()
      }),
      response: z.union([z.array(record), page])
    },
    handler: ({ query }) =>
      service.list({
        ...(query.productInformationId === undefined
          ? {}
          : { productInformationId: query.productInformationId }),
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.product === undefined ? {} : { product: query.product }),
        ...(query.label === undefined ? {} : { label: query.label }),
        ...(query.value === undefined ? {} : { value: query.value }),
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
  if (!value) throw AppError.notFound("Specification was not found.");
  return value;
}
