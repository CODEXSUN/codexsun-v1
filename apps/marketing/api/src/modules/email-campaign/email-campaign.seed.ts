import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function seedEmailCampaign(database: Kysely<MarketingDatabase>) {
  const permissions = [
    { key: "marketing.email-campaign.record.view", description: "View marketing email campaigns" },
    { key: "marketing.email-campaign.record.create", description: "Create marketing email campaigns" },
    { key: "marketing.email-campaign.record.update", description: "Update marketing email campaigns" }
  ];

  for (const perm of permissions) {
    await sql`INSERT INTO platform_permissions (\`key\`, \`description\`, \`service\`)
      VALUES (${perm.key}, ${perm.description}, 'marketing')
      ON DUPLICATE KEY UPDATE \`description\` = VALUES(\`description\`), \`service\` = VALUES(\`service\`)`.execute(database);

    await sql`INSERT INTO platform_role_permissions (\`role_key\`, \`permission_key\`)
      VALUES ('admin', ${perm.key})
      ON DUPLICATE KEY UPDATE \`permission_key\` = VALUES(\`permission_key\`)`.execute(database);
  }
}
