import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateEmailCampaign(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_email_senders (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  brand_uuid CHAR(8) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(191) NOT NULL,
  domain VARCHAR(191) NOT NULL,
  spf_status VARCHAR(24) NOT NULL DEFAULT 'verified',
  dkim_status VARCHAR(24) NOT NULL DEFAULT 'verified',
  dmarc_status VARCHAR(24) NOT NULL DEFAULT 'verified',
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY sender_email_brand (company_id, brand_uuid, email),
  INDEX sender_brand (company_id, brand_uuid)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_email_campaigns (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  brand_uuid CHAR(8) NOT NULL,
  campaign_uuid CHAR(8) NULL,
  sender_uuid CHAR(8) NOT NULL,
  from_name VARCHAR(160) NOT NULL,
  from_email VARCHAR(191) NOT NULL,
  reply_to VARCHAR(191) NOT NULL,
  name VARCHAR(160) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  preheader VARCHAR(255) NOT NULL DEFAULT '',
  body_html MEDIUMTEXT NOT NULL,
  body_text MEDIUMTEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  rejection_reason VARCHAR(500) NULL,
  scheduled_at DATETIME NULL,
  sent_count INT NOT NULL DEFAULT 0,
  suppressed_count INT NOT NULL DEFAULT 0,
  bounced_count INT NOT NULL DEFAULT 0,
  complained_count INT NOT NULL DEFAULT 0,
  unsubscribed_count INT NOT NULL DEFAULT 0,
  total_recipients INT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  created_by VARCHAR(191) NOT NULL,
  updated_by VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX email_camp_brand (company_id, brand_uuid),
  INDEX email_camp_status (company_id, status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_email_recipients (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  email_campaign_uuid CHAR(8) NOT NULL,
  recipient_email VARCHAR(191) NOT NULL,
  lead_uuid CHAR(8) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'enqueued',
  suppression_reason VARCHAR(100) NULL,
  unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
  sent_at DATETIME NULL,
  error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX recip_campaign (company_id, email_campaign_uuid),
  INDEX recip_status (company_id, email_campaign_uuid, status),
  INDEX recip_email (company_id, recipient_email)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_email_campaigns_activity (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  record_uuid CHAR(8) NOT NULL,
  action VARCHAR(191) NOT NULL,
  actor VARCHAR(191) NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX record_scope (company_id, record_uuid)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}
