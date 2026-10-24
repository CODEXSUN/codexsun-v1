import { AppError } from "@codexsun/framework/errors";
import { TransferService, type TransferRow } from "../transfer-session/index.js";
import type { CommonTableImportHost } from "../import-review/index.js";
import { BusinessImportRepository } from "./business-import.repository.js";
export class BusinessImportQueries {
  private readonly reports: BusinessImportRepository;
  constructor(private readonly host: CommonTableImportHost) {
    this.reports = new BusinessImportRepository(host.database);
  }
  async rows(
    id: string,
    table: string,
    page: number,
    status: string,
    invoice?: { table: string; sourceId: number }
  ) {
    const run = await this.reports.get(id);
    const entry = run.tables.find((t) => t.table === table);
    if (!entry) throw AppError.validation("Select a table from this report.");
    let invoiceIds: Set<number> | undefined;
    if (invoice) {
      const saved = await this.reports.invoice(id, invoice.table, invoice.sourceId);
      const child = saved.children.find((c) => c.table === table);
      if (table !== saved.table && !child)
        throw AppError.validation("This table is not part of the selected invoice.");
      invoiceIds = new Set(table === saved.table ? [saved.sourceId] : child!.sourceIds);
    }
    const found: TransferRow[] = [];
    let total = 0;
    const start = (page - 1) * 100;
    const transfers = new TransferService(this.host);
    for (const sessionId of entry.sessions) {
      const session = await transfers.get(sessionId);
      for (const saved of session.rows) {
        if (invoiceIds && !invoiceIds.has(saved.sourceId)) continue;
        const issue = entry.verificationIssues.find((i) => i.sourceId === saved.sourceId);
        const row = issue
          ? { ...saved, status: "warning" as const, message: issue.message }
          : saved;
        if (status !== "all" && row.status !== status) continue;
        if (total >= start && found.length < 100) found.push(row);
        total++;
      }
    }
    return { total, rows: found, references: entry.references };
  }
  async warnings(id: string, page: number) {
    const run = await this.reports.get(id);
    const warnings: Array<{
      group: string;
      table: string;
      sourceId: number | null;
      message: string;
    }> = run.issues.map((message) => ({ group: "run", table: "", sourceId: null, message }));
    for (const entry of run.tables) {
      if (
        entry.blocked ||
        entry.sourceChanged ||
        (entry.status === "warning" && !entry.warningIds.length && !entry.verificationIssues.length)
      )
        warnings.push({
          group: entry.group,
          table: entry.table,
          sourceId: null,
          message: entry.message
        });
      const messages = new Map<number, string>();
      const transfers = new TransferService(this.host);
      for (const sessionId of entry.sessions) {
        const session = await transfers.get(sessionId);
        for (const row of session.rows)
          if (row.status === "warning") messages.set(row.sourceId, row.message);
      }
      for (const issue of entry.verificationIssues) messages.set(issue.sourceId, issue.message);
      for (const [sourceId, message] of messages)
        warnings.push({ group: entry.group, table: entry.table, sourceId, message });
    }
    for (const invoice of await this.reports.invoiceWarnings(id))
      warnings.push({
        group: "invoices",
        table: invoice.table_name,
        sourceId: Number(invoice.source_row_id),
        message: invoice.message
      });
    for (const row of run.users?.rows ?? [])
      if (row.status === "warning")
        warnings.push({
          group: "users",
          table: "app_users",
          sourceId: row.sourceId || null,
          message: row.message
        });
    if (run.orphans)
      warnings.push({
        group: "run",
        table: "",
        sourceId: null,
        message: `${run.orphans} broken target relationships require review.`
      });
    return { total: warnings.length, rows: warnings.slice((page - 1) * 100, page * 100) };
  }
}
