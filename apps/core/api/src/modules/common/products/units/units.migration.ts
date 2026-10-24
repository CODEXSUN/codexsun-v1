import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { CoreDatabase } from "../../../../database/core-database.js";

export const unitsMigration = {
  description: "Units master data.",
  key: "core.common.products.units"
};

export const unitsDefaultsMigration = {
  description: "Add canonical unit defaults without changing existing identities or references.",
  key: "core.common.products.units.defaults-v2"
};

export async function ensureUnitDefaults(database: Kysely<CoreDatabase>) {
  // Reserve ID 1 only while the table is empty. Never repurpose an existing unit.
  await sql`INSERT INTO core_units (id, name, status, sort_order)
    SELECT 1, '-', 'active', 0 WHERE NOT EXISTS (SELECT 1 FROM core_units)
    ON DUPLICATE KEY UPDATE id=id`.execute(database);
  for (const [index, name] of ["-", "pcs", "nos", "Kg", "Meter", "Litre"].entries()) {
    await sql`INSERT INTO core_units (name, status, sort_order)
      SELECT ${name}, 'active', ${index} WHERE NOT EXISTS
        (SELECT 1 FROM core_units WHERE LOWER(TRIM(name))=${name.toLowerCase()})
      ON DUPLICATE KEY UPDATE id=id`.execute(database);
  }
}

export function migrateUnits(database: Kysely<CoreDatabase>) {
  return sql
    .raw(
      `
    CREATE TABLE IF NOT EXISTS core_units (
    uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()),1,8))) UNIQUE,
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      sort_order INT NOT NULL DEFAULT 1000,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY units_name_unique (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `
    )
    .execute(database);
}
