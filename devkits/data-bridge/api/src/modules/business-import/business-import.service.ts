import { randomUUID } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import { DatabaseImportLock, DatabaseConnectionService } from "../database-connection/index.js";
import { withConnections, type CommonTableImportHost } from "../import-review/index.js";
import { BusinessImportRepository } from "./business-import.repository.js";
import { BusinessImportPlan } from "./business-import.plan.js";
import { BusinessImportEngine } from "./business-import.engine.js";
import { BusinessInvoiceAudit } from "./business-import.invoices.js";
import { BusinessIntegrity } from "./business-import.integrity.js";
import {
  businessSummary,
  type BusinessRun,
  type BusinessProgress
} from "./business-import.types.js";
export class BusinessImportService {
  private readonly reports: BusinessImportRepository;
  private readonly locks: DatabaseImportLock;
  constructor(private readonly host: CommonTableImportHost) {
    this.reports = new BusinessImportRepository(host.database);
    this.locks = new DatabaseImportLock(host.database);
  }
  async get(id: string) {
    return businessSummary(await this.reports.get(id));
  }
  async latest(sourceId: number, targetTenantId: number) {
    const run = await this.reports.latest(sourceId, targetTenantId);
    return run ? businessSummary(run) : null;
  }
  async start(sourceId: number, targetTenantId: number, actor: string, correlationId: string) {
    if (!this.host.enqueueBusiness)
      throw AppError.validation("Enable the business import worker before starting.");
    return this.locks.withImportLock(`business-start:${targetTenantId}`, async () => {
      const active = await this.reports.active(targetTenantId);
      if (active) {
        if (active.sourceId !== sourceId)
          throw AppError.validation(
            "Another source is importing into this target. Finish that run first."
          );
        return businessSummary(active);
      }
      const pair = await new DatabaseConnectionService(this.host).verify(sourceId, targetTenantId);
      const source = await this.host.dataMigration.resolveSource(sourceId),
        target = await this.host.resolveTenant(targetTenantId);
      const local = (host: string) =>
        ["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase())
          ? "local"
          : host.toLowerCase();
      if (
        source.database === target.database &&
        source.port === target.port &&
        local(source.host) === local(target.host)
      )
        throw AppError.validation("Choose different source and target databases.");
      const at = new Date().toISOString();
      const run: BusinessRun = {
        id: randomUUID(),
        sourceId,
        targetTenantId,
        sourceDatabase: pair.sourceDatabase,
        targetDatabase: pair.targetDatabase,
        actor,
        status: "queued",
        phase: "common",
        at,
        updatedAt: at,
        message: "Queued: Common → Masters → Billing, followed by invoice verification.",
        issues: [],
        tables: [],
        invoiceCount: 0,
        invoiceMatched: 0,
        invoiceWarnings: 0,
        relationships: 0,
        orphans: 0
      };
      await this.reports.create(run);
      try {
        await this.host.enqueueBusiness!({ runId: run.id, targetTenantId, actor, correlationId });
      } catch (error) {
        run.status = "failed";
        run.message = "The import could not be queued. No records were imported.";
        await this.reports.save(run);
        throw error;
      }
      return businessSummary(run);
    });
  }
  async run(id: string, targetTenantId: number, onProgress: BusinessProgress = async () => {}) {
    return this.locks.withImportLock(`business-run:${targetTenantId}`, async () => {
      const run = await this.reports.get(id);
      if (run.targetTenantId !== targetTenantId)
        throw AppError.forbidden("Business import target does not match its job.");
      if (["success", "warning"].includes(run.status)) return businessSummary(run);
      if (
        run.status !== "queued" &&
        !run.issues.includes(
          "Recovered interrupted work. Existing rows were re-audited; recovered writes may be counted as existing."
        )
      )
        run.issues.push(
          "Recovered interrupted work. Existing rows were re-audited; recovered writes may be counted as existing."
        );
      const progress = async () => {
        await this.reports.save(run);
        await onProgress({
          runId: run.id,
          status: run.status,
          phase: run.phase,
          tables: run.tables.filter((t) => !["pending", "running"].includes(t.status)).length,
          totalTables: run.tables.length,
          inserted: run.tables.reduce((n, t) => n + t.imported, 0),
          warnings: run.tables.reduce((n, t) => n + t.warnings, 0) + (run.users?.warnings ?? 0),
          updated: run.tables.reduce((n, t) => n + (t.updated ?? 0), 0),
          invoices: run.invoiceCount
        });
      };
      try {
        const source = await this.host.dataMigration.resolveSource(run.sourceId),
          target = await this.host.resolveTenant(run.targetTenantId);
        if (source.database !== run.sourceDatabase || target.database !== run.targetDatabase)
          throw AppError.validation("Connection routing changed. Start a fresh run.");
        run.status = "running";
        await progress();
        if (!run.tables.length) {
          run.tables = await new BusinessImportPlan(this.host).build(run);
          if (run.tables.every((t) => t.status === "skipped"))
            run.issues.push("No supported business tables were available in this connection pair.");
          await progress();
        }
        await withConnections(source, target, async (from, to) => {
          const engine = new BusinessImportEngine(this.host, from, to);
          for (const group of ["common", "masters", "billing"] as const) {
            run.phase = group;
            run.message = `Auditing and importing ${group} tables in parent order.`;
            await progress();
            for (const entry of run.tables.filter(
              (t) => t.group === group && ["pending", "running"].includes(t.status)
            ))
              await engine.table(run, entry, progress);
          }
          run.phase = "invoices";
          run.message =
            "Verifying saved business data, invoice children, and target relationships.";
          await progress();
          await new BusinessIntegrity(this.host, from, to).verify(run, progress);
          await new BusinessInvoiceAudit(from, to, this.reports, run).verify(progress);
        });
        if (this.host.copyUsers && !run.users) {
          run.phase = "users";
          run.message =
            "Copying missing tenant users with preserved credentials and target User-role access.";
          await progress();
          const companyContext = ["core_companies", "core_default_company_settings"].every(
            (table) => {
              const entry = run.tables.find((item) => item.table === table);
              return (
                entry &&
                entry.sourceRows > 0 &&
                entry.status === "success" &&
                entry.verified &&
                !entry.blocked
              );
            }
          );
          run.users = companyContext
            ? await this.host.copyUsers({
                sourceId: run.sourceId,
                targetTenantId: run.targetTenantId,
                actor: run.actor
              })
            : {
                imported: 0,
                existing: 0,
                warnings: 1,
                rows: [
                  {
                    sourceId: 0,
                    targetId: null,
                    email: "",
                    status: "warning",
                    message:
                      "Resolve and verify company/default-company mapping before copying user accounts. No users were copied."
                  }
                ]
              };
          await progress();
        }
        run.phase = "complete";
        run.status =
          run.tables.some((t) => t.status === "warning") ||
          run.invoiceWarnings ||
          run.orphans ||
          run.users?.warnings ||
          run.issues.length
            ? "warning"
            : "success";
        run.message =
          run.status === "success"
            ? "All available business data and full invoices verified successfully."
            : "Completed with preserved differences or records requiring attention. Review the Warnings and Invoices tabs.";
        await progress();
        return businessSummary(run);
      } catch (error) {
        run.status = "failed";
        run.message =
          error instanceof Error && !("code" in error)
            ? error.message
            : "Import interrupted. Review the connection and queue retry.";
        await progress();
        throw error;
      }
    });
  }
}
