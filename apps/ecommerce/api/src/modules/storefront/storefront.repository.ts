import { sql } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import type {
  StorefrontCatalogFilters,
  StorefrontDiscovery,
  StorefrontProduct,
  StorefrontProductDetail
} from "./storefront.types.js";

type Row = Record<string, unknown>;

export class StorefrontRepository {
  async list(filters: StorefrontCatalogFilters = {}) {
    const search = filters.search?.toLowerCase() ?? "";
    const category = filters.category?.toLowerCase() ?? "";
    const brand = filters.brand?.toLowerCase() ?? "";
    const minPrice = filters.minPrice ?? 0;
    const maxPrice = filters.maxPrice ?? Number.MAX_SAFE_INTEGER;
    const scope = filters.scope ?? "all";
    const result = await sql<Row>`${selectProducts()}
      WHERE info.publication_status='published' AND info.status='active'
        AND (${search}='' OR ${searchCondition(search, scope)})
        AND (${category}='' OR LOWER(category.name)=${category.toLowerCase()})
        AND (${brand}='' OR LOWER(brand.name)=${brand})
        AND product.opening_price BETWEEN ${minPrice} AND ${maxPrice}
      GROUP BY info.id ${sortProducts(filters.sort)} ${paginateProducts(filters)}`.execute(
      getEcommerceDatabase()
    );
    return result.rows.map(toProduct);
  }

  async find(slug: string): Promise<StorefrontProductDetail | null> {
    const result = await sql<Row>`${selectProducts()} WHERE info.slug=${slug}
      AND info.publication_status='published' AND info.status='active'
      GROUP BY info.id LIMIT 1`.execute(getEcommerceDatabase());
    if (!result.rows[0]) return null;
    const variants =
      await sql<Row>`SELECT id,sku,title,price_adjustment FROM ecommerce_product_variants
      WHERE product_information_id=${Number(result.rows[0].id)} AND status='active' ORDER BY sort_order,id`.execute(
        getEcommerceDatabase()
      );
    const product = toProduct(result.rows[0]);
    return {
      ...product,
      bulletPoints: jsonList(result.rows[0].bullet_points_json),
      returnPolicy: String(result.rows[0].return_policy ?? ""),
      variants: variants.rows.map((variant) => ({
        id: Number(variant.id),
        price: product.price + Number(variant.price_adjustment ?? 0),
        sku: String(variant.sku),
        title: String(variant.title)
      })),
      warranty: String(result.rows[0].warranty ?? "")
    };
  }

