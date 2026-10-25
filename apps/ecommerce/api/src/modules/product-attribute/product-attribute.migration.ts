import { sql, type Kysely } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";

export const productAttributeMigration = {
  description: "Product attribute definitions and tenant-scoped product values.",
  key: "ecommerce.catalog.product-attribute"
} as const;

export async function migrateProductAttributeModule(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_product_attributes (
  created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  data_type VARCHAR(24) NOT NULL DEFAULT 'text',
  unit VARCHAR(32) NOT NULL DEFAULT '',
  is_filterable TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 1000,
  revision INT NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ecommerce_product_attributes_code_unique (code),
  INDEX ecommerce_product_attributes_status (status, sort_order)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_product_attribute_values (
  created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  product_information_id INT NOT NULL,
  attribute_id INT NOT NULL,
  value VARCHAR(191) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1000,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ecommerce_product_attribute_values_unique (product_information_id, attribute_id, value),
  INDEX ecommerce_product_attribute_values_attribute (attribute_id, value),
  CONSTRAINT ecommerce_product_attribute_values_product_fk FOREIGN KEY (product_information_id)
    REFERENCES ecommerce_product_information(id) ON DELETE CASCADE,
  CONSTRAINT ecommerce_product_attribute_values_attribute_fk FOREIGN KEY (attribute_id)
    REFERENCES ecommerce_product_attributes(id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

export const productAttributeRevisionMigration = {
  description: "Add optimistic edit revision to product attributes.",
  key: "ecommerce.catalog.product-attribute-revision"
} as const;

export async function upgradeProductAttributeRevision(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      "ALTER TABLE ecommerce_product_attributes ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1"
    )
    .execute(database);
}
