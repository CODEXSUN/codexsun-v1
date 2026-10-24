import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { crmRecordReadRoles, isContact360Permission } from "./crm.access.js";
export async function seedCrmUserAccess(database: Kysely<unknown>) {
  const rows = await sql<{
    id: number;
    key: string;
  }>`SELECT id,\`key\` FROM app_permissions WHERE \`key\` LIKE 'crm.%' AND status='active'`.execute(
    database
  );
  for (const permission of rows.rows) {
    if (isContact360Permission(permission.key)) continue;
    if (crmRecordReadRoles(permission.key)) {
      await sql`UPDATE app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id SET rp.status='inactive' WHERE r.\`key\`='user' AND rp.permission_id=${permission.id}`.execute(
        database
      );
    } else if (
      /\.(view|create|access)$/u.test(permission.key) ||
      permission.key === "crm.sop.revision.update-draft"
    ) {
      const uuid = createHash("sha256")
        .update(`user-access:${permission.key}`)
        .digest("hex")
        .slice(0, 8);
      await sql`INSERT INTO app_role_permissions(uuid,role_id,permission_id,status,is_protected) SELECT ${uuid},id,${permission.id},'active',TRUE FROM app_roles WHERE \`key\`='user' AND status='active' ON DUPLICATE KEY UPDATE status='active'`.execute(
        database
      );
    }
  }
}
