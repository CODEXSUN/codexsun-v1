import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { getCoreDatabase } from "../../../database/core-database.js";
export async function seedProductModule() {
  await sql`INSERT IGNORE INTO core_products (uuid, name, status) VALUES (${randomBytes(4).toString("hex")}, '-', 'active')`.execute(
    getCoreDatabase()
  );
  await sql`UPDATE core_products SET
    unit_id=(SELECT id FROM core_units WHERE status='active'
      AND TRIM(name)='-' LIMIT 1)
    WHERE unit_id IS NULL AND deleted_at IS NULL`.execute(getCoreDatabase());
  await sql`UPDATE core_products SET
    product_type_id=COALESCE(product_type_id,(SELECT id FROM core_product_types WHERE status='active' ORDER BY CASE WHEN TRIM(name)='-' THEN 0 ELSE 1 END,id LIMIT 1)),
    product_category_id=COALESCE(product_category_id,(SELECT id FROM core_product_categories WHERE status='active' ORDER BY CASE WHEN TRIM(name)='-' THEN 0 ELSE 1 END,id LIMIT 1)),
    hsn_code_id=COALESCE(hsn_code_id,(SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY CASE WHEN TRIM(code)='-' THEN 0 ELSE 1 END,id LIMIT 1)),
    gst_tax_id=COALESCE(gst_tax_id,(SELECT id FROM core_taxes WHERE status='active' ORDER BY CASE WHEN TRIM(description)='-' THEN 0 ELSE 1 END,id LIMIT 1))
    WHERE name='-'`.execute(getCoreDatabase());
}
