import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProjectService } from "./project.service.js";
import type { CreateProjectInput } from "./project.types.js";

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

export function createProjectRoutes(projectService: ProjectService): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/codeit/projects",
      handler: () => {
        const items = projectService.listProjects();
        return { items };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/projects",
      handler: (_req, _res, ctx) => {
        const input = (ctx.body ?? {}) as CreateProjectInput;
        return projectService.registerProject(input);
      }
    },
    {
      method: "GET",
      path: "/api/codeit/projects/:uuid",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return projectService.getProjectByUuid(uuid);
      }
    }
  ];
}
