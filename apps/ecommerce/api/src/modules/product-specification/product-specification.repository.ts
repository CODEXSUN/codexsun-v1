import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import type {
  ProductSpecificationFilters,
  ProductSpecificationRecord,
  ProductSpecificationSaveInput,
  ProductSpecificationStatus,
  ProductSpecificationStatusCounts,
  SpecificationProductOption
} from "./product-specification.types.js";
import { resolveCatalogPageWindow } from "../catalog-pagination.js";

type Row = Record<string, unknown> & {
  id: number | string;
  uuid: string;
  product_information_id: number | string;
  status: ProductSpecificationStatus;
};

export class ProductSpecificationRepository {
  async list(filters: ProductSpecificationFilters = {}): Promise<ProductSpecificationRecord[]> {
    const search = filters.search?.trim().toLowerCase() ?? "";
    const status = filters.status ?? "";
    const productId = filters.productInformationId ?? 0;
    const product = filters.product?.trim().toLowerCase() ?? "";
    const label = filters.label?.trim().toLowerCase() ?? "";
    const value = filters.value?.trim().toLowerCase() ?? "";
    const sortOrder = filters.sortOrder?.trim() ?? "";
    const result = await sql<Row>`${selectRows()}
      WHERE (${productId}=0 OR specification.product_information_id=${productId})
        AND (${status}='' OR specification.status=${status})
        AND (${search}='' OR LOWER(specification.label) LIKE ${`%${search}%`}
          OR LOWER(specification.value) LIKE ${`%${search}%`}
          OR LOWER(product.storefront_title) LIKE ${`%${search}%`})
        AND (${product}='' OR LOWER(product.storefront_title) LIKE ${`%${product}%`})
        AND (${label}='' OR LOWER(specification.label) LIKE ${`%${label}%`})
        AND (${value}='' OR LOWER(specification.value) LIKE ${`%${value}%`})
        AND (${sortOrder}='' OR CAST(specification.sort_order AS CHAR) LIKE ${`%${sortOrder}%`})
      ORDER BY product.storefront_title,specification.product_information_id,
        specification.sort_order,specification.id
      LIMIT ${filters.limit ?? 10000} OFFSET ${filters.offset ?? 0}`.execute(
      getEcommerceDatabase()
    );
    return result.rows.map(toRecord);
  }

  async page(filters: ProductSpecificationFilters = {}) {
    const statusCounts = await this.statusCounts(filters);
    const total = filters.status ? statusCounts[filters.status] : statusCounts.all;
    const window = resolveCatalogPageWindow(total, filters.page, filters.pageSize);
    const items = await this.list({
      ...filters,
      limit: window.pageSize,
      offset: (window.page - 1) * window.pageSize
    });
    return { items, page: window.page, pageSize: window.pageSize, statusCounts, total };
  }

