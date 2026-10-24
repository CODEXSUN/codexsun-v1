import type { Connection, RowDataPacket } from "mysql2/promise";
import { TransferService, TransferDatabase, identifier } from "../transfer-session/index.js";
import type { CommonTableImportHost } from "../import-review/index.js";
import type { BusinessRun, BusinessTable } from "./business-import.types.js";
export class BusinessImportEngine {
  constructor(
    private readonly host: CommonTableImportHost,
    private readonly source: Connection,
    private readonly target: Connection
  ) {}
  async table(run: BusinessRun, entry: BusinessTable, progress: () => Promise<void>) {
    const service = new TransferService(this.host);
    entry.status = "running";
    await progress();
    try {
      while (true) {
        let session = entry.activeSession ? await service.get(entry.activeSession) : null;
        if (!session) {
          const [rows] = await this.source.query<RowDataPacket[]>(
            `SELECT id FROM ${identifier(entry.sourceTable)} WHERE id>? AND id<=? ORDER BY id LIMIT 500`,
            [entry.cursor, entry.upperId]
          );
          if (!rows.length) break;
          session = await service.create(run.sourceId, run.targetTenantId, run.actor, {
            group: entry.group,
            businessRunId: run.id,
            targetTables: run.tables.filter((t) => t.group === entry.group).map((t) => t.table)
          });
          entry.activeSession = session.id;
          entry.sessions.push(session.id);
          await progress();
        }
        if (session.stage === 2)
          session = await service.mapTables(
            session.id,
            session.revision,
            entry.sourceTable,
            entry.table,
            run.actor
          );
        if (session.stage === 3)
          session = await service.mapFields(session.id, session.revision, entry.fields, run.actor);
        if (session.stage === 4) {
          const [rows] = await this.source.query<RowDataPacket[]>(
            `SELECT ${[...new Set(["id", ...entry.references.map((r) => r.sourceField)])].map(identifier).join(",")} FROM ${identifier(entry.sourceTable)} WHERE id>? AND id<=? ORDER BY id LIMIT 500`,
            [entry.cursor, entry.upperId]
          );
          if (!rows.length)
            throw new Error("Selected source records changed during recovery. Run a fresh audit.");
          const blocked = await this.blockedParents(run, entry, rows);
          session = await service.prepare(
            session.id,
            session.revision,
            rows.map((r) => Number(r.id)),
            run.actor,
            {
              parents: run.tables.map((t) => ({
                sourceTable: t.sourceTable,
                targetTable: t.table,
                fields: t.fields
              })),
              blocked
            }
          );
        }
        session = await service.executePrepared(
          session.id,
          session.revision,
          run.targetTenantId,
          run.actor
        );
        for (const row of session.rows) {
          if (row.status === "imported") {
            if (row.reuse) entry.updated = (entry.updated ?? 0) + 1;
            else entry.imported++;
          }
          if (row.status === "existing") entry.existing++;
          if (row.status === "warning") entry.warningIds.push(row.sourceId);
        }
        entry.warnings = new Set(entry.warningIds).size;
        if (session.status !== "completed") {
          entry.blocked = true;
          throw new Error(session.message);
        }
        entry.cursor = Math.max(...session.rows.map((r) => r.sourceId));
        entry.activeSession = null;
        await progress();
      }
      entry.status = entry.warnings ? "warning" : "success";
      entry.message = entry.updated
        ? "Verified seed records updated in place. Other existing rows preserved."
        : entry.sourceRows
          ? "Available source records audited. Existing rows preserved."
          : "No source records.";
    } catch (error) {
      entry.status = "warning";
      entry.blocked = true;
      entry.warnings = Math.max(entry.warnings, 1);
      entry.message =
        error instanceof Error && !("code" in error)
          ? error.message
          : "Table import failed. Review the mapping and retry.";
    }
    await progress();
  }
  private async blockedParents(run: BusinessRun, entry: BusinessTable, rows: RowDataPacket[]) {
    const schema = await new TransferDatabase(this.source, this.target).schema(
      entry.sourceTable,
      entry.table
    );
    const blocked = new Map<number, string>();
    for (const field of entry.fields.filter((f) => f.mode === "source")) {
      const parentName = schema.target.find((c) => c.name === field.target)?.parent;
      const parent = run.tables.find((t) => t.table === parentName);
      if (!parent) continue;
      for (const row of rows)
        if (
          row[field.source!] !== null &&
          (parent.blocked || parent.warningIds.includes(Number(row[field.source!])))
        )
          blocked.set(
            Number(row.id),
            `Referenced ${parent.table} record needs review. New dependent records were not inserted.`
          );
    }
    return blocked;
  }
}
