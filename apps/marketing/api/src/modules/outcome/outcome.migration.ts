import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateOutcome(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_outcomes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  brand_uuid CHAR(8) NOT NULL,
  lead_uuid CHAR(8) NOT NULL,
  qualification_uuid CHAR(8) NOT NULL DEFAULT '',
  conversion_uuid CHAR(8) NOT NULL DEFAULT '',
  disposition VARCHAR(24) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  previous_outcome_uuid CHAR(8) NULL,
  notes TEXT,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INT NOT NULL DEFAULT 1,
  created_by VARCHAR(191) NOT NULL,
  updated_by VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX outcome_company_brand (company_id, brand_uuid),
  INDEX outcome_company_lead (company_id, lead_uuid),
  INDEX outcome_disposition (company_id, disposition)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_outcomes_activity (
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
