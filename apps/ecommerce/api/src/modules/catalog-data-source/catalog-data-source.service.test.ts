import assert from "node:assert/strict";
import test from "node:test";
import { CatalogDataSourceService } from "./catalog-data-source.service.js";
import type {
  CatalogDataSourceConnectionSettings,
  CatalogDataSourceModule,
  CatalogDataSourceProvider
} from "./catalog-data-source.types.js";

type ServiceControl = ConstructorParameters<typeof CatalogDataSourceService>[0];
type ServiceRepository = NonNullable<ConstructorParameters<typeof CatalogDataSourceService>[1]>;

const product = (name: string) => ({
  brand: null,
  category: "Computers",
  compareAtPrice: null,
  description: `${name} description`,
  featured: false,
  featuredOrder: null,
  imageAlt: name,
  imageUrl: `/media/${name.toLowerCase()}.png`,
  name,
  price: 100,
  shortDescription: "",
  slug: name.toLowerCase(),
  subtitle: "",
  variantCount: 0
});

const slider = (title: string) => ({
  actionLabel: "Shop",
  actionUrl: "/shop",
  description: "",
  displayOrder: 1,
  eyebrow: "",
  imageAlt: title,
  imageUrl: `/media/${title.toLowerCase()}.png`,
  linkedItem: null,
  sliderCode: title,
  title
});

const brand = (name: string) => ({
  logoAlt: name,
  logoUrl: `/media/${name.toLowerCase()}.png`,
  name,
  productCount: 1
});

const category = (name: string) => ({ name, productCount: 1 });

const localCatalog = () => ({
  brandStrips: async () => [brand("Local brand")],
  campaignEvents: async () => [slider("Local campaign")],
  catalog: async () => [product("Local product")],
  categories: async () => [category("Local category")],
  discovery: async () => ({
    brands: [brand("Local brand")],
    categories: [category("Local category")],
    priceRange: { maximum: 100, minimum: 100 }
  }),
  featuredCards: async () => [slider("Local featured")],
  product: async (slug: string) =>
    slug === "local-product"
      ? {
          ...product("Local product"),
          bulletPoints: [],
          returnPolicy: "",
          variants: [],
          warranty: ""
        }
      : null,
  promotions: async () => [slider("Local promotion")],
  seasonStrips: async () => [slider("Local season")],
  sliders: async () => [slider("Local slider")]
});

/**
 * A remote probe whose every adapter method fails if it is called. A public read must never touch it.
 * `calls` records the attempted remote operations so a failure names the exact one.
 */
function remoteProbe() {
  const calls: string[] = [];
  const fail = (operation: string) => async () => {
    calls.push(operation);
    throw new Error(`Remote Frappe operation "${operation}" must not run during a public read.`);
  };
  return {
    calls,
    probe: {
      brandStrips: fail("brandStrips"),
      campaignEvents: fail("campaignEvents"),
      catalog: fail("catalog"),
      categories: fail("categories"),
      discovery: fail("discovery"),
      featuredCards: fail("featuredCards"),
      integrationSnapshot: fail("integrationSnapshot"),
      item: fail("item"),
      itemLookup: fail("itemLookup"),
      product: fail("product"),
      promotions: fail("promotions"),
      seasonStrips: fail("seasonStrips"),
      sliders: fail("sliders"),
      upsert: fail("upsert")
    }
  };
}

function storedModules(
  provider: CatalogDataSourceProvider = "frappe",
  enabled = true
): Array<{
  enabled: boolean;
  module: CatalogDataSourceModule;
  provider: CatalogDataSourceProvider;
  updatedAt: string;
  updatedBy: string;
}> {
  return (
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
    enabled,
    module,
    provider,
    updatedAt: "2026-08-14T00:00:00.000Z",
    updatedBy: "owner@example.test"
  }));
}

function connection(
  overrides: Partial<CatalogDataSourceConnectionSettings> = {}
): CatalogDataSourceConnectionSettings {
  return {
    frappeConfigured: true,
    frappeEnabled: true,
    frappeUrl: "https://frappe.example.test",
    verificationStatus: "live",
    ...overrides
  };
}

type Harness = {
  credentialsCalls: number;
  remote: ReturnType<typeof remoteProbe>;
  service: CatalogDataSourceService;
  settingsCalls: number;
  writeCalls: string[];
};

