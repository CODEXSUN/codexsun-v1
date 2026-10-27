import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "../../../../../../packages/framework/src/http/route-contract.js";
import {
  chatRecord,
  promptDetail,
  promptPayload,
  promptRecord,
  runRecord,
  runSummary
} from "./prompt-manager.types.js";
import type { PromptManagerService } from "./prompt-manager.service.js";

const base = "/api/codeit/prompt-manager";
const params = z.object({ id: z.string().uuid() }).strict();
export function registerPromptManagerRoutes(app: FastifyInstance, service: PromptManagerService) {
  registerContractRoute(app, {
    method: "GET",
    url: base,
    schemas: { response: z.array(promptRecord) },
    handler: () => service.list()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/chats`,
    schemas: { response: z.array(chatRecord) },
    handler: () => service.chats()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/runs`,
    schemas: { response: z.array(runSummary) },
    handler: () => service.recentRuns()
  });
  registerContractRoute(app, {
    method: "POST",
    url: base,
    schemas: { body: promptPayload, response: promptRecord },
    handler: ({ body }) => service.save(body)
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${base}/:id`,
    schemas: { params, response: promptDetail },
    handler: ({ params }) => service.detail(params.id)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${base}/:id`,
    schemas: { params, body: promptPayload, response: promptRecord },
    handler: ({ params, body }) => service.save(body, params.id)
  });
  registerContractRoute(app, {
    method: "DELETE",
    url: `${base}/:id`,
    schemas: { params, response: z.object({ deleted: z.boolean() }) },
    handler: ({ params }) => service.remove(params.id)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${base}/:id/runs`,
    schemas: {
      params,
      body: z
        .object({ threadId: z.string().min(1).max(160), expectedUpdatedAt: z.string().datetime() })
        .strict(),
      response: runRecord
    },
    handler: ({ params, body }) => service.send(params.id, body.threadId, body.expectedUpdatedAt)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${base}/runs/:id/approval`,
    schemas: {
      params,
      body: z.object({ approvalId: z.string(), decision: z.enum(["accept", "decline"]) }).strict(),
      response: runRecord
    },
    handler: ({ params, body }) => service.decide(params.id, body.approvalId, body.decision)
  });
}
