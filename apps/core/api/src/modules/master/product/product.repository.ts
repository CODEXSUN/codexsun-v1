import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { getCoreDatabase } from "../../../database/core-database.js";
import type {
  ProductListFilters,
  ProductRecord,
  ProductReferenceDefaults,
  ProductSaveInput,
  ProductStatus
} from "./product.types.js";

type ProductRow = {
  id: number | string;
  uuid: string;
  name: string;
  product_type_id: number | string | null;
  product_category_id: number | string | null;
  hsn_code_id: number | string | null;
  unit_id: number | string | null;
  gst_tax_id: number | string | null;
  product_type_name: string | null;
  product_category_name: string | null;
  hsn_code: string | null;
  unit_name: string | null;
  tax_name: string | null;
  tax_rate: number | string | null;
  opening_qty: number | string;
  opening_price: number | string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
};

export class ProductRepository {
  async defaultReferences(): Promise<ProductReferenceDefaults> {
    const result = await sql<{
      type_id: number | string | null;
      category_id: number | string | null;
      hsn_id: number | string | null;
      unit_id: number | string | null;
      tax_id: number | string | null;
    }>`SELECT
      (SELECT id FROM core_product_types WHERE status='active' ORDER BY CASE WHEN TRIM(name)='-' THEN 0 ELSE 1 END, id LIMIT 1) AS type_id,
      (SELECT id FROM core_product_categories WHERE status='active' ORDER BY CASE WHEN TRIM(name)='-' THEN 0 ELSE 1 END, id LIMIT 1) AS category_id,
      (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY CASE WHEN TRIM(code)='-' THEN 0 ELSE 1 END, id LIMIT 1) AS hsn_id,
      (SELECT id FROM core_units WHERE status='active'
        AND TRIM(name)='-' LIMIT 1) AS unit_id,
      (SELECT id FROM core_taxes WHERE status='active' ORDER BY CASE WHEN TRIM(description)='-' THEN 0 ELSE 1 END, id LIMIT 1) AS tax_id`.execute(
      getCoreDatabase()
    );
    const row = result.rows[0];
    return {
      typeId: nullableNumber(row?.type_id),
      productCategoryId: nullableNumber(row?.category_id),
      hsnCodeId: nullableNumber(row?.hsn_id),
      unitId: nullableNumber(row?.unit_id),
      taxId: nullableNumber(row?.tax_id)
    };
  }

  async hasActiveProductType(id: number) {
    const result = await sql<{ id: number }>`SELECT id FROM core_product_types
      WHERE id=${id} AND status='active' LIMIT 1`.execute(getCoreDatabase());
    return Boolean(result.rows[0]);
  }

  async hasActiveProductCategory(id: number) {
    const result = await sql<{ id: number }>`SELECT id FROM core_product_categories
      WHERE id=${id} AND status='active' LIMIT 1`.execute(getCoreDatabase());
    return Boolean(result.rows[0]);
  }

  async hasActiveHsnCode(id: number) {
    const result = await sql<{ id: number }>`SELECT id FROM core_hsn_codes
      WHERE id=${id} AND status='active' LIMIT 1`.execute(getCoreDatabase());
    return Boolean(result.rows[0]);
  }

  async hasActiveUnit(id: number) {
    const result = await sql<{ id: number }>`SELECT id FROM core_units
      WHERE id=${id} AND status='active' LIMIT 1`.execute(getCoreDatabase());
    return Boolean(result.rows[0]);
  }

  async hasActiveTax(id: number) {
    const result = await sql<{ id: number }>`SELECT id FROM core_taxes
      WHERE id=${id} AND status='active' LIMIT 1`.execute(getCoreDatabase());
    return Boolean(result.rows[0]);
  }

  async list(filters: ProductListFilters = {}) {
    const search = filters.search?.trim().toLowerCase() ?? "";
    const result = await sql<ProductRow>`${productSelect()}
      WHERE core_products.deleted_at IS NULL AND (${search} = '' OR LOWER(core_products.name) LIKE ${`%${search}%`})
      ORDER BY core_products.name, core_products.id`.execute(getCoreDatabase());
    return result.rows.map(toProduct);
  }

  async find(id: string | number) {
    const result = await sql<ProductRow>`${productSelect()}
      WHERE core_products.id=${Number(id)} AND core_products.deleted_at IS NULL LIMIT 1`.execute(
      getCoreDatabase()
    );
    return result.rows[0] ? toProduct(result.rows[0]) : null;
  }

  async create(input: ProductSaveInput) {
    const value = normalize(input);
    const result = await sql`INSERT INTO core_products
      (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id,
       opening_qty, opening_price, status)
      VALUES (${randomBytes(4).toString("hex")}, ${value.name}, ${value.typeId},
       ${value.productCategoryId}, ${value.hsnCodeId}, ${value.unitId}, ${value.taxId},
       ${value.openingStock}, ${value.openingRate}, ${value.status})`.execute(getCoreDatabase());
    return (await this.find(Number(result.insertId)))!;
  }

