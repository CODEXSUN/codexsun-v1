import { randomBytes } from "node:crypto";
import { createConnection } from "mysql2/promise";
import { env } from "../../env.js";
import { platformDatabaseName } from "../../database/platform-database.js";
import { quoteIdentifier } from "../../database/database-utils.js";
import type { Tenant } from "../tenant/index.js";
import { TenantRepository } from "../tenant/index.js";
import { tenantDatabaseMigrationsFor } from "../../database/tenant-app-database.js";
import type {
  DatabaseMaintenanceRun,
  DatabaseMigrationRow,
  DatabaseOperation,
  DatabaseRunStatus,
  DatabaseScope,
  DatabaseTableInfo
} from "./database-maintenance.types.js";
import { getPlatformDatabase } from "../../database/platform-database.js";
import { resolveTenantDatabasePassword } from "../../database/tenant-database.js";

export class DatabaseMaintenanceRepository {
  constructor(private readonly tenants = new TenantRepository()) {}

  async masterStatus() {
    const databaseName = platformDatabaseName();
    const restoreDatabaseName =
      env.CODEXSUN_RESTORE_TEST_DB_NAME ||
      (env.NODE_ENV === "production" ? null : `${databaseName}_restore_sandbox`);
    const probe = await this.probeDatabase({
      databaseName,
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER
    });
    return {
      backupStatus: "operator-required" as const,
      databaseName,
      host: env.DB_HOST,
      migrations: await this.masterMigrations(databaseName),
      port: env.DB_PORT,
      restoreDatabaseName,
      restoreSandboxExists: restoreDatabaseName
        ? await this.masterSandboxExists(restoreDatabaseName).catch(() => false)
        : false,
      restoreStatus:
        restoreDatabaseName && restoreDatabaseName.toLowerCase() !== databaseName.toLowerCase()
          ? ("sandbox-configured" as const)
          : ("not-configured" as const),
      runs: await this.runs("master", "master"),
      ...probe
    };
  }

  async activeMasterRestore() {
    const row = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .select("id")
      .where("database_scope", "=", "master")
      .where("target_key", "=", "master")
      .where("operation", "=", "restore")
      .where("status", "in", ["requested", "running"])
      .limit(1)
      .executeTakeFirst();
    return Boolean(row);
  }

  async activeTenantRestore(tenantId: number) {
    const row = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .select("id")
      .where("database_scope", "=", "tenant")
      .where("target_key", "=", String(tenantId))
      .where("operation", "=", "restore")
      .where("status", "in", ["requested", "running"])
      .limit(1)
      .executeTakeFirst();
    return Boolean(row);
  }