  async categories() {
    const result = await sql<{ name: string; product_count: number | string }>`SELECT category.name,
      COUNT(info.id) AS product_count FROM core_product_categories category
      INNER JOIN core_products product ON product.product_category_id=category.id AND product.status='active' AND product.deleted_at IS NULL
      INNER JOIN ecommerce_product_information info ON info.core_product_id=product.id AND info.publication_status='published' AND info.status='active'
      GROUP BY category.id,category.name ORDER BY category.name`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({ name: row.name, productCount: Number(row.product_count) }));
  }

  async sliders() {
    const result = await sql<Row>`SELECT * FROM ecommerce_storefront_sliders
      WHERE status='active' AND published=1
      AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP)
      AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP)
      ORDER BY display_order,slider_code`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({
      actionLabel: String(row.action_label || "Explore now"),
      actionUrl: String(row.action_url || "#catalog"),
      description: sliderText(row.description),
      displayOrder: Number(row.display_order ?? 0),
      eyebrow: String(row.eyebrow ?? ""),
      imageAlt: String(row.title),
      imageUrl: String(row.image_url ?? ""),
      linkedItem: row.ishop_item ? String(row.ishop_item) : null,
      sliderCode: String(row.slider_code),
      title: String(row.title)
    }));
  }
  async promotions() {
    const result =
      await sql<Row>`SELECT * FROM ecommerce_storefront_promotions WHERE status='active' AND published=1
      AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP)
      ORDER BY display_order,promotion_code`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({
      actionLabel: String(row.action_label || "View offer"),
      actionUrl: String(row.action_url || "#catalog"),
      badge: String(row.badge || ""),
      badgePosition: String(row.badge_position || "top-right") as
        "top-left" | "top-right" | "bottom-left" | "bottom-right",
      badgeTint: String(row.badge_tint || "brand"),
      badgeTextColor: String(row.badge_text_color || "#ffffff"),
      description: String(row.description || ""),
      displayOrder: Number(row.display_order || 0),
      eyebrow: String(row.eyebrow || ""),
      imageAlt: String(row.title),
      imageUrl: String(row.image_url || ""),
      linkedItem: row.ishop_item ? String(row.ishop_item) : null,
      offerPrice: Number(row.offer_price || 0),
      originalPrice: row.original_price == null ? null : Number(row.original_price),
      promotionCode: String(row.promotion_code),
      title: String(row.title)
    }));
  }
  async featuredCards() {
    const result = await sql<Row>`SELECT * FROM ecommerce_storefront_featured_cards
      WHERE status='active' AND published=1
      AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP)
      ORDER BY display_order,featured_code`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({
      actionLabel: String(row.action_label || "Explore now"),
      actionUrl: String(row.action_url || "#catalog"),
      badge: String(row.badge || ""),
      badgePosition: String(row.badge_position || "top-right") as
        "top-left" | "top-right" | "bottom-left" | "bottom-right",
      badgeTextColor: String(row.badge_text_color || "#ffffff"),
      badgeTint: String(row.badge_tint || "#0f766e"),
      description: String(row.description || ""),
      displayOrder: Number(row.display_order || 0),
      eyebrow: String(row.eyebrow || ""),
      featuredCode: String(row.featured_code),
      imageAlt: String(row.title),
      imageUrl: String(row.image_url || ""),
      linkedItem: row.ishop_item ? String(row.ishop_item) : null,
      offerPrice: Number(row.offer_price || 0),
      originalPrice: row.original_price == null ? null : Number(row.original_price),
      title: String(row.title)
    }));
  }

  async seasonStrips() {
    const result = await sql<Row>`SELECT * FROM ecommerce_storefront_season_strips
      WHERE status='active' AND published=1
      AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP)
      ORDER BY display_order,season_code`.execute(getEcommerceDatabase());
    return result.rows.map((row) => ({
      actionLabel: String(row.action_label || "Explore now"),
      actionUrl: String(row.action_url || "#catalog"),
      badge: String(row.badge || ""),
      badgePosition: String(row.badge_position || "top-right") as
        "top-left" | "top-right" | "bottom-left" | "bottom-right",
      badgeTint: String(row.badge_tint || "brand"),
      badgeTextColor: String(row.badge_text_color || "#ffffff"),
      description: String(row.description || ""),
      displayOrder: Number(row.display_order || 0),
      eyebrow: String(row.eyebrow || ""),
      imageAlt: String(row.title),
      imageUrl: String(row.image_url || ""),
      linkedItem: row.ishop_item ? String(row.ishop_item) : null,
      offerPrice: Number(row.offer_price || 0),
      originalPrice: row.original_price == null ? null : Number(row.original_price),
      promotionCode: String(row.season_code),
      title: String(row.title)
    }));
  }

  async discovery(): Promise<StorefrontDiscovery> {
    const [categories, brands, prices] = await Promise.all([
      this.categories(),
      sql<{
        logo_alt: string;
        logo_url: string;
        name: string;
        product_count: number | string;
      }>`SELECT brand.name,brand.logo_url,brand.logo_alt,
        COUNT(info.id) AS product_count FROM core_brands brand
        INNER JOIN ecommerce_product_information info ON info.brand_id=brand.id AND info.publication_status='published' AND info.status='active'
        INNER JOIN core_products product ON product.id=info.core_product_id AND product.status='active' AND product.deleted_at IS NULL
        WHERE brand.status='active' AND brand.show_on_storefront=1
        GROUP BY brand.id,brand.name,brand.logo_url,brand.logo_alt,brand.sort_order
        ORDER BY brand.sort_order,brand.name`.execute(getEcommerceDatabase()),
      sql<{ maximum: number | string; minimum: number | string }>`SELECT
        COALESCE(MAX(product.opening_price),0) AS maximum,COALESCE(MIN(product.opening_price),0) AS minimum
        FROM core_products product INNER JOIN ecommerce_product_information info ON info.core_product_id=product.id
        WHERE product.status='active' AND product.deleted_at IS NULL AND info.publication_status='published'
        AND info.status='active'`.execute(
        getEcommerceDatabase()
      )
    ]);
    return {
      brands: brands.rows.map((row) => ({
        logoAlt: row.logo_alt || `${row.name} logo`,
        logoUrl: row.logo_url,
        name: row.name,
        productCount: Number(row.product_count)
      })),
      categories,
      priceRange: {
        maximum: Number(prices.rows[0]?.maximum ?? 0),
        minimum: Number(prices.rows[0]?.minimum ?? 0)
      }
    };
  }
}

