import type { RowDataPacket } from "mysql2/promise";

export type RollbackTargetIdentity = {
  label: string;
  host: string;
  port: number;
  database: string;
};

export type RollbackLedgerRow = {
  scope: string;
  batch: number;
  name: string;
  version: number;
  status: string;
};

export type RollbackAssessment = {
  target: string;
  applied: number;
  incomplete: number;
  byScope: Array<{ scope: string; applied: number; incomplete: number }>;
};

export function assertDistinctRollbackTargets(
  targets: readonly RollbackTargetIdentity[],
) {
  const seen = new Set<string>();
  for (const target of targets) {
    if (
      !target.label.trim() ||
      hasControlCharacters(target.label) ||
      !target.host.trim() ||
      !target.database.trim() ||
      !Number.isInteger(target.port) ||
      target.port <= 0 ||
      target.port > 65535
    ) {
      throw new Error("Rollback assessment has an invalid target identity.");
    }
    const key = JSON.stringify([
      target.host.trim().toLowerCase(),
      target.port,
      target.database.trim().toLowerCase(),
    ]);
    if (seen.has(key))
      throw new Error(
        `Rollback assessment has a duplicate database target: ${target.label}.`,
      );
    seen.add(key);
  }
}

export function summarizeRollbackLedger(
  target: string,
  rows: readonly RollbackLedgerRow[],
): RollbackAssessment {
  const scopes = new Map<
    string,
    { scope: string; applied: number; incomplete: number }
  >();
  for (const row of rows) {
    if (
      typeof row.scope !== "string" ||
      !row.scope.trim() ||
      hasControlCharacters(row.scope) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      hasControlCharacters(row.name) ||
      !Number.isInteger(row.batch) ||
      row.batch <= 0 ||
      !Number.isInteger(row.version) ||
      row.version <= 0 ||
      !["applied", "running", "failed", "rolled_back"].includes(row.status)
    ) {
      throw new Error(
        `Rollback assessment found an invalid ledger row in ${target}.`,
      );
    }
    if (row.status === "rolled_back") continue;
    const scope = scopes.get(row.scope) ?? {
      scope: row.scope,
      applied: 0,
      incomplete: 0,
    };
    if (row.status === "applied") scope.applied += 1;
    else scope.incomplete += 1;
    scopes.set(row.scope, scope);
  }
  const byScope = [...scopes.values()].sort((a, b) =>
    a.scope.localeCompare(b.scope),
  );
  return {
    target,
    applied: byScope.reduce((sum, scope) => sum + scope.applied, 0),
    incomplete: byScope.reduce((sum, scope) => sum + scope.incomplete, 0),
    byScope,
  };
}

export async function inspectRollbackLedger(
  target: string,
  connection: { query(sql: string): Promise<[RowDataPacket[], unknown]> },
) {
  let rows: RowDataPacket[];
  try {
    [rows] = await connection.query(
      "SELECT scope,batch,name,version,status FROM migration_schema ORDER BY scope,batch,id",
    );
  } catch {
    throw new Error(
      `Rollback assessment cannot read the migration ledger for ${target}.`,
    );
  }
  return summarizeRollbackLedger(target, rows as RollbackLedgerRow[]);
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
