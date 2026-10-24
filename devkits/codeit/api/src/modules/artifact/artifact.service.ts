import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NotFoundError, ValidationError } from "../../errors.js";
import { HexUuidSchema } from "../project/project.types.js";
import type { ArtifactRepository } from "./artifact.repository.js";
import {
  type ArtifactRecord,
  type StoreArtifactInput,
  StoreArtifactInputSchema
} from "./artifact.types.js";

export class ArtifactService {
  private readonly storageDir: string;

  constructor(
    private readonly repo: ArtifactRepository,
    storageDir?: string
  ) {
    this.storageDir = storageDir
      ? resolve(storageDir)
      : resolve(process.cwd(), ".codeit", "storage", "artifacts");

    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getStorageDirectory(): string {
    return this.storageDir;
  }

  storeArtifact(input: StoreArtifactInput): ArtifactRecord {
    const parseResult = StoreArtifactInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError("Invalid artifact payload", {
        errors: parseResult.error.issues
      });
    }

    const { run_uuid, artifact_type, content, media_type, provenance } = parseResult.data;

    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const content_hash = createHash("sha256").update(buffer).digest("hex");
    const byte_size = buffer.length;

    // Generate unique 8-hex UUID
    let uuid = "";
    for (let i = 0; i < 10; i++) {
      const candidate = randomBytes(4).toString("hex").toLowerCase();
      if (!this.repo.findByUuid(candidate)) {
        uuid = candidate;
        break;
      }
    }
    if (!uuid) {
      throw new Error("Failed to generate unique artifact UUID");
    }

    const relative_storage_key = `${content_hash}.bin`;
    const finalPath = join(this.storageDir, relative_storage_key);

    // Crash-safe atomic write
    if (!existsSync(finalPath)) {
      const tempPath = join(this.storageDir, `.tmp-${uuid}-${Date.now()}.bin`);
      writeFileSync(tempPath, buffer);
      renameSync(tempPath, finalPath);
    }

    const now = new Date().toISOString();
    return this.repo.insert({
      uuid,
      run_uuid: run_uuid ?? null,
      artifact_type,
      content_hash,
      relative_storage_key,
      byte_size,
      media_type: media_type ?? "text/plain",
      provenance: provenance ?? {},
      created_at: now,
      updated_at: now
    });
  }

  getArtifact(uuid: string): { record: ArtifactRecord; content: Buffer } {
    const parsedUuid = HexUuidSchema.safeParse(uuid);
    if (!parsedUuid.success) {
      throw new ValidationError("Invalid artifact UUID format", { uuid });
    }

    const record = this.repo.findByUuid(parsedUuid.data);
    if (!record) {
      throw new NotFoundError(`Artifact not found with UUID: ${uuid}`, { uuid });
    }

    const filePath = join(this.storageDir, record.relative_storage_key);
    if (!existsSync(filePath)) {
      throw new NotFoundError(`Artifact data file missing on disk for UUID: ${uuid}`, { uuid });
    }

    const content = readFileSync(filePath);
    return { record, content };
  }
}
