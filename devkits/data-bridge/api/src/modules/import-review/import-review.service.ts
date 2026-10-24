import { CompanySeedReuse } from "../master-tables/index.js";
import { createHash, randomUUID } from "node:crypto";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { AppError } from "@codexsun/framework/errors";
import { CommonTableImportRepository } from "./import-review.repository.js";
import { CommonTableRowAudit } from "./import-review.audit.js";
import { CommonTableReferences } from "./import-review.references.js";
import type { ImportReport, ImportRowReport } from "./import-review.types.js";
import {
  commonTableNames,
  coreMasterTableNames,
  type CommonTableImportHost,
  type CommonTableName,
  type CommonTableOption
} from "./import-review.types.js";

const pageLimit = 100;
const importLimit = 10_000;
const sensitiveKey =
  /seed_placeholder|password|secret|token|credential|api.?key|private.?key|cookie|authorization/iu;

type DbColumn = { name: string; type: string; required: boolean; primary: boolean };

export class CommonTableImportService {
  private readonly imports: CommonTableImportRepository;

  constructor(private readonly host: CommonTableImportHost) {
    this.imports = new CommonTableImportRepository(host.database);
  }

  listSources() {
    return this.host.dataMigration.listSources();
  }

  listTenants() {
    return this.host.listTenants();
  }

  listImports() {
    return this.imports.list();
  }

  getImport(id: string) {
    return this.imports.get(id);
  }

  getImportRows(id: string, page: number) {
    return this.imports.pageRows(id, page, pageLimit);
  }

  async listTables(
    sourceId: number,
    targetTenantId: number,
    scope: "common" | "masters" = "common"
  ) {
    const [source, target, saved] = await Promise.all([
      this.host.dataMigration.resolveSource(sourceId),
      this.host.resolveTenant(targetTenantId),
      this.imports.list()
    ]);
    const savedByTable = new Map(
      saved
        .filter((item) => item.sourceId === sourceId && item.targetTenantId === targetTenantId)
        .map((item) => [item.table, item])
    );
    return this.withDatabases(source, target, async (sourceDb, targetDb) => {
      const [sourceTables, targetTables] = await Promise.all([
        this.existingTables(sourceDb, source.database),
        this.existingTables(targetDb, target.database)
      ]);
      const result: CommonTableOption[] = [];
      for (const table of scope === "masters" ? coreMasterTableNames : commonTableNames) {
        const sourceAvailable = sourceTables.has(table);
        const targetAvailable = targetTables.has(table);
        const [sourceColumns, targetColumns, sourceCount, targetCount] = await Promise.all([
          sourceAvailable ? this.columns(sourceDb, table) : Promise.resolve([]),
          targetAvailable ? this.columns(targetDb, table) : Promise.resolve([]),
          sourceAvailable ? this.count(sourceDb, table) : Promise.resolve(null),
          targetAvailable ? this.count(targetDb, table) : Promise.resolve(null)
        ]);
        const sourceByName = new Map(sourceColumns.map((column) => [column.name, column]));
        const shared = targetColumns.filter((column) => sourceByName.has(column.name));
        const missingTargetColumns = targetColumns
          .filter((column) => !sourceByName.has(column.name))
          .map((column) => column.name);
        const missingRequiredColumns = targetColumns
          .filter((column) => column.required && !sourceByName.has(column.name))
          .map((column) => column.name);
        const mismatchedColumns = shared
          .filter((column) => sourceByName.get(column.name)?.type !== column.type)
          .map((column) => column.name);
        const compatible =
          sourceAvailable &&
          targetAvailable &&
          missingRequiredColumns.length === 0 &&
          mismatchedColumns.length === 0;
        result.push({
          table,
          sourceRows: sourceCount,
          targetRows: targetCount,
          sourceAvailable,
          targetAvailable,
          sourceColumns: sourceColumns.map((column) => column.name),
          targetColumns: targetColumns.map((column) => column.name),
          missingTargetColumns,
          missingRequiredColumns,
          mismatchedColumns,
          compatible,
          importStatus: savedByTable.get(table)?.status ?? null
        });
      }
      return result;
    });
  }

