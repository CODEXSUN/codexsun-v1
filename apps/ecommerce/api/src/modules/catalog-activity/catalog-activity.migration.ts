import { sql, type Kysely } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";

export const catalogActivityMigration = {
  description: "Tenant-scoped staff activity for catalog definitions and collections.",
  key: "ecommerce.catalog.activity"
} as const;

export async function migrateCatalogActivityModule(_database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_staff_catalog_activity (
  created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  resource_type VARCHAR(32) NOT NULL,
  record_id INT NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor_email VARCHAR(191) NOT NULL,
  summary VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ecommerce_staff_catalog_activity_record (resource_type, record_id, created_at, id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(_database);
}
