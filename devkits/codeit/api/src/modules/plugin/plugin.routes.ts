import type { RouteDefinition } from "../project/project.routes.js";
import type { PluginService } from "./plugin.service.js";

export function createPluginRoutes(pluginService: PluginService): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/codeit/plugins",
      handler: () => {
        const plugins = pluginService.listPlugins();
        return { plugins };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/plugins/install",
      handler: (_req, _res, ctx) => {
        const rawBody = (ctx.body ?? {}) as Record<string, unknown>;
        const manifest = (rawBody.manifest ?? rawBody) as Record<string, unknown>;
        return pluginService.install(manifest);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/plugins/:uuid/enable",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const body = (ctx.body ?? {}) as { grants?: string[] };
        return pluginService.enable(uuid, body.grants);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/plugins/:uuid/disable",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return pluginService.disable(uuid);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/plugins/:uuid/revoke",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return pluginService.revoke(uuid);
      }
    },
    {
      method: "DELETE",
      path: "/api/codeit/plugins/:uuid",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const uninstalled = pluginService.uninstall(uuid);
        return { uninstalled };
      }
    },
    {
      method: "GET",
      path: "/api/codeit/plugins/:uuid/tools",
      handler: async (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const tools = await pluginService.listTools(uuid);
        return { tools };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/plugins/:uuid/invoke",
      handler: async (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const body = (ctx.body ?? {}) as {
          tool_name?: string;
          name?: string;
          arguments?: Record<string, unknown>;
          args?: Record<string, unknown>;
          timeout_ms?: number;
        };

        const toolName = body.tool_name ?? body.name ?? "";
        const args = body.arguments ?? body.args ?? {};
        const timeoutMs = body.timeout_ms;

        return await pluginService.invokeTool(
          uuid,
          toolName,
          args,
          timeoutMs !== undefined ? { timeoutMs } : undefined
        );
      }
    }
  ];
}
