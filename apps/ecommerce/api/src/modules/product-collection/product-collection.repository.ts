import { randomBytes } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";
import { resolveCatalogPageWindow } from "../catalog-pagination.js";
import type {
  CollectionProductOption,
  ProductCollectionFilters,
  ProductCollectionStatusCounts,
  ProductCollectionItem,
  ProductCollectionPublicItem,
  ProductCollectionPublicRecord,
  ProductCollectionPublication,
  ProductCollectionRecord,
  ProductCollectionSaveInput
} from "./product-collection.types.js";

type Row = Record<string, unknown> & {
  id: number | string;
  uuid: string;
  slug: string;
  title: string;
  publication_status: ProductCollectionPublication;
};

export class ProductCollectionRepository {
  async list(filters: ProductCollectionFilters = {}): Promise<ProductCollectionRecord[]> {
    const search = filters.search?.trim().toLowerCase() ?? "";
    const publication = filters.publicationStatus ?? "";
    const title = filters.title?.trim().toLowerCase() ?? "";
    const itemCount = filters.itemCount?.trim() ?? "";
    const sortOrder = filters.sortOrder?.trim() ?? "";
    const result = await sql<Row>`SELECT collection.*,
      (SELECT COUNT(*) FROM ecommerce_product_collection_items item
        WHERE item.collection_id=collection.id) AS item_count
      FROM ecommerce_product_collections collection
      WHERE (${publication}='' OR collection.publication_status=${publication})
        AND (${search}='' OR LOWER(collection.slug) LIKE ${`%${search}%`}
          OR LOWER(collection.title) LIKE ${`%${search}%`}
          OR LOWER(collection.description) LIKE ${`%${search}%`})
        AND (${title}='' OR LOWER(CONCAT(collection.title,' ',collection.slug)) LIKE ${`%${title}%`})
        AND (${sortOrder}='' OR CAST(collection.sort_order AS CHAR) LIKE ${`%${sortOrder}%`})
        AND (${itemCount}='' OR CAST((SELECT COUNT(*) FROM ecommerce_product_collection_items item
          WHERE item.collection_id=collection.id) AS CHAR) LIKE ${`%${itemCount}%`})
      ORDER BY collection.sort_order,collection.title,collection.id
      LIMIT ${filters.limit ?? 10000} OFFSET ${filters.offset ?? 0}`.execute(
      getEcommerceDatabase()
    );
    return result.rows.map(toRecord);
  }

  async page(filters: ProductCollectionFilters = {}) {
    const statusCounts = await this.statusCounts(filters);
    const total = filters.publicationStatus
      ? statusCounts[filters.publicationStatus]
      : statusCounts.all;
    const window = resolveCatalogPageWindow(total, filters.page, filters.pageSize);
    const items = await this.list({
      ...filters,
      limit: window.pageSize,
      offset: (window.page - 1) * window.pageSize
    });
    return { items, page: window.page, pageSize: window.pageSize, statusCounts, total };
  }

  async statusCounts(
    filters: ProductCollectionFilters = {}
  ): Promise<ProductCollectionStatusCounts> {
    const search = filters.search?.trim().toLowerCase() ?? "";
    const title = filters.title?.trim().toLowerCase() ?? "";
    const itemCount = filters.itemCount?.trim() ?? "";
    const sortOrder = filters.sortOrder?.trim() ?? "";
    const result = await sql<{
      total: number | string;
      draft: number | string | null;
      published: number | string | null;
      archived: number | string | null;
    }>`SELECT COUNT(*) AS total, SUM(collection.publication_status='draft') AS draft,
      SUM(collection.publication_status='published') AS published,
      SUM(collection.publication_status='archived') AS archived
      FROM ecommerce_product_collections collection
      WHERE (${search}='' OR LOWER(collection.slug) LIKE ${`%${search}%`}
        OR LOWER(collection.title) LIKE ${`%${search}%`}
        OR LOWER(collection.description) LIKE ${`%${search}%`})
        AND (${title}='' OR LOWER(CONCAT(collection.title,' ',collection.slug)) LIKE ${`%${title}%`})
        AND (${sortOrder}='' OR CAST(collection.sort_order AS CHAR) LIKE ${`%${sortOrder}%`})
        AND (${itemCount}='' OR CAST((SELECT COUNT(*) FROM ecommerce_product_collection_items item
          WHERE item.collection_id=collection.id) AS CHAR) LIKE ${`%${itemCount}%`})`.execute(
      getEcommerceDatabase()
    );
    const row = result.rows[0];
    return {
      all: Number(row?.total ?? 0),
      archived: Number(row?.archived ?? 0),
      draft: Number(row?.draft ?? 0),
      published: Number(row?.published ?? 0)
    };
  }

