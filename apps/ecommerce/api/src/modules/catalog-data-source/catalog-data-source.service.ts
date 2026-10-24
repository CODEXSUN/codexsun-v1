import { AppError } from "@codexsun/framework/errors";
import { StorefrontRepository } from "../storefront/storefront.repository.js";
import type { StorefrontCatalogFilters } from "../storefront/storefront.types.js";
import { FrappeCatalogSource } from "./catalog-data-source.frappe.js";
import { CatalogDataSourceRepository } from "./catalog-data-source.repository.js";
import type {
  CatalogDataSourceModule,
  CatalogSyncResult,
  CatalogDataSourceControl,
  CatalogDataSourceProvider,
  StorefrontCatalogSource
} from "./catalog-data-source.types.js";

class OwnCatalogSource implements StorefrontCatalogSource {
  constructor(private readonly repository = new StorefrontRepository()) {}
  catalog(filters: StorefrontCatalogFilters) {
    return this.repository.list(filters);
  }
  categories() {
    return this.repository.categories();
  }
  discovery() {
    return this.repository.discovery();
  }
  product(slug: string) {
    return this.repository.find(slug);
  }
  sliders() {
    return this.repository.sliders();
  }
  promotions() {
    return this.repository.promotions();
  }
  featuredCards() {
    return this.repository.featuredCards();
  }
  brandStrips() {
    return this.repository.discovery().then((discovery) => discovery.brands);
  }
  seasonStrips() {
    return this.repository.seasonStrips();
  }
  campaignEvents() {
    return this.repository.promotions();
  }
}

const emptyDiscovery = { brands: [], categories: [], priceRange: { maximum: 0, minimum: 0 } };

export class CatalogDataSourceService implements StorefrontCatalogSource {
  private readonly own = new OwnCatalogSource();
  private readonly frappe: FrappeCatalogSource;
  private moduleProvidersCache:
    | {
        expiresAt: number;
        value: Awaited<ReturnType<CatalogDataSourceRepository["moduleProviders"]>>;
      }
    | undefined;
  private moduleProvidersRequest:
    ReturnType<CatalogDataSourceRepository["moduleProviders"]> | undefined;

  constructor(
    private readonly control: CatalogDataSourceControl,
    private readonly repository = new CatalogDataSourceRepository()
  ) {
    this.frappe = new FrappeCatalogSource(() => control.credentials());
  }

  async pullFromFrappe(): Promise<CatalogSyncResult> {
    const snapshot = await this.frappe.integrationSnapshot();
    await this.repository.replaceFromFrappe(snapshot);
    return syncResult("frappe-to-own", snapshot, "Frappe catalog was synchronized to CXShop.");
  }

  async pushToFrappe(): Promise<CatalogSyncResult> {
    const snapshot = await this.repository.snapshot();
    await this.frappe.upsert(snapshot);
    await this.repository.recordPush(snapshot);
    return syncResult("own-to-frappe", snapshot, "CXShop catalog was synchronized to Frappe.");
  }

  frappeItems(search: string) {
    return this.frappe.itemLookup(search);
  }

  frappeItem(itemCode: string) {
    return this.frappe.item(itemCode);
  }

  async settings() {
    const [connection, modules] = await Promise.all([
      this.control.settings(),
      this.repository.moduleProviders()
    ]);
    return {
      ...connection,
      modules: modules.map((module) => ({ ...module, ...moduleDefinition(module.module) }))
    };
  }

  async switchProvider(
    module: CatalogDataSourceModule,
    provider: CatalogDataSourceProvider,
    actorEmail: string
  ) {
    const connection = await this.control.settings();
    if (provider === "frappe" && !connection.frappeConfigured) {
      throw AppError.validation(
        "Enable and verify the connection in the Frappe app before selecting Frappe Live."
      );
    }
    await this.repository.saveModuleProvider(module, provider, actorEmail);
    this.moduleProvidersCache = undefined;
    this.moduleProvidersRequest = undefined;
    return this.settings();
  }

  async switchEnabled(module: CatalogDataSourceModule, enabled: boolean, actorEmail: string) {
    await this.repository.saveModuleEnabled(module, enabled, actorEmail);
    this.moduleProvidersCache = undefined;
    this.moduleProvidersRequest = undefined;
    return this.settings();
  }

