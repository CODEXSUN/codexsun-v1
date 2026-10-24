import { randomBytes } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { Kysely } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { TenantDatabase } from "../../database/schema.js";
import { TenantUserRepository } from "./tenant-user.repository.js";

export type BridgeUserReport = {
  imported: number;
  existing: number;
  warnings: number;
  rows: Array<{
    sourceId: number;
    targetId: number | null;
    email: string;
    status: "imported" | "existing" | "warning";
    message: string;
  }>;
};
export async function copyBridgeUsers(
  source: Connection,
  target: Kysely<TenantDatabase>,
  authorize: () => Promise<void>,
  assignUserRole: (
    database: Kysely<TenantDatabase>,
    userId: number,
    roleId: number
  ) => Promise<unknown>
): Promise<BridgeUserReport> {
  await authorize();
  const report: BridgeUserReport = { imported: 0, existing: 0, warnings: 0, rows: [] };
  const [columns] = await source.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app_users'"
  );
  if (!columns.length) return report;
  const names = new Set(columns.map((column) => String(column.name)));
  if (!["id", "name", "email", "password_hash", "status"].every((name) => names.has(name))) {
    report.warnings++;
    report.rows.push({
      sourceId: 0,
      targetId: null,
      email: "",
      status: "warning",
      message: "Source user schema is unsupported. No credentials copied."
    });
    return report;
  }
  const [users] = await source.query<RowDataPacket[]>(
    `SELECT id,name,email,password_hash,status${names.has("username") ? ",username" : ""} FROM app_users ORDER BY id LIMIT 10001`
  );
  if (users.length > 10000)
    throw AppError.validation("Select a bounded user import of at most 10,000 accounts.");
  for (const sourceUser of users) {
    const email = String(sourceUser.email ?? "")
      .trim()
      .toLowerCase();
    const row: BridgeUserReport["rows"][number] = {
      sourceId: Number(sourceUser.id),
      targetId: null,
      email,
      status: "warning",
      message: "User values or password hash are unsupported. Source and target preserved."
    };
    try {
      await target.transaction().execute(async (database) => {
        const existing = await database
          .selectFrom("app_users")
          .select(["id"])
          .where("email", "=", email)
          .executeTakeFirst();
        if (existing) {
          row.status = "existing";
          row.targetId = existing.id;
          row.message = "Existing target account, password and role preserved.";
          return;
        }
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ||
          email.length > 180 ||
          !String(sourceUser.name ?? "").trim() ||
          String(sourceUser.name).length > 180 ||
          !supportedBridgeHash(sourceUser.password_hash) ||
          !["active", "inactive", "suspended"].includes(String(sourceUser.status))
        )
          return;
        const role = await database
          .selectFrom("app_roles")
          .select("id")
          .where("key", "=", "user")
          .where("status", "=", "active")
          .executeTakeFirst();
        if (!role) throw AppError.validation("The active target User role is required.");
        const username = sourceUser.username == null ? null : String(sourceUser.username).trim();
        if (username && username.length > 80) return;
        const user = await new TenantUserRepository(database).create(
          { email, name: String(sourceUser.name).trim(), username, status: sourceUser.status },
          randomBytes(4).toString("hex"),
          sourceUser.password_hash
        );
        await assignUserRole(database, user.id, role.id);
        const saved = await database
          .selectFrom("app_users")
          .select("password_hash")
          .where("id", "=", user.id)
          .executeTakeFirstOrThrow();
        if (saved.password_hash !== sourceUser.password_hash)
          throw AppError.conflict("Credential verification failed.");
        row.status = "imported";
        row.targetId = user.id;
        row.message =
          "Copied exact supported password hash; assigned target User role and its current app permissions.";
      });
    } catch {
      row.status = "warning";
      row.targetId = null;
      row.message =
        "User import could not commit. Check target User role, username uniqueness and account schema. No credential values are exposed.";
    }
    report.rows.push(row);
    if (row.status === "imported") report.imported++;
    else if (row.status === "existing") report.existing++;
    else report.warnings++;
  }
  return report;
}
export function supportedBridgeHash(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 255) return false;
  const parts = value.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2" || !/^\d+$/u.test(parts[1]!)) return false;
  const rounds = Number(parts[1]);
  return (
    rounds >= 10000 &&
    rounds <= 2000000 &&
    /^[A-Za-z0-9_-]{22,86}$/u.test(parts[2]!) &&
    /^[A-Za-z0-9_-]{43}$/u.test(parts[3]!) &&
    Buffer.from(parts[3]!, "base64url").length === 32
  );
}