  async find(id: number) {
    const result = await sql<Row>`SELECT collection.*,
      (SELECT COUNT(*) FROM ecommerce_product_collection_items item
        WHERE item.collection_id=collection.id) AS item_count
      FROM ecommerce_product_collections collection WHERE collection.id=${id} LIMIT 1`.execute(
      getEcommerceDatabase()
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async duplicate(slug: string, exceptId = 0) {
    const result = await sql<{
      id: number;
    }>`SELECT id FROM ecommerce_product_collections WHERE slug=${slug}
      AND (${exceptId}=0 OR id<>${exceptId}) LIMIT 1`.execute(getEcommerceDatabase());
    return Boolean(result.rows[0]);
  }

  async create(input: Required<ProductCollectionSaveInput>, productInformationIds?: number[]) {
    const database = getEcommerceDatabase();
    let id = 0;
    await database.transaction().execute(async (transaction) => {
      const result = await sql`INSERT INTO ecommerce_product_collections
        (uuid,slug,title,description,hero_image_url,publication_status,sort_order)
        VALUES (${randomBytes(4).toString("hex")},${input.slug},${input.title},${input.description},
          ${input.heroImageUrl},${input.publicationStatus},${input.sortOrder})`.execute(
        transaction
      );
      id = Number(result.insertId);
      if (productInformationIds) {
        await replaceItemsInTransaction(transaction, id, productInformationIds);
      }
    });
    return this.find(id);
  }

  async update(
    id: number,
    input: Required<ProductCollectionSaveInput>,
    expectedRevision: number,
    productInformationIds?: number[]
  ) {
    const database = getEcommerceDatabase();
    let affected = 0;
    await database.transaction().execute(async (transaction) => {
      const result = await sql`UPDATE ecommerce_product_collections SET slug=${input.slug},
        title=${input.title},description=${input.description},hero_image_url=${input.heroImageUrl},
        publication_status=${input.publicationStatus},sort_order=${input.sortOrder},
        revision=revision+1,updated_at=CURRENT_TIMESTAMP
        WHERE id=${id} AND revision=${expectedRevision}`.execute(transaction);
      affected = Number(result.numAffectedRows);
      if (affected === 1 && productInformationIds) {
        await replaceItemsInTransaction(transaction, id, productInformationIds);
      }
    });
    if (affected !== 1) return null;
    return this.find(id);
  }

  async setPublication(id: number, publicationStatus: ProductCollectionPublication) {
    const result = await sql`UPDATE ecommerce_product_collections
      SET publication_status=${publicationStatus},revision=revision+1,updated_at=CURRENT_TIMESTAMP
      WHERE id=${id}`.execute(getEcommerceDatabase());
    if (Number(result.numAffectedRows) !== 1) return null;
    return this.find(id);
  }

  async remove(id: number) {
    const result = await sql`DELETE FROM ecommerce_product_collections WHERE id=${id}`.execute(
      getEcommerceDatabase()
    );
    return Number(result.numAffectedRows) === 1;
  }

  async items(collectionId: number): Promise<ProductCollectionItem[]> {
    const result = await sql<{
      product_information_id: number | string;
      title: string;
      slug: string;
      sort_order: number | string;
    }>`SELECT item.product_information_id,product.storefront_title AS title,product.slug,
      item.sort_order
      FROM ecommerce_product_collection_items item
      INNER JOIN ecommerce_product_information product
        ON product.id=item.product_information_id
      WHERE item.collection_id=${collectionId}
      ORDER BY item.sort_order,item.id`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({
      productInformationId: Number(row.product_information_id),
      title: row.title,
      slug: row.slug,
      sortOrder: Number(row.sort_order)
    }));
  }

  async replaceItems(collectionId: number, productInformationIds: number[]) {
    const database = getEcommerceDatabase();
    await database.transaction().execute(async (transaction) => {
      await sql`DELETE FROM ecommerce_product_collection_items
        WHERE collection_id=${collectionId}`.execute(transaction);
      for (const [index, productId] of productInformationIds.entries()) {
        await sql`INSERT INTO ecommerce_product_collection_items
          (uuid,collection_id,product_information_id,sort_order)
          VALUES (${randomBytes(4).toString("hex")},${collectionId},${productId},${index * 1000})`.execute(
          transaction
        );
      }
    });
    return this.items(collectionId);
  }

  async productOptions(): Promise<CollectionProductOption[]> {
    const result = await sql<{
      id: number | string;
      title: string;
    }>`SELECT id,storefront_title AS title FROM ecommerce_product_information
      WHERE status='active' AND publication_status<>'archived'
      ORDER BY storefront_title,id`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({ id: Number(row.id), title: row.title }));
  }

