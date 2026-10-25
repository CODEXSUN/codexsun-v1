import { sql, type Kysely } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";

export const productCollectionMigration = {
  description: "Curated product collections and their ordered product membership.",
  key: "ecommerce.catalog.product-collection"
} as const;

export async function migrateProductCollectionModule(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_product_collections (
  created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  slug VARCHAR(191) NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NOT NULL,
  hero_image_url VARCHAR(1000) NOT NULL DEFAULT '',
  publication_status VARCHAR(24) NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 1000,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ecommerce_product_collections_slug_unique (slug),
  INDEX ecommerce_product_collections_publication (publication_status, sort_order)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_product_collection_items (
  created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(8) NOT NULL UNIQUE,
  collection_id INT NOT NULL,
  product_information_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1000,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ecommerce_product_collection_items_unique (collection_id, product_information_id),
  INDEX ecommerce_product_collection_items_product (product_information_id),
  CONSTRAINT ecommerce_product_collection_items_collection_fk FOREIGN KEY (collection_id)
    REFERENCES ecommerce_product_collections(id) ON DELETE CASCADE,
  CONSTRAINT ecommerce_product_collection_items_product_fk FOREIGN KEY (product_information_id)
    REFERENCES ecommerce_product_information(id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}
