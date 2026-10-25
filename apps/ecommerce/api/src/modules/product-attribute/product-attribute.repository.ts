import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import { resolveCatalogPageWindow } from "../catalog-pagination.js";
import type {
  ProductAttributeAssignment,
  ProductAttributeAssignmentSaveInput,
  ProductAttributeDataType,
  ProductAttributeFilters,
  ProductAttributeRecord,
  ProductAttributeSaveInput,
  ProductAttributeStatus,
  ProductAttributeStatusCounts
} from "./product-attribute.types.js";

type Row = Record<string, unknown> & {
  id: number | string;
  uuid: string;
  data_type: ProductAttributeDataType;
  status: ProductAttributeStatus;
};

type ValueRow = Record<string, unknown> & {
  attribute_id: number | string;
};

export class ProductAttributeRepository {
  async list(filters: ProductAttributeFilters = {}): Promise<ProductAttributeRecord[]> {
    const search = filters.search?.trim().toLowerCase() ?? "";
    const status = filters.status ?? "";
    const code = filters.code?.trim().toLowerCase() ?? "";
    const name = filters.name?.trim().toLowerCase() ?? "";
    const dataType = filters.dataType?.trim().toLowerCase() ?? "";
    const values = filters.values?.trim() ?? "";
    const sortOrder = filters.sortOrder?.trim() ?? "";
    const result = await sql<Row>`SELECT attribute.*, COUNT(value.id) AS value_count
      FROM ecommerce_product_attributes attribute
      LEFT JOIN ecommerce_product_attribute_values value ON value.attribute_id=attribute.id
      WHERE (${status}='' OR attribute.status=${status})
        AND (${search}='' OR LOWER(attribute.code) LIKE ${`%${search}%`}
          OR LOWER(attribute.name) LIKE ${`%${search}%`})
        AND (${code}='' OR LOWER(attribute.code) LIKE ${`%${code}%`})
        AND (${name}='' OR LOWER(attribute.name) LIKE ${`%${name}%`})
        AND (${dataType}='' OR LOWER(attribute.data_type) LIKE ${`%${dataType}%`})
        AND (${sortOrder}='' OR CAST(attribute.sort_order AS CHAR) LIKE ${`%${sortOrder}%`})
      GROUP BY attribute.id
      HAVING (${values}='' OR CAST(COUNT(value.id) AS CHAR) LIKE ${`%${values}%`})
      ORDER BY attribute.sort_order, attribute.name, attribute.id
      LIMIT ${filters.limit ?? 10000} OFFSET ${filters.offset ?? 0}`.execute(
      getEcommerceDatabase()
    );
    return result.rows.map(toRecord);
  }

