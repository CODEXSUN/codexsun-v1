import type { Connection } from "mysql2/promise";
import { quoteIdentifier } from "./database-utils.js";

export async function createMigrationDatabase(
  connection: Pick<Connection, "query">,
  name: string,
  verifyExisting: () => Promise<void>
) {
  try {
    await connection.query(
      `CREATE DATABASE ${quoteIdentifier(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    return "created" as const;
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ER_DB_CREATE_EXISTS"
    ) throw error;
  }
  await verifyExisting();
  return "existing" as const;
}
