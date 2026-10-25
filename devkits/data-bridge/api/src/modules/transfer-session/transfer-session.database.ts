import { createHash } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { AppError } from "@codexsun/framework/errors";
import { CommonTableRowAudit } from "../import-review/index.js";
import type { TransferColumn, TransferField, TransferRow } from "./transfer-session.types.js";
export const sensitive =
  /seed_placeholder|password|secret|token|credential|api.?key|private.?key|cookie|authorization/iu;
export function identifier(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_ -]*$/u.test(name))
    throw AppError.validation("Unsupported table or field name.");
  return `\`${name}\``;
}
export class TransferDatabase {
  constructor(
    readonly source: Connection,
    readonly target: Connection
  ) {}
  async tables() {
    const read = async (db: Connection) => {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
      );
      return rows
        .map((r) => String(r.name))
        .filter((name) => /^[A-Za-z_][A-Za-z0-9_ -]*$/u.test(name));
    };
    const [source, target] = await Promise.all([read(this.source), read(this.target)]);
    return {
      source,
      target
    };
  }
  async columns(db: Connection, table: string): Promise<TransferColumn[]> {
    const [columns] = await db.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${identifier(table)}`);
    const [relations] = await db.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME AS field, REFERENCED_TABLE_NAME AS parent, REFERENCED_COLUMN_NAME AS parentField, CONSTRAINT_NAME AS relationName FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL",
      [table]
    );
    return columns
      .filter((c) => !sensitive.test(String(c.Field)))
      .map((c) => ({
        name: String(c.Field),
        type: String(c.Type),
        required:
          c.Null === "NO" &&
          c.Default === null &&
          !String(c.Extra).includes("auto_increment") &&
          !/VIRTUAL|STORED|PERSISTENT/iu.test(String(c.Extra)),
        primary: c.Key === "PRI",
        generated:
          String(c.Extra).includes("auto_increment") ||
          /VIRTUAL|STORED|PERSISTENT/iu.test(String(c.Extra)),
        parent: relations.some(
          (r) =>
            r.field === c.Field &&
            relations.filter((other) => other.relationName === r.relationName).length > 1
        )
          ? "unsupported"
          : relations.find((r) => r.field === c.Field)?.parentField === "id"
            ? String(relations.find((r) => r.field === c.Field)!.parent)
            : relations.some((r) => r.field === c.Field)
              ? "unsupported"
              : null
      }));
  }
  async schema(sourceTable: string, targetTable: string) {
    const tables = await this.tables();
    if (!tables.source.includes(sourceTable) || !tables.target.includes(targetTable))
      throw AppError.validation(
        "Select available source and target tables from this connection pair."
      );
    const [source, target] = await Promise.all([
      this.columns(this.source, sourceTable),
      this.columns(this.target, targetTable)
    ]);
    const hash = createHash("sha256")
      .update(JSON.stringify({ sourceTable, targetTable, source, target }))
      .digest("hex");
    return { source, target, hash };
  }
  async verify(sourceTable: string, targetTable: string, fields: TransferField[]) {
    const schema = await this.schema(sourceTable, targetTable);
    const [engines] = await this.target.query<RowDataPacket[]>(
      "SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
      [targetTable]
    );
    if (String(engines[0]?.engine).toLowerCase() !== "innodb")
      throw AppError.validation("Destination must use InnoDB for transactional imports.");
    if (
      schema.source.filter((column) => column.primary).length !== 1 ||
      !schema.source.some(
        (column) =>
          column.name === "id" &&
          column.primary &&
          /^(?:tinyint|smallint|mediumint|int|bigint)/iu.test(column.type)
      )
    )
      throw AppError.validation("Source selection requires one integer primary key named id.");
    if (new Set(fields.map((f) => f.target)).size !== fields.length)
      throw AppError.validation("Map each target field once.");
    for (const column of schema.target) {
      const field = fields.find((f) => f.target === column.name);
      if ((!field || field.mode === "default") && column.required)
        throw AppError.validation(`Map required target field ${column.name}.`);
    }
    for (const field of fields) {
      const target = schema.target.find((c) => c.name === field.target);
      if (
        !target ||
        (target.generated && !(target.primary && target.name === "id") && field.mode !== "default")
      )
        throw AppError.validation(`Invalid target field ${field.target}.`);
      if (field.mode === "value" && target.required && field.value === null)
        throw AppError.validation(`Enter a value for required target field ${field.target}.`);
      if (field.mode === "source") {
        const source = schema.source.find((c) => c.name === field.source);
        if (!source || !compatibleType(source.type, target.type))
          throw AppError.validation(
            `Field ${field.target} requires a source with matching type (${target.type}).`
          );
        if (
          target.parent &&
          (!source.parent || source.parent === "unsupported" || target.parent === "unsupported")
        )
          throw AppError.validation(
            `Choose a verified target parent for ${field.target}; no supported source relationship is declared.`
          );
      }
      if (target.parent && field.mode !== "default" && field.mode !== "source") {
        if (field.mode !== "value" || target.parent === "unsupported")
          throw AppError.validation(`Unsupported parent mapping for ${field.target}.`);
        const [found] = await this.target.query<RowDataPacket[]>(
          `SELECT id FROM ${identifier(target.parent)} WHERE id=?`,
          [field.value]
        );
        if (found.length !== 1)
          throw AppError.validation(`Select an existing target parent for ${field.target}.`);
      }
      if (field.mode === "uuid" && !/^char\(8\)$/iu.test(target.type))
        throw AppError.validation("Generated UUID requires a CHAR(8) target.");
      if (field.mode === "now" && !/^(date|datetime|timestamp)/iu.test(target.type))
        throw AppError.validation("Current time requires a date field.");
    }
    const active = fields.filter((f) => f.mode !== "default").map((f) => f.target);
    if (
      !active.some(
        (name) => !["id", "uuid", "created_at", "updated_at", "created_by"].includes(name)
      )
    )
      throw AppError.validation("Select at least one business field to compare and import.");
    const [required] = await this.target.query<RowDataPacket[]>(
      `SHOW COLUMNS FROM ${identifier(targetTable)}`
    );
    const blocked = required.find(
      (column) =>
        sensitive.test(String(column.Field)) &&
        column.Null === "NO" &&
        column.Default === null &&
        !String(column.Extra).includes("auto_increment")
    );
    if (blocked)
      throw AppError.validation(
        `Destination requires sensitive field ${String(blocked.Field)}. Use its owning application's import process.`
      );
    return schema;
  }
  async audit(table: string, row: TransferRow, fields: TransferField[]) {
    const columnsInfo = await this.columns(this.target, table);
    for (const column of columnsInfo) {
      if (!(column.name in row.data)) continue;
      const value = row.data[column.name];
      const length = /^(?:var)?char\((\d+)\)/iu.exec(column.type);
      let problem = "";
      if (column.name === "id" && (!Number.isSafeInteger(Number(value)) || Number(value) <= 0))
        problem = "requires a positive integer";
      else if (column.required && (value === null || value === undefined))
        problem = "requires a value";
      else if (length && typeof value === "string" && [...value].length > Number(length[1]))
        problem = `exceeds ${length[1]} characters`;
      else if (
        /^(?:tinyint|smallint|mediumint|int|bigint|decimal|float|double)/iu.test(column.type) &&
        value !== null &&
        (value === "" || !Number.isFinite(Number(value)))
      )
        problem = "requires a number";
      else if (
        /^(?:date|datetime|timestamp)/iu.test(column.type) &&
        value !== null &&
        !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$/u.test(String(value))
      )
        problem = "requires a valid SQL date or date-time";
      if (problem) {
        row.status = "warning";
        row.message = `Target ${column.name} ${problem}.`;
        row.target = null;
        return;
      }
    }
    const columns = fields
      .filter(
        (f) =>
          f.mode !== "default" &&
          !["id", "uuid", "created_at", "updated_at", "created_by"].includes(f.target)
      )
      .map((f) => f.target);
    const audit = new CommonTableRowAudit(this.target, table, columns);
    const keys = await audit.uniqueKeys();
    const result = await audit.row({ rowNumber: row.sourceId, data: row.data }, keys);
    row.target = await new CommonTableRowAudit(this.target, table, [
      ...new Set([
        ...(table === "core_companies" ? ["id"] : []),
        ...fields.filter((field) => field.mode !== "default").map((field) => field.target)
      ])
    ]).matchingData(row.data, keys);
    row.status =
      result.status === "ready" ? "ready" : result.status === "existing" ? "existing" : "warning";
    row.message = result.message;
    if (
      row.status === "existing" &&
      row.target &&
      columns.some((name) =>
        row.data[name] === null
          ? row.target![name] !== null
          : String(row.data[name]) !== String(row.target![name])
      )
    ) {
      row.status = "warning";
      row.message = "Existing business key has different mapped data. Target preserved.";
    } else if (row.status === "existing" && table !== "core_units")
      row.message = "Mapped business data already exists. Target preserved.";
  }
}

export function compatibleType(source: string, target: string) {
  if (source.toLowerCase() === target.toLowerCase()) return true;
  const fromText = /^(?:var)?char\((\d+)\)$/iu.exec(source);
  const toText = /^varchar\((\d+)\)$/iu.exec(target);
  if (fromText && toText) return Number(fromText[1]) <= Number(toText[1]);
  const sizes: Record<string, number> = {
    tinyint: 8,
    smallint: 16,
    mediumint: 24,
    int: 32,
    bigint: 64
  };
  const fromInt = /^(tinyint|smallint|mediumint|int|bigint)(?:\(\d+\))?( unsigned)?$/iu.exec(
    source
  );
  const toInt = /^(tinyint|smallint|mediumint|int|bigint)(?:\(\d+\))?( unsigned)?$/iu.exec(target);
  if (!fromInt || !toInt) return false;
  const fromBits = sizes[fromInt[1]!.toLowerCase()]!;
  const toBits = sizes[toInt[1]!.toLowerCase()]!;
  if (!fromInt[2] && toInt[2]) return false;
  return fromInt[2] && !toInt[2] ? toBits > fromBits : toBits >= fromBits;
}
