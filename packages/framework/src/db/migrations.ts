import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";

export type MigrationDirection = "down" | "up";

export type MigrationStep<Database> = {
  acceptedAppliedChecksums?: readonly string[];
  checksum: string;
  description: string;
  down?: (database: Kysely<Database>) => Promise<unknown>;
  name: string;
  up: (database: Kysely<Database>) => Promise<unknown>;
  version: number;
};

export type MigrationBatch<Database> = {
  batch: number;
  description: string;
  scope: string;
  resolveSteps?: (
    ledger: readonly MigrationLedgerEntry[],
  ) => readonly MigrationStep<Database>[];
  steps: readonly MigrationStep<Database>[];
  version: string;
};

export type MigrationRunOptions = {
  batchSize?: number;
  createdBy?: string;
  ledgerTable?: string;
  lockTimeoutSeconds?: number;
};

export type MigrationRunResult = {
  applied: string[];
  batch: number;
  checksums: Record<string, string>;
  skipped: string[];
};

export type TablePrefixPolicy = {
  excludePrefixes?: readonly string[];
  include?: readonly string[];
  prefix: string;
};

type StandardColumn = {
  column_name: string;
  character_maximum_length: number | string | null;
};

type LedgerRow = {
  checksum: string;
  name: string;
  status: "applied" | "failed" | "rolled_back" | "running";
  version: number;
};

export type MigrationLedgerEntry = Readonly<
  LedgerRow & { batch: number; scope: string }
>;

export const migrationSchemaTableName = "migration_schema";
export const legacyMigrationSchemaTableName = "app_migration_batches";

const defaultLedgerTable = migrationSchemaTableName;

export type MigrationSchemaAdoption = {
  from: string;
  to: string;
};

export function planMigrationSchemaAdoption(
  tableNames: readonly string[],
  targetTable = migrationSchemaTableName,
  legacyTable = legacyMigrationSchemaTableName,
): MigrationSchemaAdoption | null {
  const target = safeIdentifier(targetTable);
  const legacy = safeIdentifier(legacyTable);
  const tables = new Set(tableNames);
  if (tables.has(target) && tables.has(legacy)) {
    throw new Error(
      `Migration ledger collision: both ${legacy} and ${target} exist. Refusing to merge migration history automatically.`,
    );
  }
  return !tables.has(target) && tables.has(legacy)
    ? { from: legacy, to: target }
    : null;
}

export async function runMigrationBatch<Database>(
  database: Kysely<Database>,
  migrationBatch: MigrationBatch<Database>,
  options: MigrationRunOptions = {},
): Promise<MigrationRunResult> {
  assertBatch(migrationBatch);
  const ledgerTable = safeIdentifier(options.ledgerTable ?? defaultLedgerTable);
  const createdBy = options.createdBy?.trim() || "system:migration";
  const batchSize = positiveInteger(
    options.batchSize ?? 25,
    "migration batch size",
  );
  const lockName = migrationLockName(
    migrationBatch.scope,
    migrationBatch.batch,
  );
  await ensureMigrationLedger(database, ledgerTable);

  return withMigrationLock(
    database,
    lockName,
    options.lockTimeoutSeconds ?? 30,
    async (lockedDatabase) => {
      if (migrationBatch.resolveSteps) {
        const ledger = await readScopeLedger(
          lockedDatabase,
          ledgerTable,
          migrationBatch.scope,
        );
        migrationBatch = {
          ...migrationBatch,
          steps: migrationBatch.resolveSteps(ledger),
        };
        assertBatch(migrationBatch);
      }
      const result: MigrationRunResult = {
        applied: [],
        batch: migrationBatch.batch,
        checksums: {},
        skipped: [],
      };

      try {
        for (
          let offset = 0;
          offset < migrationBatch.steps.length;
          offset += batchSize
        ) {
          const chunk = migrationBatch.steps.slice(offset, offset + batchSize);
          for (const step of chunk) {
            const checksum = checksumFor(migrationBatch, step);
            result.checksums[step.name] = checksum;
            const existing = await findLedgerRow(
              lockedDatabase,
              ledgerTable,
              migrationBatch.scope,
              step.name,
            );
            if (existing?.status === "applied") {
              assertChecksum(existing, step, checksum, true);
              result.skipped.push(step.name);
              continue;
            }
            if (
              existing &&
              existing.checksum !== checksum &&
              existing.status !== "rolled_back"
            ) {
              assertChecksum(existing, step, checksum);
            }
            if (
              existing?.status === "running" ||
              existing?.status === "failed"
            ) {
              throw new Error(
                `Migration ${step.name} is ${existing.status}. Reconcile its schema and ledger before retrying.`,
              );
            }

            await writeLedgerState(lockedDatabase, ledgerTable, {
              batch: migrationBatch.batch,
              checksum,
              createdBy,
              description: step.description,
              error: null,
              name: step.name,
              scope: migrationBatch.scope,
              status: "running",
              version: step.version,
            });
            try {
              await step.up(lockedDatabase);
              await writeLedgerState(lockedDatabase, ledgerTable, {
                batch: migrationBatch.batch,
                checksum,
                createdBy,
                description: step.description,
                error: null,
                name: step.name,
                scope: migrationBatch.scope,
                status: "applied",
                version: step.version,
              });
              result.applied.push(step.name);
            } catch (error) {
              await writeLedgerState(lockedDatabase, ledgerTable, {
                batch: migrationBatch.batch,
                checksum,
                createdBy,
                description: step.description,
                error: migrationError(error),
                name: step.name,
                scope: migrationBatch.scope,
                status: "failed",
                version: step.version,
              });
              throw error;
            }
          }
        }
        return result;
      } catch (error) {
        throw new Error(
          `Migration batch ${migrationBatch.scope}:${migrationBatch.batch} failed: ${migrationError(error)}`,
          { cause: error },
        );
      }
    },
  );
}

