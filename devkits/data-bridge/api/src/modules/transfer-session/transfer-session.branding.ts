import type { CommonTableImportHost } from "../import-review/index.js";
import type { TransferDatabase } from "./transfer-session.database.js";
import { identifier } from "./transfer-session.database.js";
import type { TransferField, TransferSession } from "./transfer-session.types.js";
import type { RowDataPacket } from "mysql2/promise";

const brandingFields = ["logo_path", "logo_dark_path", "favicon_path"];

export function companyBrandingFields(table: string, fields: TransferField[], enabled: boolean) {
  return fields.map((field) =>
    enabled && table === "core_companies" && brandingFields.includes(field.target)
      ? { ...field, mode: "default" as const, value: null }
      : field
  );
}

export async function transferCompanyBranding(
  host: Pick<CommonTableImportHost, "copyCompanyBranding">,
  session: TransferSession,
  database: TransferDatabase
) {
  if (!host.copyCompanyBranding || session.targetTable !== "core_companies") return;
  const sourceColumns = await database.columns(database.source, session.sourceTable);
  const mappings = brandingFields
    .map((target) => ({
      target,
      source: session.fields.find((field) => field.target === target)?.source ?? target
    }))
    .filter((field) => sourceColumns.some((column) => column.name === field.source));
  if (!mappings.length) return;
  for (const row of session.rows) {
    if (row.status === "warning") continue;
    try {
      const targetId = Number(row.target?.id ?? row.reuse?.targetId);
      if (!Number.isSafeInteger(targetId) || targetId <= 0)
        throw new Error("Mapped target company identity is unavailable.");
      const [records] = await database.source.query<RowDataPacket[]>(
        `SELECT ${[...new Set(mappings.map((field) => field.source))].map(identifier).join(",")} FROM ${identifier(session.sourceTable)} WHERE id=?`,
        [row.sourceId]
      );
      if (!records[0]) throw new Error("Source company is no longer available.");
      const paths = Object.fromEntries(
        mappings
          .filter((field) => records[0]![field.source])
          .map((field) => [field.target, String(records[0]![field.source])])
      );
      row.branding = await host.copyCompanyBranding({
        sourceId: session.sourceId,
        sourceDatabase: session.sourceDatabase,
        targetTenantId: session.targetTenantId,
        sourceCompanyId: row.sourceId,
        targetCompanyId: targetId,
        paths,
        actor: session.actor
      });
    } catch {
      row.branding = {
        copied: 0,
        existing: 0,
        warnings: [
          "Company branding could not be copied. Business data remains committed; review source media configuration."
        ]
      };
    }
    row.message += ` Logos: ${row.branding.copied} copied, ${row.branding.existing} existing, ${row.branding.warnings.length} warnings.`;
  }
}
