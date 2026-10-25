import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function seedContent(database: Kysely<MarketingDatabase>) {
  const stable = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 8);

  // 1. Seed content permissions
  for (const action of ["view", "create", "update"]) {
    const key = "marketing.content.record." + action;
    await sql`INSERT INTO app_permissions(uuid,\`key\`,label,description,status,is_protected)
      VALUES(${stable(key)},${key},${"Marketing Content " + action},${"Allows Marketing Content " + action},'active',TRUE)
      ON DUPLICATE KEY UPDATE label=VALUES(label)`.execute(database);

    await sql`INSERT INTO app_role_permissions(uuid,role_id,permission_id,status,is_protected)
      SELECT ${stable("admin:" + key)},r.id,p.id,'active',TRUE
      FROM app_roles r JOIN app_permissions p ON p.\`key\`=${key}
      WHERE r.\`key\`='admin'
      ON DUPLICATE KEY UPDATE uuid=app_role_permissions.uuid`.execute(database);
  }

  // 2. Seed demo contents if table is empty
  const countRow = (
    await sql<{ count: number }>`SELECT COUNT(*) AS count FROM marketing_contents`.execute(database)
  ).rows[0];

  if (!countRow || Number(countRow.count) === 0) {
    const brand = (
      await sql<{
        uuid: string;
        company_id: number;
      }>`SELECT uuid, company_id FROM marketing_brands WHERE status='active' ORDER BY id ASC LIMIT 1`.execute(
        database
      )
    ).rows[0];

    if (brand) {
      const demoContents = [
        {
          uuid: stable("demo-content-fb-1"),
          title: "Exciting product launch announcement",
          body: "We are thrilled to launch our next-generation AI workflows for modern business!",
          channel: "facebook",
          publishMode: "api",
          status: "draft",
          scheduledAt: null,
          publishedAt: null,
          mediaUrls: JSON.stringify(["https://example.com/media/launch.png"]),
          notes: null
        },
        {
          uuid: stable("demo-content-ig-2"),
          title: "Behind the scenes team spotlight",
          body: "Our engineering team working on the new enterprise capabilities. #tech #innovation",
          channel: "instagram",
          publishMode: "api",
          status: "scheduled",
          scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " "),
          publishedAt: null,
          mediaUrls: JSON.stringify(["https://example.com/media/team.jpg"]),
          notes: null
        },
        {
          uuid: stable("demo-content-li-3"),
          title: "Quarterly industry report insights",
          body: "Check out our latest quarterly insights on tenant isolation and multi-agent architecture.",
          channel: "linkedin",
          publishMode: "manual",
          status: "published",
          scheduledAt: null,
          publishedAt: new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace("T", " "),
          mediaUrls: JSON.stringify([]),
          notes: "Published natively to company page by social team."
        }
      ];

      for (const item of demoContents) {
        await sql`INSERT INTO marketing_contents(
          uuid, company_id, brand_uuid, title, body, channel,
          publish_mode, status, scheduled_at, published_at,
          media_urls, manual_task_notes, created_by, updated_by
        ) VALUES (
          ${item.uuid}, ${brand.company_id}, ${brand.uuid}, ${item.title}, ${item.body}, ${item.channel},
          ${item.publishMode}, ${item.status}, ${item.scheduledAt}, ${item.publishedAt},
          ${item.mediaUrls}, ${item.notes}, 'system@marketing.seed', 'system@marketing.seed'
        ) ON DUPLICATE KEY UPDATE title=VALUES(title)`.execute(database);
      }
    }
  }
}