  async tenantSandboxExists(tenant: Tenant, databaseName: string) {
    const connection = await createConnection({
      host: tenant.dbHost || env.DB_HOST,
      password: resolveTenantDatabasePassword(tenant),
      port: tenant.dbPort || env.DB_PORT,
      user: tenant.dbUser || env.DB_USER
    });
    try {
      const [rows] = await connection.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?",
        [databaseName]
      );
      return Array.isArray(rows) && rows.length > 0;
    } finally {
      await connection.end();
    }
  }

  async masterSandboxExists(databaseName: string) {
    const connection = await createConnection({
      host: env.DB_HOST,
      password: env.DB_PASSWORD,
      port: env.DB_PORT,
      user: env.DB_USER
    });
    try {
      const [rows] = await connection.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?",
        [databaseName]
      );
      return Array.isArray(rows) && rows.length > 0;
    } finally {
      await connection.end();
    }
  }

  async tenantStatuses() {
    const tenants = await this.tenants.list();
    return Promise.all(tenants.map((tenant) => this.tenantStatus(tenant)));
  }

  async tenantStatus(tenant: Tenant) {
    let probe: Awaited<ReturnType<DatabaseMaintenanceRepository["probeDatabase"]>>;
    try {
      probe = await this.probeDatabase({
        databaseName: tenant.dbName,
        host: tenant.dbHost || env.DB_HOST,
        password: resolveTenantDatabasePassword(tenant),
        port: tenant.dbPort || env.DB_PORT,
        user: tenant.dbUser || env.DB_USER
      });
    } catch (error) {
      probe = offlineProbe(connectionMessage(error));
    }
    return {
      databaseName: tenant.dbName,
      host: tenant.dbHost || env.DB_HOST,
      migrations: await this.tenantMigrations(tenant),
      port: tenant.dbPort || env.DB_PORT,
      restoreDatabaseName: tenantRestoreSandboxName(tenant.dbName, tenant.id),
      restoreSandboxExists: await this.tenantSandboxExists(
        tenant,
        tenantRestoreSandboxName(tenant.dbName, tenant.id)
      ).catch(() => false),
      runs: await this.runs("tenant", String(tenant.id)),
      tenantCode: tenant.tenantCode,
      tenantId: tenant.id,
      tenantName: tenant.tenantName,
      ...probe
    };
  }

  async tenantDetails(id: number) {
    const tenant = await this.findTenant(id);
    if (!tenant) return null;
    const status = await this.tenantStatus(tenant);
    const tables = await this.tenantTables(tenant);
    return {
      ...status,
      migrationPlan: this.tenantMigrationPlan(tenant, status.migrations),
      tables
    };
  }

  async findTenant(id: number) {
    return this.tenants.findByIdOrCode(String(id));
  }

  async recordRun(input: {
    databaseName: string;
    details?: Record<string, unknown>;
    operation: DatabaseOperation;
    scope: DatabaseScope;
    status: DatabaseRunStatus;
    targetKey: string;
  }) {
    const result = await getPlatformDatabase()
      .insertInto("database_maintenance_runs")
      .values({
        completed_at: input.status === "completed" || input.status === "failed" ? new Date() : null,
        database_name: input.databaseName,
        database_scope: input.scope,
        details_json: JSON.stringify(input.details ?? {}),
        operation: input.operation,
        status: input.status,
        target_key: input.targetKey,
        uuid: randomBytes(4).toString("hex")
      })
      .executeTakeFirst();
    const run = await this.findRun(Number(result.insertId));
    if (!run) throw new Error("Database maintenance run could not be read after creation.");
    return run;
  }

  async findRun(id: number) {
    const row = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toRun(row) : null;
  }

  async updateRunStatus(id: number, status: DatabaseRunStatus, details: Record<string, unknown>) {
    await getPlatformDatabase()
      .updateTable("database_maintenance_runs")
      .set({
        completed_at: status === "completed" || status === "failed" ? new Date() : null,
        details_json: JSON.stringify(details),
        status
      })
      .where("id", "=", id)
      .execute();
    return this.findRun(id);
  }

  async latestCompletedBackup(scope: DatabaseScope, targetKey: string) {
    const rows = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .selectAll()
      .where("database_scope", "=", scope)
      .where("target_key", "=", targetKey)
      .where("operation", "=", "backup")
      .where("status", "=", "completed")
      .orderBy("completed_at", "desc")
      .orderBy("id", "desc")
      .limit(1)
      .execute();
    return rows[0] ? toRun(rows[0]) : null;
  }

  async completedRestores(scope: DatabaseScope, targetKey: string) {
    const rows = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .selectAll()
      .where("database_scope", "=", scope)
      .where("target_key", "=", targetKey)
      .where("operation", "=", "restore")
      .where("status", "=", "completed")
      .orderBy("id", "desc")
      .limit(100)
      .execute();
    return rows.map(toRun);
  }

  async completedMasterBackups() {
    const rows = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .selectAll()
      .where("database_scope", "=", "master")
      .where("target_key", "=", "master")
      .where("operation", "=", "backup")
      .where("status", "=", "completed")
      .orderBy("id", "desc")
      .limit(100)
      .execute();
    return rows.map(toRun);
  }

  async completedTenantBackups(tenantId: number) {
    const rows = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .selectAll()
      .where("database_scope", "=", "tenant")
      .where("target_key", "=", String(tenantId))
      .where("operation", "=", "backup")
      .where("status", "=", "completed")
      .orderBy("id", "desc")
      .limit(100)
      .execute();
    return rows.map(toRun);
  }

  private async runs(scope: DatabaseScope, targetKey: string) {
    const rows = await getPlatformDatabase()
      .selectFrom("database_maintenance_runs")
      .selectAll()
      .where("database_scope", "=", scope)
      .where("target_key", "=", targetKey)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(10)
      .execute();
    return rows.map(toRun);
  }

  private async probeDatabase(input: {
    databaseName: string;
    host: string;
    password?: string;
    port: number;
    user: string;
  }) {
    try {
      const connection = await createConnection({
        database: input.databaseName,
        host: input.host,
        password: input.password ?? env.DB_PASSWORD,
        port: input.port,
        timezone: "Z",
        user: input.user
      });
      try {
        const [versionRows] = await connection.query("SELECT VERSION() as version");
        const [tableRows] = await connection.query("SHOW TABLES");
        const version =
          Array.isArray(versionRows) &&
          versionRows[0] &&
          typeof (versionRows[0] as { version?: unknown }).version === "string"
            ? String((versionRows[0] as { version: string }).version)
            : "unknown";
        return {
          connectionMessage: null,
          status: "online" as const,
          tableCount: Array.isArray(tableRows) ? tableRows.length : 0,
          version
        };
      } finally {
        await connection.end();
      }
    } catch (error) {
      return offlineProbe(connectionMessage(error));
    }
  }

  private async masterMigrations(databaseName: string) {
    try {
      const connection = await createConnection({
        database: databaseName,
        host: env.DB_HOST,
        password: env.DB_PASSWORD,
        port: env.DB_PORT,
        timezone: "Z",
        user: env.DB_USER
      });
      try {
        const [rows] = await connection.query(
          "SELECT name, version, applied_at FROM migration_schema WHERE status='applied' ORDER BY batch, id"
        );
        return Array.isArray(rows)
          ? rows.map((row) => ({
              appliedAt: new Date((row as { applied_at: Date | string }).applied_at).toISOString(),
              name: String((row as { name: string }).name),
              version: Number((row as { version: number | string }).version)
            }))
          : [];
      } finally {
        await connection.end();
      }
    } catch {
      return [];
    }
  }

  private async tenantMigrations(tenant: Tenant) {
    try {
      const connection = await createConnection({
        database: tenant.dbName,
        host: tenant.dbHost || env.DB_HOST,
        password: resolveTenantDatabasePassword(tenant),
        port: tenant.dbPort || env.DB_PORT,
        timezone: "Z",
        user: tenant.dbUser || env.DB_USER
      });
      try {
        const [rows] = await connection.query(
          "SELECT name, version, applied_at FROM migration_schema WHERE status='applied' ORDER BY scope, batch, id"
        );
        return Array.isArray(rows)
          ? rows.map((row) => ({
              appliedAt: new Date((row as { applied_at: Date | string }).applied_at).toISOString(),
              name: String((row as { name: string }).name),
              version: Number((row as { version: number | string }).version)
            }))
          : [];
      } finally {
        await connection.end();
      }
    } catch {
      return [];
    }
  }

  private async tenantTables(tenant: Tenant): Promise<DatabaseTableInfo[]> {
    try {
      const connection = await createConnection({
        database: tenant.dbName,
        host: tenant.dbHost || env.DB_HOST,
        password: resolveTenantDatabasePassword(tenant),
        port: tenant.dbPort || env.DB_PORT,
        timezone: "Z",
        user: tenant.dbUser || env.DB_USER
      });
      try {
        const [rows] = await connection.query("SHOW TABLE STATUS");
        if (!Array.isArray(rows)) return [];
        return Promise.all(
          rows.map(async (row) => {
            const table = row as Record<string, unknown>;
            const name = String(table.Name ?? "");
            const [countRows] = await connection.query(
              `SELECT COUNT(*) as recordCount FROM ${quoteIdentifier(name)}`
            );
            const count =
              Array.isArray(countRows) && countRows[0]
                ? Number((countRows[0] as { recordCount?: unknown }).recordCount ?? 0)
                : 0;
            return {
              autoIncrement: table.Auto_increment == null ? null : Number(table.Auto_increment),
              collation: table.Collation == null ? null : String(table.Collation),
              comment: String(table.Comment ?? ""),
              createdAt: toIsoDate(table.Create_time),
              dataBytes: Number(table.Data_length ?? 0),
              engine: table.Engine == null ? null : String(table.Engine),
              indexBytes: Number(table.Index_length ?? 0),
              name,
              recordCount: count,
              updatedAt: toIsoDate(table.Update_time)
            };
          })
        );
      } finally {
        await connection.end();
      }
    } catch {
      return [];
    }
  }

  private tenantMigrationPlan(tenant: Tenant, applied: DatabaseMigrationRow[]) {
    const appliedNames = new Set(applied.map((migration) => migration.name));
    const definitions = tenantDatabaseMigrationsFor(tenant);
    const available = definitions.map((migration) => ({
      description: migration.description,
      name: migration.name
    }));
    const pending = available.filter((migration) => !appliedNames.has(migration.name));
    return {
      applied,
      available,
      dryRunScript: pending.flatMap((migration) => {
        const definition = definitions.find((item) => item.name === migration.name);
        return definition
          ? [`-- ${definition.name}: ${definition.description}`, ...definition.statements]
          : [`-- ${migration.name}`];
      }),
      latestApplied: applied.at(-1) ?? null,
      latestPending: pending[0] ?? null,
      pending
    };
  }
}

