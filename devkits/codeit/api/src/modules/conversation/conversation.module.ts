import type { DatabaseSync } from "node:sqlite";
import { ConversationRepository } from "./conversation.repository.js";
import { createConversationRoutes } from "./conversation.routes.js";
import { ConversationService } from "./conversation.service.js";
import type { RouteDefinition } from "../project/project.routes.js";

export class ConversationModule {
  public readonly repository: ConversationRepository;
  public readonly service: ConversationService;
  public readonly routes: RouteDefinition[];

  constructor(db: DatabaseSync) {
    this.repository = new ConversationRepository(db);
    this.service = new ConversationService(this.repository, db);
    this.routes = createConversationRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