  async preview(input: {
    sourceId: number;
    targetTenantId: number;
    table: CommonTableName;
    page: number;
  }) {
    const [source, target] = await Promise.all([
      this.host.dataMigration.resolveSource(input.sourceId),
      this.host.resolveTenant(input.targetTenantId)
    ]);
    return this.withDatabases(source, target, async (sourceDb, targetDb) => {
      const [sourceColumns, targetColumns, sourceRows, targetRows, sourceCount, targetCount] =
        await Promise.all([
          this.columns(sourceDb, input.table),
          this.columns(targetDb, input.table),
          this.rows(sourceDb, input.table, input.page, pageLimit),
          this.rows(targetDb, input.table, input.page, pageLimit),
          this.count(sourceDb, input.table),
          this.count(targetDb, input.table)
        ]);
      const sourceNames = new Set(sourceColumns.map((column) => column.name));
      const missingRequiredColumns = targetColumns
        .filter((column) => column.required && !sourceNames.has(column.name))
        .map((column) => column.name);
      const columns = targetColumns
        .filter((column) => sourceNames.has(column.name))
        .map((column) => column.name);
      const hash = this.schemaHash(sourceColumns, targetColumns, columns);
      return {
        sourceRows: sourceCount,
        targetRows: targetCount,
        page: input.page,
        pageSize: pageLimit,
        columns,
        missingRequiredColumns,
        compatible:
          missingRequiredColumns.length === 0 &&
          columns.every(
            (name) =>
              sourceColumns.find((column) => column.name === name)?.type ===
              targetColumns.find((column) => column.name === name)?.type
          ),
        source: sourceRows.map((row) => this.redact(row, columns)),
        target: targetRows.map((row) => this.redact(row, columns)),
        schemaHash: hash
      };
    });
  }

  async save(input: {
    sourceId: number;
    targetTenantId: number;
    table: CommonTableName;
    actor: string;
    rowIds: number[];
    columns: string[];
  }) {
    const rowIds = [...new Set(input.rowIds)];
    if (
      !rowIds.length ||
      rowIds.length > importLimit ||
      rowIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    ) {
      throw AppError.validation("Select between 1 and 10,000 source rows using their IDs.");
    }
    const [source, target] = await Promise.all([
      this.host.dataMigration.resolveSource(input.sourceId),
      this.host.resolveTenant(input.targetTenantId)
    ]);
    return this.withDatabases(source, target, async (sourceDb, targetDb) => {
      const [sourceColumns, targetColumns] = await Promise.all([
        this.columns(sourceDb, input.table),
        this.columns(targetDb, input.table)
      ]);
      const sourceByName = new Map(sourceColumns.map((column) => [column.name, column]));
      if (!sourceColumns.some((column) => column.name === "id" && column.primary)) {
        throw AppError.validation("Selecting source rows requires a primary ID column.");
      }
      const columns = [...new Set(input.columns)];
      if (
        !columns.length ||
        columns.some(
          (name) =>
            !sourceByName.has(name) ||
            !targetColumns.some((column) => column.name === name) ||
            sensitiveKey.test(name)
        )
      ) {
        throw AppError.validation("Choose shared, non-sensitive columns from the Columns menu.");
      }
      const missingRequired = targetColumns
        .filter((column) => column.required && !columns.includes(column.name))
        .map((column) => column.name);
      if (missingRequired.length) {
        throw AppError.validation(`Select required target columns: ${missingRequired.join(", ")}.`);
      }
      const typeMismatch = columns.filter(
        (name) =>
          sourceByName.get(name)?.type !==
          targetColumns.find((column) => column.name === name)?.type
      );
      if (typeMismatch.length) {
        throw AppError.validation(`Field types differ for: ${typeMismatch.join(", ")}.`);
      }
      const schemaHash = this.schemaHash(sourceColumns, targetColumns, columns);
      const primaryKey = sourceColumns
        .filter((column) => column.primary)
        .map((column) => column.name);
      const ordering = sourceByName.has("id")
        ? ["id"]
        : primaryKey.length
          ? primaryKey
          : sourceColumns[0]
            ? [sourceColumns[0].name]
            : [];
      if (!columns.length || !ordering.length) {
        throw AppError.validation("This table has no matching fields to import.");
      }
      const selectColumns = columns.map(quoteIdentifier).join(", ");
      const orderBy = ordering.map(quoteIdentifier).join(", ");
      const [result] = await sourceDb.query<RowDataPacket[]>(
        `SELECT ${selectColumns} FROM ${quoteIdentifier(input.table)} WHERE \`id\` IN (${rowIds.map(() => "?").join(", ")}) ORDER BY ${orderBy}`,
        rowIds
      );
      if (result.length !== rowIds.length) {
        throw AppError.validation(
          "Some selected source rows no longer exist. Refresh and select them again."
        );
      }
      const references = new CommonTableReferences(sourceDb, targetDb);
      const rows = [];
      for (const [index, data] of result.entries()) {
        rows.push({ rowNumber: index + 1, data: await references.translate(input.table, data) });
      }
      return this.imports.save({
        uuid: randomUUID(),
        sourceId: input.sourceId,
        targetTenantId: input.targetTenantId,
        table: input.table,
        sourceDatabase: source.database,
        targetDatabase: target.database,
        columns,
        schemaHash,
        rows,
        actor: input.actor
      });
    });
  }

