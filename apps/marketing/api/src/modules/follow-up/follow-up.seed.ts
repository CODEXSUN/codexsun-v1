import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function seedFollowUp(database: Kysely<MarketingDatabase>) {
  const stable = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 8);
  for (const action of ["view", "create", "update"]) {
    const key = "marketing.follow-up.record." + action;
    await sql`INSERT INTO app_permissions(uuid,\`key\`,label,description,status,is_protected) VALUES(${stable(key)},${key},${"Marketing Follow-up " + action},${"Allows Marketing Follow-up " + action},'active',TRUE) ON DUPLICATE KEY UPDATE label=VALUES(label)`.execute(
      database
    );
    await sql`INSERT INTO app_role_permissions(uuid,role_id,permission_id,status,is_protected) SELECT ${stable("admin:" + key)},r.id,p.id,'active',TRUE FROM app_roles r JOIN app_permissions p ON p.\`key\`=${key} WHERE r.\`key\`='admin' ON DUPLICATE KEY UPDATE uuid=app_role_permissions.uuid`.execute(
      database
    );
  }
}
