import type { DatabaseSync } from "node:sqlite";
import type { RouteDefinition } from "../project/project.routes.js";
import { OrchestrationRepository } from "./orchestration.repository.js";
import { createOrchestrationRoutes } from "./orchestration.routes.js";
import { OrchestrationService, type OrchestrationServiceOptions } from "./orchestration.service.js";

export class OrchestrationModule {
  public readonly repository: OrchestrationRepository;
  public readonly service: OrchestrationService;
  public readonly routes: RouteDefinition[];

  constructor(db: DatabaseSync, options?: OrchestrationServiceOptions) {
    this.repository = new OrchestrationRepository(db);
    this.service = new OrchestrationService(this.repository, db, options);
    this.routes = createOrchestrationRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
