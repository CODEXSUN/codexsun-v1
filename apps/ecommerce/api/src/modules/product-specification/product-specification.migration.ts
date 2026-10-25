import { sql, type Kysely } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";

export const productSpecificationMigration = {
  description: "Ordered product specification rows.",
  key: "ecommerce.catalog.product-specification"
} as const;

export async function migrateProductSpecificationModule(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_product_specifications (
  created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  product_information_id INT NOT NULL,
  label VARCHAR(120) NOT NULL,
  value VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1000,
  revision INT NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ecommerce_product_specifications_label_unique (product_information_id, label),
  INDEX ecommerce_product_specifications_product (product_information_id, status, sort_order),
  CONSTRAINT ecommerce_product_specifications_product_fk FOREIGN KEY (product_information_id)
    REFERENCES ecommerce_product_information(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

export const productSpecificationRevisionMigration = {
  description: "Add optimistic edit revision to product specifications.",
  key: "ecommerce.catalog.product-specification-revision"
} as const;

export async function upgradeProductSpecificationRevision(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      "ALTER TABLE ecommerce_product_specifications ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1"
    )
    .execute(database);
}
