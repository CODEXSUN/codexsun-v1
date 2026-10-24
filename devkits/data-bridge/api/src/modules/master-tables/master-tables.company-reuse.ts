import type { Connection, RowDataPacket } from "mysql2/promise";
import { AppError } from "@codexsun/framework/errors";

export type CompanyReuseRow = {
  sourceId: number;
  source: Record<string, unknown>;
  data: Record<string, unknown>;
  target: Record<string, unknown> | null;
  status: string;
  message: string;
  reuse?: { targetId: number; before: Record<string, unknown>; sourceCount: number };
};
export class CompanySeedReuse {
  constructor(
    private readonly source: Connection,
    private readonly target: Connection,
    private readonly isSeed?: (row: Record<string, unknown>) => boolean
  ) {}
  async claimExisting(table: string, row: CompanyReuseRow) {
    if (
      !["core_companies", "core_default_company_settings"].includes(table) ||
      row.status !== "existing"
    )
      return;
    const company = table === "core_companies";
    if (company && (!row.data.code || !row.data.name)) return;
    const [records] = await this.target.query<RowDataPacket[]>(
      company
        ? "SELECT * FROM core_companies WHERE code=? AND name=? FOR UPDATE"
        : "SELECT * FROM core_default_company_settings WHERE singleton_key=1 FOR UPDATE",
      company ? [String(row.data.code), String(row.data.name)] : []
    );
    const record = records[0];
    if (records.length !== 1 || !record || Number(record.seed_placeholder) !== 1) return;
    if (company && !this.isSeed?.(record)) return;
    await this.target.execute(
      `UPDATE \`${table}\` SET seed_placeholder=0,updated_at=updated_at WHERE id=?`,
      [record.id]
    );
    row.message =
      "Existing business data preserved. Seed identity confirmed for this source mapping.";
  }
  async prepare(sourceTable: string, table: string, row: CompanyReuseRow) {
    if (
      !["core_companies", "core_default_company_settings"].includes(table) ||
      row.status === "existing"
    )
      return;
    if (!/^[A-Za-z_][A-Za-z0-9_ -]*$/u.test(sourceTable)) return;
    const [counts] = await this.source.query<RowDataPacket[]>(
      `SELECT COUNT(*) n FROM \`${sourceTable}\``
    );
    const count = Number(counts[0]!.n);
    const [targets] = await this.target.query<RowDataPacket[]>(
      `SELECT * FROM \`${table}\` ORDER BY id LIMIT 2`
    );
    if (!targets.length) return;
    const existing = targets[0]!;
    const pristine =
      table === "core_companies"
        ? this.isSeed?.(existing) === true
        : Number(existing.seed_placeholder) === 1 &&
          Number(existing.singleton_key) === 1 &&
          existing.landing_app === "application" &&
          existing.status === "active" &&
          existing.created_by === "system:migration" &&
          String(existing.created_at) === String(existing.updated_at);
    if (count !== 1 || targets.length !== 1 || !pristine) {
      if (row.status === "ready" || row.status === "warning") {
        row.status = "warning";
        row.message = `Company mapping needs review: ${count} source records and ${targets.length > 1 ? "multiple" : targets.length} target records. Reuse an exact match or one verified seed for a single-company source. No company was created.`;
      }
      return;
    }
    if (table === "core_companies") {
      if (!row.data.name || !row.data.code)
        throw AppError.validation("Map company name and code before seed reuse.");
      const [children] = await this.target.query<RowDataPacket[]>(
        "SELECT TABLE_NAME name,COLUMN_NAME field,REFERENCED_COLUMN_NAME parentField FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='core_companies' AND TABLE_NAME REGEXP '^core_companies_'"
      );
      for (const child of children) {
        if (
          ![child.name, child.field].every((name) =>
            /^[A-Za-z_][A-Za-z0-9_ -]*$/u.test(String(name))
          )
        )
          throw AppError.validation(
            "Review unsupported company child relationships before seed reuse."
          );
        const [values] = await this.target.query<RowDataPacket[]>(
          `SELECT COUNT(*) n FROM \`${String(child.name)}\` WHERE \`${String(child.field)}\`=?`,
          [existing[String(child.parentField)]]
        );
        if (Number(values[0]!.n))
          throw AppError.validation(
            "The seed company has business details. Review its mapping explicitly."
          );
      }
    } else if (!row.data.company_id)
      throw AppError.validation("Resolve the target company before default settings reuse.");
    row.reuse = { targetId: Number(existing.id), before: { ...existing }, sourceCount: count };
    for (const name of ["id", "uuid", "created_by", "created_at"])
      if (name in row.data) row.data[name] = existing[name];
    row.target = { ...existing };
    row.status = "ready";
    row.message = `Update verified seed ${table} ID ${existing.id} in place. Preserve its identity and references.`;
    return row.reuse;
  }
  async commit(sourceTable: string, table: string, row: CompanyReuseRow) {
    const plan = row.reuse;
    if (!plan) return false;
    const [current] = await this.target.query<RowDataPacket[]>(
      `SELECT * FROM \`${table}\` WHERE id=? FOR UPDATE`,
      [plan.targetId]
    );
    if (!current[0] || JSON.stringify(current[0]) !== JSON.stringify(plan.before))
      throw AppError.validation(
        "The seed changed after preparation. Prepare company mapping again."
      );
    const columns = Object.keys(row.source);
    const [origin] = await this.source.query<RowDataPacket[]>(
      `SELECT ${columns.map((name) => `\`${name}\``).join(",")} FROM \`${sourceTable}\` WHERE id=?`,
      [row.sourceId]
    );
    if (
      !origin[0] ||
      JSON.stringify(Object.fromEntries(columns.map((name) => [name, origin[0]![name]]))) !==
        JSON.stringify(row.source)
    )
      throw AppError.validation("Source company changed. Prepare company mapping again.");
    const fresh: CompanyReuseRow = { ...row, status: "ready" };
    delete fresh.reuse;
    const refreshed = await this.prepare(sourceTable, table, fresh);
    if (!refreshed || refreshed.targetId !== plan.targetId)
      throw AppError.validation("Company count or seed eligibility changed. Prepare again.");
    const fields = Object.keys(row.data).filter(
      (name) =>
        !["id", "uuid", "created_by", "created_at", "updated_at", "seed_placeholder"].includes(name)
    );
    await this.target.execute(
      `UPDATE \`${table}\` SET ${fields.map((name) => `\`${name}\`=?`).join(",")},seed_placeholder=0 WHERE id=?`,
      [
        ...fields.map((name) => {
          const v = row.data[name];
          return v === null ||
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean"
            ? v
            : JSON.stringify(v);
        }),
        plan.targetId
      ]
    );
    row.status = "imported";
    row.message = "Updated verified seed in place. Existing ID, UUID and references preserved.";
    return true;
  }
}