  async validProductIds(ids: number[]) {
    if (ids.length === 0) return new Set<number>();
    const result = await sql<{
      id: number | string;
    }>`SELECT id FROM ecommerce_product_information
      WHERE status='active' AND publication_status<>'archived'
        AND id IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `
        )})`.execute(getEcommerceDatabase());
    return new Set(result.rows.map((row) => Number(row.id)));
  }

  async publicList(): Promise<ProductCollectionRecord[]> {
    const result = await sql<Row>`SELECT collection.*,
      (SELECT COUNT(*) FROM ecommerce_product_collection_items item
        INNER JOIN ecommerce_product_information product
          ON product.id=item.product_information_id
        WHERE item.collection_id=collection.id AND product.status='active'
          AND product.publication_status='published') AS item_count
      FROM ecommerce_product_collections collection
      WHERE collection.publication_status='published'
        AND EXISTS (SELECT 1 FROM ecommerce_product_collection_items item
          INNER JOIN ecommerce_product_information product
            ON product.id=item.product_information_id
          WHERE item.collection_id=collection.id AND product.status='active'
            AND product.publication_status='published')
      ORDER BY collection.sort_order,collection.title,collection.id`.execute(
      getEcommerceDatabase()
    );
    return result.rows.map(toRecord);
  }

  async publicFind(slug: string): Promise<ProductCollectionPublicRecord | null> {
    const collection =
      await sql<Row>`SELECT collection.* FROM ecommerce_product_collections collection
      WHERE collection.slug=${slug} AND collection.publication_status='published' LIMIT 1`.execute(
        getEcommerceDatabase()
      );
    if (!collection.rows[0]) return null;
    const row = collection.rows[0];
    const items = await sql<{
      product_information_id: number | string;
      title: string;
      slug: string;
      sort_order: number | string;
      image_url: string | null;
    }>`SELECT item.product_information_id,product.storefront_title AS title,product.slug,
      item.sort_order,
      (SELECT image.url FROM ecommerce_product_images image
        WHERE image.product_information_id=product.id AND image.status='active'
        ORDER BY image.is_primary DESC,image.sort_order,image.id LIMIT 1) AS image_url
      FROM ecommerce_product_collection_items item
      INNER JOIN ecommerce_product_information product
        ON product.id=item.product_information_id
      WHERE item.collection_id=${Number(row.id)} AND product.status='active'
        AND product.publication_status='published'
      ORDER BY item.sort_order,item.id`.execute(getEcommerceDatabase());
    if (items.rows.length === 0) return null;
    return {
      slug: row.slug,
      title: row.title,
      description: String(row.description ?? ""),
      heroImageUrl: String(row.hero_image_url ?? ""),
      sortOrder: Number(row.sort_order ?? 1000),
      items: items.rows.map((item) => ({
        productInformationId: Number(item.product_information_id),
        title: item.title,
        slug: item.slug,
        sortOrder: Number(item.sort_order),
        imageUrl: item.image_url ? String(item.image_url) : null
      })) satisfies ProductCollectionPublicItem[]
    };
  }
}

async function replaceItemsInTransaction(
  transaction: Kysely<EcommerceDatabase>,
  collectionId: number,
  productInformationIds: number[]
) {
  await sql`DELETE FROM ecommerce_product_collection_items
    WHERE collection_id=${collectionId}`.execute(transaction);
  for (const [index, productId] of productInformationIds.entries()) {
    await sql`INSERT INTO ecommerce_product_collection_items
      (uuid,collection_id,product_information_id,sort_order)
      VALUES (${randomBytes(4).toString("hex")},${collectionId},${productId},${index * 1000})`.execute(
      transaction
    );
  }
}

function toRecord(row: Row): ProductCollectionRecord {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    slug: row.slug,
    title: row.title,
    description: String(row.description ?? ""),
    heroImageUrl: String(row.hero_image_url ?? ""),
    publicationStatus: row.publication_status,
    sortOrder: Number(row.sort_order ?? 1000),
    revision: Number(row.revision ?? 1),
    itemCount: Number(row.item_count ?? 0),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}
