import type { RouteDefinition } from "../project/project.routes.js";
import type { ConversationService } from "./conversation.service.js";
import type { AppendMessageInput, CreateConversationInput } from "./conversation.types.js";

export function createConversationRoutes(
  conversationService: ConversationService
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/codeit/conversations",
      handler: (_req, _res, ctx) => {
        const projectUuid = ctx.query.get("project_uuid") ?? "";
        const items = conversationService.listConversationsByProject(projectUuid);
        return { items };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/conversations",
      handler: (_req, _res, ctx) => {
        const input = (ctx.body ?? {}) as CreateConversationInput;
        return conversationService.createConversation(input);
      }
    },
    {
      method: "GET",
      path: "/api/codeit/conversations/:uuid",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return conversationService.getConversationByUuid(uuid);
      }
    },
    {
      method: "GET",
      path: "/api/codeit/conversations/:uuid/messages",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const limitParam = ctx.query.get("limit");
        const cursorParam = ctx.query.get("cursor");

        const limit = limitParam ? Number(limitParam) : undefined;
        const cursor = cursorParam ?? undefined;

        return conversationService.listMessages(uuid, { limit, cursor });
      }
    },
    {
      method: "POST",
      path: "/api/codeit/conversations/:uuid/messages",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const input = (ctx.body ?? {}) as AppendMessageInput;
        return conversationService.appendMessage(uuid, input);
      }
    }
  ];
}
