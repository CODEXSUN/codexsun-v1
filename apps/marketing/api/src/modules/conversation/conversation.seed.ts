import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function seedConversation(database: Kysely<MarketingDatabase>) {
  const permissions = [
    { key: "marketing.conversation.record.view", description: "View marketing conversations" },
    { key: "marketing.conversation.record.create", description: "Create marketing conversations" },
    { key: "marketing.conversation.record.update", description: "Update marketing conversations" }
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
