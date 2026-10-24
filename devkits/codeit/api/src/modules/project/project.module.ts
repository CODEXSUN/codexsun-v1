import type { DatabaseSync } from "node:sqlite";
import { ProjectRepository } from "./project.repository.js";
import { type RouteDefinition, createProjectRoutes } from "./project.routes.js";
import { ProjectService } from "./project.service.js";

export class ProjectModule {
  public readonly repository: ProjectRepository;
  public readonly service: ProjectService;
  public readonly routes: RouteDefinition[];

  constructor(db: DatabaseSync) {
    this.repository = new ProjectRepository(db);
    this.service = new ProjectService(this.repository);
    this.routes = createProjectRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
