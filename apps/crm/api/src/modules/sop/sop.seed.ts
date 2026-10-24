import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { SopDatabase } from "./sop.types.js";

const permissions = [
  "crm.sop.view",
  "crm.sop.create",
  "crm.sop.update",
  "crm.sop.revision.update-draft",
  "crm.sop.publish",
  "crm.sop.deactivate",
  "crm.duty.assign",
  "crm.duty.manage",
  "crm.duty.view.own",
  "crm.duty.view.all",
  "crm.duty-report.create.own",
  "crm.duty-report.view.own",
  "crm.duty-report.view.all"
] as const;
export async function seedSopPermissions(database: Kysely<SopDatabase>) {
  for (const key of permissions) {
    await sql`INSERT INTO app_permissions (uuid, \`key\`, label, description, status, is_protected) VALUES (${stable(key)}, ${key}, ${key}, ${`Allows ${key}.`}, 'active', TRUE) ON DUPLICATE KEY UPDATE label=VALUES(label), description=VALUES(description), status='active'`.execute(
      database
    );
    const roles =
      key === "crm.sop.revision.update-draft"
        ? ["admin", "super-admin", "user"]
        : key === "crm.duty-report.view.all" || key === "crm.duty.view.all"
          ? ["admin", "super-admin", "manager"]
          : key.endsWith("view.own") || key === "crm.sop.view"
            ? ["admin", "super-admin", "manager", "user", "auditor"]
            : key === "crm.duty-report.create.own"
              ? ["admin", "super-admin", "user"]
              : ["admin", "super-admin"];
    for (const role of roles)
      await sql`INSERT INTO app_role_permissions (uuid, role_id, permission_id, status, is_protected) SELECT ${stable(`${role}:${key}`)}, r.id, p.id, 'active', TRUE FROM app_roles r JOIN app_permissions p ON p.\`key\`=${key} WHERE r.\`key\`=${role} ON DUPLICATE KEY UPDATE status='active'`.execute(
        database
      );
  }
}
function stable(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
