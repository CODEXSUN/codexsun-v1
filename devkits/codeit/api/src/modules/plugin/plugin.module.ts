import type { DatabaseSync } from "node:sqlite";
import type { RouteDefinition } from "../project/project.routes.js";
import { McpBroker } from "./mcp.broker.js";
import { PluginRepository } from "./plugin.repository.js";
import { createPluginRoutes } from "./plugin.routes.js";
import { PluginService } from "./plugin.service.js";

export class PluginModule {
  public readonly repository: PluginRepository;
  public readonly broker: McpBroker;
  public readonly service: PluginService;
  public readonly routes: RouteDefinition[];

  constructor(db: DatabaseSync, broker?: McpBroker) {
    this.repository = new PluginRepository(db);
    this.broker = broker ?? new McpBroker();
    this.service = new PluginService(this.repository, this.broker);
    this.routes = createPluginRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
