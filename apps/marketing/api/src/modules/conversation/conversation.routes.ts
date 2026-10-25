import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import type { MarketingDependencies } from "../../context.js";
import { ConsentRepository } from "../consent/consent.repository.js";
import { ConversationRepository } from "./conversation.repository.js";
import { ConversationService } from "./conversation.service.js";

export const threadInputSchema = z.strictObject({
  brandUuid: z.string().trim().min(1).max(8),
  channel: z.enum(["whatsapp", "sms", "chat"]).optional(),
  contactIdentifier: z.string().trim().min(1).max(64),
  contactName: z.string().trim().max(191).optional(),
  leadUuid: z.string().trim().min(1).max(8).optional(),
  assignedTo: z.string().trim().max(191).optional()
});

export const threadRecordSchema = z.strictObject({
  uuid: z.string(),
  revision: z.number(),
  companyId: z.number(),
  brandUuid: z.string(),
  channel: z.enum(["whatsapp", "sms", "chat"]),
  contactIdentifier: z.string(),
  contactName: z.string(),
  leadUuid: z.string().nullable(),
  status: z.enum(["open", "resolved", "closed"]),
  assignedTo: z.string().nullable(),
  isHumanTakeover: z.boolean(),
  stopConditionMet: z.boolean(),
  lastInboundAt: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const messageRecordSchema = z.strictObject({
  uuid: z.string(),
  companyId: z.number(),
  threadUuid: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  sender: z.string(),
  content: z.string(),
  templateName: z.string().nullable(),
  status: z.enum(["pending", "sent", "delivered", "read", "failed"]),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const nurtureRuleInputSchema = z.strictObject({
  brandUuid: z.string().trim().min(1).max(8),
  name: z.string().trim().min(1).max(191),
  triggerEvent: z.enum(["lead_created", "inbound_message", "manual"]),
  maxSteps: z.number().int().positive().optional(),
  intervalHours: z.number().int().positive().optional(),
  templateName: z.string().trim().min(1).max(64)
});

export const nurtureRuleRecordSchema = z.strictObject({
  uuid: z.string(),
  companyId: z.number(),
  brandUuid: z.string(),
  name: z.string(),
  triggerEvent: z.enum(["lead_created", "inbound_message", "manual"]),
  maxSteps: z.number(),
  intervalHours: z.number(),
  templateName: z.string(),
  status: z.enum(["active", "paused"]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const nurtureEnrollmentRecordSchema = z.strictObject({
  uuid: z.string(),
  companyId: z.number(),
  ruleUuid: z.string(),
  threadUuid: z.string(),
  leadUuid: z.string().nullable(),
  stepNumber: z.number(),
  status: z.enum(["active", "completed", "stopped"]),
  stopReason: z.string().nullable(),
  stoppedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function registerConversationRoutes(
  app: FastifyInstance,
  dependencies: MarketingDependencies
) {
  const getService = async (req: FastifyRequest): Promise<ConversationService> => {
    const context = await dependencies.context(req);
    return new ConversationService(
      new ConversationRepository(context),
      new ConsentRepository(context),
      context
    );
  };

  /* 1. Threads List */
  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversations",
    schemas: {
      querystring: z.strictObject({
        limit: z.coerce.number().int().positive().optional(),
        offset: z.coerce.number().int().nonnegative().optional(),
        search: z.string().optional(),
        status: z.string().optional(),
        channel: z.string().optional(),
        brandUuid: z.string().optional()
      }),
      response: z.array(threadRecordSchema)
    },
    handler: async ({ request, query }) => {
      const service = await getService(request);
      return service.listThreads(query?.limit ?? 20, query?.offset ?? 0, {
        ...(query?.search ? { search: query.search } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.channel ? { channel: query.channel } : {}),
        ...(query?.brandUuid ? { brandUuid: query.brandUuid } : {})
      });
    }
  });

  /* 2. Threads Count */
  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversations/count",
    schemas: {
      querystring: z.strictObject({
        search: z.string().optional(),
        status: z.string().optional(),
        channel: z.string().optional(),
        brandUuid: z.string().optional()
      }),
      response: z.strictObject({ total: z.number() })
    },
    handler: async ({ request, query }) => {
      const service = await getService(request);
      return {
        total: await service.countThreads({
          ...(query?.search ? { search: query.search } : {}),
          ...(query?.status ? { status: query.status } : {}),
          ...(query?.channel ? { channel: query.channel } : {}),
          ...(query?.brandUuid ? { brandUuid: query.brandUuid } : {})
        })
      };
    }
  });

  /* 3. Get Thread with Messages */
  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversations/:uuid",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: threadRecordSchema.extend({
        messages: z.array(messageRecordSchema),
        inServiceWindow: z.boolean()
      })
    },
    handler: async ({ request, params }) => {
      const service = await getService(request);
      const thread = await service.getThread(params.uuid);
      const messages = await service.listMessages(params.uuid);
      const inServiceWindow = service.isWithinServiceWindow(thread.lastInboundAt);
      return {
        ...thread,
        messages,
        inServiceWindow
      };
    }
  });

  /* 4. Create Thread */
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations",
    schemas: {
      body: threadInputSchema,
      response: z.strictObject({ uuid: z.string() })
    },
    handler: async ({ request, body }) => {
      const service = await getService(request);
      const uuid = await service.createThread(body);
      return { uuid };
    }
  });

  /* 5. Send Message (with 24h window validation) */
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations/:uuid/messages",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({
        content: z.string().min(1),
        templateName: z.string().optional()
      }),
      response: messageRecordSchema
    },
    handler: async ({ request, params, body }) => {
      const service = await getService(request);
      return service.sendMessage(params.uuid, body);
    }
  });

  /* 6. Toggle Human Takeover */
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations/:uuid/takeover",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ enabled: z.boolean() }),
      response: z.strictObject({ success: z.boolean() })
    },
    handler: async ({ request, params, body }) => {
      const service = await getService(request);
      await service.setHumanTakeover(params.uuid, body.enabled);
      return { success: true };
    }
  });

  /* 7. Update Thread Status */
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations/:uuid/status",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({ status: z.enum(["open", "resolved", "closed"]) }),
      response: z.strictObject({ success: z.boolean() })
    },
    handler: async ({ request, params, body }) => {
      const service = await getService(request);
      await service.updateStatus(params.uuid, body.status);
      return { success: true };
    }
  });

  /* 8. Thread Activity */
  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversations/:uuid/activity",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: z.array(
        z.strictObject({
          action: z.string(),
          actor: z.string(),
          occurredAt: z.string()
        })
      )
    },
    handler: async ({ request, params }) => {
      const service = await getService(request);
      return service.activity(params.uuid);
    }
  });

  /* 9. Nurture Rules */
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations/nurture/rules",
    schemas: {
      body: nurtureRuleInputSchema,
      response: z.strictObject({ uuid: z.string() })
    },
    handler: async ({ request, body }) => {
      const service = await getService(request);
      const uuid = await service.createNurtureRule(body);
      return { uuid };
    }
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversations/nurture/rules",
    schemas: {
      querystring: z.strictObject({ brandUuid: z.string().optional() }),
      response: z.array(nurtureRuleRecordSchema)
    },
    handler: async ({ request, query }) => {
      const service = await getService(request);
      return service.listNurtureRules(query?.brandUuid);
    }
  });

  /* 10. Nurture Enroll, Dispatch & Stop */
  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations/:uuid/nurture/enroll",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({
        ruleUuid: z.string().min(1),
        leadUuid: z.string().optional()
      }),
      response: z.strictObject({ uuid: z.string() })
    },
    handler: async ({ request, params, body }) => {
      const service = await getService(request);
      const uuid = await service.enrollContact(body.ruleUuid, params.uuid, body.leadUuid ?? null);
      return { uuid };
    }
  });

  registerContractRoute(app, {
    method: "GET",
    url: "/marketing/conversations/:uuid/nurture",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: nurtureEnrollmentRecordSchema.nullable()
    },
    handler: async ({ request, params }) => {
      const service = await getService(request);
      return service.getActiveEnrollment(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations/:uuid/nurture/dispatch",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      response: z.strictObject({
        dispatched: z.boolean(),
        reason: z.string().optional()
      })
    },
    handler: async ({ request, params }) => {
      const service = await getService(request);
      return service.dispatchNurtureStep(params.uuid);
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/marketing/conversations/:uuid/nurture/stop",
    schemas: {
      params: z.strictObject({ uuid: z.string() }),
      body: z.strictObject({
        reason: z.enum(["reply", "opt_out", "conversion", "human_takeover", "channel_restriction"])
      }),
      response: z.strictObject({ stopped: z.number() })
    },
    handler: async ({ request, params, body }) => {
      const service = await getService(request);
      const stopped = await service.evaluateStopConditions(params.uuid, body.reason);
      return { stopped };
    }
  });

  /* 11. Public WhatsApp Webhook */
  app.get("/public/marketing/webhooks/whatsapp", async (request, reply) => {
    const query = request.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };

    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"]) {
      return reply.code(200).send(query["hub.challenge"] ?? "");
    }
    return reply.code(403).send("Forbidden");
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/public/marketing/webhooks/whatsapp",
    schemas: {
      body: z.strictObject({
        brandUuid: z.string().min(1),
        messages: z
          .array(
            z.strictObject({
              from: z.string(),
              id: z.string(),
              timestamp: z.string(),
              type: z.string(),
              text: z.strictObject({ body: z.string() }).optional()
            })
          )
          .optional()
      }),
      response: z.strictObject({
        processed: z.number(),
        stoppedRules: z.number()
      })
    },
    handler: async ({ request, body }) => {
      const service = await getService(request);
      return service.processInboundWhatsAppWebhook(body);
    }
  });
}
