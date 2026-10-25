import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateConsent(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_consent_events (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    brand_uuid CHAR(8) NOT NULL,
    recipient VARCHAR(254) NOT NULL,
    channel VARCHAR(24) NOT NULL,
    purpose VARCHAR(24) NOT NULL,
    action VARCHAR(24) NOT NULL,
    notice_version VARCHAR(80) NOT NULL,
    evidence VARCHAR(500) NOT NULL,
    source VARCHAR(160) NOT NULL,
    occurred_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NULL,
    request_key VARCHAR(80) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_by VARCHAR(191) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY consent_request (company_id,request_key),
    INDEX consent_subject (company_id,brand_uuid,recipient,channel,purpose,id),
    FOREIGN KEY (brand_uuid) REFERENCES marketing_brands(uuid) ON DELETE RESTRICT
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);

  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_contact_restrictions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    recipient VARCHAR(254) NOT NULL,
    channel VARCHAR(24) NOT NULL DEFAULT 'all',
    blocked BOOLEAN NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_by VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX mkt_restriction_subject(company_id,recipient,channel,id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}
