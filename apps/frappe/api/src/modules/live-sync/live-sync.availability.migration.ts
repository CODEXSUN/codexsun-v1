import { sql, type Kysely } from "kysely";
import type { FrappeDatabase } from "../connection/connection.types.js";

export async function addFrappeAvailability(database: Kysely<FrappeDatabase>) {
  await sql`CREATE TABLE IF NOT EXISTS frappe_availability_settings (
    id INT NOT NULL PRIMARY KEY,
    schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
    opens_at CHAR(5) NOT NULL DEFAULT '08:00',
    closes_at CHAR(5) NOT NULL DEFAULT '21:00',
    connection_status VARCHAR(16) NOT NULL DEFAULT 'unknown',
    checked_base_url VARCHAR(2048) NULL,
    last_checked_at DATETIME(3) NULL,
    next_check_at DATETIME(3) NULL,
    last_error TEXT NULL,
    updated_by VARCHAR(191) NOT NULL DEFAULT 'system',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`.execute(database);
  await sql`INSERT INTO frappe_availability_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id`.execute(
    database
  );
}
