import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";

const permissions = [
  "core.application.records.view",
  "core.application.records.create",
  "core.application.records.update",
  "core.application.records.delete",
  "core.application.records.lifecycle"
] as const;

export async function seedCoreTenantPermissions(database: Kysely<unknown>) {
  const available = await sql<{ table_count: string | number }>`
    SELECT COUNT(*) AS table_count FROM information_schema.tables
    WHERE table_schema=DATABASE() AND table_name IN ('app_permissions','app_roles','app_role_permissions')
  `.execute(database);
  if (Number(available.rows[0]?.table_count ?? 0) !== 3) return;
  for (const key of permissions) {
    const label = key.split(".").join(" · ");
    await sql`
      INSERT INTO app_permissions (uuid, \`key\`, label, description, status, is_protected)
      VALUES (${stable(key)}, ${key}, ${label}, ${`Allows ${label.toLowerCase()} in Core.`}, 'active', TRUE)
      ON DUPLICATE KEY UPDATE
        label=VALUES(label), description=VALUES(description), status='active', is_protected=TRUE
    `.execute(database);
    const roles =
      key === "core.application.records.view"
        ? ["admin", "super-admin", "manager", "team-head", "user"]
        : ["admin"];
    for (const roleKey of roles) {
      await sql`
        INSERT INTO app_role_permissions (uuid, role_id, permission_id, status, is_protected)
        SELECT ${stable(`role-permission:${roleKey}:${key}`)}, role.id, permission.id, 'active', TRUE
        FROM app_roles role
        INNER JOIN app_permissions permission ON permission.\`key\`=${key}
        WHERE role.\`key\`=${roleKey}
        ON DUPLICATE KEY UPDATE status='active', is_protected=TRUE
      `.execute(database);
    }
  }
  await seedCoreStandardUserAccess(database);
}

export async function seedCoreStandardUserAccess(database: Kysely<unknown>) {
  const available = await sql<{
    n: number;
  }>`SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('app_permissions','app_roles','app_role_permissions')`.execute(
    database
  );
  if (Number(available.rows[0]?.n) !== 3) return;
  for (const key of ["core.application.records.view", "core.application.records.create"]) {
    const label = key.split(".").join(" · ");
    await sql`INSERT INTO app_permissions(uuid,\`key\`,label,description,status,is_protected) VALUES(${stable(key)},${key},${label},${`Allows ${label.toLowerCase()} in Core.`},'active',TRUE) ON DUPLICATE KEY UPDATE status='active'`.execute(
      database
    );
    await sql`INSERT INTO app_role_permissions(uuid,role_id,permission_id,status,is_protected) SELECT ${stable(`role-permission:user:${key}`)},r.id,p.id,'active',TRUE FROM app_roles r JOIN app_permissions p ON p.\`key\`=${key} WHERE r.\`key\`='user' ON DUPLICATE KEY UPDATE status='active',is_protected=TRUE`.execute(
      database
    );
  }
  await sql`UPDATE app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id JOIN app_permissions p ON p.id=rp.permission_id
    SET rp.status='inactive' WHERE r.\`key\`='user' AND p.\`key\` IN ('core.application.records.update','core.application.records.delete','core.application.records.lifecycle')`.execute(
    database
  );
}

function stable(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