  async update(id: string | number, input: ProductSaveInput) {
    const current = await this.find(id);
    if (!current || current.name === "-") return null;
    const value = normalize(input, current);
    await sql`UPDATE core_products SET name=${value.name}, product_type_id=${value.typeId},
      product_category_id=${value.productCategoryId}, hsn_code_id=${value.hsnCodeId},
      unit_id=${value.unitId}, gst_tax_id=${value.taxId}, opening_qty=${value.openingStock},
      opening_price=${value.openingRate}, status=${value.status}, updated_at=CURRENT_TIMESTAMP
      WHERE id=${Number(id)} AND deleted_at IS NULL`.execute(getCoreDatabase());
    return this.find(id);
  }

  async setActive(id: string | number, active: boolean) {
    const current = await this.find(id);
    if (!current || current.name === "-") return null;
    await sql`UPDATE core_products SET status=${active ? "active" : "suspend"},
      updated_at=CURRENT_TIMESTAMP WHERE id=${Number(id)} AND deleted_at IS NULL`.execute(
      getCoreDatabase()
    );
    return this.find(id);
  }

  async forceDelete(id: string | number) {
    const current = await this.find(id);
    if (!current || current.name === "-") return null;
    await sql`UPDATE core_products SET status='deleted', deleted_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP WHERE id=${Number(id)} AND deleted_at IS NULL`.execute(
      getCoreDatabase()
    );
    return current;
  }
}

function normalize(input: ProductSaveInput, current?: ProductRecord) {
  const name = String(input.name ?? current?.name ?? "").trim();
  if (!name) throw new Error("Product name is required.");
  return {
    name,
    typeId: nullableNumber(input.typeId ?? current?.typeId),
    productCategoryId: nullableNumber(input.productCategoryId ?? current?.productCategoryId),
    hsnCodeId: nullableNumber(input.hsnCodeId ?? current?.hsnCodeId),
    unitId: nullableNumber(input.unitId ?? current?.unitId),
    taxId: nullableNumber(input.taxId ?? current?.taxId),
    openingStock: numberValue(input.openingStock ?? current?.openingStock),
    openingRate: numberValue(input.openingRate ?? current?.openingRate),
    status: (input.status ??
      (input.isActive === false ? "inactive" : current?.status) ??
      "active") as ProductStatus
  };
}

function toProduct(row: ProductRow): ProductRecord {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    name: row.name,
    typeId: nullableNumber(row.product_type_id),
    productCategoryId: nullableNumber(row.product_category_id),
    hsnCodeId: nullableNumber(row.hsn_code_id),
    unitId: nullableNumber(row.unit_id),
    taxId: nullableNumber(row.gst_tax_id),
    typeName: nullableText(row.product_type_name),
    productCategoryName: nullableText(row.product_category_name),
    hsnCode: nullableText(row.hsn_code),
    unitName: nullableText(row.unit_name),
    taxName: nullableText(row.tax_name),
    taxRate: nullableNumber(row.tax_rate),
    openingStock: numberValue(row.opening_qty),
    openingRate: numberValue(row.opening_price),
    status: row.status as ProductStatus,
    isActive: row.status === "active",
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: row.deleted_at ? dateValue(row.deleted_at) : null
  };
}
function productSelect() {
  return sql`SELECT core_products.*, core_product_types.name AS product_type_name,
    core_product_categories.name AS product_category_name, core_hsn_codes.code AS hsn_code,
    core_units.name AS unit_name, core_taxes.description AS tax_name, core_taxes.rate_percent AS tax_rate
    FROM core_products
    LEFT JOIN core_product_types ON core_product_types.id=core_products.product_type_id
    LEFT JOIN core_product_categories ON core_product_categories.id=core_products.product_category_id
    LEFT JOIN core_hsn_codes ON core_hsn_codes.id=core_products.hsn_code_id
    LEFT JOIN core_units ON core_units.id=core_products.unit_id
    LEFT JOIN core_taxes ON core_taxes.id=core_products.gst_tax_id`;
}
function nullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}
function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function dateValue(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// Public, tenant-scoped lookup for apps extending Core product records.
export async function listProductCatalogLookupsForDatabase(
  database: import("kysely").Kysely<import("../../../database/core-database.js").CoreDatabase>
) {
  const rows = (
    await sql<{
      id: number;
      uuid: string;
      name: string;
      categoryId: number | null;
      categoryName: string | null;
      unitName: string | null;
      taxRate: number | null;
      status: string;
      deletedAt: Date | null;
    }>`SELECT p.id, p.uuid, p.name, p.product_category_id AS categoryId, c.name AS categoryName, u.name AS unitName, t.rate_percent AS taxRate, p.status, p.deleted_at AS deletedAt
    FROM core_products p LEFT JOIN core_product_categories c ON c.id=p.product_category_id
    LEFT JOIN core_units u ON u.id=p.unit_id LEFT JOIN core_taxes t ON t.id=p.gst_tax_id
    ORDER BY p.name, p.id`.execute(database)
  ).rows;
  return rows.map((row) => ({
    id: Number(row.id),
    uuid: row.uuid,
    name: row.name,
    categoryId: row.categoryId === null ? null : Number(row.categoryId),
    categoryName: row.categoryName,
    unitName: row.unitName,
    taxRate: row.taxRate === null ? null : Number(row.taxRate),
    active: row.status === "active" && row.deletedAt === null
  }));
}
