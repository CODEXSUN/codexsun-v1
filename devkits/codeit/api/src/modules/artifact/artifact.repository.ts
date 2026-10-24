import type { DatabaseSync } from "node:sqlite";
import type { ArtifactRecord, ArtifactType } from "./artifact.types.js";

interface ArtifactRow {
  id: number;
  uuid: string;
  run_uuid: string | null;
  artifact_type: string;
  content_hash: string;
  relative_storage_key: string;
  byte_size: number;
  media_type: string;
  provenance: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ArtifactRow): ArtifactRecord {
  let parsedProvenance: Record<string, unknown> = {};
  try {
    parsedProvenance = JSON.parse(row.provenance || "{}");
  } catch {
    parsedProvenance = {};
  }

  return {
    id: row.id,
    uuid: row.uuid,
    run_uuid: row.run_uuid,
    artifact_type: row.artifact_type as ArtifactType,
    content_hash: row.content_hash,
    relative_storage_key: row.relative_storage_key,
    byte_size: row.byte_size,
    media_type: row.media_type,
    provenance: parsedProvenance,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class ArtifactRepository {
  constructor(private readonly db: DatabaseSync) {}

  findByUuid(uuid: string): ArtifactRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_artifacts WHERE uuid = ?")
      .get(uuid) as unknown as ArtifactRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByHash(contentHash: string): ArtifactRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_artifacts WHERE content_hash = ?")
      .get(contentHash) as unknown as ArtifactRow | undefined;
    return row ? mapRow(row) : null;
  }

  insert(data: Omit<ArtifactRecord, "id">): ArtifactRecord {
    const stmt = this.db.prepare(`
      INSERT INTO codeit_artifacts (
        uuid, run_uuid, artifact_type, content_hash, relative_storage_key,
        byte_size, media_type, provenance, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.uuid,
      data.run_uuid ?? null,
      data.artifact_type,
      data.content_hash,
      data.relative_storage_key,
      data.byte_size,
      data.media_type,
      JSON.stringify(data.provenance ?? {}),
      data.created_at,
      data.updated_at
    );

    const insertedId =
      typeof result.lastInsertRowid === "bigint"
        ? Number(result.lastInsertRowid)
        : result.lastInsertRowid;

    return {
      id: insertedId,
      ...data
    };
  }
}
