import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import { resolveCatalogPageWindow } from "../catalog-pagination.js";
import type {
  ProductInformationOption,
  ProductVariantFilters,
  ProductVariantPage,
  ProductVariantRecord,
  ProductVariantSaveInput,
  ProductVariantStatusCounts
} from "./product-variant.types.js";
type Row = Record<string, unknown> & {
  id: number | string;
  uuid: string;
  product_information_id: number | string;
  product_title: string;
  sku: string;
  title: string;
  status: "active" | "inactive";
};
export class ProductVariantRepository {
  async list(filters: ProductVariantFilters = {}): Promise<ProductVariantPage> {
    const status = filters.status;
    const where = filterWhere(filters);
    const grouped = await sql<{
      status: keyof ProductVariantStatusCounts;
      total: number | string;
    }>`SELECT v.status, COUNT(*) AS total
      FROM ecommerce_product_variants v INNER JOIN ecommerce_product_information p ON p.id=v.product_information_id
      ${where} GROUP BY v.status`.execute(getEcommerceDatabase());
    const statusCounts: ProductVariantStatusCounts = { all: 0, active: 0, inactive: 0 };
    for (const row of grouped.rows) {
      const count = Number(row.total ?? 0);
      statusCounts[row.status] = count;
      statusCounts.all += count;
    }
    const total = status ? statusCounts[status] : statusCounts.all;
    const window = resolveCatalogPageWindow(total, filters.page, filters.pageSize);
    const statusWhere = status ? sql`AND v.status=${status}` : sql``;
    const result = await sql<Row>`${selectRows()} ${where} ${statusWhere}
      ORDER BY p.storefront_title,v.sort_order,v.id
      LIMIT ${window.pageSize} OFFSET ${(window.page - 1) * window.pageSize}`.execute(
      getEcommerceDatabase()
    );
    return {
      items: result.rows.map(toRecord),
      page: window.page,
      pageSize: window.pageSize,
      statusCounts,
      total
    };
  }
  async find(id: number) {
    const result = await sql<Row>`${selectRows()} WHERE v.id=${id} LIMIT 1`.execute(
      getEcommerceDatabase()
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }
  async productOptions() {
    const result = await sql<{
      id: number | string;
      title: string;
    }>`SELECT id,storefront_title AS title FROM ecommerce_product_information WHERE publication_status<>'archived' ORDER BY storefront_title,id`.execute(
      getEcommerceDatabase()
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      title: r.title
    })) as ProductInformationOption[];
  }
  async productExists(id: number) {
    const result = await sql<{
      id: number;
    }>`SELECT info.id FROM ecommerce_product_information info
      INNER JOIN core_products product ON product.id=info.core_product_id
      WHERE info.id=${id} AND info.publication_status<>'archived'
      AND product.status='active' AND product.deleted_at IS NULL LIMIT 1`.execute(
      getEcommerceDatabase()
    );
    return Boolean(result.rows[0]);
  }
  async duplicateSku(sku: string, exceptId = 0) {
    const result = await sql<{
      id: number;
    }>`SELECT id FROM ecommerce_product_variants WHERE sku=${sku} AND (${exceptId}=0 OR id<>${exceptId}) LIMIT 1`.execute(
      getEcommerceDatabase()
    );
    return Boolean(result.rows[0]);
  }
  async duplicateOptions(productInformationId: number, optionSignature: string, exceptId = 0) {
    const result = await sql<{ id: number }>`SELECT id FROM ecommerce_product_variants
      WHERE product_information_id=${productInformationId} AND option_signature=${optionSignature}
      AND (${exceptId}=0 OR id<>${exceptId}) LIMIT 1`.execute(getEcommerceDatabase());
    return Boolean(result.rows[0]);
  }
  async create(input: ProductVariantSaveInput) {
    const result =
      await sql`INSERT INTO ecommerce_product_variants (uuid,product_information_id,sku,title,barcode,option_1_name,option_1_value,option_2_name,option_2_value,option_3_name,option_3_value,option_signature,price_adjustment,compare_at_adjustment,cost_adjustment,weight,sort_order,status) VALUES (${randomBytes(4).toString("hex")},${input.productInformationId},${input.sku},${input.title},${input.barcode},${input.option1Name},${input.option1Value},${input.option2Name},${input.option2Value},${input.option3Name},${input.option3Value},${input.optionSignature},${input.priceAdjustment},${input.compareAtAdjustment},${input.costAdjustment},${input.weight},${input.sortOrder},${input.status})`.execute(
        getEcommerceDatabase()
      );
    return this.find(Number(result.insertId));
  }
  async update(id: number, input: ProductVariantSaveInput, expectedRevision: number) {
    const result =
      await sql`UPDATE ecommerce_product_variants SET product_information_id=${input.productInformationId},sku=${input.sku},title=${input.title},barcode=${input.barcode},option_1_name=${input.option1Name},option_1_value=${input.option1Value},option_2_name=${input.option2Name},option_2_value=${input.option2Value},option_3_name=${input.option3Name},option_3_value=${input.option3Value},option_signature=${input.optionSignature},price_adjustment=${input.priceAdjustment},compare_at_adjustment=${input.compareAtAdjustment},cost_adjustment=${input.costAdjustment},weight=${input.weight},sort_order=${input.sortOrder},status=${input.status},revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=${id} AND revision=${expectedRevision}`.execute(
        getEcommerceDatabase()
      );
    if (Number(result.numAffectedRows) !== 1) return null;
    return this.find(id);
  }
  async setActive(id: number, active: boolean) {
    await sql`UPDATE ecommerce_product_variants SET status=${active ? "active" : "inactive"},revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=${id}`.execute(
      getEcommerceDatabase()
    );
    return this.find(id);
  }
}
function selectRows() {
  return sql`SELECT v.*,p.storefront_title AS product_title FROM ecommerce_product_variants v INNER JOIN ecommerce_product_information p ON p.id=v.product_information_id`;
}
function filterWhere(filters: ProductVariantFilters) {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const sku = filters.sku?.trim().toLowerCase() ?? "";
  const title = filters.title?.trim().toLowerCase() ?? "";
  const productTitle = filters.productTitle?.trim().toLowerCase() ?? "";
  const options = filters.options?.trim().toLowerCase() ?? "";
  const productId = filters.productInformationId ?? 0;
  return sql`WHERE (${productId}=0 OR v.product_information_id=${productId})
    AND (${search}='' OR LOWER(v.sku) LIKE ${`%${search}%`} OR LOWER(v.title) LIKE ${`%${search}%`})
    AND (${sku}='' OR LOWER(v.sku) LIKE ${`%${sku}%`})
    AND (${title}='' OR LOWER(v.title) LIKE ${`%${title}%`})
    AND (${productTitle}='' OR LOWER(p.storefront_title) LIKE ${`%${productTitle}%`})
    AND (${options}='' OR LOWER(CONCAT_WS(' / ',v.option_1_value,v.option_2_value,v.option_3_value)) LIKE ${`%${options}%`})`;
}
function toRecord(r: Row): ProductVariantRecord {
  return {
    id: Number(r.id),
    uuid: r.uuid,
    productInformationId: Number(r.product_information_id),
    productTitle: String(r.product_title),
    sku: r.sku,
    title: r.title,
    barcode: String(r.barcode ?? ""),
    option1Name: String(r.option_1_name ?? ""),
    option1Value: String(r.option_1_value ?? ""),
    option2Name: String(r.option_2_name ?? ""),
    option2Value: String(r.option_2_value ?? ""),
    option3Name: String(r.option_3_name ?? ""),
    option3Value: String(r.option_3_value ?? ""),
    priceAdjustment: Number(r.price_adjustment ?? 0),
    compareAtAdjustment: Number(r.compare_at_adjustment ?? 0),
    costAdjustment: Number(r.cost_adjustment ?? 0),
    weight: Number(r.weight ?? 0),
    sortOrder: Number(r.sort_order ?? 1000),
    status: r.status,
    revision: Number(r.revision ?? 1),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString()
  };
}
