import type { DatabaseSync } from "node:sqlite";
import type { ProjectRecord, TrustState } from "./project.types.js";

interface ProjectRow {
  id: number;
  uuid: string;
  name: string;
  root_path: string;
  trust_state: string;
  policy_revision: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    root_path: row.root_path,
    trust_state: row.trust_state as TrustState,
    policy_revision: row.policy_revision,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class ProjectRepository {
  constructor(private readonly db: DatabaseSync) {}

  findAll(): ProjectRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM codeit_projects ORDER BY id ASC")
      .all() as unknown as ProjectRow[];
    return rows.map(mapRow);
  }

  findByUuid(uuid: string): ProjectRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_projects WHERE uuid = ?")
      .get(uuid) as unknown as ProjectRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByRootPath(rootPath: string): ProjectRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_projects WHERE root_path = ?")
      .get(rootPath) as unknown as ProjectRow | undefined;
    return row ? mapRow(row) : null;
  }

  insert(data: Omit<ProjectRecord, "id">): ProjectRecord {
    const stmt = this.db.prepare(`
      INSERT INTO codeit_projects (uuid, name, root_path, trust_state, policy_revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.uuid,
      data.name,
      data.root_path,
      data.trust_state,
      data.policy_revision,
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

  updateTrustState(uuid: string, trustState: TrustState): ProjectRecord | null {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE codeit_projects SET trust_state = ?, updated_at = ? WHERE uuid = ?")
      .run(trustState, now, uuid);
    return this.findByUuid(uuid);
  }
}