export async function rollbackMigrationBatch<Database>(
  database: Kysely<Database>,
  migrationBatch: MigrationBatch<Database>,
  options: MigrationRunOptions = {},
) {
  assertBatch(migrationBatch);
  const ledgerTable = safeIdentifier(options.ledgerTable ?? defaultLedgerTable);
  const createdBy = options.createdBy?.trim() || "system:migration-rollback";
  const lockName = migrationLockName(
    migrationBatch.scope,
    migrationBatch.batch,
  );

  return withMigrationLock(
    database,
    lockName,
    options.lockTimeoutSeconds ?? 30,
    async (lockedDatabase) => {
      const tables = await listDatabaseTables(lockedDatabase);
      if (
        ledgerTable === migrationSchemaTableName &&
        tables.includes(migrationSchemaTableName) &&
        tables.includes(legacyMigrationSchemaTableName)
      ) {
        throw new Error("Rollback refused: both current and legacy migration ledgers exist.");
      }
      if (!tables.includes(ledgerTable)) {
        throw new Error(
          `Rollback refused: migration ledger ${ledgerTable} is missing. Resolve ledger adoption before rollback.`,
        );
      }
      const ledger = await readScopeLedger(
        lockedDatabase,
        ledgerTable,
        migrationBatch.scope,
      );
      if (migrationBatch.resolveSteps) {
        migrationBatch = {
          ...migrationBatch,
          steps: migrationBatch.resolveSteps(ledger),
        };
        assertBatch(migrationBatch);
      }
      for (const row of ledger) {
        if (row.status === "failed" || row.status === "running") {
          throw new Error(
            `Migration ${row.name} is ${row.status}. Reconcile its schema and ledger before rollback.`,
          );
        }
        if (row.status === "applied" && row.batch > migrationBatch.batch) {
          throw new Error(
            `Migration ${row.name} belongs to a newer applied batch. Roll back newer batches first.`,
          );
        }
        if (
          row.status === "applied" &&
          row.batch === migrationBatch.batch &&
          !migrationBatch.steps.some((step) => step.name === row.name)
        ) {
          throw new Error(`Migration ${row.name} is not in the rollback plan.`);
        }
      }
      const pending: Array<{
        step: MigrationStep<Database>;
        checksum: string;
      }> = [];
      for (const step of [...migrationBatch.steps].reverse()) {
        const existing = ledger.find((row) => row.name === step.name);
        if (
          !existing ||
          existing.status !== "applied" ||
          existing.batch !== migrationBatch.batch
        )
          continue;
        const checksum = checksumFor(migrationBatch, step);
        assertChecksum(existing, step, checksum, true);
        if (!step.down) {
          throw new Error(
            `Migration ${step.name} has no safe rollback. Restore the verified backup or add a forward corrective migration.`,
          );
        }
        pending.push({ step, checksum });
      }
      const rolledBack: string[] = [];
      for (const { step, checksum } of pending) {
        await writeLedgerState(lockedDatabase, ledgerTable, {
          batch: migrationBatch.batch,
          checksum,
          createdBy,
          description: step.description,
          error: null,
          name: step.name,
          scope: migrationBatch.scope,
          status: "running",
          version: step.version,
        });
        try {
          await step.down!(lockedDatabase);
        } catch (error) {
          await writeLedgerState(lockedDatabase, ledgerTable, {
            batch: migrationBatch.batch,
            checksum,
            createdBy,
            description: step.description,
            error: migrationError(error),
            name: step.name,
            scope: migrationBatch.scope,
            status: "failed",
            version: step.version,
          });
          throw error;
        }
        await writeLedgerState(lockedDatabase, ledgerTable, {
          batch: migrationBatch.batch,
          checksum,
          createdBy,
          description: step.description,
          error: null,
          name: step.name,
          scope: migrationBatch.scope,
          status: "rolled_back",
          version: step.version,
        });
        rolledBack.push(step.name);
      }
      return { batch: migrationBatch.batch, rolledBack };
    },
  );
}

