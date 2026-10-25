import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateConversation(database: Kysely<MarketingDatabase>) {
  // 1. Threads
  await sql.raw(
    `CREATE TABLE IF NOT EXISTS marketing_conversation_threads (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(8) NOT NULL UNIQUE,
      revision INT NOT NULL DEFAULT 1,
      company_id INT NOT NULL,
      brand_uuid CHAR(8) NOT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
      contact_identifier VARCHAR(64) NOT NULL,
      contact_name VARCHAR(191) NOT NULL DEFAULT '',
      lead_uuid CHAR(8) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      assigned_to VARCHAR(191) NULL,
      is_human_takeover TINYINT(1) NOT NULL DEFAULT 0,
      stop_condition_met TINYINT(1) NOT NULL DEFAULT 0,
      last_inbound_at DATETIME NULL,
      last_message_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX company_scope (company_id, brand_uuid),
      INDEX contact_lookup (company_id, contact_identifier),
      INDEX status_idx (company_id, status)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  ).execute(database);

  // 2. Messages
  await sql.raw(
    `CREATE TABLE IF NOT EXISTS marketing_conversation_messages (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(8) NOT NULL UNIQUE,
      company_id INT NOT NULL,
      thread_uuid CHAR(8) NOT NULL,
      direction VARCHAR(10) NOT NULL,
      sender VARCHAR(191) NOT NULL,
      content TEXT NOT NULL,
      template_name VARCHAR(64) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'sent',
      error TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX thread_scope (company_id, thread_uuid),
      INDEX status_scope (company_id, status)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  ).execute(database);

  // 3. Nurture Rules
  await sql.raw(
    `CREATE TABLE IF NOT EXISTS marketing_nurture_rules (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(8) NOT NULL UNIQUE,
      company_id INT NOT NULL,
      brand_uuid CHAR(8) NOT NULL,
      name VARCHAR(191) NOT NULL,
      trigger_event VARCHAR(40) NOT NULL,
      max_steps INT NOT NULL DEFAULT 3,
      interval_hours INT NOT NULL DEFAULT 24,
      template_name VARCHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX rule_scope (company_id, brand_uuid)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  ).execute(database);

  // 4. Nurture Enrollments
  await sql.raw(
    `CREATE TABLE IF NOT EXISTS marketing_nurture_enrollments (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(8) NOT NULL UNIQUE,
      company_id INT NOT NULL,
      rule_uuid CHAR(8) NOT NULL,
      thread_uuid CHAR(8) NOT NULL,
      lead_uuid CHAR(8) NULL,
      step_number INT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      stop_reason VARCHAR(40) NULL,
      stopped_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX enrollment_scope (company_id, thread_uuid),
      INDEX rule_enrollment (company_id, rule_uuid),
      INDEX status_idx (company_id, status)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  ).execute(database);

  // 5. Activity log
  await sql.raw(
    `CREATE TABLE IF NOT EXISTS marketing_conversation_activity (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      uuid CHAR(8) NOT NULL UNIQUE,
      company_id INT NOT NULL,
      thread_uuid CHAR(8) NOT NULL,
      action VARCHAR(191) NOT NULL,
      actor VARCHAR(191) NOT NULL,
      occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX thread_activity (company_id, thread_uuid)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  ).execute(database);
}
