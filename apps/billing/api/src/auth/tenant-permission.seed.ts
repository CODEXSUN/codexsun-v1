import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";

const permissions = [
  "billing.application.records.view",
  "billing.application.records.create",
  "billing.application.records.update",
  "billing.application.records.delete",
  "billing.application.records.lifecycle",
  "billing.application.records.compliance"
] as const;

export async function seedBillingTenantPermissions(database: Kysely<unknown>) {
  const available = await sql<{ table_count: string | number }>`
    SELECT COUNT(*) AS table_count FROM information_schema.tables
    WHERE table_schema=DATABASE() AND table_name IN ('app_permissions','app_roles','app_role_permissions')
  `.execute(database);
  if (Number(available.rows[0]?.table_count ?? 0) !== 3) return;
  await ensureBillingAdministratorRoles(database);
  for (const key of permissions) {
    const label = key.split(".").join(" · ");
    await sql`
      INSERT INTO app_permissions (uuid, \`key\`, label, description, status, is_protected)
      VALUES (${stable(key)}, ${key}, ${label}, ${`Allows ${label.toLowerCase()} in Billing.`}, 'active', TRUE)
      ON DUPLICATE KEY UPDATE
        label=VALUES(label), description=VALUES(description), status='active', is_protected=TRUE
    `.execute(database);
    for (const roleKey of ["admin", "super-admin", "super_admin"]) {
      await sql`
        INSERT IGNORE INTO app_role_permissions (uuid, role_id, permission_id, status, is_protected)
        SELECT ${stable(`role-permission:${roleKey}:${key}`)}, role.id, permission.id, 'active', TRUE
        FROM app_roles role
        INNER JOIN app_permissions permission ON permission.\`key\`=${key}
        WHERE role.\`key\`=${roleKey}
      `.execute(database);
    }
  }
  await seedBillingStandardUserAccess(database);
  await ensureLegacyAdministratorAssignments(database);
}

export async function seedBillingStandardUserAccess(database: Kysely<unknown>) {
  const available = await sql<{
    n: number;
  }>`SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('app_permissions','app_roles','app_role_permissions')`.execute(
    database
  );
  if (Number(available.rows[0]?.n) !== 3) return;
  for (const key of [
    "billing.application.records.view",
    "billing.application.records.create",
    "billing.application.records.update"
  ]) {
    const label = key.split(".").join(" - ");
    await sql`INSERT INTO app_permissions(uuid,\`key\`,label,description,status,is_protected) VALUES(${stable(key)},${key},${label},${`Allows ${label.toLowerCase()} in Billing.`},'active',TRUE) ON DUPLICATE KEY UPDATE status='active'`.execute(
      database
    );
    await sql`INSERT INTO app_role_permissions(uuid,role_id,permission_id,status,is_protected) SELECT ${stable(`role-permission:user:${key}`)},r.id,p.id,'active',TRUE FROM app_roles r JOIN app_permissions p ON p.\`key\`=${key} WHERE r.\`key\`='user' ON DUPLICATE KEY UPDATE status='active',is_protected=TRUE`.execute(
      database
    );
  }
  await sql`UPDATE app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id JOIN app_permissions p ON p.id=rp.permission_id
    SET rp.status=CASE WHEN p.\`key\` IN ('billing.application.records.view','billing.application.records.create','billing.application.records.update') THEN 'active' ELSE 'inactive' END
    WHERE r.\`key\`='user' AND p.\`key\` LIKE 'billing.application.records.%'`.execute(database);
}

async function ensureBillingAdministratorRoles(database: Kysely<unknown>) {
  for (const role of [
    ["admin", "Admin", "Full tenant administration access."],
    ["super-admin", "Super Admin", "Full tenant administration access with super-user approval."]
  ] as const) {
    await sql`
      INSERT IGNORE INTO app_roles (uuid, \`key\`, label, description, status, is_protected)
      VALUES (${stable(`tenant-role:${role[0]}`)}, ${role[0]}, ${role[1]}, ${role[2]}, 'active', TRUE)
    `.execute(database);
  }
}

async function ensureLegacyAdministratorAssignments(database: Kysely<unknown>) {
  for (const [legacyRole, roleKey] of [
    ["admin", "admin"],
    ["super-admin", "super-admin"],
    ["super_admin", "super-admin"]
  ] as const) {
    await sql`
      INSERT IGNORE INTO app_user_roles (uuid, user_id, role_id, status, is_protected)
      SELECT LOWER(SUBSTRING(MD5(CONCAT('legacy-user-role:', actor.id, ':', role.id)),1,8)), actor.id, role.id, 'active', TRUE
      FROM app_users actor
      INNER JOIN app_roles role ON role.\`key\`=${roleKey}
      WHERE actor.role=${legacyRole} AND actor.status='active'
    `.execute(database);
  }
}

function stable(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
