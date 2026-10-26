import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";
import { variantWriterParityCases } from "./product-variant.writer-cases.js";

/** Explicit disposable-staging acceptance. Never called by startup or migration. */
export async function verifyProductVariantWriterCompatibility(
  database: Kysely<EcommerceDatabase>,
  productId: number
) {
  const scope = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(database);
  assert.match(scope.rows[0]?.name ?? "", /^codexsun_staging_/);
  const sentinel = new Error("Rollback synthetic writer verification");
  let checks = 0;
  try {
    await database.transaction().execute(async (transaction) => {
      for (const fixture of variantWriterParityCases) {
        const result = await sql<{
          signature: string;
        }>`SELECT ecommerce_variant_signature_v1(${fixture.columns[0]},${fixture.columns[1]},${fixture.columns[2]},${fixture.columns[3]},${fixture.columns[4]},${fixture.columns[5]}) AS signature`.execute(
          transaction
        );
        assert.equal(result.rows[0]?.signature, fixture.expectedSignature);
        checks++;
      }
      const first = await insert(transaction, productId, 0, false);
      const second = await insert(transaction, productId, 2, true);
      assert.notEqual(first, second);
      await assert.rejects(insert(transaction, productId, 1, false), duplicate);
      await assert.rejects(insert(transaction, productId, 1, true), duplicate);
      checks += 4;
      const changed = variantWriterParityCases[3]!;
      // Legacy UPDATE omits the signature and must replace the previously stored identity.
      await sql`UPDATE ecommerce_product_variants SET option_1_name=${changed.columns[0]},option_1_value=${changed.columns[1]},option_2_name=${changed.columns[2]},option_2_value=${changed.columns[3]},option_3_name=${changed.columns[4]},option_3_value=${changed.columns[5]} WHERE id=${first}`.execute(
        transaction
      );
      const stored = await sql<{
        signature: string;
        revision: number;
      }>`SELECT option_signature AS signature, revision FROM ecommerce_product_variants WHERE id=${first}`.execute(
        transaction
      );
      assert.equal(stored.rows[0]?.signature, changed.expectedSignature);
      assert.equal(Number(stored.rows[0]?.revision), 2);
      await assert.rejects(insert(transaction, productId, 3, true), duplicate);
      await assert.rejects(
        sql`UPDATE ecommerce_product_variants SET option_1_name=${changed.columns[0]},option_1_value=${changed.columns[1]},option_2_name=${changed.columns[2]},option_2_value=${changed.columns[3]},option_3_name=${changed.columns[4]},option_3_value=${changed.columns[5]},option_signature=${changed.expectedSignature},revision=revision+1 WHERE id=${second}`.execute(
          transaction
        ),
        duplicate
      );
      checks += 4;
      throw sentinel;
    });
  } catch (error) {
    if (error !== sentinel) throw error;
  }
  return { checks, rolledBack: true, productionAcceptance: false };
}

async function insert(
  database: Transaction<EcommerceDatabase>,
  productId: number,
  index: number,
  modern: boolean
) {
  const fixture = variantWriterParityCases[index]!;
  const uuid = randomBytes(4).toString("hex");
  const signatureColumn = modern ? sql`,option_signature` : sql``;
  const signatureValue = modern ? sql`,${fixture.expectedSignature}` : sql``;
  const result = await sql`INSERT INTO ecommerce_product_variants
    (uuid,product_information_id,sku,title,barcode,option_1_name,option_1_value,option_2_name,option_2_value,option_3_name,option_3_value,price_adjustment,compare_at_adjustment,cost_adjustment,weight,sort_order,status${signatureColumn})
    VALUES (${uuid},${productId},${`writer-proof-${uuid}`},'Synthetic writer proof','',${fixture.columns[0]},${fixture.columns[1]},${fixture.columns[2]},${fixture.columns[3]},${fixture.columns[4]},${fixture.columns[5]},0,0,0,0,1000,'active'${signatureValue})`.execute(
    database
  );
  return Number(result.insertId);
}

function duplicate(error: unknown) {
  return (error as { code?: string }).code === "ER_DUP_ENTRY";
}
