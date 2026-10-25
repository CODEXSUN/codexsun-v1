import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateConversion(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_conversions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  company_id INT NOT NULL,
  brand_uuid CHAR(8) NOT NULL,
  lead_uuid CHAR(8) NOT NULL,
  qualification_uuid CHAR(8) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'converted',
  declared_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  cancellation_reason VARCHAR(500) NOT NULL DEFAULT '',
  notes TEXT,
  converted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INT NOT NULL DEFAULT 1,
  created_by VARCHAR(191) NOT NULL,
  updated_by VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY conv_company_lead (company_id, lead_uuid),
  INDEX conv_company_brand (company_id, brand_uuid),
  INDEX conv_status (company_id, status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_conversions_activity (
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