export function migrationChecksum<Database>(
  migrationBatch: MigrationBatch<Database>,
  step: MigrationStep<Database>,
) {
  return checksumFor(migrationBatch, step);
}

export async function applyTablePrefixPolicy<Database>(
  database: Kysely<Database>,
  policy: TablePrefixPolicy,
) {
  const tables = await listDatabaseTables(database);
  const renamed = planTablePrefixChanges(tables, policy);
  for (const { from: source, to: target } of renamed) {
    await sql
      .raw(`RENAME TABLE \`${source}\` TO \`${target}\``)
      .execute(database);
  }
  return renamed;
}

export async function rollbackTablePrefixPolicy<Database>(
  database: Kysely<Database>,
  policy: TablePrefixPolicy,
) {
  const tables = await listDatabaseTables(database);
  const renamed = planTablePrefixRollback(tables, policy);
  for (const { from: source, to: target } of renamed) {
    await sql
      .raw(`RENAME TABLE \`${source}\` TO \`${target}\``)
      .execute(database);
  }
  return renamed;
}

export function planTablePrefixChanges(
  tables: readonly string[],
  policy: TablePrefixPolicy,
) {
  const prefix = safePrefix(policy.prefix);
  const include = policy.include
    ? new Set(policy.include.map(safeIdentifier))
    : null;
  const excluded = (policy.excludePrefixes ?? []).map(safePrefix);
  const known = new Set(tables.map(safeIdentifier));
  const renamed: Array<{ from: string; to: string }> = [];
  for (const source of [...known].sort()) {
    if (
      source.startsWith(prefix) ||
      excluded.some((value) => source.startsWith(value))
    )
      continue;
    if (include && !include.has(source)) continue;
    const target = safeIdentifier(`${prefix}${source}`);
    if (known.has(target)) {
      throw new Error(
        `Cannot rename legacy table ${source} to ${target}: both tables exist. Reconcile the rows before retrying.`,
      );
    }
    renamed.push({ from: source, to: target });
  }
  return renamed;
}

export function planTablePrefixRollback(
  tables: readonly string[],
  policy: TablePrefixPolicy,
) {
  const prefix = safePrefix(policy.prefix);
  const include = policy.include
    ? new Set(policy.include.map(safeIdentifier))
    : null;
  const known = new Set(tables.map(safeIdentifier));
  const renamed: Array<{ from: string; to: string }> = [];
  for (const source of [...known]
    .filter((name) => name.startsWith(prefix))
    .sort()
    .reverse()) {
    const target = safeIdentifier(source.slice(prefix.length));
    if (include && !include.has(target)) continue;
    if (known.has(target)) {
      throw new Error(
        `Cannot roll back table ${source} to ${target}: both tables exist. Reconcile the rows before retrying.`,
      );
    }
    renamed.push({ from: source, to: target });
  }
  return renamed;
}

