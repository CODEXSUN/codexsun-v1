import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { StorefrontRepository } from "../storefront/storefront.repository.js";
import { CatalogDataSourceService } from "./catalog-data-source.service.js";
import type {
  CatalogDataSourceConnectionSettings,
  CatalogDataSourceModule,
  CatalogDataSourceProvider
} from "./catalog-data-source.types.js";

type ServiceControl = ConstructorParameters<typeof CatalogDataSourceService>[0];
type ServiceRepository = NonNullable<ConstructorParameters<typeof CatalogDataSourceService>[1]>;
type Provenance = "imported" | "native";

function provenanceTag<T extends object>(value: T, provenance: Provenance) {
  return { ...value, provenance };
}

function product(name: string, slug: string, price: number) {
  return {
    brand: null,
    category: `${name} category`,
    compareAtPrice: null,
    description: `${name} description`,
    featured: false,
    featuredOrder: null,
    imageAlt: name,
    imageUrl: `/media/${slug}.png`,
    name,
    price,
    shortDescription: `${name} summary`,
    slug,
    subtitle: "",
    variantCount: 0
  };
}

function detail(item: ReturnType<typeof product>, provenance: Provenance) {
  return provenanceTag(
    {
      ...item,
      bulletPoints: [],
      returnPolicy: "",
      variants: [],
      warranty: ""
    },
    provenance
  );
}

function slider(kind: string, provenance: Provenance) {
  return provenanceTag(
    {
      actionLabel: "Shop",
      actionUrl: "/shop",
      badge: "",
      badgePosition: "top-right" as const,
      badgeTint: "brand",
      badgeTextColor: "#ffffff",
      description: "",
      displayOrder: 1,
      eyebrow: "",
      imageAlt: kind,
      imageUrl: `/media/${kind}.png`,
      linkedItem: null,
      offerPrice: 0,
      originalPrice: null,
      promotionCode: kind,
      title: kind
    },
    provenance
  );
}

function brand(kind: string, provenance: Provenance) {
  return provenanceTag(
    {
      logoAlt: kind,
      logoUrl: `/media/${kind}.png`,
      name: kind,
      productCount: 1
    },
    provenance
  );
}

function category(kind: string, provenance: Provenance) {
  return provenanceTag({ name: kind, productCount: 1 }, provenance);
}

function importedRecords() {
  const item = product("Imported product", "imported-product", 100);
  return {
    brand: brand("Imported brand", "imported"),
    campaign: slider("Imported campaign", "imported"),
    category: category("Imported category", "imported"),
    detail: detail(item, "imported"),
    featured: slider("Imported featured", "imported"),
    product: provenanceTag(item, "imported"),
    promotion: slider("Imported promotion", "imported"),
    season: slider("Imported season", "imported"),
    slider: slider("Imported slider", "imported")
  };
}

function nativeRecords() {
  const item = product("Native product", "native-product", 200);
  return {
    brand: brand("Native brand", "native"),
    campaign: slider("Native campaign", "native"),
    category: category("Native category", "native"),
    detail: detail(item, "native"),
    featured: slider("Native featured", "native"),
    product: provenanceTag(item, "native"),
    promotion: slider("Native promotion", "native"),
    season: slider("Native season", "native"),
    slider: slider("Native slider", "native")
  };
}

function unifiedSource() {
  const imported = importedRecords();
  const native = nativeRecords();
  return {
    brandStrips: async () => [imported.brand, native.brand],
    campaignEvents: async () => [imported.campaign, native.campaign],
    catalog: async () => [imported.product, native.product],
    categories: async () => [imported.category, native.category],
    discovery: async () => ({
      brands: [imported.brand, native.brand],
      categories: [imported.category, native.category],
      priceRange: { maximum: 200, minimum: 100 }
    }),
    featuredCards: async () => [imported.featured, native.featured],
    product: async (slug: string) =>
      slug === "imported-product"
        ? imported.detail
        : slug === "native-product"
          ? native.detail
          : null,
    promotions: async () => [imported.promotion, native.promotion],
    seasonStrips: async () => [imported.season, native.season],
    sliders: async () => [imported.slider, native.slider]
  };
}

