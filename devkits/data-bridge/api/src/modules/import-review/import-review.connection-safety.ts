import { randomBytes } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import type { Connection, RowDataPacket } from "mysql2/promise";

const permittedPrivileges = new Set(["USAGE", "SELECT", "SHOW VIEW"]);

export async function requireReadOnlySource(source: Connection) {
  const [rows] = await source.query<RowDataPacket[]>("SHOW GRANTS FOR CURRENT_USER");
  if (!rows.length || rows.some((row) => !isReadOnlyGrant(String(Object.values(row)[0] ?? ""))))
    throw AppError.validation(
      "The source database user must have read-only grants without write or administrative privileges."
    );
  await source.query("SET SESSION TRANSACTION READ ONLY");
}

export function isReadOnlyGrant(grant: string) {
  const match = /^GRANT\s+(.+?)\s+ON\s+.+?\s+TO\s+.+$/iu.exec(grant);
  if (!match || /\bWITH\s+GRANT\s+OPTION\b/iu.test(grant)) return false;
  return match[1]!
    .split(",")
    .every((privilege) => permittedPrivileges.has(privilege.trim().toUpperCase()));
}

export async function requireDistinctDatabases(source: Connection, target: Connection) {
  const [sourceRows] = await source.query<RowDataPacket[]>("SELECT DATABASE() AS database_name");
  const [targetRows] = await target.query<RowDataPacket[]>(
    "SELECT DATABASE() AS database_name, CONNECTION_ID() AS connection_id"
  );
  const sourceName = String(sourceRows[0]?.database_name ?? "");
  const targetName = String(targetRows[0]?.database_name ?? "");
  if (!sourceName || !targetName)
    throw AppError.validation("Could not verify database identities.");
  if (sourceName.toLowerCase() !== targetName.toLowerCase()) return;

  const lock = `codexsun-bridge-${randomBytes(20).toString("hex")}`;
  const [acquired] = await target.query<RowDataPacket[]>("SELECT GET_LOCK(?, 0) AS acquired", [
    lock
  ]);
  if (Number(acquired[0]?.acquired) !== 1)
    throw AppError.validation("Could not verify database server identity.");
  try {
    const [observed] = await source.query<RowDataPacket[]>("SELECT IS_USED_LOCK(?) AS owner", [
      lock
    ]);
    if (String(observed[0]?.owner ?? "") === String(targetRows[0]?.connection_id ?? ""))
      throw AppError.validation("Source and destination must be different databases.");
    if (observed[0]?.owner != null)
      throw AppError.validation("Could not verify database server identity.");
  } finally {
    await target.query("SELECT RELEASE_LOCK(?)", [lock]);
  }
}
