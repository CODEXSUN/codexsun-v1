import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import type { CommonTableImportHost } from "../import-review/index.js";
import { TransferService } from "./transfer-session.service.js";
const name = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_ -]*$/u)
  .max(191);
const params = z.object({ id: z.string().uuid() }).strict();
const revision = z.object({ revision: z.number().int().nonnegative() }).strict();
const field = z
  .object({
    target: name,
    source: name.nullable(),
    mode: z.enum(["source", "default", "value", "uuid", "now"]),
    value: z.union([z.string().max(10000), z.number(), z.null()])
  })
  .strict();
const record = z.record(z.string(), z.unknown());
const row = z
  .object({
    sourceId: z.number().int(),
    branding: z
      .object({
        copied: z.number().int(),
        existing: z.number().int(),
        warnings: z.array(z.string())
      })
      .strict()
      .optional(),
    reuse: z
      .object({ targetId: z.number().int(), before: record, sourceCount: z.number().int() })
      .strict()
      .optional(),
    source: record,
    data: record,
    target: record.nullable(),
    status: z.enum(["ready", "existing", "warning", "imported"]),
    message: z.string()
  })
  .strict();
export const transferSessionSchema = z
  .object({
    id: z.string().uuid(),
    context: z
      .object({
        group: z.enum(["common", "masters", "billing"]),
        targetTables: z.array(z.string()),
        businessRunId: z.string().uuid().optional()
      })
      .strict()
      .optional(),
    selectedRows: z.number().int().nonnegative().optional(),
    warningRows: z.number().int().nonnegative().optional(),
    revision: z.number().int(),
    stage: z.number().int(),
    status: z.enum(["draft", "prepared", "queued", "completed", "failed"]),
    sourceId: z.number().int(),
    targetTenantId: z.number().int(),
    sourceDatabase: z.string(),
    targetDatabase: z.string(),
    sourceTable: z.string(),
    targetTable: z.string(),
    fields: z.array(field),
    schemaHash: z.string(),
    rows: z.array(row),
    actor: z.string(),
    updatedAt: z.string(),
    message: z.string()
  })
  .strict();
const column = z
  .object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    generated: z.boolean(),
    primary: z.boolean(),
    parent: z.string().nullable()
  })
  .strict();
export function registerTransferRoutes(app: FastifyInstance, host: CommonTableImportHost) {
  const service = new TransferService(host);
  registerContractRoute(app, {
    method: "GET",
    url: "/transfers",
    schemas: { response: z.array(transferSessionSchema) },
    handler: () => service.list()
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/transfers",
    schemas: {
      body: z
        .object({
          sourceId: z.number().int().positive(),
          targetTenantId: z.number().int().positive()
        })
        .strict(),
      response: transferSessionSchema
    },
    handler: async ({ body, request }) =>
      service.create(body.sourceId, body.targetTenantId, await host.authorize(request))
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/transfers/:id",
    schemas: { params, response: transferSessionSchema },
    handler: ({ params }) => service.get(params.id)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/transfers/:id/inspect",
    schemas: {
      params,
      response: z
        .object({
          tables: z.object({ source: z.array(z.string()), target: z.array(z.string()) }).strict(),
          schema: z
            .object({ source: z.array(column), target: z.array(column), hash: z.string() })
            .strict()
            .nullable()
        })
        .strict()
    },
    handler: ({ params }) => service.inspect(params.id)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/transfers/:id/tables",
    schemas: {
      params,
      body: revision.extend({ sourceTable: name, targetTable: name }).strict(),
      response: transferSessionSchema
    },
    handler: async ({ params, body, request }) =>
      service.mapTables(
        params.id,
        body.revision,
        body.sourceTable,
        body.targetTable,
        await host.authorize(request)
      )
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/transfers/:id/fields",
    schemas: {
      params,
      body: revision.extend({ fields: z.array(field).min(1).max(200) }).strict(),
      response: transferSessionSchema
    },
    handler: async ({ params, body, request }) =>
      service.mapFields(params.id, body.revision, body.fields, await host.authorize(request))
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/transfers/:id/preview",
    schemas: {
      params,
      querystring: z
        .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
        .strict(),
      response: z.object({ rows: z.array(record), total: z.number().int() }).strict()
    },
    handler: ({ params, query }) => service.preview(params.id, query.page)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/transfers/:id/parents",
    schemas: {
      params,
      querystring: z.object({ field: name }).strict(),
      response: z.array(z.object({ id: z.number().int(), label: z.string() }).strict())
    },
    handler: ({ params, query }) => service.parents(params.id, query.field)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/transfers/:id/prepare",
    schemas: {
      params,
      body: revision
        .extend({ ids: z.array(z.number().int().positive()).min(1).max(1000) })
        .strict(),
      response: transferSessionSchema
    },
    handler: async ({ params, body, request }) =>
      service.prepare(params.id, body.revision, body.ids, await host.authorize(request))
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/transfers/:id/commit",
    schemas: {
      params,
      body: revision.extend({ confirmed: z.literal(true) }).strict(),
      response: transferSessionSchema
    },
    handler: async ({ params, body, request }) =>
      service.commit(params.id, body.revision, await host.authorize(request), request.id)
  });
}