export async function ensureStandardTableColumns<Database>(
  database: Kysely<Database>,
  tableNames: readonly string[],
) {
  for (const rawTableName of tableNames) {
    const tableName = safeIdentifier(rawTableName);
    const tables = await listDatabaseTables(database);
    if (!tables.includes(tableName)) {
      throw new Error(
        `Expected module-owned table ${tableName} was not created.`,
      );
    }
    let columns = await listTableColumns(database, tableName);
    if (!columns.has("id")) {
      const primaryKey = await tableHasPrimaryKey(database, tableName);
      if (primaryKey) {
        throw new Error(
          `Cannot add the standard id to ${tableName}: a legacy primary key already exists. Add an explicit owning-module conversion migration.`,
        );
      }
      await sql
        .raw(
          `ALTER TABLE \`${tableName}\` ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST`,
        )
        .execute(database);
      columns = await listTableColumns(database, tableName);
    }
    if (!columns.has("uuid")) {
      await sql
        .raw(
          `ALTER TABLE \`${tableName}\` ADD COLUMN uuid CHAR(8) NULL AFTER id`,
        )
        .execute(database);
      await sql
        .raw(
          `UPDATE \`${tableName}\` SET uuid=LOWER(SUBSTRING(MD5(CONCAT('${tableName}:',id)),1,8)) WHERE uuid IS NULL`,
        )
        .execute(database);
    } else if (Number(columns.get("uuid")?.character_maximum_length ?? 8) > 8) {
      const truncationCollision = await uuidCollisionCount(database, tableName);
      if (truncationCollision > 0) {
        throw new Error(
          `Cannot shorten UUIDs in ${tableName}: an 8-character collision exists.`,
        );
      }
      await sql
        .raw(
          `UPDATE \`${tableName}\` SET uuid=LOWER(LEFT(uuid,8)) WHERE LENGTH(uuid)>8`,
        )
        .execute(database);
    }
    if ((await uuidCollisionCount(database, tableName)) > 0) {
      throw new Error(
        `Cannot standardize UUIDs in ${tableName}: an 8-character collision exists.`,
      );
    }
    await sql
      .raw(
        `ALTER TABLE \`${tableName}\` MODIFY COLUMN uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()),1,8)))`,
      )
      .execute(database);
    if (!(await tableHasUniqueColumn(database, tableName, "uuid"))) {
      await sql
        .raw(
          `ALTER TABLE \`${tableName}\` ADD UNIQUE KEY \`${tableName}_uuid_unique\` (uuid)`,
        )
        .execute(database);
    }
    columns = await listTableColumns(database, tableName);
    for (const [columnName, definition] of [
      ["status", "VARCHAR(24) NOT NULL DEFAULT 'active'"],
      ["created_by", "VARCHAR(191) NOT NULL DEFAULT 'system:migration'"],
      ["created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
      [
        "updated_at",
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      ],
    ] as const) {
      if (columns.has(columnName)) continue;
      await sql
        .raw(
          `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`,
        )
        .execute(database);
    }
  }
}

async function ensureMigrationLedger<Database>(
  database: Kysely<Database>,
  ledgerTable: string,
) {
  await withMigrationLock(
    database,
    "codexsun:migration-schema",
    30,
    async (lockedDatabase) => {
      if (ledgerTable === migrationSchemaTableName) {
        const adoption = planMigrationSchemaAdoption(
          await listDatabaseTables(lockedDatabase),
        );
        if (adoption) {
          await sql
            .raw(`RENAME TABLE \`${adoption.from}\` TO \`${adoption.to}\``)
            .execute(lockedDatabase);
        }
      }

      await sql
        .raw(
          `CREATE TABLE IF NOT EXISTS \`${ledgerTable}\` (` +
            "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
            "uuid CHAR(8) NOT NULL UNIQUE," +
            "scope VARCHAR(80) NOT NULL," +
            "batch INT NOT NULL," +
            "version INT NOT NULL," +
            "name VARCHAR(191) NOT NULL," +
            "checksum CHAR(64) NOT NULL," +
            "description VARCHAR(500) NOT NULL DEFAULT ''," +
            "status VARCHAR(24) NOT NULL DEFAULT 'running'," +
            "error_text TEXT NULL," +
            "created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration'," +
            "started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)," +
            "applied_at DATETIME(3) NULL," +
            "rolled_back_at DATETIME(3) NULL," +
            "created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)," +
            "updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)," +
            "UNIQUE KEY migration_schema_scope_name_unique(scope,name)," +
            "INDEX migration_schema_batch_status_idx(scope,batch,status)" +
            ") CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
        )
        .execute(lockedDatabase);
    },
  );
}

async function readScopeLedger<Database>(
  database: Kysely<Database>,
  ledgerTable: string,
  scope: string,
) {
  const result = await sql<MigrationLedgerEntry>`
    SELECT scope, batch, checksum, name, status, version
    FROM ${sql.table(ledgerTable)}
    WHERE scope=${scope}
    ORDER BY version, name
  `.execute(database);
  return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
}

async function findLedgerRow<Database>(
  database: Kysely<Database>,
  ledgerTable: string,
  scope: string,
  name: string,
) {
  const result = await sql<LedgerRow>`
    SELECT checksum, name, status, version
    FROM ${sql.table(ledgerTable)}
    WHERE scope=${scope} AND name=${name}
    LIMIT 1
  `.execute(database);
  return result.rows[0];
}

async function writeLedgerState<Database>(
  database: Kysely<Database>,
  ledgerTable: string,
  value: {
    batch: number;
    checksum: string;
    createdBy: string;
    description: string;
    error: string | null;
    name: string;
    scope: string;
    status: LedgerRow["status"];
    version: number;
  },
) {
  const uuid = createHash("sha256")
    .update(`${value.scope}:${value.name}`)
    .digest("hex")
    .slice(0, 8);
  await sql`
    INSERT INTO ${sql.table(ledgerTable)}
      (uuid,scope,batch,version,name,checksum,description,status,error_text,created_by,
       started_at,applied_at,rolled_back_at)
    VALUES
      (${uuid},${value.scope},${value.batch},${value.version},${value.name},${value.checksum},
       ${value.description},${value.status},${value.error},${value.createdBy},CURRENT_TIMESTAMP(3),
       ${value.status === "applied" ? sql`CURRENT_TIMESTAMP(3)` : null},
       ${value.status === "rolled_back" ? sql`CURRENT_TIMESTAMP(3)` : null})
    ON DUPLICATE KEY UPDATE
      batch=VALUES(batch),version=VALUES(version),checksum=VALUES(checksum),
      description=VALUES(description),status=VALUES(status),error_text=VALUES(error_text),
      created_by=VALUES(created_by),started_at=VALUES(started_at),
      applied_at=VALUES(applied_at),rolled_back_at=VALUES(rolled_back_at)
  `.execute(database);
}

async function withMigrationLock<Database, Result>(
  database: Kysely<Database>,
  lockName: string,
  timeoutSeconds: number,
  callback: (database: Kysely<Database>) => Promise<Result>,
) {
  return database.connection().execute(async (connection) => {
    const acquired = await sql<{ acquired: number | string | null }>`
      SELECT GET_LOCK(${lockName}, ${positiveInteger(timeoutSeconds, "migration lock timeout")})
        AS acquired
    `.execute(connection);
    if (Number(acquired.rows[0]?.acquired ?? 0) !== 1) {
      throw new Error(`Could not acquire migration lock ${lockName}.`);
    }
    try {
      return await callback(connection);
    } finally {
      await sql`SELECT RELEASE_LOCK(${lockName})`.execute(connection);
    }
  });
}

function checksumFor<Database>(
  migrationBatch: MigrationBatch<Database>,
  step: MigrationStep<Database>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        batch: migrationBatch.batch,
        checksum: step.checksum,
        name: step.name,
        scope: migrationBatch.scope,
        version: step.version,
      }),
    )
    .digest("hex");
}

