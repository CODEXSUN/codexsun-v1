import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import type { CommonTableImportHost } from "../import-review/index.js";
import { connectionPair } from "../transfer-session/index.js";
import { BusinessImportService } from "./business-import.service.js";
import { BusinessImportRepository } from "./business-import.repository.js";
import { BusinessImportQueries } from "./business-import.queries.js";
const params = z.object({ id: z.string().uuid() }).strict();
const page = z.coerce.number().int().min(1).max(100000).default(1);
const record = z.record(z.string(), z.unknown());
export const businessRowSchema = z
  .object({
    sourceId: z.number(),
    source: record,
    data: record,
    target: record.nullable(),
    status: z.enum(["ready", "imported", "existing", "warning"]),
    message: z.string(),
    reuse: z
      .object({ targetId: z.number().int(), before: record, sourceCount: z.number().int() })
      .strict()
      .optional()
  })
  .strict();
const table = z
  .object({
    table: z.string(),
    sourceTable: z.string(),
    group: z.enum(["common", "masters", "billing"]),
    status: z.enum(["pending", "running", "success", "warning", "skipped"]),
    sourceRows: z.number(),
    targetRows: z.number(),
    imported: z.number(),
    updated: z.number().int().nonnegative().optional(),
    existing: z.number(),
    warnings: z.number(),
    sessions: z.array(z.string()),
    blocked: z.boolean(),
    message: z.string(),
    verified: z.boolean(),
    sourceChanged: z.boolean(),
    verificationIssues: z.array(z.object({ sourceId: z.number(), message: z.string() }).strict()),
    references: z.array(
      z
        .object({ sourceField: z.string(), targetField: z.string(), parentTable: z.string() })
        .strict()
    )
  })
  .strict();
export const businessSummarySchema = z
  .object({
    id: z.string().uuid(),
    sourceId: z.number(),
    targetTenantId: z.number(),
    sourceDatabase: z.string(),
    targetDatabase: z.string(),
    actor: z.string(),
    status: z.enum(["queued", "running", "success", "warning", "failed"]),
    phase: z.enum(["common", "masters", "billing", "invoices", "users", "complete"]),
    at: z.string(),
    updatedAt: z.string(),
    message: z.string(),
    users: z
      .object({
        imported: z.number().int(),
        existing: z.number().int(),
        warnings: z.number().int(),
        rows: z.array(
          z
            .object({
              sourceId: z.number().int(),
              targetId: z.number().int().nullable(),
              email: z.string(),
              status: z.enum(["imported", "existing", "warning"]),
              message: z.string()
            })
            .strict()
        )
      })
      .strict()
      .optional(),
    issues: z.array(z.string()),
    tables: z.array(table),
    invoiceCount: z.number(),
    invoiceMatched: z.number(),
    invoiceWarnings: z.number(),
    relationships: z.number(),
    orphans: z.number()
  })
  .strict();
const invoice = z
  .object({
    table: z.string(),
    sourceId: z.number(),
    targetId: z.number().nullable(),
    identity: z.string(),
    status: z.enum(["success", "warning"]),
    deleted: z.boolean(),
    message: z.string(),
    children: z.array(
      z
        .object({
          table: z.string(),
          sourceIds: z.array(z.number()),
          sourceRows: z.number(),
          targetRows: z.number(),
          matched: z.number(),
          differences: z.number(),
          extra: z.number(),
          message: z.string()
        })
        .strict()
    )
  })
  .strict();
export function registerBusinessImportRoutes(app: FastifyInstance, host: CommonTableImportHost) {
  const service = new BusinessImportService(host),
    queries = new BusinessImportQueries(host),
    repository = new BusinessImportRepository(host.database);
  registerContractRoute(app, {
    method: "POST",
    url: "/business-imports",
    schemas: {
      body: connectionPair.extend({ confirmed: z.literal(true) }).strict(),
      response: businessSummarySchema
    },
    handler: async ({ body, request }) =>
      service.start(body.sourceId, body.targetTenantId, await host.authorize(request), request.id)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/business-imports/latest",
    schemas: { querystring: connectionPair, response: businessSummarySchema.nullable() },
    handler: ({ query }) => service.latest(query.sourceId, query.targetTenantId)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/business-imports/:id",
    schemas: { params, response: businessSummarySchema },
    handler: ({ params }) => service.get(params.id)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/business-imports/:id/rows",
    schemas: {
      params,
      querystring: z
        .object({
          table: z.string().min(1).max(191),
          page,
          status: z.enum(["all", "imported", "existing", "warning", "ready"]).default("all"),
          invoiceTable: z.string().min(1).max(191).optional(),
          invoiceSourceId: z.coerce.number().int().positive().optional()
        })
        .strict()
        .refine((q) => Boolean(q.invoiceTable) === Boolean(q.invoiceSourceId), {
          message: "Provide both invoice table and source row ID."
        }),
      response: z
        .object({
          total: z.number(),
          references: z.array(
            z
              .object({ sourceField: z.string(), targetField: z.string(), parentTable: z.string() })
              .strict()
          ),
          rows: z.array(businessRowSchema)
        })
        .strict()
    },
    handler: ({ params, query }) =>
      queries.rows(
        params.id,
        query.table,
        query.page,
        query.status,
        query.invoiceTable && query.invoiceSourceId
          ? { table: query.invoiceTable, sourceId: query.invoiceSourceId }
          : undefined
      )
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/business-imports/:id/warnings",
    schemas: {
      params,
      querystring: z.object({ page }).strict(),
      response: z
        .object({
          total: z.number(),
          rows: z.array(
            z
              .object({
                group: z.string(),
                table: z.string(),
                sourceId: z.number().nullable(),
                message: z.string()
              })
              .strict()
          )
        })
        .strict()
    },
    handler: ({ params, query }) => queries.warnings(params.id, query.page)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/business-imports/:id/invoices",
    schemas: {
      params,
      querystring: z
        .object({ page, warningsOnly: z.enum(["true", "false"]).default("false") })
        .strict(),
      response: z.object({ total: z.number(), rows: z.array(invoice) }).strict()
    },
    handler: async ({ params, query }) => {
      await service.get(params.id);
      return repository.invoices(params.id, query.page, query.warningsOnly === "true");
    }
  });
}