  async statusCounts(
    filters: ProductSpecificationFilters = {}
  ): Promise<ProductSpecificationStatusCounts> {
    const search = filters.search?.trim().toLowerCase() ?? "";
    const productId = filters.productInformationId ?? 0;
    const product = filters.product?.trim().toLowerCase() ?? "";
    const label = filters.label?.trim().toLowerCase() ?? "";
    const value = filters.value?.trim().toLowerCase() ?? "";
    const sortOrder = filters.sortOrder?.trim() ?? "";
    const result = await sql<{
      total: number | string;
      active: number | string | null;
      inactive: number | string | null;
    }>`SELECT COUNT(*) AS total, SUM(specification.status='active') AS active,
      SUM(specification.status='inactive') AS inactive
      FROM ecommerce_product_specifications specification
      INNER JOIN ecommerce_product_information product
        ON product.id=specification.product_information_id
      WHERE (${productId}=0 OR specification.product_information_id=${productId})
        AND (${search}='' OR LOWER(specification.label) LIKE ${`%${search}%`}
          OR LOWER(specification.value) LIKE ${`%${search}%`}
          OR LOWER(product.storefront_title) LIKE ${`%${search}%`})
        AND (${product}='' OR LOWER(product.storefront_title) LIKE ${`%${product}%`})
        AND (${label}='' OR LOWER(specification.label) LIKE ${`%${label}%`})
        AND (${value}='' OR LOWER(specification.value) LIKE ${`%${value}%`})
        AND (${sortOrder}='' OR CAST(specification.sort_order AS CHAR) LIKE ${`%${sortOrder}%`})`.execute(
      getEcommerceDatabase()
    );
    const row = result.rows[0];
    return {
      all: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0)
    };
  }

  async find(id: number) {
    const result = await sql<Row>`${selectRows()} WHERE specification.id=${id} LIMIT 1`.execute(
      getEcommerceDatabase()
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async productOptions(): Promise<SpecificationProductOption[]> {
    const result = await sql<{
      id: number | string;
      title: string;
    }>`SELECT id,storefront_title AS title FROM ecommerce_product_information
      WHERE status='active' AND publication_status<>'archived'
      ORDER BY storefront_title,id`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({ id: Number(row.id), title: row.title }));
  }

  async productExists(id: number) {
    const result = await sql<{
      id: number;
    }>`SELECT id FROM ecommerce_product_information WHERE id=${id} AND status='active'
      AND publication_status<>'archived' LIMIT 1`.execute(getEcommerceDatabase());
    return Boolean(result.rows[0]);
  }

  async duplicate(productInformationId: number, label: string, exceptId = 0) {
    const result = await sql<{
      id: number;
    }>`SELECT id FROM ecommerce_product_specifications
      WHERE product_information_id=${productInformationId} AND label=${label}
        AND (${exceptId}=0 OR id<>${exceptId}) LIMIT 1`.execute(getEcommerceDatabase());
    return Boolean(result.rows[0]);
  }

  async create(input: Required<ProductSpecificationSaveInput>) {
    const result = await sql`INSERT INTO ecommerce_product_specifications
      (uuid,product_information_id,label,value,sort_order,status)
      VALUES (${randomBytes(4).toString("hex")},${input.productInformationId},${input.label},
        ${input.value},${input.sortOrder},${input.status})`.execute(getEcommerceDatabase());
    return this.find(Number(result.insertId));
  }

  async update(
    id: number,
    input: Required<ProductSpecificationSaveInput>,
    expectedRevision: number
  ) {
    const result = await sql`UPDATE ecommerce_product_specifications SET
      product_information_id=${input.productInformationId},label=${input.label},
      value=${input.value},sort_order=${input.sortOrder},status=${input.status},
      revision=revision+1,updated_at=CURRENT_TIMESTAMP
      WHERE id=${id} AND revision=${expectedRevision}`.execute(getEcommerceDatabase());
    if (Number(result.numAffectedRows) !== 1) return null;
    return this.find(id);
  }

  async setStatus(id: number, status: ProductSpecificationStatus) {
    await sql`UPDATE ecommerce_product_specifications SET status=${status},
      revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=${id}`.execute(
      getEcommerceDatabase()
    );
    return this.find(id);
  }

  async remove(id: number) {
    const result = await sql`DELETE FROM ecommerce_product_specifications WHERE id=${id}`.execute(
      getEcommerceDatabase()
    );
    return Number(result.numAffectedRows) === 1;
  }
}

function selectRows() {
  return sql`SELECT specification.*,product.storefront_title AS product_title
    FROM ecommerce_product_specifications specification
    INNER JOIN ecommerce_product_information product
      ON product.id=specification.product_information_id`;
}

function toRecord(row: Row): ProductSpecificationRecord {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    productInformationId: Number(row.product_information_id),
    productTitle: String(row.product_title ?? ""),
    label: String(row.label),
    value: String(row.value),
    sortOrder: Number(row.sort_order ?? 1000),
    status: row.status,
    revision: Number(row.revision ?? 1),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}