  async auditSaved(id: string, actor: string) {
    return this.imports.withImportLock(id, () => this.auditSelectedRows(id, actor));
  }

  private async auditSelectedRows(id: string, actor: string) {
    const saved = await this.imports.get(id);
    if (saved.status !== "reviewed")
      throw AppError.validation("Only a saved review can be audited.");
    const [source, target] = await Promise.all([
      this.host.dataMigration.resolveSource(saved.sourceId),
      this.host.resolveTenant(saved.targetTenantId)
    ]);
    const report = await this.withDatabases(source, target, async (sourceDb, targetDb) => {
      const [sourceColumns, targetColumns] = await Promise.all([
        this.columns(sourceDb, saved.table),
        this.columns(targetDb, saved.table)
      ]);
      if (this.schemaHash(sourceColumns, targetColumns, saved.columns) !== saved.schemaHash) {
        throw AppError.validation("The table schema changed after review. Save it again.");
      }
      const audit = new CommonTableRowAudit(targetDb, saved.table, saved.columns);
      const keys = await audit.uniqueKeys();
      const rows: ImportRowReport[] = [];
      for (const row of await this.imports.rows(id)) rows.push(await audit.row(row, keys));
      return { phase: "audit" as const, at: new Date().toISOString(), actor, rows };
    });
    await this.imports.saveReport(id, report);
    return report;
  }

  async importSaved(id: string, actor: string) {
    return this.imports.withImportLock(id, () => this.runSavedImport(id, actor));
  }

  private async runSavedImport(id: string, actor: string) {
    const saved = await this.imports.get(id);
    if (saved.status !== "reviewed") {
      throw AppError.validation("Only a saved review can be imported.");
    }
    if (saved.report?.phase !== "audit")
      throw AppError.validation("Audit the selected rows before importing.");
    const report: ImportReport = {
      phase: "complete",
      at: new Date().toISOString(),
      actor,
      rows: []
    };
    let targetCommitted = false;
    const [source, target] = await Promise.all([
      this.host.dataMigration.resolveSource(saved.sourceId),
      this.host.resolveTenant(saved.targetTenantId)
    ]);
    try {
      const result = await this.withDatabases(source, target, async (sourceDb, targetDb) => {
        const lockName = `codexsun.bridge.table:${createHash("sha256").update(`${target.database}.${saved.table}`).digest("hex").slice(0, 32)}`;
        const [lock] = await targetDb.query<RowDataPacket[]>("SELECT GET_LOCK(?, 30) AS acquired", [
          lockName
        ]);
        if (Number(lock[0]?.acquired) !== 1)
          throw AppError.validation("Another import is using this target table. Try again.");
        try {
          const [sourceColumns, targetColumns] = await Promise.all([
            this.columns(sourceDb, saved.table),
            this.columns(targetDb, saved.table)
          ]);
          const currentHash = this.schemaHash(sourceColumns, targetColumns, saved.columns);
          if (currentHash !== saved.schemaHash) {
            throw AppError.validation(
              "The table schema changed after review. Refresh and save it again."
            );
          }
          const rows = await this.imports.rows(id);
          const audit = new CommonTableRowAudit(targetDb, saved.table, saved.columns);
          const keys = await audit.uniqueKeys();
          const names = saved.columns as string[];
          const insertSql = `INSERT INTO ${quoteIdentifier(saved.table)} (${names
            .map(quoteIdentifier)
            .join(", ")}) VALUES (${names.map(() => "?").join(", ")})`;
          let imported = 0;
          let skipped = 0;
          await targetDb.beginTransaction();
          try {
            for (const row of rows) {
              const checked = await audit.row(row, keys);
              if (checked.status !== "ready") {
                if (checked.status === "existing") {
                  const matched = {
                    sourceId: row.rowNumber,
                    source: row.data,
                    data: row.data,
                    target: null,
                    status: "existing",
                    message: checked.message
                  };
                  await new CompanySeedReuse(
                    sourceDb,
                    targetDb,
                    this.host.isCompanySeed
                  ).claimExisting(saved.table, matched);
                  checked.message = matched.message;
                }
                report.rows.push(checked);
                skipped += 1;
                continue;
              }
              try {
                await targetDb.execute(
                  insertSql,
                  names.map((name) => bindValue(row.data[name]))
                );
                imported += 1;
                report.rows.push({
                  rowNumber: row.rowNumber,
                  status: "inserted",
                  message: "Inserted successfully."
                });
              } catch (error) {
                if (isDuplicateKey(error)) {
                  skipped += 1;
                  report.rows.push({
                    rowNumber: row.rowNumber,
                    status: "warning",
                    message:
                      "A unique key became occupied during import. Existing row kept; skipped."
                  });
                  continue;
                }
                throw error;
              }
            }
            await targetDb.commit();
            targetCommitted = true;
          } catch (error) {
            await targetDb.rollback();
            throw error;
          }
          return { imported, skipped };
        } finally {
          await targetDb.query("SELECT RELEASE_LOCK(?)", [lockName]);
        }
      });
      await this.imports.complete(id, actor, result.imported, result.skipped, report);
      return { ...result, status: "imported" as const };
    } catch (error) {
      if (targetCommitted) {
        await this.imports.saveReport(id, report);
        throw error;
      }
      report.phase = "failed";
      const outcomes = new Map(report.rows.map((row) => [row.rowNumber, row]));
      report.rows = (await this.imports.rows(id)).map((row) => {
        const outcome = outcomes.get(row.rowNumber);
        return outcome && outcome.status !== "inserted"
          ? outcome
          : {
              rowNumber: row.rowNumber,
              status: "rolled_back" as const,
              message: "Not imported. No changes from this import were committed."
            };
      });
      await this.imports.saveReport(id, report);
      await this.imports.fail(id, actor, error instanceof Error ? error.message : "Import failed.");
      throw error;
    }
  }

