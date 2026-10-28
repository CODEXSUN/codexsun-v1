import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies } from "../../context.js";
import { SubmissionService } from "./submission.service.js";
import { SubmissionImportSession } from "./submission.import-session.js";
import type { SubmissionDependencies } from "./submission.types.js";
import {
  handleMetaLeadWebhook,
  handleGoogleAdsLeadWebhook,
  verifyMetaSubscription
} from "./submission.social-webhook.js";

export const submissionInputSchema = z.strictObject({
  captureUuid: z.string().regex(/^[a-f0-9]{8}$/),
  sourceKey: z.string().trim().min(8).max(191),
  name: z.string().trim().min(1).max(160),
  email: z.union([z.literal(""), z.string().email().max(254)]),
  phone: z.string().trim().max(40),
  message: z.string().max(10000),
  privacyConsent: z.literal(true),
  sourceReference: z.string().max(191).default(""),
  sourceConsentAt: z.union([z.literal(""), z.string().datetime()]).default(""),
  sourceNoticeVersion: z.string().max(80).default("unknown")
});

export const submissionRecordSchema = submissionInputSchema.extend({
  uuid: z.string(),
  companyId: z.number(),
  brandUuid: z.string(),
  campaignUuid: z.string(),
  campaignLabel: z.string(),
  noticeVersion: z.string(),
  consentNotice: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  status: z.enum(["pending", "delivered"]),
  leadUuid: z.string().nullable()
});

const submissionFiltersSchema = z.object({
  search: z.string().max(160).default(""),
  status: z.enum(["all", "pending", "delivered"]).default("all"),
  fromDate: z.union([z.literal(""), z.iso.date()]).default(""),
  toDate: z.union([z.literal(""), z.iso.date()]).default(""),
  name: z.string().max(160).default(""),
  campaignLabel: z.string().max(160).default(""),
  email: z.string().max(254).default(""),
  phone: z.string().max(40).default(""),
  columnStatus: z.string().max(24).default(""),
  leadUuid: z.string().max(8).default("")
});

export function registerSubmissionRoutes(
  app: FastifyInstance,
  context: MarketingDependencies["context"],
  deps: SubmissionDependencies
) {
  const importSummary = z.object({
    uuid: z.string(),
    filename: z.string(),
    total: z.number(),
    completed: z.number()
  });
  const importParams = z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) });
  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/submission-imports",
    schemas: { response: z.array(importSummary) },
    handler: async ({ request }) => new SubmissionImportSession(await context(request), deps).list()
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/submission-imports",
    schemas: {
      body: z.strictObject({
        filename: z.string().trim().min(1).max(191),
        mapping: z.record(z.string().max(80), z.string().max(191)),
        rows: z.array(submissionInputSchema).min(1).max(100)
      }),
      response: importSummary
    },
    handler: async ({ request, body }) =>
      new SubmissionImportSession(await context(request), deps).create(
        body.filename,
        body.mapping,
        body.rows
      )
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/submission-imports/:uuid/advance",
    schemas: { params: importParams, body: z.strictObject({}), response: importSummary },
    handler: async ({ request, params }) =>
      new SubmissionImportSession(await context(request), deps).advance(params.uuid)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/submission-imports/:uuid/cancel",
    schemas: { params: importParams, body: z.strictObject({}), response: z.object({ cancelled: z.boolean() }) },
    handler: async ({ request, params }) =>
      new SubmissionImportSession(await context(request), deps).cancel(params.uuid)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/submissions/count",
    schemas: {
      querystring: submissionFiltersSchema,
      response: z.object({ total: z.number() })
    },
    handler: async ({ request, query }) => ({
      total: await new SubmissionService(await context(request), deps).count(query)
    })
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/submissions/:uuid",
    schemas: {
      params: z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: submissionRecordSchema
    },
    handler: async ({ request, params }) =>
      new SubmissionService(await context(request), deps).get(params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/submissions",
    schemas: { body: submissionInputSchema, response: submissionRecordSchema },
    handler: async ({ request, body }) =>
      new SubmissionService(await context(request), deps).accept(body)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/submissions",
    schemas: {
      querystring: submissionFiltersSchema.extend({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0)
      }),
      response: z.array(submissionRecordSchema)
    },
    handler: async ({ request, query }) =>
      new SubmissionService(await context(request), deps).list(query.limit, query.offset, query)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/submissions/:uuid/retry",
    schemas: {
      params: z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: submissionRecordSchema
    },
    handler: async ({ request, params }) =>
      new SubmissionService(await context(request), deps).retry(params.uuid)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/submissions/:uuid/handoff",
    schemas: {
      params: z.object({ uuid: z.string().regex(/^[a-f0-9]{8}$/) }),
      response: z.object({
        uuid: z.string(),
        leadUuid: z.string().nullable(),
        status: z.string()
      })
    },
    handler: async ({ request, params }) =>
      new SubmissionService(await context(request), deps).handoff(params.uuid)
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/webhooks/meta-leads",
    schemas: {
      querystring: z
        .object({
          "hub.mode": z.string().optional(),
          "hub.verify_token": z.string().optional(),
          "hub.challenge": z.string().optional()
        })
        .passthrough(),
      response: z.object({
        challenge: z.string(),
        status: z.string()
      })
    },
    handler: async ({ query }) => verifyMetaSubscription(query as Record<string, unknown>)
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/webhooks/meta-leads",
    schemas: {
      body: z.record(z.string(), z.unknown()),
      response: z.object({
        received: z.boolean(),
        submissionUuid: z.string(),
        leadUuid: z.string().nullable(),
        isTest: z.boolean(),
        status: z.string()
      })
    },
    handler: async ({ request, body }) =>
      handleMetaLeadWebhook(
        await context(request),
        deps,
        body,
        request.headers,
        request.query as Record<string, unknown>
      )
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/webhooks/google-leads",
    schemas: {
      body: z.record(z.string(), z.unknown()),
      response: z.object({
        received: z.boolean(),
        submissionUuid: z.string(),
        leadUuid: z.string().nullable(),
        isTest: z.boolean(),
        status: z.string()
      })
    },
    handler: async ({ request, body }) =>
      handleGoogleAdsLeadWebhook(
        await context(request),
        deps,
        body,
        request.headers,
        request.query as Record<string, unknown>
      )
  });
}
