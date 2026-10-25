import type { Connection, RowDataPacket } from "mysql2/promise";
import type { LegacyMapping } from "./legacy-cxapp.types.js";
import { legacyCsv } from "./legacy-cxapp.report.js";

export async function legacySchemaManifest(target: Connection, mappings: LegacyMapping[]) {
  const [columns] = await target.query<RowDataPacket[]>(
    `SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,ORDINAL_POSITION
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION`
  );
  const [relations] = await target.query<RowDataPacket[]>(
    `SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  return mappings.map((mapping) => ({
    ...mapping,
    fields: columns
      .filter((c) => c.TABLE_NAME === mapping.targetTable)
      .map((column) => {
        const relation = relations.find(
          (r) => r.TABLE_NAME === column.TABLE_NAME && r.COLUMN_NAME === column.COLUMN_NAME
        );
        const generated =
          String(column.EXTRA).includes("auto_increment") ||
          ["id", "uuid", "created_at", "updated_at"].includes(column.COLUMN_NAME);
        const required =
          column.IS_NULLABLE === "NO" && column.COLUMN_DEFAULT === null && !generated;
        const audit =
          /_by$/.test(column.COLUMN_NAME) || /seed_placeholder/.test(column.COLUMN_NAME);
        return {
          column: String(column.COLUMN_NAME),
          type: String(column.COLUMN_TYPE),
          required,
          parent: relation
            ? `${relation.REFERENCED_TABLE_NAME}.${relation.REFERENCED_COLUMN_NAME}`
            : null,
          rule:
            mapping.columns[column.COLUMN_NAME] ??
            (generated
              ? "target-owned generated identity/time"
              : audit
                ? "target-owned audit/seed metadata"
                : column.COLUMN_DEFAULT !== null
                  ? "owner SQL default"
                  : column.IS_NULLABLE === "YES"
                    ? "optional, omitted unless reviewed"
                    : "UNMAPPED REQUIRED")
        };
      })
  }));
}

export function legacySchemaCsv(manifest: Awaited<ReturnType<typeof legacySchemaManifest>>) {
  const headers = [
    "Stage",
    "Source table",
    "Source key",
    "Target table",
    "Target field",
    "Type",
    "Required",
    "Target parent",
    "Mapping rule"
  ];
  const rows = manifest.flatMap((table) =>
    table.fields.map((field) => [
      table.phase,
      table.sourceTable,
      table.sourceKey,
      table.targetTable,
      field.column,
      field.type,
      field.required,
      field.parent,
      field.rule
    ])
  );
  return {
    fields: legacyCsv(headers, rows),
    references: legacyCsv(
      headers,
      rows.filter((row) => row[7])
    )
  };
}
