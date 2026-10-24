import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import {
  PRODUCT_VARIANT_OPTION_NAME_MAX_LENGTH,
  PRODUCT_VARIANT_OPTION_VALUE_MAX_LENGTH
} from "./product-variant.identity.js";
import { ProductVariantService } from "./product-variant.service.js";
const base = "/ecommerce/catalog/variants",
  service = new ProductVariantService(),
  params = z.object({ id: z.coerce.number().int().positive() }),
  status = z.enum(["active", "inactive"]);
const payload = z.object({
  productInformationId: z.number().int().positive(),
  sku: z.string().trim().min(1).max(120),
  title: z.string().trim().max(191).default(""),
  barcode: z.string().max(120).default(""),
  option1Name: z.string().max(PRODUCT_VARIANT_OPTION_NAME_MAX_LENGTH).default(""),
  option1Value: z.string().max(PRODUCT_VARIANT_OPTION_VALUE_MAX_LENGTH).default(""),
  option2Name: z.string().max(PRODUCT_VARIANT_OPTION_NAME_MAX_LENGTH).default(""),
  option2Value: z.string().max(PRODUCT_VARIANT_OPTION_VALUE_MAX_LENGTH).default(""),
  option3Name: z.string().max(PRODUCT_VARIANT_OPTION_NAME_MAX_LENGTH).default(""),
  option3Value: z.string().max(PRODUCT_VARIANT_OPTION_VALUE_MAX_LENGTH).default(""),
  priceAdjustment: z.number().default(0),
  compareAtAdjustment: z.number().default(0),
  costAdjustment: z.number().default(0),
  weight: z.number().min(0).default(0),
  sortOrder: z.number().int().min(0).default(1000),
  status: status.default("active")
});
const updatePayload = payload.extend({
  expectedRevision: z.number().int().positive()
});
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
  pageSize: z.number().int().positive().max(100),
  statusCounts: z.object({
    all: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    inactive: z.number().int().nonnegative()
  }),
  total: z.number().int().nonnegative()
});
export async function registerProductVariantRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: base,
    schemas: {
      querystring: z.object({
        search: z.string().max(191).optional(),
        status: status.optional(),
        productInformationId: z.coerce.number().int().positive().optional(),
        sku: z.string().trim().max(120).optional(),
        title: z.string().trim().max(191).optional(),
        productTitle: z.string().trim().max(191).optional(),
        options: z.string().trim().max(360).optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(100).optional()
      }),
      response: page
    },
    handler: ({ query }) =>
      service.list({
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.productInformationId === undefined
          ? {}
          : { productInformationId: query.productInformationId }),
        ...(query.sku === undefined ? {} : { sku: query.sku }),
        ...(query.title === undefined ? {} : { title: query.title }),
        ...(query.productTitle === undefined ? {} : { productTitle: query.productTitle }),
        ...(query.options === undefined ? {} : { options: query.options }),
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
    url: `${base}/:id`,
    schemas: { params, response: record },
    handler: async ({ params }) => required(await service.find(params.id))
  });
  registerContractRoute(app, {
    method: "POST",
    url: base,
    schemas: { body: payload, response: record },
    handler: async ({ body }) => required(await service.create(body))
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${base}/:id`,
    schemas: { body: updatePayload, params, response: record },
    handler: async ({ body, params }) => required(await service.update(params.id, body))
  });
  for (const [action, active] of [
    ["activate", true],
    ["deactivate", false]
  ] as const)
    registerContractRoute(app, {
      method: "POST",
      url: `${base}/:id/${action}`,
      schemas: { params, response: record },
      handler: async ({ params }) => required(await service.setActive(params.id, active))
    });
}
function required<T>(value: T | null) {
  if (!value) throw AppError.notFound("Variant was not found.");
  return value;
}