  async page(filters: ProductAttributeFilters = {}) {
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

  async statusCounts(filters: ProductAttributeFilters = {}): Promise<ProductAttributeStatusCounts> {
    const search = filters.search?.trim().toLowerCase() ?? "";
    const code = filters.code?.trim().toLowerCase() ?? "";
    const name = filters.name?.trim().toLowerCase() ?? "";
    const dataType = filters.dataType?.trim().toLowerCase() ?? "";
    const values = filters.values?.trim() ?? "";
    const sortOrder = filters.sortOrder?.trim() ?? "";
    const result = await sql<{
      total: number | string;
      active: number | string | null;
      inactive: number | string | null;
    }>`SELECT COUNT(*) AS total, SUM(attribute.status='active') AS active,
      SUM(attribute.status='inactive') AS inactive
      FROM ecommerce_product_attributes attribute
      WHERE (${search}='' OR LOWER(attribute.code) LIKE ${`%${search}%`}
        OR LOWER(attribute.name) LIKE ${`%${search}%`})
        AND (${code}='' OR LOWER(attribute.code) LIKE ${`%${code}%`})
        AND (${name}='' OR LOWER(attribute.name) LIKE ${`%${name}%`})
        AND (${dataType}='' OR LOWER(attribute.data_type) LIKE ${`%${dataType}%`})
        AND (${sortOrder}='' OR CAST(attribute.sort_order AS CHAR) LIKE ${`%${sortOrder}%`})
        AND (${values}='' OR CAST((SELECT COUNT(*) FROM ecommerce_product_attribute_values value
          WHERE value.attribute_id=attribute.id) AS CHAR) LIKE ${`%${values}%`})`.execute(
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
    const result = await sql<Row>`SELECT attribute.*, COUNT(value.id) AS value_count
      FROM ecommerce_product_attributes attribute
      LEFT JOIN ecommerce_product_attribute_values value ON value.attribute_id=attribute.id
      WHERE attribute.id=${id} GROUP BY attribute.id LIMIT 1`.execute(getEcommerceDatabase());
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async duplicate(code: string, exceptId = 0) {
    const result = await sql<{
      id: number;
    }>`SELECT id FROM ecommerce_product_attributes WHERE code=${code}
      AND (${exceptId}=0 OR id<>${exceptId}) LIMIT 1`.execute(getEcommerceDatabase());
    return Boolean(result.rows[0]);
  }

  async create(input: Required<ProductAttributeSaveInput>) {
    const result = await sql`INSERT INTO ecommerce_product_attributes
      (uuid,code,name,data_type,unit,is_filterable,sort_order,status)
      VALUES (${randomBytes(4).toString("hex")},${input.code},${input.name},${input.dataType},
        ${input.unit},${input.isFilterable ? 1 : 0},${input.sortOrder},${input.status})`.execute(
      getEcommerceDatabase()
    );
    return this.find(Number(result.insertId));
  }

  async update(id: number, input: Required<ProductAttributeSaveInput>, expectedRevision: number) {
    const result = await sql`UPDATE ecommerce_product_attributes SET code=${input.code},
      name=${input.name},data_type=${input.dataType},unit=${input.unit},
      is_filterable=${input.isFilterable ? 1 : 0},sort_order=${input.sortOrder},
      status=${input.status},revision=revision+1,updated_at=CURRENT_TIMESTAMP
      WHERE id=${id} AND revision=${expectedRevision}`.execute(getEcommerceDatabase());
    if (Number(result.numAffectedRows) !== 1) return null;
    return this.find(id);
  }

  async setStatus(id: number, status: ProductAttributeStatus) {
    await sql`UPDATE ecommerce_product_attributes SET status=${status},revision=revision+1,
      updated_at=CURRENT_TIMESTAMP WHERE id=${id}`.execute(getEcommerceDatabase());
    return this.find(id);
  }

  async remove(id: number) {
    const result = await sql`DELETE FROM ecommerce_product_attributes WHERE id=${id}`.execute(
      getEcommerceDatabase()
    );
    return Number(result.numAffectedRows) === 1;
  }

  async activeAttributeIds(ids: number[]) {
    if (ids.length === 0) return new Map<number, ProductAttributeDataType>();
    const result = await sql<{
      id: number | string;
      data_type: ProductAttributeDataType;
    }>`SELECT id,data_type FROM ecommerce_product_attributes
      WHERE status='active' AND id IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `
      )})`.execute(getEcommerceDatabase());
    return new Map(result.rows.map((row) => [Number(row.id), row.data_type]));
  }

  async productOptions() {
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

  async assignment(productInformationId: number): Promise<ProductAttributeAssignment[]> {
    const result = await sql<ValueRow & Row>`SELECT attribute.id, attribute.uuid,
      attribute.code, attribute.name, attribute.data_type, attribute.unit, attribute.status,
      value.attribute_id, value.value
      FROM ecommerce_product_attributes attribute
      LEFT JOIN ecommerce_product_attribute_values value
        ON value.attribute_id=attribute.id AND value.product_information_id=${productInformationId}
      WHERE attribute.status='active'
      ORDER BY attribute.sort_order, attribute.name, value.sort_order, value.id`.execute(
      getEcommerceDatabase()
    );
    const grouped = new Map<number, ProductAttributeAssignment>();
    for (const row of result.rows) {
      const attributeId = Number(row.id);
      let item = grouped.get(attributeId);
      if (!item) {
        item = {
          attributeId,
          code: String(row.code),
          name: String(row.name),
          dataType: row.data_type,
          unit: String(row.unit ?? ""),
          values: []
        };
        grouped.set(attributeId, item);
      }
      if (row.value != null) item.values.push(String(row.value));
      grouped.set(attributeId, item);
    }
    return [...grouped.values()];
  }

  async replaceAssignment(
    productInformationId: number,
    input: ProductAttributeAssignmentSaveInput
  ) {
    const database = getEcommerceDatabase();
    await database.transaction().execute(async (transaction) => {
      await sql`DELETE FROM ecommerce_product_attribute_values
        WHERE product_information_id=${productInformationId}`.execute(transaction);
      for (const [index, entry] of input.values.entries()) {
        for (const [valueIndex, value] of entry.values.entries()) {
          await sql`INSERT INTO ecommerce_product_attribute_values
            (uuid,product_information_id,attribute_id,value,sort_order)
            VALUES (${randomBytes(4).toString("hex")},${productInformationId},${entry.attributeId},
              ${value},${index * 1000 + valueIndex})`.execute(transaction);
        }
      }
    });
    return this.assignment(productInformationId);
  }
}

function toRecord(row: Row): ProductAttributeRecord {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    code: String(row.code),
    name: String(row.name),
    dataType: row.data_type,
    unit: String(row.unit ?? ""),
    isFilterable: Boolean(row.is_filterable),
    sortOrder: Number(row.sort_order ?? 1000),
    status: row.status,
    valueCount: Number(row.value_count ?? 0),
    revision: Number(row.revision ?? 1),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}
