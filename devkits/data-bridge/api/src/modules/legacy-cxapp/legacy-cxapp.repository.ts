import { migrateLegacyPreparation } from "./legacy-cxapp.migration.js";
import { bindLegacyPreparationContext } from "./legacy-cxapp.seed.js";
import { createHash } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { identifier } from "../transfer-session/index.js";
import type {
  LegacyMapping,
  LegacyPrepared,
  LegacyRecord,
  LegacyReference
} from "./legacy-cxapp.types.js";

// This repository writes only disposable preparation records, never the business target.
export class LegacyPreparationRepository {
  readonly rows: LegacyPrepared[] = [];
  readonly mappings: LegacyMapping[] = [];
  constructor(
    readonly source: Connection,
    readonly stage: Connection,
    readonly target: Connection
  ) {}

  async bindContext(sourceDatabase: string, targetDatabase: string) {
    await bindLegacyPreparationContext(this.stage,sourceDatabase,targetDatabase);
  }

  async initialize() {
    await migrateLegacyPreparation(this.stage);
  }

  async read(table: string): Promise<LegacyRecord[]> {
    const [columns] = await this.source.query<RowDataPacket[]>(
      `SHOW COLUMNS FROM ${identifier(table)}`
    );
    const keys = columns.filter((c) => c.Key === "PRI").map((c) => identifier(String(c.Field)));
    if (!keys.length) throw new Error(`Missing stable source primary key: ${table}`);
    const [rows] = await this.source.query<RowDataPacket[]>(
      `SELECT * FROM ${identifier(table)} ORDER BY ${keys.join(",")}`
    );
    return rows as LegacyRecord[];
  }

  async mapping(mapping: LegacyMapping) {
    if (
      this.mappings.some(
        (m) => m.sourceTable === mapping.sourceTable && m.targetTable === mapping.targetTable
      )
    )
      return;
    this.mappings.push(mapping);
    await this.stage.execute(
      "INSERT INTO bridge_legacy_mappings(phase,source_table,source_key,target_table,columns_json) VALUES(?,?,?,?,?)",
      [
        mapping.phase,
        mapping.sourceTable,
        mapping.sourceKey,
        mapping.targetTable,
        JSON.stringify(mapping.columns)
      ]
    );
  }

  find(table: string, key: string | number, sourceTable?: string) {
    return this.rows.find(
      (r) =>
        r.targetTable === table &&
        r.sourceKey === String(key) &&
        (!sourceTable || r.sourceTable === sourceTable)
    );
  }

  async matches(
    table: string,
    values: LegacyRecord,
    connection = this.target
  ): Promise<LegacyRecord[]> {
    const entries = Object.entries(values);
    if (!entries.length || entries.some(([, value]) => value === null)) return [];
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM ${identifier(table)} WHERE ${entries.map(([name]) => `${identifier(name)} <=> ?`).join(" AND ")} LIMIT 2`,
      entries.map(([, value]) => value)
    );
    return rows as LegacyRecord[];
  }

  async save(
    input: Omit<LegacyPrepared, "stageId" | "targetId">,
    identity: string[],
    references: LegacyReference[] = []
  ) {
    const row: LegacyPrepared = {
      ...input,
      data: { ...input.data },
      issues: [...input.issues],
      stageId: null,
      targetId: null
    };
    const targetIdentity: LegacyRecord = {};
    for (const name of identity) targetIdentity[name] = row.data[name] ?? null;
    for (const reference of references) {
      row.data[reference.field] = reference.row?.stageId ?? null;
      if (!reference.row?.stageId || reference.row.issues.length)
        row.issues.push(`Unresolved parent ${reference.field}.`);
      if (identity.includes(reference.field))
        targetIdentity[reference.field] = reference.row?.targetId ?? null;
    }
    const target = await this.matches(row.targetTable, targetIdentity);
    if (target.length > 1) row.issues.push("Ambiguous existing target business identity.");
    if (target.length === 1) {
      row.targetId = Number(target[0]!.id);
      const compared = { ...row.data };
      for (const reference of references)
        compared[reference.field] = reference.row?.targetId ?? null;
      const differences = selectedDifferences(row.targetTable, compared, target[0]!);
      if (differences.length)
        row.issues.push(`Existing target differs: ${differences.join(", ")}.`);
    }
    if (!row.issues.length) {
      const key: LegacyRecord = {};
      for (const name of identity) key[name] = row.data[name] ?? null;
      const existing = await this.matches(row.targetTable, key, this.stage);
      if (existing.length > 1) throw new Error(`Ambiguous staging identity: ${row.targetTable}`);
      if (existing.length) {
        const differences = selectedDifferences(row.targetTable, row.data, existing[0]!);
        if (differences.length)
          row.issues.push(`Existing staging identity differs: ${differences.join(", ")}.`);
        else row.stageId = Number(existing[0]!.id);
      } else {
        const columns = Object.keys(row.data);
        const [result] = await this.stage.execute(
          `INSERT INTO ${identifier(row.targetTable)} (${columns.map(identifier).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
          Object.values(row.data)
        );
        row.stageId = Number((result as { insertId: number }).insertId);
      }
    }
    await this.stage.execute(
      `INSERT INTO bridge_legacy_prepared_rows(phase,source_table,source_key,target_table,source_json,prepared_json,issues_json,stage_id,existing_target_id,status)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        row.phase,
        row.sourceTable,
        row.sourceKey,
        row.targetTable,
        JSON.stringify(row.source),
        JSON.stringify(row.data),
        JSON.stringify(row.issues),
        row.stageId,
        row.targetId,
        row.issues.length ? "blocked" : "prepared"
      ]
    );
    this.rows.push(row);
    return row;
  }
}

export function legacyUuid(table: string, key: string | number) {
  return createHash("sha256").update(`cxapp-legacy-v1:${table}:${key}`).digest("hex").slice(0, 8);
}
export function legacyText(value: unknown) {
  return String(value ?? "").trim();
}
export function legacyStatus(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    !legacyText(value) ||
    ![0, 1].includes(Number(value))
  )
    throw new Error("Unknown legacy active flag.");
  return Number(value) === 1 ? "active" : "inactive";
}

function selectedDifferences(table: string, data: LegacyRecord, existing: LegacyRecord) {
  return Object.entries(data)
    .filter(([field, value]) => {
      if (["uuid", "created_by", "created_at", "updated_at"].includes(field)) return false;
      const current = existing[field];
      if (value === null || current === null || current === undefined) return value !== current;
      if (table === "core_units" && field === "name")
        return legacyText(value).toLowerCase() !== legacyText(current).toLowerCase();
      if (typeof value === "number" || typeof current === "number")
        return Number(value) !== Number(current);
      return String(value) !== String(current);
    })
    .map(([field]) => field);
}
