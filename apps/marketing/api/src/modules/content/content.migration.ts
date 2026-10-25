import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateContent(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_contents (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  brand_uuid CHAR(8) NOT NULL,
  campaign_uuid CHAR(8) NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  channel VARCHAR(40) NOT NULL,
  publish_mode VARCHAR(20) NOT NULL DEFAULT 'api',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME NULL,
  published_at DATETIME NULL,
  media_urls JSON NULL,
  rejection_reason VARCHAR(500) NULL,
  manual_task_notes TEXT NULL,
  manual_completed_at DATETIME NULL,
  manual_completed_by VARCHAR(191) NULL,
  external_post_id VARCHAR(191) NULL,
  approved_by VARCHAR(191) NULL,
  approved_at DATETIME NULL,
  revision INT NOT NULL DEFAULT 1,
  created_by VARCHAR(191) NOT NULL,
  updated_by VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX content_company_brand (company_id, brand_uuid),
  INDEX content_company_campaign (company_id, campaign_uuid),
  INDEX content_status_sched (company_id, status, scheduled_at),
  INDEX content_channel_status (company_id, channel, status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_contents_activity (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  record_uuid CHAR(8) NOT NULL,
  company_id INT NOT NULL,
  action VARCHAR(40) NOT NULL,
  actor VARCHAR(191) NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX record_scope (company_id, record_uuid)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}
