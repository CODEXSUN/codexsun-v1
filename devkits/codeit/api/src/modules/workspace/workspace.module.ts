import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { ProjectRepository } from "../project/project.repository.js";
import { ProjectService } from "../project/project.service.js";
import { RunRepository } from "../run/run.repository.js";
import { RunService } from "../run/run.service.js";
import { ToolPolicy } from "../tool/tool.policy.js";
import { ToolService } from "../tool/tool.service.js";
import { CommandRunner } from "./workspace.command.js";
import { WorkspaceGit } from "./workspace.git.js";
import { type ArtifactCreationInput, WorkspacePatcher } from "./workspace.patch.js";
import { WorkspaceReader } from "./workspace.reader.js";
import {
  type ProjectLookupFn,
  type RouteDefinition,
  createWorkspaceRoutes
} from "./workspace.routes.js";
import { WorkspaceSearcher } from "./workspace.searcher.js";

export interface WorkspaceModuleServices {
  projectService?: ProjectService;
  runService?: RunService;
  toolService?: ToolService;
  toolPolicy?: typeof ToolPolicy;
}

export class WorkspaceModule {
  public readonly reader: WorkspaceReader;
  public readonly searcher: WorkspaceSearcher;
  public readonly git: WorkspaceGit;
  public readonly patcher: WorkspacePatcher;
  public readonly runner: CommandRunner;
  public readonly projectService: ProjectService;
  public readonly runService: RunService;
  public readonly toolService: ToolService;
  public readonly toolPolicy: typeof ToolPolicy;
  public readonly routes: RouteDefinition[];

  constructor(
    db: DatabaseSync,
    customLookupOrServices?: ProjectLookupFn | WorkspaceModuleServices,
    maybeServices?: WorkspaceModuleServices
  ) {
    let customLookup: ProjectLookupFn | undefined;
    let services: WorkspaceModuleServices | undefined;

    if (typeof customLookupOrServices === "function") {
      customLookup = customLookupOrServices;
      services = maybeServices;
    } else if (typeof customLookupOrServices === "object" && customLookupOrServices !== null) {
      services = customLookupOrServices;
    }

    this.reader = new WorkspaceReader();
    this.searcher = new WorkspaceSearcher(this.reader);
    this.git = new WorkspaceGit(this.reader);
    this.runner = new CommandRunner(undefined, this.reader);

    this.projectService = services?.projectService ?? new ProjectService(new ProjectRepository(db));
    this.toolService = services?.toolService ?? new ToolService(db);
    this.runService = services?.runService ?? new RunService(new RunRepository(db), db);
    this.toolPolicy = services?.toolPolicy ?? ToolPolicy;

    this.patcher = new WorkspacePatcher({
      runLookup: (runUuid: string) => {
        try {
          const row = db
            .prepare("SELECT state, cancellation_generation FROM codeit_runs WHERE uuid = ?")
            .get(runUuid) as { state: string; cancellation_generation: number } | undefined;
          return row ?? null;
        } catch {
          return null;
        }
      },
      artifactCallback: (input: ArtifactCreationInput) => {
        const uuid = randomBytes(4).toString("hex");
        const contentBuf = Buffer.from(input.content, "utf8");
        const hash = createHash("sha256").update(contentBuf).digest("hex");
        const now = new Date().toISOString();
        const storageKey = `diffs/${uuid}.diff`;
        try {
          db.prepare(
            `
            INSERT INTO codeit_artifacts (uuid, run_uuid, artifact_type, content_hash, relative_storage_key, byte_size, media_type, provenance, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          ).run(
            uuid,
            input.run_uuid,
            input.artifact_type,
            hash,
            storageKey,
            contentBuf.length,
            input.media_type,
            JSON.stringify(input.provenance),
            now,
            now
          );
        } catch {
          // If artifacts table not ready or in-memory test double
        }
        return { uuid };
      }
    });

    const projectLookupToUse = customLookup ?? this.projectService;

    this.routes = createWorkspaceRoutes(
      this.reader,
      this.searcher,
      this.git,
      this.patcher,
      this.runner,
      projectLookupToUse,
      this.runService,
      this.toolService,
      this.toolPolicy
    );
  }

  register(): RouteDefinition[] {
    return this.routes;
  }
}
