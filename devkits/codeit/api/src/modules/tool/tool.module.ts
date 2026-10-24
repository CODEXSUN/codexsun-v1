import type { DatabaseSync } from "node:sqlite";
import { type RouteDefinition, createToolRoutes } from "./tool.routes.js";
import { ToolService } from "./tool.service.js";

export class ToolModule {
  public readonly service: ToolService;
  public readonly routes: RouteDefinition[];

  constructor(db: DatabaseSync) {
    this.service = new ToolService(db);
    this.routes = createToolRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
