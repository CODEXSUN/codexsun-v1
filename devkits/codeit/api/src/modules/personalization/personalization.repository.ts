import type { DatabaseSync } from "node:sqlite";
import type {
  ConfirmationState,
  FactFilter,
  FactScope,
  PersonalFact
} from "./personalization.types.js";

interface PersonalFactRow {
  id: number;
  uuid: string;
  scope: string;
  owner_id: string;
  fact_key: string;
  fact_value: string;
  source: string;
  confirmation_state: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: PersonalFactRow): PersonalFact {
  return {
    id: row.id,
    uuid: row.uuid,
    scope: row.scope as FactScope,
    owner_id: row.owner_id,
    fact_key: row.fact_key,
    fact_value: row.fact_value,
    source: row.source,
    confirmation_state: row.confirmation_state as ConfirmationState,
    verified_at: row.verified_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class PersonalizationRepository {
  constructor(private readonly db: DatabaseSync) {}

  findByUuid(uuid: string): PersonalFact | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_personal_facts WHERE uuid = ?")
      .get(uuid) as unknown as PersonalFactRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByKey(scope: FactScope, ownerId: string, factKey: string): PersonalFact | null {
    const row = this.db
      .prepare(
        "SELECT * FROM codeit_personal_facts WHERE scope = ? AND owner_id = ? AND fact_key = ?"
      )
      .get(scope, ownerId, factKey) as unknown as PersonalFactRow | undefined;
    return row ? mapRow(row) : null;
  }

  list(filter: FactFilter = {}): PersonalFact[] {
    let query = "SELECT * FROM codeit_personal_facts WHERE 1=1";
    const params: unknown[] = [];

    if (filter.scope) {
      query += " AND scope = ?";
      params.push(filter.scope);
    }
    if (filter.owner_id) {
      query += " AND owner_id = ?";
      params.push(filter.owner_id);
    }
    if (filter.confirmation_state) {
      query += " AND confirmation_state = ?";
      params.push(filter.confirmation_state);
    }
    if (filter.fact_key) {
      query += " AND fact_key = ?";
      params.push(filter.fact_key);
    }

    query += " ORDER BY id ASC";

    const rows = this.db
      .prepare(query)
      .all(...(params as unknown as [string])) as unknown as PersonalFactRow[];
    return rows.map(mapRow);
  }

  save(data: Omit<PersonalFact, "id">): PersonalFact {
    const existing = this.findByKey(data.scope, data.owner_id, data.fact_key);

    if (existing && existing.id !== undefined) {
      const now = new Date().toISOString();
      const verifiedAt = data.verified_at !== undefined ? data.verified_at : existing.verified_at;

      this.db
        .prepare(
          `
          UPDATE codeit_personal_facts
          SET fact_value = ?, source = ?, confirmation_state = ?, verified_at = ?, updated_at = ?
          WHERE id = ?
        `
        )
        .run(
          data.fact_value,
          data.source,
          data.confirmation_state,
          verifiedAt ?? null,
          now,
          existing.id
        );

      return {
        id: existing.id,
        uuid: existing.uuid,
        scope: data.scope,
        owner_id: data.owner_id,
        fact_key: data.fact_key,
        fact_value: data.fact_value,
        source: data.source,
        confirmation_state: data.confirmation_state,
        verified_at: verifiedAt ?? undefined,
        created_at: existing.created_at,
        updated_at: now
      };
    }

    const stmt = this.db.prepare(`
      INSERT INTO codeit_personal_facts (
        uuid, scope, owner_id, fact_key, fact_value, source, confirmation_state, verified_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.uuid,
      data.scope,
      data.owner_id,
      data.fact_key,
      data.fact_value,
      data.source,
      data.confirmation_state,
      data.verified_at ?? null,
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

  updateConfirmationState(
    uuid: string,
    state: ConfirmationState,
    verifiedAt?: string | null
  ): PersonalFact | null {
    const now = new Date().toISOString();
    const effectiveVerifiedAt =
      verifiedAt !== undefined ? verifiedAt : state === "confirmed" ? now : null;

    this.db
      .prepare(
        `
        UPDATE codeit_personal_facts
        SET confirmation_state = ?, verified_at = ?, updated_at = ?
        WHERE uuid = ?
      `
      )
      .run(state, effectiveVerifiedAt, now, uuid);

    return this.findByUuid(uuid);
  }

  delete(uuid: string): boolean {
    const result = this.db.prepare("DELETE FROM codeit_personal_facts WHERE uuid = ?").run(uuid);
    return Number(result.changes) > 0;
  }

  deleteByOwner(scope: FactScope, ownerId: string): number {
    const result = this.db
      .prepare("DELETE FROM codeit_personal_facts WHERE scope = ? AND owner_id = ?")
      .run(scope, ownerId);
    return Number(result.changes);
  }

  invalidateBySourceRevision(ownerId: string, sourceRevision: string): number {
    const now = new Date().toISOString();
    const pattern = `%${sourceRevision}%`;
    const result = this.db
      .prepare(
        `
        UPDATE codeit_personal_facts
        SET confirmation_state = 'stale', updated_at = ?
        WHERE owner_id = ?
          AND (source LIKE ? OR source = ?)
          AND confirmation_state != 'stale'
      `
      )
      .run(now, ownerId, pattern, sourceRevision);

    return Number(result.changes);
  }
}
