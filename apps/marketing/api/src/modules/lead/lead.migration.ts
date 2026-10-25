import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateLead(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_leads (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  brand_uuid CHAR(8) NOT NULL,
  campaign_uuid CHAR(8) NOT NULL DEFAULT '',
  capture_uuid CHAR(8) NOT NULL DEFAULT '',
  submission_uuid CHAR(8) NOT NULL DEFAULT '',
  source VARCHAR(80) NOT NULL DEFAULT 'direct',
  source_reference VARCHAR(191) NOT NULL DEFAULT '',
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  company_name VARCHAR(160) NOT NULL DEFAULT '',
  notes TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'new',
  assigned_to VARCHAR(191) NOT NULL DEFAULT '',
  score INT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  created_by VARCHAR(191) NOT NULL,
  updated_by VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX lead_company_brand(company_id, brand_uuid),
  INDEX lead_submission(company_id, submission_uuid),
  INDEX lead_status(company_id, status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_leads_activity (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  record_uuid CHAR(8) NOT NULL,
  company_id INT NOT NULL,
  action VARCHAR(40) NOT NULL,
  actor VARCHAR(191) NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX record_scope(company_id, record_uuid)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}
