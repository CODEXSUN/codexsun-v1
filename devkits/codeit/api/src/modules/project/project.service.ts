import { randomBytes } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  InvalidStateError,
  NotFoundError,
  PathDeniedError,
  ValidationError
} from "../../errors.js";
import type { ProjectRepository } from "./project.repository.js";
import {
  type CreateProjectInput,
  CreateProjectInputSchema,
  HexUuidSchema,
  type ProjectRecord
} from "./project.types.js";

export class ProjectService {
  constructor(private readonly repo: ProjectRepository) {}

  listProjects(): ProjectRecord[] {
    return this.repo.findAll();
  }

  getProjectByUuid(uuid: string): ProjectRecord {
    const parsedUuid = HexUuidSchema.safeParse(uuid);
    if (!parsedUuid.success) {
      throw new ValidationError("Invalid project UUID format", { uuid });
    }

    const project = this.repo.findByUuid(parsedUuid.data);
    if (!project) {
      throw new NotFoundError(`Project not found with UUID: ${uuid}`, { uuid });
    }
    return project;
  }

  registerProject(input: CreateProjectInput): ProjectRecord {
    const parseResult = CreateProjectInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError("Invalid project payload", {
        errors: parseResult.error.issues
      });
    }

    const { name, root_path, trust_state } = parseResult.data;

    // 1. Canonical root validation
    const resolvedPath = resolve(root_path);
    if (!existsSync(resolvedPath)) {
      throw new PathDeniedError(`Project root path does not exist: ${resolvedPath}`, {
        root_path
      });
    }

    try {
      const stats = statSync(resolvedPath);
      if (!stats.isDirectory()) {
        throw new PathDeniedError(`Project root path must be a directory: ${resolvedPath}`, {
          root_path
        });
      }
    } catch (err) {
      if (err instanceof PathDeniedError) throw err;
      throw new PathDeniedError(`Cannot access project root path: ${resolvedPath}`, {
        root_path
      });
    }

    let canonicalRoot: string;
    try {
      canonicalRoot = realpathSync(resolvedPath);
    } catch {
      canonicalRoot = resolvedPath;
    }

    // 2. Duplicate detection
    const existing = this.repo.findByRootPath(canonicalRoot);
    if (existing) {
      throw new InvalidStateError(
        `A project is already registered with canonical root path: ${canonicalRoot}`,
        409,
        { existingUuid: existing.uuid, root_path: canonicalRoot }
      );
    }

    // 3. Unique 8-hex UUID generation
    let uuid = "";
    for (let i = 0; i < 10; i++) {
      const candidate = randomBytes(4).toString("hex").toLowerCase();
      if (!this.repo.findByUuid(candidate)) {
        uuid = candidate;
        break;
      }
    }
    if (!uuid) {
      throw new Error("Failed to generate unique project UUID after multiple attempts");
    }

    const now = new Date().toISOString();
    return this.repo.insert({
      uuid,
      name: name.trim(),
      root_path: canonicalRoot,
      trust_state: trust_state ?? "untrusted",
      policy_revision: "1.0.0",
      created_at: now,
      updated_at: now
    });
  }
}
