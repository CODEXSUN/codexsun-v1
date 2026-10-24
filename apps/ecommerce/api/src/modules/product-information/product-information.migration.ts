import { sql, type Kysely } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";

export const productInformationMigration = {
  description: "Ecommerce product information linked to Core products.",
  key: "ecommerce.catalog.product-information"
} as const;

export async function migrateProductInformationModule(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_product_information (
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL UNIQUE,
    core_product_id INT NOT NULL,
    brand_id INT NULL,
    storefront_title VARCHAR(191) NOT NULL,
    subtitle VARCHAR(255) NOT NULL DEFAULT '',
    slug VARCHAR(191) NOT NULL,
    short_description VARCHAR(500) NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    bullet_points_json TEXT NOT NULL,
    material VARCHAR(191) NOT NULL DEFAULT '',
    country_of_origin VARCHAR(120) NOT NULL DEFAULT '',
    manufacturer VARCHAR(191) NOT NULL DEFAULT '',
    warranty VARCHAR(500) NOT NULL DEFAULT '',
    return_policy VARCHAR(500) NOT NULL DEFAULT '',
    shipping_class VARCHAR(120) NOT NULL DEFAULT 'standard',
    weight DECIMAL(12,3) NOT NULL DEFAULT 0,
    length DECIMAL(12,3) NOT NULL DEFAULT 0,
    width DECIMAL(12,3) NOT NULL DEFAULT 0,
    height DECIMAL(12,3) NOT NULL DEFAULT 0,
    minimum_order_quantity INT NOT NULL DEFAULT 1,
    maximum_order_quantity INT NULL,
    seo_title VARCHAR(191) NOT NULL DEFAULT '',
    seo_description VARCHAR(320) NOT NULL DEFAULT '',
    publication_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    revision INT NOT NULL DEFAULT 1,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ecommerce_product_information_core_unique (core_product_id),
    UNIQUE KEY ecommerce_product_information_slug_unique (slug),
    INDEX ecommerce_product_information_publication (publication_status, is_featured),
    CONSTRAINT ecommerce_product_information_core_fk FOREIGN KEY (core_product_id)
      REFERENCES core_products(id) ON DELETE RESTRICT,
    CONSTRAINT ecommerce_product_information_brand_fk FOREIGN KEY (brand_id)
      REFERENCES core_brands(id) ON DELETE RESTRICT
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

export const productInformationDetailsMigration = {
  description: "Add complete hosted-store product detail fields.",
  key: "ecommerce.catalog.product-information-details-v2"
} as const;

export async function upgradeProductInformationDetails(database: Kysely<EcommerceDatabase>) {
  const statements = [
    "ADD COLUMN IF NOT EXISTS brand_id INT NULL AFTER core_product_id",
    "ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255) NOT NULL DEFAULT '' AFTER storefront_title",
    "ADD COLUMN IF NOT EXISTS bullet_points_json TEXT NOT NULL AFTER description",
    "ADD COLUMN IF NOT EXISTS material VARCHAR(191) NOT NULL DEFAULT ''",
    "ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(120) NOT NULL DEFAULT ''",
    "ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(191) NOT NULL DEFAULT ''",
    "ADD COLUMN IF NOT EXISTS warranty VARCHAR(500) NOT NULL DEFAULT ''",
    "ADD COLUMN IF NOT EXISTS return_policy VARCHAR(500) NOT NULL DEFAULT ''",
    "ADD COLUMN IF NOT EXISTS shipping_class VARCHAR(120) NOT NULL DEFAULT 'standard'",
    "ADD COLUMN IF NOT EXISTS weight DECIMAL(12,3) NOT NULL DEFAULT 0",
    "ADD COLUMN IF NOT EXISTS length DECIMAL(12,3) NOT NULL DEFAULT 0",
    "ADD COLUMN IF NOT EXISTS width DECIMAL(12,3) NOT NULL DEFAULT 0",
    "ADD COLUMN IF NOT EXISTS height DECIMAL(12,3) NOT NULL DEFAULT 0",
    "ADD COLUMN IF NOT EXISTS minimum_order_quantity INT NOT NULL DEFAULT 1",
    "ADD COLUMN IF NOT EXISTS maximum_order_quantity INT NULL"
  ];
  for (const statement of statements) {
    await sql.raw(`ALTER TABLE ecommerce_product_information ${statement}`).execute(database);
  }
  const constraints = await sql<{ count: number | string }>`SELECT COUNT(*) AS count
    FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()
    AND TABLE_NAME='ecommerce_product_information'
    AND CONSTRAINT_NAME='ecommerce_product_information_brand_fk'`.execute(database);
  if (Number(constraints.rows[0]?.count ?? 0) === 0) {
    await sql
      .raw(
        `ALTER TABLE ecommerce_product_information ADD CONSTRAINT
      ecommerce_product_information_brand_fk FOREIGN KEY (brand_id)
      REFERENCES core_brands(id) ON DELETE RESTRICT`
      )
      .execute(database);
  }
}

export const productInformationRevisionMigration = {
  description: "Add optimistic edit revision to product information.",
  key: "ecommerce.catalog.product-information-revision"
} as const;

export async function upgradeProductInformationRevision(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      "ALTER TABLE ecommerce_product_information ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1"
    )
    .execute(database);
}
