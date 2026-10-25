import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import { z } from "zod";
import type { MarketingDependencies } from "../../context.js";
import { EmailCampaignService } from "./email-campaign.service.js";

export const emailSenderInputSchema = z.strictObject({
  brandUuid: z.string().trim().min(1).max(8),
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(191),
  domain: z.string().trim().min(3).max(191)
});

export const emailSenderRecordSchema = z.strictObject({
  uuid: z.string(),
  companyId: z.number(),
  brandUuid: z.string(),
  name: z.string(),
  email: z.string(),
  domain: z.string(),
  spfStatus: z.enum(["verified", "unverified", "failed"]),
  dkimStatus: z.enum(["verified", "unverified", "failed"]),
  dmarcStatus: z.enum(["verified", "unverified", "failed"]),
  isVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const emailCampaignInputSchema = z.strictObject({
  brandUuid: z.string().trim().min(1).max(8),
  campaignUuid: z.string().trim().max(8).optional().nullable(),
  senderUuid: z.string().trim().min(1).max(8),
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(255),
  preheader: z.string().trim().max(255).optional().default(""),
  bodyHtml: z.string().trim().min(1).max(65535),
  bodyText: z.string().trim().min(1).max(65535),
  scheduledAt: z.string().optional().nullable(),
  expectedRevision: z.number().int().positive().optional()
});

export const emailCampaignRecordSchema = z.strictObject({
  uuid: z.string(),
  companyId: z.number(),
  brandUuid: z.string(),
  campaignUuid: z.string().nullable(),
  senderUuid: z.string(),
  fromName: z.string(),
  fromEmail: z.string(),
  replyTo: z.string(),
  name: z.string(),
  subject: z.string(),
  preheader: z.string(),
  bodyHtml: z.string(),
  bodyText: z.string(),
  status: z.enum([
    "draft",
    "pending_approval",
    "approved",
    "rejected",
    "scheduled",
    "sending",
    "completed",
    "paused",
    "cancelled"
  ]),
  rejectionReason: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  sentCount: z.number(),
  suppressedCount: z.number(),
  bouncedCount: z.number(),
  complainedCount: z.number(),
  unsubscribedCount: z.number(),
  totalRecipients: z.number(),
  revision: z.number(),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const emailCampaignRecipientSchema = z.strictObject({
  uuid: z.string(),
  companyId: z.number(),
  emailCampaignUuid: z.string(),
  recipientEmail: z.string(),
  leadUuid: z.string().nullable(),
  status: z.enum([
    "enqueued",
    "sending",
    "sent",
    "suppressed",
    "failed",
    "bounced",
    "complained",
    "unsubscribed",
    "cancelled"
  ]),
  suppressionReason: z.string().nullable(),
  unsubscribeToken: z.string(),
  sentAt: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const emailActivitySchema = z.strictObject({
  action: z.string(),
  actor: z.string(),
  occurredAt: z.string()
});

const listQuerySchema = z.strictObject({
  search: z.string().default(""),
  status: z.string().default("all"),
  brand: z.string().optional(),
  subject: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export function registerEmailCampaignRoutes(
  app: FastifyInstance,
  dependencies: MarketingDependencies
) {
  const service = async (request: FastifyRequest) => {
    return new EmailCampaignService(await dependencies.context(request));
  };

  /* Senders */

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/email-senders",
    schemas: {
      querystring: z.strictObject({ brandUuid: z.string().optional() }),
      response: z.array(emailSenderRecordSchema)
    },
    handler: async ({ request, query }) => {
      return (await service(request)).listSenders(query.brandUuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-senders",
    schemas: {
      body: emailSenderInputSchema,
      response: emailSenderRecordSchema
    },
    handler: async ({ request, body }) => {
      return (await service(request)).registerSender(body);
    }
  });

  /* Campaigns */

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/email-campaigns",
    schemas: {
      querystring: listQuerySchema,
      response: z.array(emailCampaignRecordSchema)
    },
    handler: async ({ request, query }) => {
      const filters: { brand?: string; subject?: string } = {};
      if (query.brand) filters.brand = query.brand;
      if (query.subject) filters.subject = query.subject;
      return (await service(request)).list(query.search, query.limit, query.offset, query.status, filters);
    }
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/email-campaigns/count",
    schemas: {
      querystring: listQuerySchema,
      response: z.strictObject({ count: z.number() })
    },
    handler: async ({ request, query }) => {
      const filters: { brand?: string; subject?: string } = {};
      if (query.brand) filters.brand = query.brand;
      if (query.subject) filters.subject = query.subject;
      const count = await (await service(request)).count(query.search, query.status, filters);
      return { count };
    }
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/email-campaigns/:uuid",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params }) => {
      return (await service(request)).get(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns",
    schemas: {
      body: emailCampaignInputSchema,
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, body }) => {
      return (await service(request)).save(body);
    }
  });

  registerContractRoute(app, {
    method: "PUT",
    url: "/marketing/email-campaigns/:uuid",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: emailCampaignInputSchema,
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params, body }) => {
      return (await service(request)).save(body, params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/email-campaigns/:uuid/activity",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: z.array(emailActivitySchema)
    },
    handler: async ({ request, params }) => {
      return (await service(request)).activity(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/email-campaigns/:uuid/recipients",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      querystring: z.strictObject({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.string().default("all")
      }),
      response: z.array(emailCampaignRecipientSchema)
    },
    handler: async ({ request, params, query }) => {
      return (await service(request)).listRecipients(params.uuid, query.limit, query.offset, query.status);
    }
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/email-campaigns/:uuid/recipients/count",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      querystring: z.strictObject({ status: z.string().default("all") }),
      response: z.strictObject({ count: z.number() })
    },
    handler: async ({ request, params, query }) => {
      const count = await (await service(request)).countRecipients(params.uuid, query.status);
      return { count };
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/submit-approval",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params }) => {
      return (await service(request)).submitForApproval(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/approve",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params }) => {
      return (await service(request)).approve(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/reject",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ reason: z.string().trim().min(1).max(500) }),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params, body }) => {
      return (await service(request)).reject(params.uuid, body.reason);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/schedule",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ scheduledAt: z.string() }),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params, body }) => {
      return (await service(request)).schedule(params.uuid, body.scheduledAt);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/cancel",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ reason: z.string().optional() }).optional(),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params, body }) => {
      return (await service(request)).cancel(params.uuid, body?.reason);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/pause",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params }) => {
      return (await service(request)).pause(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/resume",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: emailCampaignRecordSchema
    },
    handler: async ({ request, params }) => {
      return (await service(request)).resume(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/preview",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ sampleValues: z.record(z.string(), z.string()).optional() }).optional(),
      response: z.strictObject({
        subject: z.string(),
        preheader: z.string(),
        html: z.string(),
        text: z.string(),
        variablesUsed: z.array(z.string()),
        unresolvedVariables: z.array(z.string())
      })
    },
    handler: async ({ request, params, body }) => {
      const s = await service(request);
      const campaign = await s.get(params.uuid);
      return s.preview(campaign, body?.sampleValues);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/test-send",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ recipient: z.string().trim().email() }),
      response: z.strictObject({
        delivered: z.boolean(),
        recipient: z.string(),
        subject: z.string()
      })
    },
    handler: async ({ request, params, body }) => {
      return (await service(request)).testSend(params.uuid, body.recipient);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/snapshot-audience",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ leadStatus: z.string().optional() }).optional(),
      response: z.strictObject({
        enqueued: z.number(),
        suppressed: z.number(),
        total: z.number()
      })
    },
    handler: async ({ request, params, body }) => {
      return (await service(request)).snapshotAudience(params.uuid, body);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/email-campaigns/:uuid/dispatch",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ batchSize: z.number().int().min(1).max(500).default(50) }).optional(),
      response: z.strictObject({
        processed: z.number(),
        sent: z.number(),
        suppressed: z.number(),
        cancelled: z.number(),
        failed: z.number(),
        remaining: z.number()
      })
    },
    handler: async ({ request, params, body }) => {
      return (await service(request)).dispatchBatch(params.uuid, body?.batchSize ?? 50);
    }
  });

  /* Public Unsubscribe & Webhooks */

  app.get("/public/marketing/unsubscribe", async (request, reply) => {
    const token = (request.query as { token?: string })?.token;
    if (!token) {
      return reply.type("text/html").send("<h3>Invalid request. Unsubscribe token is required.</h3>");
    }
    try {
      const s = await service(request);
      const res = await s.unsubscribeByToken(token);
      return reply.type("text/html").send(
        `<html><body><h2>Unsubscribe Confirmed</h2><p>${res.email} has been unsubscribed from promotional marketing communications.</p></body></html>`
      );
    } catch {
      return reply.type("text/html").send("<h3>Invalid or expired unsubscribe token.</h3>");
    }
  });

  app.post("/public/marketing/unsubscribe", async (request, reply) => {
    const token = (request.query as { token?: string })?.token || (request.body as { token?: string })?.token;
    if (!token) {
      return reply.status(400).send({ success: false, error: "Token is required" });
    }
    const s = await service(request);
    const result = await s.unsubscribeByToken(token);
    return reply.header("List-Unsubscribe-Post", "List-Unsubscribe=One-Click").send(result);
  });

  app.post("/public/marketing/email/events", async (request, reply) => {
    const body = request.body as {
      eventType: "bounce" | "complaint";
      tokenOrEmail: string;
      bounceType?: "hard_bounce" | "soft_bounce";
    };
    if (!body?.eventType || !body?.tokenOrEmail) {
      return reply.status(400).send({ success: false, error: "Missing eventType or tokenOrEmail" });
    }
    const s = await service(request);
    if (body.eventType === "bounce") {
      await s.recordBounce(body.tokenOrEmail, body.bounceType ?? "hard_bounce");
    } else if (body.eventType === "complaint") {
      await s.recordComplaint(body.tokenOrEmail);
    }
    return reply.send({ success: true, processed: body.eventType });
  });
}