export function tenantRestoreSandboxName(databaseName: string, tenantId: number) {
  const suffix = `_restore_${tenantId}`;
  return `${databaseName.slice(0, 64 - suffix.length)}${suffix}`;
}

function toIsoDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function offlineProbe(message: string) {
  return {
    connectionMessage: message,
    status: "offline" as const,
    tableCount: 0,
    version: "unreachable"
  };
}

function connectionMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "sqlMessage" in error) {
    const sqlMessage = String((error as { sqlMessage?: unknown }).sqlMessage ?? "").trim();
    if (sqlMessage) return sqlMessage;
  }
  return String(error || "Unknown database connection error.");
}

function toRun(row: {
  completed_at: Date | string | null;
  created_at: Date | string;
  database_name: string;
  database_scope: DatabaseScope;
  details_json: string | Record<string, unknown>;
  id: number;
  operation: DatabaseOperation;
  status: DatabaseRunStatus;
  target_key: string;
  uuid: string;
}): DatabaseMaintenanceRun {
  return {
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    databaseName: row.database_name,
    details: parseDetails(row.details_json),
    id: Number(row.id),
    operation: row.operation,
    scope: row.database_scope,
    status: row.status,
    targetKey: row.target_key,
    uuid: row.uuid
  };
}

function parseDetails(value: string | Record<string, unknown>) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