function assertChecksum(
  existing: LedgerRow,
  step: Pick<
    MigrationStep<unknown>,
    "acceptedAppliedChecksums" | "name" | "version"
  >,
  checksum: string,
  allowAcceptedAppliedChecksum = false,
) {
  const acceptedChecksum =
    allowAcceptedAppliedChecksum &&
    step.acceptedAppliedChecksums?.includes(existing.checksum);
  if (
    existing.version !== step.version ||
    (existing.checksum !== checksum && !acceptedChecksum)
  ) {
    throw new Error(
      `Migration checksum mismatch for ${step.name}. Applied migrations are immutable; add a new forward migration.`,
    );
  }
}

function assertBatch<Database>(batch: MigrationBatch<Database>) {
  if (!batch.scope.trim()) throw new Error("Migration scope is required.");
  positiveInteger(batch.batch, "migration batch");
  const names = new Set<string>();
  for (const step of batch.steps) {
    positiveInteger(step.version, `migration version for ${step.name}`);
    if (!step.name.trim() || !step.checksum.trim()) {
      throw new Error("Migration names and checksum sources are required.");
    }
    for (const checksum of step.acceptedAppliedChecksums ?? []) {
      if (!/^[a-f0-9]{64}$/u.test(checksum)) {
        throw new Error(
          `Accepted migration checksum for ${step.name} must be SHA-256 hex.`,
        );
      }
    }
    if (names.has(step.name))
      throw new Error(`Duplicate migration name ${step.name}.`);
    names.add(step.name);
  }
}

