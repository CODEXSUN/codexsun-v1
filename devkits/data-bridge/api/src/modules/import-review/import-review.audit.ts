import { prepareExistingUnit } from "../common-tables/index.js";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { ImportRowReport } from "./import-review.types.js";

export class CommonTableRowAudit {
  constructor(
    private readonly database: Connection,
    private readonly table: string,
    private readonly columns: string[]
  ) {
    if (!/^[A-Za-z_][A-Za-z0-9_ -]*$/u.test(table))
      throw new Error("Invalid audit table identifier.");
  }

  async uniqueKeys() {
    const [indexes] = await this.database.query<RowDataPacket[]>(
      `SHOW INDEX FROM \`${this.table}\` WHERE Non_unique = 0`
    );
    const keys = new Map<string, string[]>();
    for (const index of indexes) {
      const names = keys.get(String(index.Key_name)) ?? [];
      names[Number(index.Seq_in_index) - 1] = String(index.Column_name);
      keys.set(String(index.Key_name), names);
    }
    return [...keys.values()].filter((names) => names.every((name) => this.columns.includes(name)));
  }

  async row(
    row: { rowNumber: number; data: Record<string, unknown> },
    keys: string[][]
  ): Promise<ImportRowReport> {
    const unit =
      this.table === "core_units"
        ? await prepareExistingUnit(this.database, row.data, this.columns)
        : null;
    if (unit?.ambiguous)
      return {
        rowNumber: row.rowNumber,
        status: "warning",
        message:
          "Multiple target units share the normalized name. Review unit identity before importing."
      };
    if (await this.exists(row.data, this.columns, true)) {
      return {
        rowNumber: row.rowNumber,
        status: "existing",
        message: unit?.changed
          ? "Existing unit identity matched. Target label and display order preserved."
          : "All selected values already exist. This row will be skipped."
      };
    }
    for (const names of keys) {
      if (names.some((name) => row.data[name] === null || row.data[name] === undefined)) continue;
      if (await this.exists(row.data, names)) {
        return {
          rowNumber: row.rowNumber,
          status: "conflict",
          message: `Existing unique key (${names.join(", ")}) has different selected values. Kept existing row; skipped import.`
        };
      }
    }
    if (this.table === "core_companies") {
      const [existing] = await this.database.query<RowDataPacket[]>(
        "SELECT id FROM core_companies LIMIT 1"
      );
      if (existing.length)
        return {
          rowNumber: row.rowNumber,
          status: "warning",
          message:
            "Review company identity in Field Mapping. An existing company must not be duplicated."
        };
    }
    return {
      rowNumber: row.rowNumber,
      status: "ready",
      message: keys.length
        ? "No existing row found. Ready to insert."
        : "No selected unique key. No exact selected-value match found; ready to insert."
    };
  }

  async matchingData(data: Record<string, unknown>, keys: string[][]) {
    for (const names of [this.columns, ...keys]) {
      if (
        names !== this.columns &&
        names.some((name) => data[name] === null || data[name] === undefined)
      )
        continue;
      const [rows] = await this.database.query<RowDataPacket[]>(
        `SELECT ${this.columns.map((name) => `\`${name}\``).join(", ")} FROM \`${this.table}\` WHERE ${names.map((name) => `\`${name}\` <=> ?`).join(" AND ")} LIMIT 1`,
        names.map((name) =>
          data[name] !== null && typeof data[name] === "object"
            ? JSON.stringify(data[name])
            : data[name]
        )
      );
      if (rows[0]) return Object.fromEntries(this.columns.map((name) => [name, rows[0]![name]]));
    }
    return null;
  }

  private async exists(data: Record<string, unknown>, names: string[], exact = false) {
    const where = names
      .map((name) =>
        exact && typeof data[name] === "string"
          ? `BINARY \`${name}\` <=> BINARY ?`
          : `\`${name}\` <=> ?`
      )
      .join(" AND ");
    const [rows] = await this.database.query<RowDataPacket[]>(
      `SELECT 1 FROM \`${this.table}\` WHERE ${where} LIMIT 1`,
      names.map((name) =>
        data[name] !== null && typeof data[name] === "object"
          ? JSON.stringify(data[name])
          : data[name]
      )
    );
    return rows.length > 0;
  }
}
