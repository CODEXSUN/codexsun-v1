import type { DatabaseSync } from "node:sqlite";
import type { RouteDefinition } from "../project/project.routes.js";
import { PersonalizationRepository } from "./personalization.repository.js";
import { createPersonalizationRoutes } from "./personalization.routes.js";
import { PersonalizationService } from "./personalization.service.js";

export class PersonalizationModule {
  public readonly repository: PersonalizationRepository;
  public readonly service: PersonalizationService;
  public readonly routes: RouteDefinition[];

  constructor(db: DatabaseSync) {
    this.repository = new PersonalizationRepository(db);
    this.service = new PersonalizationService(this.repository);
    this.routes = createPersonalizationRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
