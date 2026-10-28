import { assertDatabaseName, quoteIdentifier } from "../../database/database-utils.js";

export function restoreCreateDatabaseSql(databaseName: string, requireNewSandbox: boolean) {
  const name = assertDatabaseName(databaseName, "restore sandbox database name");
  return `CREATE DATABASE ${requireNewSandbox ? "" : "IF NOT EXISTS "}${quoteIdentifier(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
}
