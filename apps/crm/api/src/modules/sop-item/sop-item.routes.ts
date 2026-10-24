import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import { SopItemRepository } from "./sop-item.repository.js";
import { SopItemService } from "./sop-item.service.js";
import { sopFrequencies, type SopItemRequestContext } from "./sop-item.types.js";

const path = "/crm/sop-items";
const id = z.object({ id: z.coerce.number().int().positive() });
const revisionParams = id.extend({ revisionId: z.coerce.number().int().positive() });
const input = z
  .object({
    sopId: z.number().int().positive(),
    code: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(191),
    department: z.string().trim().max(120).default(""),
    frequency: z.enum(sopFrequencies),
    sortOrder: z.number().int().min(0).max(1000000)
  })
  .strict();
const revisionInput = z
  .object({
    instructions: z.string().trim().min(1).max(20000),
    evidenceGuidance: z.string().trim().max(4000).default("")
  })
  .strict();
const revisionSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string(),
  sopItemId: z.number().int().positive(),
  revision: z.number().int().positive(),
  instructions: z.string(),
  evidenceGuidance: z.string(),
  status: z.enum(["draft", "published", "superseded"]),
  effectiveFrom: z.string().nullable(),
  author: z.string(),
  publishedAt: z.string().nullable(),
  createdAt: z.string()
});
const itemSchema = input.extend({
  id: z.number().int().positive(),
  uuid: z.string(),
  status: z.enum(["active", "inactive"]),
  frappeSyncStatus: z.enum(["pending", "processing", "failed", "synced"]).nullable(),
  currentRevision: revisionSchema.nullable(),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerSopItemRoutes(
  app: FastifyInstance,
  context: (request: FastifyRequest) => Promise<SopItemRequestContext>
) {
  const service = async (request: FastifyRequest) => {
    const scope = await context(request);
    return { scope, service: new SopItemService(new SopItemRepository(scope.database)) };
  };
  registerContractRoute(app, {
    method: "GET",
    url: path,
    schemas: {
      querystring: z.object({ search: z.string().trim().max(191).default("") }),
      response: z.array(itemSchema)
    },
    handler: async ({ query, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.view");
      return useCase.list(query.search);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: path + "/:id",
    schemas: { params: id, response: itemSchema },
    handler: async ({ params, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.view");
      return useCase.get(params.id);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: path,
    schemas: { body: input.extend({ revision: revisionInput }), response: itemSchema },
    handler: async ({ body, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.update");
      const result = await useCase.create(body, body.revision, scope.actorEmail);
      await scope.queueSync?.("sop-item", result.id);
      return result;
    }
  });
  registerContractRoute(app, {
    method: "PUT",
    url: path + "/:id",
    schemas: { params: id, body: input, response: itemSchema },
    handler: async ({ params, body, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.update");
      const result = await useCase.update(params.id, body, scope.actorEmail);
      await scope.queueSync?.("sop-item", params.id);
      return result!;
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: path + "/:id/revisions",
    schemas: { params: id, response: z.array(revisionSchema) },
    handler: async ({ params, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.view");
      await useCase.get(params.id);
      return new SopItemRepository(scope.database).revisions(params.id);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: path + "/:id/revisions",
    schemas: { params: id, body: revisionInput, response: revisionSchema },
    handler: async ({ params, body, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.update");
      return useCase.createRevision(params.id, body, scope.actorEmail);
    }
  });
  registerContractRoute(app, {
    method: "PUT",
    url: path + "/:id/revisions/:revisionId",
    schemas: { params: revisionParams, body: revisionInput, response: revisionSchema },
    handler: async ({ params, body, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.revision.update-draft");
      return useCase.updateRevision(params.id, params.revisionId, body);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: path + "/:id/revisions/:revisionId/publish",
    schemas: { params: revisionParams, response: revisionSchema },
    handler: async ({ params, request }) => {
      const { scope, service: useCase } = await service(request);
      await scope.authorize("crm.sop.publish");
      const result = await useCase.publish(params.id, params.revisionId, scope.actorEmail);
      await scope.queueSync?.("sop-item", params.id);
      return result;
    }
  });
}