function legacyImportedOnlySource() {
  const imported = importedRecords();
  const calls: string[] = [];
  const record =
    <T>(operation: string, value: T) =>
    async () => {
      calls.push(operation);
      return value;
    };
  return {
    calls,
    source: {
      brandStrips: record("brandStrips", [imported.brand]),
      campaignEvents: record("campaignEvents", [imported.campaign]),
      catalog: record("catalog", [imported.product]),
      categories: record("categories", [imported.category]),
      discovery: record("discovery", {
        brands: [imported.brand],
        categories: [imported.category],
        priceRange: { maximum: 100, minimum: 100 }
      }),
      featuredCards: record("featuredCards", [imported.featured]),
      product: async (slug: string) => {
        calls.push("product");
        return slug === "imported-product" ? imported.detail : null;
      },
      promotions: record("promotions", [imported.promotion]),
      seasonStrips: record("seasonStrips", [imported.season]),
      sliders: record("sliders", [imported.slider])
    }
  };
}

const modules = (
  [
    "categories",
    "brands",
    "products",
    "product-details",
    "variants",
    "product-images",
    "sliders",
    "promotions",
    "featured-cards",
    "brand-strips",
    "season-strips",
    "campaign-events"
  ] as CatalogDataSourceModule[]
).map((module) => ({
  enabled: true,
  module,
  provider: "frappe" as CatalogDataSourceProvider,
  updatedAt: "2026-08-14T00:00:00.000Z",
  updatedBy: "owner@example.test"
}));

function connection(): CatalogDataSourceConnectionSettings {
  return {
    frappeConfigured: true,
    frappeEnabled: true,
    frappeUrl: "https://frappe.example.test",
    verificationStatus: "live"
  };
}

function makeService(local: ReturnType<typeof unifiedSource>) {
  const remoteCalls: string[] = [];
  const remote = new Proxy(
    {},
    {
      get: (_target, operation) => async () => {
        remoteCalls.push(String(operation));
        throw new Error(`Public reads must not call Frappe: ${String(operation)}`);
      }
    }
  );
  const service = new CatalogDataSourceService(
    {
      credentials: async () => {
        throw new Error("Public reads must not read Frappe credentials.");
      },
      settings: async () => connection(),
      test: async (provider: CatalogDataSourceProvider) => ({
        connected: provider === "own",
        latencyMs: 0,
        message: "probe",
        provider,
        providerLabel: provider
      })
    } as unknown as ServiceControl,
    {
      moduleProviders: async () => modules
    } as unknown as ServiceRepository
  );
  Object.assign(service as object, { frappe: remote, own: local });
  return { remoteCalls, service };
}

function provenanceOf(item: unknown) {
  return (item as { provenance?: string } | null | undefined)?.provenance;
}

function provenances(items: ReadonlyArray<object>) {
  return items.map(provenanceOf);
}

test("the storefront repository has no provenance partition", async () => {
  const source = await readFile(
    new URL("../storefront/storefront.repository.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /frappe_modified_at\s+IS\s+(?:NOT\s+)?NULL/iu,
    "A provenance predicate would hide imported or native records."
  );
  assert.equal("sourceCondition" in new StorefrontRepository(), false);
});

test("mixed imported and native records remain one published tenant projection", async () => {
  const legacy = legacyImportedOnlySource();
  const { remoteCalls, service } = makeService(unifiedSource());
  Object.assign(service as object, { fallback: legacy.source });

  const discovery = await service.discovery();

  assert.deepEqual(provenances(await service.catalog({})), ["imported", "native"]);
  assert.equal(provenanceOf(await service.product("imported-product")), "imported");
  assert.equal(provenanceOf(await service.product("native-product")), "native");
  assert.deepEqual(provenances(await service.categories()), ["imported", "native"]);
  assert.deepEqual(provenances(discovery.brands), ["imported", "native"]);
  assert.deepEqual(provenances(discovery.categories), ["imported", "native"]);
  assert.deepEqual(discovery.priceRange, { maximum: 200, minimum: 100 });
  assert.deepEqual(provenances(await service.sliders()), ["imported", "native"]);
  assert.deepEqual(provenances(await service.promotions()), ["imported", "native"]);
  assert.deepEqual(provenances(await service.featuredCards()), ["imported", "native"]);
  assert.deepEqual(provenances(await service.brandStrips()), ["imported", "native"]);
  assert.deepEqual(provenances(await service.seasonStrips()), ["imported", "native"]);
  assert.deepEqual(provenances(await service.campaignEvents()), ["imported", "native"]);

  assert.deepEqual(legacy.calls, [], "The imported-only provenance partition was consulted.");
  assert.deepEqual(remoteCalls, [], "A public read reached the remote Frappe adapter.");
});