  async test(provider: CatalogDataSourceProvider) {
    const result = await this.control.test(provider);
    if (provider !== "frappe" || !result.connected) return result;
    const started = Date.now();
    try {
      const products = await this.frappe.catalog({});
      return {
        ...result,
        latencyMs: result.latencyMs + Date.now() - started,
        message: `Frappe iShop catalog is ready with ${products.length} published products.`
      };
    } catch (error) {
      return {
        ...result,
        connected: false,
        latencyMs: result.latencyMs + Date.now() - started,
        message: error instanceof Error ? error.message : "Frappe iShop catalog access failed."
      };
    }
  }

  async catalog(filters: StorefrontCatalogFilters) {
    return this.withResolvedImages(
      await this.read("products", (source) => source.catalog(filters))
    );
  }

  async categories() {
    return this.read("categories", (source) => source.categories());
  }

  async discovery() {
    if (await this.modulesUseSameProvider(["products", "categories", "brands"])) {
      const discovery = await this.read("products", (source) => source.discovery(), emptyDiscovery);
      return { ...discovery, brands: await this.withResolvedLogos(discovery.brands) };
    }
    const [productDiscovery, categories, brandDiscovery] = await Promise.all([
      this.read("products", (source) => source.discovery(), emptyDiscovery),
      this.read("categories", (source) => source.categories()),
      this.read("brands", (source) => source.discovery(), emptyDiscovery)
    ]);
    return {
      ...productDiscovery,
      brands: await this.withResolvedLogos(brandDiscovery.brands),
      categories
    };
  }

  async product(slug: string) {
    if (await this.modulesUseSameProvider(["product-details", "variants", "product-images"])) {
      const product = await this.read("product-details", (source) => source.product(slug), null);
      return product ? this.withResolvedImage(product) : null;
    }
    const [details, variants, images] = await Promise.all([
      this.read("product-details", (source) => source.product(slug), null),
      this.read("variants", (source) => source.product(slug), null),
      this.read("product-images", (source) => source.product(slug), null)
    ]);
    if (!details) return null;
    return this.withResolvedImage({
      ...details,
      imageAlt: images?.imageAlt ?? details.imageAlt,
      imageUrl: images?.imageUrl ?? details.imageUrl,
      variantCount: variants?.variantCount ?? details.variantCount,
      variants: variants?.variants ?? details.variants
    });
  }

  async sliders() {
    return this.withResolvedImages(await this.read("sliders", (source) => source.sliders()));
  }
  async promotions() {
    return this.withResolvedImages(await this.read("promotions", (source) => source.promotions()));
  }
  async featuredCards() {
    return this.withResolvedImages(
      await this.read("featured-cards", (source) => source.featuredCards())
    );
  }
  async brandStrips() {
    return this.withResolvedLogos(
      await this.read("brand-strips", (source) => source.brandStrips())
    );
  }
  async seasonStrips() {
    return this.withResolvedImages(
      await this.read("season-strips", (source) => source.seasonStrips())
    );
  }
  async campaignEvents() {
    return this.withResolvedImages(
      await this.read("campaign-events", (source) => source.campaignEvents())
    );
  }

  private async withResolvedImage<T extends { imageUrl: string }>(item: T): Promise<T> {
    if (!isFrappeFile(item.imageUrl)) return item;
    const { frappeUrl } = await this.control.settings();
    return { ...item, imageUrl: absoluteFrappeFile(item.imageUrl, frappeUrl) };
  }

  private async withResolvedImages<T extends { imageUrl: string }>(items: T[]): Promise<T[]> {
    if (!items.some((item) => isFrappeFile(item.imageUrl))) return items;
    const { frappeUrl } = await this.control.settings();
    return items.map((item) => ({
      ...item,
      imageUrl: absoluteFrappeFile(item.imageUrl, frappeUrl)
    }));
  }

  private async withResolvedLogos<T extends { logoUrl: string }>(items: T[]): Promise<T[]> {
    if (!items.some((item) => isFrappeFile(item.logoUrl))) return items;
    const { frappeUrl } = await this.control.settings();
    return items.map((item) => ({
      ...item,
      logoUrl: absoluteFrappeFile(item.logoUrl, frappeUrl)
    }));
  }