function harness(
  options: {
    connection?: CatalogDataSourceConnectionSettings;
    local?: Record<string, unknown>;
    modules?: ReturnType<typeof storedModules>;
    now?: Date;
  } = {}
): Harness {
  const remote = remoteProbe();
  const writeCalls: string[] = [];
  let settingsCalls = 0;
  let credentialsCalls = 0;
  const repository = {
    moduleProviders: async () => options.modules ?? storedModules("frappe"),
    recordPush: async () => {
      writeCalls.push("recordPush");
    },
    replaceFromFrappe: async () => {
      writeCalls.push("replaceFromFrappe");
    },
    saveModuleEnabled: async () => {
      writeCalls.push("saveModuleEnabled");
    },
    saveModuleProvider: async () => {
      writeCalls.push("saveModuleProvider");
    },
    snapshot: async () => emptySnapshot()
  };
  const control = {
    credentials: async () => {
      credentialsCalls += 1;
      throw new Error("Remote Frappe credentials must not be read during a public read.");
    },
    settings: async () => {
      settingsCalls += 1;
      return options.connection ?? connection();
    },
    test: async (provider: CatalogDataSourceProvider) => ({
      connected: provider === "own",
      latencyMs: 0,
      message: "probe",
      provider,
      providerLabel: provider
    })
  };
  const service = new CatalogDataSourceService(
    control as unknown as ServiceControl,
    repository as unknown as ServiceRepository
  );
  Object.assign(service as object, {
    frappe: remote.probe,
    own: options.local ?? localCatalog()
  });
  return { credentialsCalls, remote, service, settingsCalls, writeCalls };
}

function emptySnapshot() {
  return {
    brand_strips: [],
    campaign_events: [],
    catalogs: [],
    erpnext_items: [],
    featured_cards: [],
    items: [],
    promotions: [],
    season_strips: [],
    sliders: []
  };
}

test("every public catalog read performs zero remote calls with a stored Frappe selection", async () => {
  const { credentialsCalls, remote, service, settingsCalls, writeCalls } = harness({
    connection: connection(),
    modules: storedModules("frappe")
  });

  assert.equal((await service.catalog({}))[0]?.name, "Local product");
  assert.equal((await service.categories())[0]?.name, "Local category");
  assert.equal((await service.discovery()).brands[0]?.name, "Local brand");
  assert.equal((await service.product("local-product"))?.name, "Local product");
  assert.equal((await service.sliders())[0]?.title, "Local slider");
  assert.equal((await service.promotions())[0]?.title, "Local promotion");
  assert.equal((await service.featuredCards())[0]?.title, "Local featured");
  assert.equal((await service.brandStrips())[0]?.name, "Local brand");
  assert.equal((await service.seasonStrips())[0]?.title, "Local season");
  assert.equal((await service.campaignEvents())[0]?.title, "Local campaign");

  assert.equal(
    "fallback" in (service as object),
    false,
    "Public reads must use the single unified tenant-local projection."
  );
  assert.deepEqual(remote.calls, [], "A public read reached the remote Frappe adapter.");
  assert.equal(credentialsCalls, 0, "A public read read remote Frappe credentials.");
  assert.equal(settingsCalls, 0, "A public read read Frappe connection settings it did not need.");
  assert.deepEqual(writeCalls, [], "A public read wrote catalog data.");
});

test("a broken, disabled or unreachable Frappe connection cannot change a public read", async () => {
  for (const connectionState of [
    connection({ frappeConfigured: false, frappeEnabled: false, verificationStatus: "offline" }),
    connection({ frappeEnabled: false }),
    connection({ frappeConfigured: false, verificationStatus: "unverified" })
  ]) {
    const { remote, service } = harness({
      connection: connectionState,
      modules: storedModules("frappe")
    });
    assert.equal((await service.catalog({}))[0]?.name, "Local product");
    assert.equal((await service.discovery()).brands[0]?.name, "Local brand");
    assert.deepEqual(remote.calls, []);
  }
});

test("an empty local projection returns the documented empty result, never fabricated records", async () => {
  const empty = {
    brandStrips: async () => [],
    campaignEvents: async () => [],
    catalog: async () => [],
    categories: async () => [],
    discovery: async () => ({ brands: [], categories: [], priceRange: { maximum: 0, minimum: 0 } }),
    featuredCards: async () => [],
    product: async () => null,
    promotions: async () => [],
    seasonStrips: async () => [],
    sliders: async () => []
  };
  const { remote, service } = harness({ local: empty });
  assert.deepEqual(await service.catalog({}), []);
  assert.deepEqual(await service.discovery(), {
    brands: [],
    categories: [],
    priceRange: { maximum: 0, minimum: 0 }
  });
  assert.equal(await service.product("missing"), null);
  assert.deepEqual(remote.calls, []);
});

test("imported Frappe media references resolve from stored settings without a remote call", async () => {
  const local = localCatalog();
  const withFrappeMedia = {
    ...local,
    catalog: async () => [{ ...product("Imported product"), imageUrl: "/files/imported.png" }],
    brandStrips: async () => [{ ...brand("Imported brand"), logoUrl: "/files/brand.png" }]
  };
  const { credentialsCalls, remote, service } = harness({
    connection: connection({ frappeUrl: "https://frappe.example.test" }),
    local: withFrappeMedia
  });

  assert.equal(
    (await service.catalog({}))[0]?.imageUrl,
    "https://frappe.example.test/files/imported.png"
  );
  assert.equal(
    (await service.brandStrips())[0]?.logoUrl,
    "https://frappe.example.test/files/brand.png"
  );
  assert.deepEqual(remote.calls, []);
  assert.equal(credentialsCalls, 0);
});

