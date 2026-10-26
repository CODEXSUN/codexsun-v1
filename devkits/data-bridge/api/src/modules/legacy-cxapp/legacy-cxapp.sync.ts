import type { RowDataPacket } from "mysql2/promise";
import type { LegacyPreparationRepository } from "./legacy-cxapp.repository.js";
import type { LegacyMapping, LegacyPrepared } from "./legacy-cxapp.types.js";

export async function hydrateLegacyPreparation(repository: LegacyPreparationRepository) {
  const [saved] = await repository.stage.query<RowDataPacket[]>(
    "SELECT * FROM bridge_legacy_prepared_rows ORDER BY id"
  );
  if (saved.some((row) => Number(row.execution_authorized) !== 0)) {
    throw new Error("Preparation cannot load execution-authorized records.");
  }
  const [mapped] = await repository.stage.query<RowDataPacket[]>(
    "SELECT * FROM bridge_legacy_mappings ORDER BY id"
  );
  const rows: LegacyPrepared[] = saved.map((row) => ({
    phase: row.phase,
    sourceTable: row.source_table,
    sourceKey: row.source_key,
    targetTable: row.target_table,
    source: parse(row.source_json),
    data: parse(row.prepared_json),
    issues: parse(row.issues_json),
    stageId: row.stage_id,
    targetId: row.existing_target_id
  }));
  const mappings: LegacyMapping[] = mapped.map((row) => ({
    phase: row.phase,
    sourceTable: row.source_table,
    sourceKey: row.source_key,
    targetTable: row.target_table,
    columns: parse(row.columns_json)
  }));
  repository.rows.splice(0, repository.rows.length, ...rows);
  repository.mappings.splice(0, repository.mappings.length, ...mappings);
}

function parse<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) : value;
}
