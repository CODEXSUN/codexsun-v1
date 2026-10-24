import type { RouteDefinition } from "../project/project.routes.js";
import type { ProviderService } from "./provider.service.js";
import { ProviderTestInputSchema } from "./provider.types.js";

/**
 * Route definitions for Codeit Provider Management.
 */
export function createProviderRoutes(providerService: ProviderService): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/codeit/providers",
      handler: async () => {
        const providers = await providerService.listProviders();
        return { providers };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/providers/test",
      handler: async (_req, _res, ctx) => {
        const input = ProviderTestInputSchema.parse(ctx.body ?? {});
        return await providerService.testProvider(input.provider, input.model);
      }
    }
  ];
}
