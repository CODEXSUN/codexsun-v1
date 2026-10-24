import type { DatabaseSync } from "node:sqlite";
import type { PluginEnabledState, PluginInstallRecord } from "./plugin.types.js";

interface PluginInstallRow {
  id: number;
  uuid: string;
  plugin_id: string;
  version: string;
  manifest_digest: string;
  enabled_state: string;
  grants: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: PluginInstallRow): PluginInstallRecord {
  let grants: string[] = [];
  try {
    const parsed = JSON.parse(row.grants);
    if (Array.isArray(parsed)) {
      grants = parsed;
    }
  } catch {
    grants = [];
  }

  return {
    id: row.id,
    uuid: row.uuid,
    plugin_id: row.plugin_id,
    version: row.version,
    manifest_digest: row.manifest_digest,
    enabled_state: row.enabled_state as PluginEnabledState,
    grants,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class PluginRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(data: {
    uuid: string;
    plugin_id: string;
    version: string;
    manifest_digest: string;
    enabled_state?: PluginEnabledState;
    grants?: string[];
  }): PluginInstallRecord {
    const now = new Date().toISOString();
    const enabled_state = data.enabled_state ?? "installed";
    const grantsJson = JSON.stringify(data.grants ?? []);

    this.db
      .prepare(
        `INSERT INTO codeit_plugin_installs (
          uuid, plugin_id, version, manifest_digest, enabled_state, grants, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.uuid,
        data.plugin_id,
        data.version,
        data.manifest_digest,
        enabled_state,
        grantsJson,
        now,
        now
      );

    const record = this.findByUuid(data.uuid);
    if (!record) {
      throw new Error(`Failed to retrieve newly created plugin install for uuid ${data.uuid}`);
    }
    return record;
  }

  findByUuid(uuid: string): PluginInstallRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_plugin_installs WHERE uuid = ?")
      .get(uuid) as unknown as PluginInstallRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByPluginId(plugin_id: string): PluginInstallRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_plugin_installs WHERE plugin_id = ? ORDER BY id DESC LIMIT 1")
      .get(plugin_id) as unknown as PluginInstallRow | undefined;
    return row ? mapRow(row) : null;
  }

  updateEnabledState(uuid: string, enabled_state: PluginEnabledState): PluginInstallRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE codeit_plugin_installs
         SET enabled_state = ?, updated_at = ?
         WHERE uuid = ?`
      )
      .run(enabled_state, now, uuid);

    const updated = this.findByUuid(uuid);
    if (!updated) {
      throw new Error(`Plugin not found for uuid ${uuid}`);
    }
    return updated;
  }

  updateGrants(uuid: string, grants: string[]): PluginInstallRecord {
    const now = new Date().toISOString();
    const grantsJson = JSON.stringify(grants);

    this.db
      .prepare(
        `UPDATE codeit_plugin_installs
         SET grants = ?, updated_at = ?
         WHERE uuid = ?`
      )
      .run(grantsJson, now, uuid);

    const updated = this.findByUuid(uuid);
    if (!updated) {
      throw new Error(`Plugin not found for uuid ${uuid}`);
    }
    return updated;
  }

  list(): PluginInstallRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM codeit_plugin_installs ORDER BY id ASC")
      .all() as unknown as PluginInstallRow[];
    return rows.map(mapRow);
  }

  delete(uuid: string): boolean {
    const res = this.db.prepare("DELETE FROM codeit_plugin_installs WHERE uuid = ?").run(uuid);
    return Number(res.changes) > 0;
  }
}