function safeIdentifier(value: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(value))
    throw new Error(`Unsafe SQL identifier ${value}.`);
  return value;
}

function safePrefix(value: string) {
  if (!/^[a-z][a-z0-9]*_$/.test(value))
    throw new Error(`Unsafe table prefix ${value}.`);
  return value;
}

async function listDatabaseTables<Database>(database: Kysely<Database>) {
  const result = await sql<{ table_name: string }>`
    SELECT TABLE_NAME AS table_name
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'
  `.execute(database);
  return result.rows.map(({ table_name }) => table_name);
}

async function listTableColumns<Database>(
  database: Kysely<Database>,
  tableName: string,
) {
  const result = await sql<StandardColumn>`
    SELECT COLUMN_NAME AS column_name,
           CHARACTER_MAXIMUM_LENGTH AS character_maximum_length
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${tableName}
  `.execute(database);
  return new Map(result.rows.map((column) => [column.column_name, column]));
}

async function tableHasPrimaryKey<Database>(
  database: Kysely<Database>,
  tableName: string,
) {
  const result = await sql<{ key_count: number | string }>`
    SELECT COUNT(*) AS key_count
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${tableName}
      AND CONSTRAINT_TYPE='PRIMARY KEY'
  `.execute(database);
  return Number(result.rows[0]?.key_count ?? 0) > 0;
}

async function tableHasUniqueColumn<Database>(
  database: Kysely<Database>,
  tableName: string,
  columnName: string,
) {
  const result = await sql<{ key_count: number | string }>`
    SELECT COUNT(*) AS key_count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${tableName}
      AND COLUMN_NAME=${columnName} AND NON_UNIQUE=0
  `.execute(database);
  return Number(result.rows[0]?.key_count ?? 0) > 0;
}

async function uuidCollisionCount<Database>(
  database: Kysely<Database>,
  tableName: string,
) {
  const result = await sql<{ collision_count: number | string }>`
    SELECT COUNT(*) AS collision_count
    FROM (
      SELECT LEFT(uuid,8)
      FROM ${sql.table(tableName)}
      WHERE uuid IS NOT NULL
      GROUP BY LEFT(uuid,8)
      HAVING COUNT(*) > 1
    ) collisions
  `.execute(database);
  return Number(result.rows[0]?.collision_count ?? 0);
}

function positiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${label} must be a positive integer.`);
  return value;
}

function migrationLockName(scope: string, batch: number) {
  const digest = createHash("sha256")
    .update(`${scope}:${batch}`)
    .digest("hex")
    .slice(0, 24);
  return `codexsun:migration:${digest}`;
}

function migrationError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