test("stored provider selections survive public reads without being rewritten", async () => {
  const modules = storedModules("frappe");
  const { service, writeCalls } = harness({ modules, local: localCatalog() });
  await service.catalog({});
  await service.sliders();
  const settings = await service.settings();
  assert.deepEqual(
    settings.modules.map(({ module, provider, enabled }) => ({ enabled, module, provider })),
    modules.map(({ module, provider, enabled }) => ({ enabled, module, provider }))
  );
  assert.deepEqual(writeCalls, [], "A read rewrote provider settings.");
});

test("disabled modules return their documented empty shapes without a remote call", async () => {
  const { remote, service } = harness({
    local: localCatalog(),
    modules: storedModules("frappe", false)
  });
  assert.deepEqual(await service.catalog({}), []);
  assert.deepEqual(await service.discovery(), {
    brands: [],
    categories: [],
    priceRange: { maximum: 0, minimum: 0 }
  });
  assert.equal(await service.product("local-product"), null);
  assert.deepEqual(await service.brandStrips(), []);
  assert.deepEqual(remote.calls, []);
});

test("explicit transfer actions remain the only remote catalog path", async () => {
  const remote = remoteProbe();
  const writeCalls: string[] = [];
  const repository = {
    moduleProviders: async () => storedModules("frappe"),
    recordPush: async () => {
      writeCalls.push("recordPush");
    },
    replaceFromFrappe: async () => {
      writeCalls.push("replaceFromFrappe");
    },
    snapshot: async () => emptySnapshot()
  };
  const service = new CatalogDataSourceService(
    { settings: async () => connection() } as unknown as ServiceControl,
    repository as unknown as ServiceRepository
  );
  Object.assign(service as object, {
    frappe: {
      ...remote.probe,
      catalog: remote.probe.catalog,
      integrationSnapshot: async () => {
        remote.calls.push("integrationSnapshot");
        return emptySnapshot();
      },
      upsert: async () => {
        remote.calls.push("upsert");
      }
    },
    own: localCatalog()
  });

  const pulled = await service.pullFromFrappe();
  const pushed = await service.pushToFrappe();
  assert.equal(pulled.direction, "frappe-to-own");
  assert.equal(pushed.direction, "own-to-frappe");
  assert.deepEqual(remote.calls, ["integrationSnapshot", "upsert"]);
  assert.deepEqual(writeCalls.sort(), ["recordPush", "replaceFromFrappe"]);
});

test("the staff Frappe item picker stays an explicit remote read", async () => {
  const calls: string[] = [];
  const service = new CatalogDataSourceService(
    { settings: async () => connection() } as unknown as ServiceControl,
    { moduleProviders: async () => storedModules("frappe") } as unknown as ServiceRepository
  );
  Object.assign(service as object, {
    frappe: {
      item: async (code: string) => {
        calls.push(`item:${code}`);
        return { item_code: code, item_name: code };
      },
      itemLookup: async (search: string) => {
        calls.push(`itemLookup:${search}`);
        return [];
      }
    }
  });
  await service.frappeItems("printer");
  await service.frappeItem("ITEM-1");
  assert.deepEqual(calls, ["itemLookup:printer", "item:ITEM-1"]);
});

test("switching provider still requires a configured connection and records the change", async () => {
  const writes: string[] = [];
  const repository = {
    moduleProviders: async () => storedModules("own"),
    saveModuleProvider: async (
      module: CatalogDataSourceModule,
      provider: CatalogDataSourceProvider
    ) => {
      writes.push(`${module}:${provider}`);
    }
  };
  const service = new CatalogDataSourceService(
    {
      settings: async () => connection({ frappeConfigured: false })
    } as unknown as ServiceControl,
    repository as unknown as ServiceRepository
  );
  await assert.rejects(
    () => service.switchProvider("products", "frappe", "owner@example.test"),
    /Enable and verify the connection/u
  );
  assert.equal(writes.length, 0);

  const configured = new CatalogDataSourceService(
    { settings: async () => connection() } as unknown as ServiceControl,
    {
      moduleProviders: async () => storedModules("own"),
      saveModuleProvider: async (
        module: CatalogDataSourceModule,
        provider: CatalogDataSourceProvider
      ) => {
        writes.push(`${module}:${provider}`);
      }
    } as unknown as ServiceRepository
  );
  await configured.switchProvider("products", "frappe", "owner@example.test");
  assert.deepEqual(writes, ["products:frappe"]);
});
