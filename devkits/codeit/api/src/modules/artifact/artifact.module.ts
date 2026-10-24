import type { DatabaseSync } from "node:sqlite";
import type { RouteDefinition } from "../project/project.routes.js";
import { ArtifactRepository } from "./artifact.repository.js";
import { createArtifactRoutes } from "./artifact.routes.js";
import { ArtifactService } from "./artifact.service.js";

export class ArtifactModule {
  public readonly repository: ArtifactRepository;
  public readonly service: ArtifactService;
  public readonly routes: RouteDefinition[];

  constructor(db: DatabaseSync, storageDir?: string) {
    this.repository = new ArtifactRepository(db);
    this.service = new ArtifactService(this.repository, storageDir);
    this.routes = createArtifactRoutes(this.service);
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
