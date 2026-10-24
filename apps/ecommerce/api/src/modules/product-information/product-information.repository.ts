import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import { resolveCatalogPageWindow } from "../catalog-pagination.js";
import type {
  CoreBrandOption,
  CoreProductOption,
  ProductInformationFilters,
  ProductInformationPage,
  ProductInformationRecord,
  ProductInformationSaveInput,
  ProductInformationStatusCounts
} from "./product-information.types.js";

type Row = Record<string, unknown> & {
  id: number | string;
  uuid: string;
  core_product_id: number | string;
  core_product_name: string;
  publication_status: "draft" | "published" | "archived";
};

export class ProductInformationRepository {
  async list(filters: ProductInformationFilters = {}): Promise<ProductInformationPage> {
    const status = filters.status;
    const where = filterWhere(filters);
    const grouped = await sql<{
      publication_status: keyof ProductInformationStatusCounts;
      total: number | string;
    }>`SELECT info.publication_status, COUNT(*) AS total
      FROM ecommerce_product_information info INNER JOIN core_products core ON core.id=info.core_product_id
      LEFT JOIN core_brands brand ON brand.id=info.brand_id
      ${where} GROUP BY info.publication_status`.execute(getEcommerceDatabase());
    const statusCounts: ProductInformationStatusCounts = {
      all: 0,
      archived: 0,
      draft: 0,
      published: 0
    };
    for (const row of grouped.rows) {
      const count = Number(row.total ?? 0);
      statusCounts[row.publication_status] = count;
      statusCounts.all += count;
    }
    const total = status ? statusCounts[status] : statusCounts.all;
    const window = resolveCatalogPageWindow(total, filters.page, filters.pageSize);
    const statusWhere = status ? sql`AND info.publication_status=${status}` : sql``;
    const result = await sql<Row>`${selectRows()} ${where} ${statusWhere}
      ORDER BY info.storefront_title, info.id LIMIT ${window.pageSize} OFFSET ${(window.page - 1) * window.pageSize}`.execute(
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
    const result = await sql<Row>`${selectRows()} WHERE info.id=${id} LIMIT 1`.execute(
      getEcommerceDatabase()
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }
  async coreProductOptions() {
    return options<CoreProductOption>("core_products");
  }
  async coreBrandOptions() {
    return options<CoreBrandOption>("core_brands");
  }
  async coreProductExists(id: number) {
    return exists("core_products", id, "deleted_at IS NULL AND");
  }
  async coreBrandExists(id: number) {
    return exists("core_brands", id);
  }
  async duplicate(coreProductId: number, slug: string, exceptId = 0) {
    const result = await sql<{ id: number }>`SELECT id FROM ecommerce_product_information
      WHERE (core_product_id=${coreProductId} OR slug=${slug}) AND (${exceptId}=0 OR id<>${exceptId}) LIMIT 1`.execute(
      getEcommerceDatabase()
    );
    return Boolean(result.rows[0]);
  }
  async create(input: ProductInformationSaveInput) {
    const v = values(input);
    const result = await sql`INSERT INTO ecommerce_product_information
      (uuid,core_product_id,brand_id,storefront_title,subtitle,slug,short_description,description,
       bullet_points_json,material,country_of_origin,manufacturer,warranty,return_policy,shipping_class,
       weight,length,width,height,minimum_order_quantity,maximum_order_quantity,seo_title,seo_description,
       publication_status,is_featured)
      VALUES (${randomBytes(4).toString("hex")},${v.coreProductId},${v.brandId},${v.storefrontTitle},${v.subtitle},${v.slug},
       ${v.shortDescription},${v.description},${v.bulletPointsJson},${v.material},${v.countryOfOrigin},${v.manufacturer},
       ${v.warranty},${v.returnPolicy},${v.shippingClass},${v.weight},${v.length},${v.width},${v.height},
       ${v.minimumOrderQuantity},${v.maximumOrderQuantity},${v.seoTitle},${v.seoDescription},${v.publicationStatus},${v.isFeatured})`.execute(
      getEcommerceDatabase()
    );
    return this.find(Number(result.insertId));
  }
  async update(id: number, input: ProductInformationSaveInput, expectedRevision: number) {
    const v = values(input);
    const result =
      await sql`UPDATE ecommerce_product_information SET core_product_id=${v.coreProductId},brand_id=${v.brandId},
      storefront_title=${v.storefrontTitle},subtitle=${v.subtitle},slug=${v.slug},short_description=${v.shortDescription},
      description=${v.description},bullet_points_json=${v.bulletPointsJson},material=${v.material},country_of_origin=${v.countryOfOrigin},
      manufacturer=${v.manufacturer},warranty=${v.warranty},return_policy=${v.returnPolicy},shipping_class=${v.shippingClass},
      weight=${v.weight},length=${v.length},width=${v.width},height=${v.height},minimum_order_quantity=${v.minimumOrderQuantity},
      maximum_order_quantity=${v.maximumOrderQuantity},seo_title=${v.seoTitle},seo_description=${v.seoDescription},
      publication_status=${v.publicationStatus},is_featured=${v.isFeatured},revision=revision+1,updated_at=CURRENT_TIMESTAMP
      WHERE id=${id} AND revision=${expectedRevision}`.execute(getEcommerceDatabase());
    if (Number(result.numAffectedRows) !== 1) return null;
    return this.find(id);
  }
  async archive(id: number) {
    await sql`UPDATE ecommerce_product_information SET publication_status='archived',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=${id}`.execute(
      getEcommerceDatabase()
    );
    return this.find(id);
  }
}

function selectRows() {
  return sql`SELECT info.*,core.name AS core_product_name,brand.name AS brand_name
  FROM ecommerce_product_information info INNER JOIN core_products core ON core.id=info.core_product_id
  LEFT JOIN core_brands brand ON brand.id=info.brand_id`;
}
function filterWhere(filters: ProductInformationFilters) {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const storefrontTitle = filters.storefrontTitle?.trim().toLowerCase() ?? "";
  const coreProductName = filters.coreProductName?.trim().toLowerCase() ?? "";
  const brandName = filters.brandName?.trim().toLowerCase() ?? "";
  const slug = filters.slug?.trim().toLowerCase() ?? "";
  return sql`WHERE (${search}='' OR LOWER(info.storefront_title) LIKE ${`%${search}%`} OR LOWER(core.name) LIKE ${`%${search}%`})
    AND (${storefrontTitle}='' OR LOWER(info.storefront_title) LIKE ${`%${storefrontTitle}%`})
    AND (${coreProductName}='' OR LOWER(core.name) LIKE ${`%${coreProductName}%`})
    AND (${brandName}='' OR LOWER(COALESCE(brand.name,'')) LIKE ${`%${brandName}%`})
    AND (${slug}='' OR LOWER(info.slug) LIKE ${`%${slug}%`})`;
}
async function options<T>(table: "core_products" | "core_brands") {
  const extra = table === "core_products" ? sql`deleted_at IS NULL AND` : sql``;
  const result = await sql<{
    id: number | string;
    name: string;
  }>`SELECT id,name FROM ${sql.table(table)} WHERE ${extra} status='active' ORDER BY name,id`.execute(
    getEcommerceDatabase()
  );
  return result.rows.map((row) => ({ id: Number(row.id), name: row.name })) as T[];
}
async function exists(table: "core_products" | "core_brands", id: number, extra = "") {
  const result = await sql<{
    id: number;
  }>`SELECT id FROM ${sql.table(table)} WHERE ${sql.raw(extra)} status='active' AND id=${id} LIMIT 1`.execute(
    getEcommerceDatabase()
  );
  return Boolean(result.rows[0]);
}
function values(input: ProductInformationSaveInput) {
  return {
    ...input,
    brandId: input.brandId ?? null,
    subtitle: input.subtitle ?? "",
    shortDescription: input.shortDescription ?? "",
    description: input.description ?? "",
    bulletPointsJson: JSON.stringify(input.bulletPoints ?? []),
    material: input.material ?? "",
    countryOfOrigin: input.countryOfOrigin ?? "",
    manufacturer: input.manufacturer ?? "",
    warranty: input.warranty ?? "",
    returnPolicy: input.returnPolicy ?? "",
    shippingClass: input.shippingClass ?? "standard",
    weight: input.weight ?? 0,
    length: input.length ?? 0,
    width: input.width ?? 0,
    height: input.height ?? 0,
    minimumOrderQuantity: input.minimumOrderQuantity ?? 1,
    maximumOrderQuantity: input.maximumOrderQuantity ?? null,
    seoTitle: input.seoTitle ?? "",
    seoDescription: input.seoDescription ?? "",
    publicationStatus: input.publicationStatus ?? "draft",
    isFeatured: input.isFeatured ? 1 : 0
  };
}
function toRecord(row: Row): ProductInformationRecord {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    coreProductId: Number(row.core_product_id),
    coreProductName: String(row.core_product_name),
    brandId: nullableNumber(row.brand_id),
    brandName: text(row.brand_name),
    storefrontTitle: String(row.storefront_title),
    subtitle: String(row.subtitle ?? ""),
    slug: String(row.slug),
    shortDescription: String(row.short_description ?? ""),
    description: String(row.description ?? ""),
    bulletPoints: jsonList(row.bullet_points_json),
    material: String(row.material ?? ""),
    countryOfOrigin: String(row.country_of_origin ?? ""),
    manufacturer: String(row.manufacturer ?? ""),
    warranty: String(row.warranty ?? ""),
    returnPolicy: String(row.return_policy ?? ""),
    shippingClass: String(row.shipping_class ?? "standard"),
    weight: Number(row.weight ?? 0),
    length: Number(row.length ?? 0),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    minimumOrderQuantity: Number(row.minimum_order_quantity ?? 1),
    maximumOrderQuantity: nullableNumber(row.maximum_order_quantity),
    seoTitle: String(row.seo_title ?? ""),
    seoDescription: String(row.seo_description ?? ""),
    publicationStatus: row.publication_status,
    isFeatured: Boolean(row.is_featured),
    revision: Number(row.revision ?? 1),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}
function nullableNumber(value: unknown) {
  return value == null ? null : Number(value);
}
function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}
function jsonList(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
