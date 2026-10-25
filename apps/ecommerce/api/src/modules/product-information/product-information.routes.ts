import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import { ProductInformationService } from "./product-information.service.js";

const base = "/ecommerce/catalog/product-information";
const service = new ProductInformationService();
const status = z.enum(["draft", "published", "archived"]);
const params = z.object({ id: z.coerce.number().int().positive() });
const payload = z.object({
  coreProductId: z.number().int().positive(),
  brandId: z.number().int().positive().nullable().default(null),
  storefrontTitle: z.string().trim().min(1),
  subtitle: z.string().max(255).default(""),
  slug: z.string().trim().min(1),
  shortDescription: z.string().max(500).default(""),
  description: z.string().default(""),
  bulletPoints: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  material: z.string().max(191).default(""),
  countryOfOrigin: z.string().max(120).default(""),
  manufacturer: z.string().max(191).default(""),
  warranty: z.string().max(500).default(""),
  returnPolicy: z.string().max(500).default(""),
  shippingClass: z.string().max(120).default("standard"),
  weight: z
    .number()
    .min(0)
    .nullable()
    .default(0)
    .transform((value) => value ?? 0),
  length: z
    .number()
    .min(0)
    .nullable()
    .default(0)
    .transform((value) => value ?? 0),
  width: z
    .number()
    .min(0)
    .nullable()
    .default(0)
    .transform((value) => value ?? 0),
  height: z
    .number()
    .min(0)
    .nullable()
    .default(0)
    .transform((value) => value ?? 0),
  minimumOrderQuantity: z.number().int().positive().default(1),
  maximumOrderQuantity: z.number().int().positive().nullable().default(null),
  seoTitle: z.string().max(191).default(""),
  seoDescription: z.string().max(320).default(""),
  publicationStatus: status.default("draft"),
  isFeatured: z.boolean().default(false)
});
const updatePayload = payload.extend({
  expectedRevision: z.number().int().positive()
});
const record = payload.extend({
  id: z.number(),
  uuid: z.string().length(8),
  coreProductName: z.string(),
  brandName: z.string().nullable(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string()
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
const page = z.object({
  items: z.array(record),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
  statusCounts: z.object({
    all: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative()
  }),
  total: z.number().int().nonnegative()
});

export async function registerProductInformationRoutes(
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
        storefrontTitle: z.string().trim().max(191).optional(),
        coreProductName: z.string().trim().max(191).optional(),
        brandName: z.string().trim().max(191).optional(),
        slug: z.string().trim().max(191).optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(100).optional()
      }),
      response: page
    },
    handler: ({ query }) =>
      service.list({
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.storefrontTitle === undefined ? {} : { storefrontTitle: query.storefrontTitle }),
        ...(query.coreProductName === undefined ? {} : { coreProductName: query.coreProductName }),
        ...(query.brandName === undefined ? {} : { brandName: query.brandName }),
        ...(query.slug === undefined ? {} : { slug: query.slug }),
        ...(query.page === undefined ? {} : { page: query.page }),
        ...(query.pageSize === undefined ? {} : { pageSize: query.pageSize })
      })
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/core-products`,
    schemas: { response: z.array(z.object({ id: z.number(), name: z.string() })) },
    handler: () => service.coreProductOptions()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/core-brands`,
    schemas: { response: z.array(z.object({ id: z.number(), name: z.string() })) },
    handler: () => service.coreBrandOptions()
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
  registerContractRoute(app, {
    method: "POST",
    url: `${base}/:id/archive`,
    schemas: { params, response: record },
    handler: async ({ params, request }) =>
      required(await service.archive(params.id, resolveActorEmail(request)))
  });
}
function required<T>(value: T | null): T {
  if (!value) throw AppError.notFound("Product information was not found.");
  return value;
}
