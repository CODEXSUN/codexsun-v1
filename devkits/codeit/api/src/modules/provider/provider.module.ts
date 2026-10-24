import type { RouteDefinition } from "../project/project.routes.js";
import { createProviderRoutes } from "./provider.routes.js";
import { ProviderService } from "./provider.service.js";

export class ProviderModule {
  public readonly service: ProviderService;
  public readonly routes: RouteDefinition[];

  constructor(service?: ProviderService) {
    this.service = service ?? new ProviderService();
    this.routes = createProviderRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