  private async read<T>(
    module: CatalogDataSourceModule,
    operation: (source: StorefrontCatalogSource) => Promise<T>,
    disabledValue: T = [] as T
  ) {
    // Local-only public reads (EC-R01). A stored `frappe` selection still records the intended import
    // origin and the direction used by explicit Pull/Push transfer, but it never selects a live read:
    // the storefront must render from the tenant projection even when the Frappe connection is healthy.
    const providers = await this.moduleProviders();
    if (providers.find((item) => item.module === module)?.enabled === false) return disabledValue;
    return operation(this.own);
  }

  private async modulesUseSameProvider(modules: CatalogDataSourceModule[]) {
    const providers = await this.moduleProviders();
    const selected = modules.map(
      (module) => providers.find((item) => item.module === module)?.provider ?? "own"
    );
    return (
      modules.every(
        (module) => providers.find((item) => item.module === module)?.enabled !== false
      ) && selected.every((provider) => provider === selected[0])
    );
  }

  private async moduleProviders() {
    if (this.moduleProvidersCache && this.moduleProvidersCache.expiresAt > Date.now()) {
      return this.moduleProvidersCache.value;
    }
    this.moduleProvidersRequest ??= this.repository.moduleProviders().then((value) => {
      this.moduleProvidersCache = { expiresAt: Date.now() + 30_000, value };
      return value;
    });
    try {
      return await this.moduleProvidersRequest;
    } finally {
      this.moduleProvidersRequest = undefined;
    }
  }
}

function isFrappeFile(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("/files/") || value.startsWith("/private/files/"))
  );
}

function absoluteFrappeFile(value: string, frappeUrl: string | null) {
  if (!isFrappeFile(value) || !frappeUrl) return value;
  try {
    return new URL(value, frappeUrl).toString();
  } catch {
    return value;
  }
}

function moduleDefinition(module: CatalogDataSourceModule) {
  return {
    categories: { description: "Storefront category navigation and filters.", label: "Categories" },
    brands: { description: "Brand discovery, filters, and storefront groups.", label: "Brands" },
    products: {
      description: "Product lists, storefront search, prices, and discovery.",
      label: "Products & search"
    },
    "product-details": {
      description: "Product page content, policies, and highlights.",
      label: "Product details"
    },
    variants: {
      description: "Product variants, SKU choices, and variant prices.",
      label: "Variants"
    },
    "product-images": {
      description: "Primary storefront product images and alternative text.",
      label: "Product images"
    },
    sliders: {
      description: "Home page slider content, imagery, links, scheduling, and display order.",
      label: "Home slider"
    },
    promotions: {
      description: "Promotion cards, offer prices, badges, placement, tint, links, and scheduling.",
      label: "Promotion cards"
    },
    "featured-cards": {
      description: "Featured cards, badges, colours, prices, links, imagery, and scheduling.",
      label: "Featured cards"
    },
    "brand-strips": {
      description: "Ordered storefront brand logos. Local brand discovery remains the fallback.",
      label: "Brand strip"
    },
    "season-strips": {
      description:
        "Dedicated scheduled seasonal banners with an independent local or Frappe source.",
      label: "Season strip"
    },
    "campaign-events": {
      description:
        "Campaign and event carousel records. Local promotion cards remain the fallback.",
      label: "Campaign events"
    }
  }[module];
}

function syncResult(
  direction: CatalogSyncResult["direction"],
  snapshot: Awaited<ReturnType<FrappeCatalogSource["integrationSnapshot"]>>,
  message: string
): CatalogSyncResult {
  return {
    catalogs: snapshot.catalogs.length,
    direction,
    erpnextItems: snapshot.erpnext_items.length,
    items: snapshot.items.length,
    sliders: snapshot.sliders.length,
    promotions: snapshot.promotions.length,
    featuredCards: snapshot.featured_cards.length,
    brandStrips: snapshot.brand_strips?.length ?? 0,
    seasonStrips: snapshot.season_strips?.length ?? 0,
    campaignEvents: snapshot.campaign_events?.length ?? 0,
    message
  };
}
