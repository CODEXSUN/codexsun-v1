import type { DatabaseSync } from "node:sqlite";
import type { RouteDefinition } from "../project/project.routes.js";
import type { ProviderService } from "../provider/provider.service.js";
import type { CodingLoopService } from "./coding-loop.service.js";
import { RunRepository } from "./run.repository.js";
import { createRunRoutes } from "./run.routes.js";
import { RunService } from "./run.service.js";

export class RunModule {
  public readonly repository: RunRepository;
  public readonly service: RunService;
  public readonly loopService?: CodingLoopService | undefined;
  public readonly routes: RouteDefinition[];

  constructor(
    db: DatabaseSync,
    providerService?: ProviderService | undefined,
    loopService?: CodingLoopService | undefined
  ) {
    this.repository = new RunRepository(db);
    this.service = new RunService(this.repository, db, providerService);
    this.loopService = loopService;
    this.routes = createRunRoutes(this.service, this.loopService);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
