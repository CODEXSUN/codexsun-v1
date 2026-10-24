import type { IncomingMessage, ServerResponse } from "node:http";
import { ValidationError } from "../../errors.js";
import type { ToolService } from "./tool.service.js";
import { ApproveToolInputSchema } from "./tool.types.js";

export interface RouteDefinition {
  method: string;
  path: string;
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    ctx: {
      params: Record<string, string>;
      query: URLSearchParams;
      body: unknown;
      correlationId: string;
    }
  ) => Promise<unknown> | unknown;
}

export function createToolRoutes(toolService: ToolService): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/codeit/tools",
      handler: () => {
        const tools = toolService.listTools();
        return { tools };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/tools/approve",
      handler: (_req, _res, ctx) => {
        const parseResult = ApproveToolInputSchema.safeParse(ctx.body ?? {});
        if (!parseResult.success) {
          throw new ValidationError("Invalid approval submission payload", {
            errors: parseResult.error.issues
          });
        }

        const { approval_uuid, decision } = parseResult.data;
        const approval = toolService.decideApproval(approval_uuid, decision);
        return approval;
      }
    }
  ];
}
