import { sql, type Kysely } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";
import {
  canonicalStoredOptionSignature,
  findCanonicalOptionDuplicateGroups,
  PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH,
  type CanonicalOptionIdentityRow,
  type CanonicalOptionDuplicateGroup
} from "./product-variant.identity.js";

const OPTION_UNIQUE_INDEX = "ecommerce_product_variants_option_unique";
type MigrationOptionRow = CanonicalOptionIdentityRow & { id: number | string };

export const productVariantMigration = {
  description: "Purchasable catalog product variants.",
  key: "ecommerce.catalog.product-variant"
} as const;
export async function migrateProductVariantModule(database: Kysely<EcommerceDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ecommerce_product_variants (
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration', id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL UNIQUE, product_information_id INT NOT NULL, sku VARCHAR(120) NOT NULL,
    title VARCHAR(191) NOT NULL, barcode VARCHAR(120) NOT NULL DEFAULT '', option_1_name VARCHAR(80) NOT NULL DEFAULT '',
    option_1_value VARCHAR(120) NOT NULL DEFAULT '', option_2_name VARCHAR(80) NOT NULL DEFAULT '',
    option_2_value VARCHAR(120) NOT NULL DEFAULT '', option_3_name VARCHAR(80) NOT NULL DEFAULT '',
    option_3_value VARCHAR(120) NOT NULL DEFAULT '', price_adjustment DECIMAL(14,2) NOT NULL DEFAULT 0,
    compare_at_adjustment DECIMAL(14,2) NOT NULL DEFAULT 0, cost_adjustment DECIMAL(14,2) NOT NULL DEFAULT 0,
    option_signature CHAR(64) NOT NULL, weight DECIMAL(12,3) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 1000, revision INT NOT NULL DEFAULT 1,
    status VARCHAR(24) NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ecommerce_product_variants_sku_unique (sku),
    UNIQUE KEY ecommerce_product_variants_option_unique (product_information_id,option_signature),
    INDEX ecommerce_product_variants_product (product_information_id,status,sort_order),
    CONSTRAINT ecommerce_product_variants_product_fk FOREIGN KEY (product_information_id)
      REFERENCES ecommerce_product_information(id) ON DELETE RESTRICT
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

export const productVariantOptionsMigration = {
  description: "Add optimistic revision and option-signature storage before canonical identity.",
  key: "ecommerce.catalog.product-variant-options"
} as const;

export async function upgradeProductVariantOptions(database: Kysely<EcommerceDatabase>) {
  const statements = [
    "ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1",
    `ADD COLUMN IF NOT EXISTS option_signature CHAR(${PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH}) NOT NULL DEFAULT ''`
  ];
  for (const statement of statements) {
    await sql.raw(`ALTER TABLE ecommerce_product_variants ${statement}`).execute(database);
  }
}

export const productVariantCanonicalOptionsMigration = {
  description: "Canonical, slot-independent SHA-256 variant option identity.",
  key: "ecommerce.catalog.product-variant-canonical-options"
} as const;

export async function upgradeProductVariantCanonicalOptions(database: Kysely<EcommerceDatabase>) {
  const rows = await sql<MigrationOptionRow>`SELECT id,
    product_information_id AS productInformationId, sku,
    option_1_name AS option1Name, option_1_value AS option1Value,
    option_2_name AS option2Name, option_2_value AS option2Value,
    option_3_name AS option3Name, option_3_value AS option3Value
    FROM ecommerce_product_variants`.execute(database);

  // Detect every canonical collision before dropping the legacy index or mutating rows.
  const duplicateGroups = findCanonicalOptionDuplicateGroups(rows.rows);
  if (duplicateGroups.length > 0) throw canonicalDuplicateError(duplicateGroups);

  const column = await sql<{
    character_maximum_length: number | string | null;
  }>`SELECT CHARACTER_MAXIMUM_LENGTH AS character_maximum_length
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ecommerce_product_variants'
      AND COLUMN_NAME='option_signature' LIMIT 1`.execute(database);
  if (!column.rows[0]) {
    await sql
      .raw(
        `ALTER TABLE ecommerce_product_variants ADD COLUMN option_signature CHAR(${PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH}) NOT NULL DEFAULT ''`
      )
      .execute(database);
  } else {
    const currentLength = Number(column.rows[0].character_maximum_length ?? 0);
    if (currentLength > 0 && currentLength < PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH) {
      await sql
        .raw(
          "ALTER TABLE ecommerce_product_variants MODIFY COLUMN option_signature VARCHAR(191) NOT NULL DEFAULT ''"
        )
        .execute(database);
    }
  }

  const indexColumns = await sql<{
    column_name: string;
    non_unique: number | string;
    seq_in_index: number | string;
  }>`SELECT COLUMN_NAME AS column_name, NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS seq_in_index
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ecommerce_product_variants'
      AND INDEX_NAME=${OPTION_UNIQUE_INDEX}
    ORDER BY SEQ_IN_INDEX`.execute(database);
  const hasCanonicalIndex =
    indexColumns.rows.length === 2 &&
    Number(indexColumns.rows[0]?.non_unique ?? 1) === 0 &&
    String(indexColumns.rows[0]?.column_name) === "product_information_id" &&
    String(indexColumns.rows[1]?.column_name) === "option_signature";
  if (indexColumns.rows.length > 0 && !hasCanonicalIndex) {
    await sql
      .raw(`ALTER TABLE ecommerce_product_variants DROP INDEX ${OPTION_UNIQUE_INDEX}`)
      .execute(database);
  }

  // Rewriting under the existing (product, signature) unique index keeps the table protected
  // throughout. The canonical preflight above proves the new signatures cannot collide, so the
  // index does not need a constraint-free window.
  for (const row of rows.rows) {
    const optionSignature = canonicalStoredOptionSignature(row);
    await sql`UPDATE ecommerce_product_variants SET option_signature=${optionSignature}
      WHERE id=${row.id}`.execute(database);
  }

  await sql
    .raw(
      `ALTER TABLE ecommerce_product_variants MODIFY COLUMN option_signature CHAR(${PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH}) NOT NULL`
    )
    .execute(database);

  if (!hasCanonicalIndex) {
    await sql
      .raw(
        `ALTER TABLE ecommerce_product_variants ADD UNIQUE KEY ${OPTION_UNIQUE_INDEX} (product_information_id,option_signature)`
      )
      .execute(database);
  }
}

function canonicalDuplicateError(groups: readonly CanonicalOptionDuplicateGroup[]): Error {
  const details = groups
    .map((group) => {
      const skus = group.rows.map((row) => String(row.sku)).join(", ");
      return `Product ${group.productInformationId}: ${skus}`;
    })
    .join("\n");
  return new Error(
    `Cannot apply ${productVariantCanonicalOptionsMigration.key}: ${groups.length} canonical product option duplicate group(s) exist. No rows were deleted or merged. Resolve these variants and rerun the migration:\n${details}`
  );
}
