import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import { ProductCollectionService } from "./product-collection.service.js";

const base = "/ecommerce/catalog/collections";
const publicBase = "/ecommerce/storefront/collections";
const service = new ProductCollectionService();
const params = z.object({ id: z.coerce.number().int().positive() });
const publication = z.enum(["draft", "published", "archived"]);
const payload = z.object({
  slug: z.string().trim().min(1).max(191),
  title: z.string().trim().min(1).max(191),
  description: z.string().max(2000).default(""),
  heroImageUrl: z.string().max(1000).default(""),
  publicationStatus: publication.default("draft"),
  sortOrder: z.number().int().min(0).default(1000),
  productInformationIds: z.array(z.number().int().positive()).max(200).optional()
});
const updatePayload = payload.extend({
  expectedRevision: z.number().int().positive()
});
const record = payload.extend({
  id: z.number(),
  uuid: z.string().length(8),
  revision: z.number().int().positive(),
  itemCount: z.number().int().nonnegative(),
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
    archived: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    published: z.number().int().nonnegative()
  })
});
const item = z.object({
  productInformationId: z.number(),
  title: z.string(),
  slug: z.string(),
  sortOrder: z.number()
});
const itemPayload = z.object({
  productInformationIds: z.array(z.number().int().positive()).max(200)
});
const publicItem = item.extend({ imageUrl: z.string().nullable() });
const publicRecord = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  heroImageUrl: z.string(),
  sortOrder: z.number(),
  items: z.array(publicItem)
});
const publicSummary = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  heroImageUrl: z.string(),
  sortOrder: z.number(),
  itemCount: z.number().int().nonnegative()
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

export async function registerProductCollectionRoutes(
  app: FastifyInstance,
  resolveActorEmail: (request: FastifyRequest) => string = () => ""
) {
  registerContractRoute(app, {
    method: "GET",
    url: base,
    schemas: {
      querystring: z.object({
        search: z.string().max(191).optional(),
        publicationStatus: publication.optional(),
        title: z.string().max(191).optional(),
        itemCount: z.string().max(32).optional(),
        sortOrder: z.string().max(32).optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().optional()
      }),
      response: z.union([z.array(record), page])
    },
    handler: ({ query }) =>
      service.list({
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.publicationStatus === undefined
          ? {}
          : { publicationStatus: query.publicationStatus }),
        ...(query.title === undefined ? {} : { title: query.title }),
        ...(query.itemCount === undefined ? {} : { itemCount: query.itemCount }),
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
    url: `${base}/:id/items`,
    schemas: { params, response: z.array(item) },
    handler: async ({ params }) => {
      if (!(await service.find(params.id))) throw AppError.notFound("Collection was not found.");
      return service.items(params.id);
    }
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${base}/:id/items`,
    schemas: { body: itemPayload, params, response: z.array(item) },
    handler: async ({ body, params, request }) =>
      service.replaceItems(params.id, body.productInformationIds, resolveActorEmail(request))
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
  for (const [action, nextPublication] of [
    ["publish", "published"],
    ["unpublish", "draft"],
    ["archive", "archived"]
  ] as const)
    registerContractRoute(app, {
      method: "POST",
      url: `${base}/:id/${action}`,
      schemas: { params, response: record },
      handler: async ({ params, request }) =>
        required(
          await service.setPublication(params.id, nextPublication, resolveActorEmail(request))
        )
    });
  registerContractRoute(app, {
    method: "DELETE",
    url: `${base}/:id`,
    schemas: { params, response: record },
    handler: async ({ params, request }) => service.remove(params.id, resolveActorEmail(request))
  });
}

export async function registerProductCollectionPublicRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: publicBase,
    schemas: { response: z.array(publicSummary) },
    handler: async () =>
      (await service.publicList()).map((collection) => ({
        slug: collection.slug,
        title: collection.title,
        description: collection.description,
        heroImageUrl: collection.heroImageUrl,
        sortOrder: collection.sortOrder,
        itemCount: collection.itemCount
      }))
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${publicBase}/:slug`,
    schemas: { params: z.object({ slug: z.string().min(1).max(191) }), response: publicRecord },
    handler: async ({ params }) => required(await service.publicFind(params.slug))
  });
}

function required<T>(value: T | null) {
  if (!value) throw AppError.notFound("Collection was not found.");
  return value;
}