  private async existingTables(connection: Connection, database: string) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [database]
    );
    return new Set(rows.map((row) => String(row.name)));
  }

  private async columns(connection: Connection, table: CommonTableName): Promise<DbColumn[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SHOW COLUMNS FROM ${quoteIdentifier(table)}`
    );
    return rows.map((row) => ({
      name: String(row.Field),
      type: String(row.Type).toLowerCase(),
      required:
        row.Null === "NO" && row.Default === null && !String(row.Extra).includes("auto_increment"),
      primary: row.Key === "PRI"
    }));
  }

  private async count(connection: Connection, table: CommonTableName) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ${quoteIdentifier(table)}`
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async rows(
    connection: Connection,
    table: CommonTableName,
    page: number,
    pageSize: number
  ) {
    const columns = await this.columns(connection, table);
    const ordering = columns.some((column) => column.name === "id")
      ? ["id"]
      : columns.filter((column) => column.primary).map((column) => column.name);
    const orderBy = (ordering.length ? ordering : columns.map((column) => column.name))
      .map(quoteIdentifier)
      .join(", ");
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
    );
    return rows.map((row) => ({ ...row }));
  }

  private withDatabases<T>(
    source: Awaited<ReturnType<CommonTableImportHost["dataMigration"]["resolveSource"]>>,
    target: Awaited<ReturnType<CommonTableImportHost["resolveTenant"]>>,
    operation: (sourceDb: Connection, targetDb: Connection) => Promise<T>
  ) {
    return withConnections(source, target, operation);
  }

  private schemaHash(source: DbColumn[], target: DbColumn[], columns: string[]) {
    return createHash("sha256")
      .update(
        JSON.stringify({
          source: source.map(({ name, type }) => [name, type]),
          target: target.map(({ name, type, required }) => [name, type, required]),
          columns
        })
      )
      .digest("hex");
  }

  private redact(row: Record<string, unknown>, columns: string[]) {
    return Object.fromEntries(
      columns.map((column) => [column, sensitiveKey.test(column) ? "[redacted]" : row[column]])
    );
  }
}

export async function withConnections<T>(
  source: Awaited<ReturnType<CommonTableImportHost["dataMigration"]["resolveSource"]>>,
  target: Awaited<ReturnType<CommonTableImportHost["resolveTenant"]>>,
  operation: (sourceDb: Connection, targetDb: Connection) => Promise<T>
): Promise<T> {
  const sourceDb = await createConnection({
    host: source.host,
    port: source.port,
    user: source.user,
    password: source.password,
    database: source.database,
    dateStrings: true,
    ...(source.tlsMode === "required" ? { ssl: {} } : {}),
    connectTimeout: 10_000
  });
  let targetDb: Connection | undefined;
  try {
    targetDb = await createConnection({
      host: target.host,
      port: target.port,
      user: target.user,
      password: target.password,
      database: target.database,
      dateStrings: true,
      connectTimeout: 10_000
    });
    return await operation(sourceDb, targetDb);
  } finally {
    await Promise.allSettled([sourceDb.end(), targetDb?.end() ?? Promise.resolve()]);
  }
}

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(identifier)) {
    throw AppError.validation("Database identifier is invalid.");
  }
  return `\`${identifier}\``;
}

function isDuplicateKey(error: unknown) {
  return Boolean(error && typeof error === "object" && "errno" in error && error.errno === 1062);
}

function bindValue(
  value: unknown
): string | number | bigint | boolean | Date | Buffer | Uint8Array | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value instanceof Date ||
    Buffer.isBuffer(value) ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  if (value === undefined) return null;
  return JSON.stringify(value);
}
