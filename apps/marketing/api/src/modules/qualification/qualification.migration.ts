import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateQualification(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_qualifications (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  brand_uuid CHAR(8) NOT NULL,
  lead_uuid CHAR(8) NOT NULL,
  reviewer VARCHAR(191) NOT NULL,
  decision VARCHAR(24) NOT NULL,
  criteria VARCHAR(500) NOT NULL DEFAULT '',
  reason VARCHAR(500) NOT NULL,
  notes TEXT,
  revision INT NOT NULL DEFAULT 1,
  created_by VARCHAR(191) NOT NULL,
  updated_by VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX qual_company_brand(company_id, brand_uuid),
  INDEX qual_company_lead(company_id, lead_uuid),
  INDEX qual_decision(company_id, decision)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_qualifications_activity (
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
