import type { Connection, RowDataPacket } from "mysql2/promise";
import { AppError } from "@codexsun/framework/errors";
import { CommonTableRowAudit } from "../import-review/index.js";
import { CommonTableReferences } from "../import-review/index.js";
import { CommonTableImportService } from "../import-review/index.js";
import type { BulkImportReport, BulkTableReport } from "./report.types.js";

const excluded =
  /^(id|uuid|created_by|created_at|updated_at|deleted_at)$|seed_placeholder|password|secret|token|credential|api.?key|private.?key|cookie|authorization/iu;

export class CommonBulkEngine {
  constructor(
    private readonly source: Connection,
    private readonly target: Connection,
    private readonly service: CommonTableImportService
  ) {}

  async table(run: BulkImportReport, entry: BulkTableReport, progress: () => Promise<void>) {
    entry.status = "running";
    await progress();
    try {
      if (entry.importId) {
        const saved = await this.service.getImport(entry.importId);
        if (saved.status === "imported") {
          entry.inserted = saved.importedRows;
          for (const row of entry.rows ?? []) {
            if (row.status !== "pending") continue;
            row.status = "warning";
            row.message =
              "Import completed before worker recovery; target snapshot was not captured. Verify this row.";
            entry.attention.push({ rowId: row.rowId, message: row.message });
          }
          entry.status = entry.attention.length ? "warning" : "success";
          entry.message = "Recovered the saved import result.";
          return;
        }
      }
      const [sourceColumns] = await this.source.query<RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${entry.table}\``
      );
      const [targetColumns] = await this.target.query<RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${entry.table}\``
      );
      const columns = targetColumns
        .map((column) => String(column.Field))
        .filter(
          (field) => !excluded.test(field) && sourceColumns.some((column) => column.Field === field)
        );
      if (!sourceColumns.some((column) => column.Field === "id" && column.Key === "PRI"))
        throw new Error("Source table requires a primary ID column.");
      if (!columns.length) throw new Error("There are no shared business fields.");
      const [rows] = await this.source.query<RowDataPacket[]>(
        `SELECT * FROM \`${entry.table}\` ORDER BY id LIMIT 10001`
      );
      entry.sourceRows = rows.length;
      if (rows.length > 10000)
        throw new Error(
          "More than 10,000 source rows; use a bounded import review for this table."
        );
      const audit = new CommonTableRowAudit(this.target, entry.table, columns);
      const keys = await audit.uniqueKeys();
      const references = new CommonTableReferences(this.source, this.target);
      const selected: number[] = [];
      entry.rows = [];
      entry.existing = 0;
      entry.attention = [];
      for (const row of rows) {
        const snapshot: NonNullable<BulkTableReport["rows"]>[number] = {
          rowId: Number(row.id),
          status: "pending",
          message: "Awaiting import.",
          source: Object.fromEntries(columns.map((name) => [name, row[name]])),
          target: null
        };
        entry.rows.push(snapshot);
        try {
          const prepared = await references.prepare(
            entry.table,
            Object.fromEntries(columns.map((name) => [name, row[name]]))
          );
          const data = prepared.data;
          snapshot.collection = prepared.collection;
          snapshot.prepared = data;
          const checked = await audit.row({ rowNumber: Number(row.id), data }, keys);
          snapshot.message = checked.message;
          snapshot.status =
            checked.status === "ready"
              ? "pending"
              : checked.status === "existing"
                ? "existing"
                : "warning";
          snapshot.target = await audit.matchingData(data, keys);
          if (checked.status === "ready") selected.push(Number(row.id));
          else {
            if (checked.status === "existing") entry.existing++;
            if (checked.status === "conflict")
              entry.attention.push({ rowId: Number(row.id), message: checked.message });
          }
        } catch (error) {
          snapshot.status = "warning";
          snapshot.message = safeMessage(error);
          entry.attention.push({ rowId: Number(row.id), message: snapshot.message });
        }
      }
      if (selected.length) {
        const saved = await this.service.save({
          sourceId: run.sourceId,
          targetTenantId: run.targetTenantId,
          table: entry.table,
          rowIds: selected,
          columns,
          actor: run.actor
        });
        entry.importId = saved.id;
        await progress();
        await this.service.auditSaved(saved.id, run.actor);
        const result = await this.service.importSaved(saved.id, run.actor);
        entry.inserted = result.imported;

        const detail = await this.service.getImport(saved.id);
        entry.existing +=
          detail.report?.rows.filter((row) => row.status === "existing").length ?? 0;
        for (const row of detail.report?.rows ?? []) {
          if (["conflict", "warning", "rolled_back"].includes(row.status))
            entry.attention.push({
              rowId: selected[row.rowNumber - 1] ?? null,
              message: row.message
            });
        }
        for (const outcome of detail.report?.rows ?? []) {
          const snapshot = entry.rows.find((row) => row.rowId === selected[outcome.rowNumber - 1]);
          if (!snapshot) continue;
          snapshot.status =
            outcome.status === "inserted"
              ? "imported"
              : outcome.status === "existing"
                ? "existing"
                : "warning";
          snapshot.message = outcome.message;
          const data = await references.translate(entry.table, snapshot.source);
          snapshot.target = await audit.matchingData(data, keys);
        }
        // Check the values in the target after commit, rather than relying on insert counts.
        for (let page = 1; page <= Math.ceil(detail.rowCount / 100); page++) {
          for (const row of await this.service.getImportRows(saved.id, page)) {
            if ((await audit.row(row, keys)).status !== "existing") {
              const snapshot = entry.rows.find(
                (item) => item.rowId === selected[row.rowNumber - 1]
              );
              if (snapshot) {
                snapshot.status = "warning";
                snapshot.message = "Target values differ after import. Review this record.";
              }
              entry.attention.push({
                rowId: selected[row.rowNumber - 1] ?? null,
                message: "Target values differ after import. Review this record."
              });
            }
          }
        }
      }
      entry.status = entry.attention.length ? "warning" : "success";
      entry.message = entry.inserted
        ? `${entry.inserted} missing rows imported.`
        : "No missing rows to import.";
    } catch (error) {
      for (const row of entry.rows ?? []) {
        if (row.status === "pending") {
          row.status = "warning";
          row.message = safeMessage(error);
        }
      }
      entry.status = "warning";
      entry.message = safeMessage(error);
      entry.attention.push({ rowId: null, message: entry.message });
    } finally {
      await progress();
    }
  }
}

function safeMessage(error: unknown) {
  if (error instanceof AppError) return error.message;
  // Driver messages can include row values; keep them out of the combined report.
  if (error && typeof error === "object" && "code" in error)
    return `Database validation failed (${String(error.code)}). Review this table.`;
  return error instanceof Error ? error.message : "Table import could not complete.";
}
