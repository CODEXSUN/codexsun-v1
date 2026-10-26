import { sql, type Kysely } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";
import {
  canonicalStoredOptionSignature,
  findCanonicalOptionDuplicateGroups,
  type CanonicalOptionIdentityRow
} from "./product-variant.identity.js";
import { variantWriterRoutines, variantWriterTrigger } from "./product-variant.writer-sql.js";
import { variantWriterParityCases } from "./product-variant.writer-cases.js";

export async function upgradeProductVariantLegacyWriters(database: Kysely<EcommerceDatabase>) {
  const rows = await sql<CanonicalOptionIdentityRow & { databaseSignature: string }>`SELECT id,
    product_information_id AS productInformationId, sku,
    option_1_name AS option1Name, option_1_value AS option1Value,
    option_2_name AS option2Name, option_2_value AS option2Value,
    option_3_name AS option3Name, option_3_value AS option3Value
    FROM ecommerce_product_variants`.execute(database);
  if (findCanonicalOptionDuplicateGroups(rows.rows).length) {
    throw new Error("Legacy-writer upgrade refused canonical duplicates. No rows were changed.");
  }
  for (const statement of variantWriterRoutines()) await sql.raw(statement).execute(database);
  for (const fixture of variantWriterParityCases) {
    const probe = await sql<{
      signature: string;
    }>`SELECT ecommerce_variant_signature_v1(${fixture.columns[0]},${fixture.columns[1]},${fixture.columns[2]},${fixture.columns[3]},${fixture.columns[4]},${fixture.columns[5]}) AS signature`.execute(
      database
    );
    if (probe.rows[0]?.signature !== fixture.expectedSignature) {
      throw new Error(
        "Database canonical signature parity probe failed. Preserve rows and review the database environment."
      );
    }
  }
  // Verify database encoding/normalization against the application before changing business rows.
  const checked = await sql<CanonicalOptionIdentityRow & { databaseSignature: string }>`SELECT id,
    product_information_id AS productInformationId, sku,
    option_1_name AS option1Name, option_1_value AS option1Value,
    option_2_name AS option2Name, option_2_value AS option2Value,
    option_3_name AS option3Name, option_3_value AS option3Value,
    ecommerce_variant_signature_v1(option_1_name,option_1_value,option_2_name,option_2_value,option_3_name,option_3_value) AS databaseSignature
    FROM ecommerce_product_variants`.execute(database);
  if (checked.rows.some((row) => row.databaseSignature !== canonicalStoredOptionSignature(row))) {
    throw new Error(
      "Database/application canonical signatures disagree. Preserve rows and review the database environment."
    );
  }
  await sql.raw(variantWriterTrigger("INSERT")).execute(database);
  await sql.raw(variantWriterTrigger("UPDATE")).execute(database);
  // The sentinel admits old INSERTs. BEFORE triggers replace it before unique-key checks.
  await sql
    .raw(
      "ALTER TABLE ecommerce_product_variants MODIFY COLUMN option_signature CHAR(64) NOT NULL DEFAULT ''"
    )
    .execute(database);
  await sql
    .raw(
      "UPDATE ecommerce_product_variants SET option_signature=ecommerce_variant_signature_v1(option_1_name,option_1_value,option_2_name,option_2_value,option_3_name,option_3_value)"
    )
    .execute(database);
}