function searchCondition(search: string, scope: StorefrontCatalogFilters["scope"]) {
  const like = `%${search}%`;
  if (scope === "brands") return sql`LOWER(brand.name) LIKE ${like}`;
  if (scope === "categories") return sql`LOWER(category.name) LIKE ${like}`;
  const productMatch = sql`(LOWER(info.storefront_title) LIKE ${like} OR LOWER(info.subtitle) LIKE ${like}
    OR LOWER(info.short_description) LIKE ${like} OR LOWER(info.description) LIKE ${like}
    OR LOWER(info.bullet_points_json) LIKE ${like} OR EXISTS (
      SELECT 1 FROM ecommerce_product_variants search_variant
      WHERE search_variant.product_information_id=info.id AND search_variant.status='active'
      AND (LOWER(search_variant.sku) LIKE ${like} OR LOWER(search_variant.title) LIKE ${like})
    ))`;
  return scope === "products"
    ? productMatch
    : sql`(${productMatch} OR LOWER(brand.name) LIKE ${like} OR LOWER(category.name) LIKE ${like})`;
}

function sortProducts(sort: StorefrontCatalogFilters["sort"] = "featured") {
  if (sort === "name") return sql`ORDER BY info.storefront_title`;
  if (sort === "price-asc") return sql`ORDER BY product.opening_price,info.storefront_title`;
  if (sort === "price-desc") return sql`ORDER BY product.opening_price DESC,info.storefront_title`;
  if (sort === "discount")
    return sql`ORDER BY MAX(variant.compare_at_adjustment) DESC,info.storefront_title`;
  return sql`ORDER BY info.is_featured DESC,info.storefront_title`;
}

function paginateProducts(filters: StorefrontCatalogFilters) {
  if (filters.limit == null) return sql``;
  return sql`LIMIT ${filters.limit} OFFSET ${filters.offset ?? 0}`;
}

function selectProducts() {
  return sql`SELECT info.*,product.opening_price,category.name AS category_name,brand.name AS brand_name,
    image.url AS image_url,image.alt_text AS image_alt,COUNT(DISTINCT variant.id) AS variant_count,
    MAX(variant.compare_at_adjustment) AS compare_at_adjustment
    FROM ecommerce_product_information info
    INNER JOIN core_products product ON product.id=info.core_product_id AND product.status='active' AND product.deleted_at IS NULL
    INNER JOIN core_product_categories category ON category.id=product.product_category_id
    LEFT JOIN core_brands brand ON brand.id=info.brand_id
    LEFT JOIN ecommerce_product_images image ON image.product_information_id=info.id AND image.is_primary=1 AND image.status='active'
    LEFT JOIN ecommerce_product_variants variant ON variant.product_information_id=info.id AND variant.status='active'`;
}

function toProduct(row: Row): StorefrontProduct {
  const price = Number(row.opening_price ?? 0);
  const compareAdjustment = Number(row.compare_at_adjustment ?? 0);
  return {
    brand: row.brand_name ? String(row.brand_name) : null,
    category: String(row.category_name),
    compareAtPrice: compareAdjustment > 0 ? price + compareAdjustment : null,
    description: String(row.description ?? ""),
    featured: Boolean(row.is_featured),
    featuredOrder: null,
    imageAlt: String(row.image_alt ?? row.storefront_title),
    imageUrl: String(row.image_url ?? ""),
    name: String(row.storefront_title),
    price,
    shortDescription: String(row.short_description ?? ""),
    slug: String(row.slug),
    subtitle: String(row.subtitle ?? ""),
    variantCount: Number(row.variant_count ?? 0)
  };
}

function jsonList(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function sliderText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}
