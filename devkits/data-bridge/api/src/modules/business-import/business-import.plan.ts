import type { RowDataPacket } from "mysql2/promise";
import {
  TransferDatabase,
  identifier,
  type TransferField,
  type TransferColumn
} from "../transfer-session/index.js";
import { CommonTablesService } from "../common-tables/index.js";
import { MasterTablesService } from "../master-tables/index.js";
import { BillingTablesService } from "../billing-tables/index.js";
import { TransferService, companyBrandingFields } from "../transfer-session/index.js";
import { withConnections, type CommonTableImportHost } from "../import-review/index.js";
import { sourceFingerprint } from "./business-import.values.js";
import type { BusinessRun, BusinessTable, BusinessGroup } from "./business-import.types.js";
export function defaultBusinessFields(
  source: TransferColumn[],
  target: TransferColumn[]
): TransferField[] {
  return target.map((column) => {
    let mode: TransferField["mode"] = "default";
    if (column.name === "uuid" && column.required) mode = "uuid";
    else if (
      column.generated ||
      ["id", "uuid", "created_at", "updated_at"].includes(column.name) ||
      /_by$/u.test(column.name)
    )
      mode = "default";
    else if (source.some((field) => field.name === column.name)) mode = "source";
    return {
      target: column.name,
      source: mode === "source" ? column.name : null,
      mode,
      value: null
    };
  });
}
export class BusinessImportPlan {
  constructor(private readonly host: CommonTableImportHost) {}
  async build(run: BusinessRun) {
    const catalogs = [
      await new CommonTablesService(this.host).catalog(run.sourceId, run.targetTenantId),
      await new MasterTablesService(this.host).catalog(run.sourceId, run.targetTenantId),
      await new BillingTablesService(this.host).catalog(run.sourceId, run.targetTenantId)
    ];
    const saved = (await new TransferService(this.host).list()).filter(
      (s) =>
        s.sourceId === run.sourceId &&
        s.targetTenantId === run.targetTenantId &&
        s.fields.length &&
        s.stage >= 4
    );
    const source = await this.host.dataMigration.resolveSource(run.sourceId),
      target = await this.host.resolveTenant(run.targetTenantId);
    return withConnections(source, target, async (from, to) => {
      const database = new TransferDatabase(from, to);
      const tables = await database.tables();
      const entries: BusinessTable[] = [];
      for (const [index, catalog] of catalogs.entries())
        for (const table of catalog) {
          const group = (["common", "masters", "billing"] as const)[index] as BusinessGroup;
          const mapping = saved.find(
            (s) => s.targetTable === table.table && tables.source.includes(s.sourceTable)
          );
          const sourceTable = mapping?.sourceTable ?? table.table;
          const entry: BusinessTable = {
            table: table.table,
            sourceTable,
            group,
            status: "pending",
            sourceRows: table.sourceRows ?? 0,
            targetRows: table.targetRows ?? 0,
            imported: 0,
            existing: 0,
            warnings: 0,
            cursor: 0,
            upperId: 0,
            sessions: [],
            activeSession: null,
            warningIds: [],
            blocked: false,
            message: "",
            references: [],
            fields: [],
            schemaHash: "",
            sourceHash: "",
            verified: false,
            sourceChanged: false,
            verificationIssues: []
          };
          entries.push(entry);
          const originExists = tables.source.includes(sourceTable),
            targetExists = tables.target.includes(table.table);
          if (!originExists && !targetExists) {
            entry.status = "skipped";
            entry.message = "Not installed in either database.";
            continue;
          }
          if (!originExists || !targetExists) {
            entry.status = "warning";
            entry.warnings = 1;
            entry.blocked = true;
            entry.message = !originExists
              ? "Source table is unavailable. Save an explicit table mapping first."
              : "Target table is unavailable. Apply its owner migrations first.";
            continue;
          }
          try {
            const schema = await database.schema(sourceTable, table.table);
            entry.fields = companyBrandingFields(
              table.table,
              defaultBusinessFields(schema.source, schema.target).map((field) => {
                const previous = mapping?.fields.find((f) => f.target === field.target);
                return previous &&
                  !schema.target.find((c) => c.name === field.target)?.generated &&
                  !["id", "uuid", "created_at", "updated_at"].includes(field.target) &&
                  !/_by$/u.test(field.target) &&
                  !["now", "uuid"].includes(previous.mode)
                  ? previous
                  : field;
              }),
              Boolean(this.host.copyCompanyBranding)
            );

            if (
              mapping?.fields.some(
                (f) =>
                  !["source", "default"].includes(f.mode) &&
                  !["id", "uuid", "created_at", "updated_at"].includes(f.target) &&
                  !/_by$/u.test(f.target)
              )
            )
              throw new Error(
                "Saved mapping uses custom business values. Review this table individually before automatic import."
              );
            entry.references = entry.fields.flatMap((f) => {
              const parent = schema.target.find((c) => c.name === f.target)?.parent;
              return f.mode === "source" && f.source && parent
                ? [{ sourceField: f.source, targetField: f.target, parentTable: parent }]
                : [];
            });
            const [counts] = await from.query<RowDataPacket[]>(
              `SELECT COUNT(*) total,COALESCE(MAX(id),0) upper_id FROM ${identifier(sourceTable)}`
            );
            entry.sourceRows = Number(counts[0]!.total);
            entry.upperId = Number(counts[0]!.upper_id);
            if (!Number.isSafeInteger(entry.upperId))
              throw new Error("Source keys exceed the supported integer range.");
            entry.schemaHash = entry.sourceRows
              ? (await database.verify(sourceTable, table.table, entry.fields)).hash
              : schema.hash;
            entry.sourceHash = (await sourceFingerprint(from, entry)).hash;
          } catch (error) {
            entry.status = "warning";
            entry.warnings = 1;
            entry.blocked = true;
            entry.message =
              error instanceof Error && !("code" in error)
                ? error.message
                : "Schema inspection failed. Review the table mapping.";
          }
        }
      return entries;
    });
  }
}
