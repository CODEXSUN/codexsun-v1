/**
 * EC-T01 / lease L1 — disposable Ecommerce tenant, actor, and denial E2E harness.
 *
 * What this proves against a fresh, throw-away Platform master database and two fresh tenant
 * databases created from the real tenant provisioning pipeline:
 *
 *  A1  Tenant A staff read with a valid session -> 200 and tenant A Ecommerce data.
 *  A2  No session, a revoked session, and an absent session slot -> 401.
 *  A3  Forged browser `x-tenant-db`/`x-tenant-id` headers pointing at tenant B are replaced from
 *      the trusted session, so the request still reads tenant A's database only.
 *  A4  A record ID that exists only in tenant B is not found through tenant A (record substitution).
 *  A5  Tenant B with Ecommerce disabled -> 403 and no data leakage (staff and public surfaces).
 *  A6  Removing `ecommerce.catalog.view` from the acting admin role live -> 403; restoring it -> 200.
 *  A7  Unknown and suspended hosts -> 404 for `/storefront/bootstrap` in multi-tenant mode.
 *  A8  An Ecommerce data accessor called outside `runWithEcommerceRequestScope` throws forbidden.
 *  A9  Two companies, two customer contacts, and two vendor contacts in tenant A; the tenant A
 *      public scope cannot see tenant B fixtures.
 *  A10 Composition and legacy-cleanup checks formerly covered by the retired
 *      `ecommerce-modules.e2e.ts` entry point.
 *
 * Safety: the script overrides DB_MASTER_NAME / DEFAULT_TENANT_* before the Platform environment
 * is loaded and only ever drops the three databases whose names it generated. It never touches
 * `codexsun_master_db`, `codexsun_db`, `sukraa_db`, `altex_db`, or any database it did not create.
 *
 * Run: node --import tsx tools/e2e/ecommerce-tenancy.e2e.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { createPool } from "mysql2";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { Kysely, MysqlDialect, sql } from "kysely";
import type { EcommerceDatabase } from "../../apps/ecommerce/api/src/database/ecommerce-database.js";

const runId = Date.now();
const masterDatabaseName = `codexsun_ecommerce_tenancy_e2e_${runId}`;
const tenantADatabaseName = `${masterDatabaseName}_a`;
const tenantBDatabaseName = `${masterDatabaseName}_b`;
const tenantACode = `E2ETA${runId}`;
const tenantBCode = `E2ETB${runId}`;
const tenantASlug = `ecommerce-tenancy-a-${runId}`;
const tenantBSlug = `ecommerce-tenancy-b-${runId}`;
const tenantADomain = `${tenantASlug}.localhost`;
const tenantBDomain = `${tenantBSlug}.localhost`;
const tenantAUuid = `ea${runId.toString(16).slice(-6)}`;
const tenantBUuid = `eb${runId.toString(16).slice(-6)}`;
const fixtureStorageRoot = resolve(
  process.cwd(),
  "dist",
  "ecommerce-scratch",
  "storage",
  String(runId)
);

// The real DB host/user/password/secret come from the root .env. Only the database names and the
// tenancy runtime switches are replaced, before the Platform environment module is imported.
Object.assign(process.env, {
  CODEXSUN_DB_FRESH_ON_START: "0",
  CODEXSUN_QUEUE_WORKER_ENABLED: "0",
  CODEXSUN_TENANCY_MODE: "multi",
  DB_MASTER_NAME: masterDatabaseName,
  DEFAULT_TENANT_CORPORATE_ID: tenantACode,
  DEFAULT_TENANT_DB_NAME: tenantADatabaseName,
  DEFAULT_TENANT_DOMAIN: tenantADomain,
  DEFAULT_TENANT_NAME: "Ecommerce Tenancy E2E Tenant A",
  DEFAULT_TENANT_SLUG: tenantASlug,
  ENABLE_DEFAULT_TENANT_SEED: "0",
  NODE_ENV: "test",
  STORAGE_ROOT: fixtureStorageRoot
});

const { env } = await import("../../apps/platform/api/src/env.js");
const { bootstrapPlatformDatabase, closePlatformDatabase } =
  await import("../../apps/platform/api/src/database/platform-database.js");
const { closeAllTenantDatabases } =
  await import("../../apps/platform/api/src/database/tenant-database.js");
const { defaultTenantModuleKeys } =
  await import("../../apps/platform/api/src/modules/app-registry/index.js");
const { TenantService } =
  await import("../../apps/platform/api/src/modules/tenant/tenant.service.js");
const { DatabaseMaintenanceService } =
  await import("../../apps/platform/api/src/modules/database-maintenance/database-maintenance.service.js");
const { createApp } = await import("../../apps/platform/api/src/app.js");
const { isSingleTenantMode } = await import("../../apps/platform/api/src/tenancy-mode.js");
const { closeAllBillingDatabases } = await import("@codexsun/billing-api");
const { closeCoreDatabase, getActiveContactForDatabase, getCompanyForDatabase } =
  await import("@codexsun/core-api");
const { isAppError } = await import("@codexsun/framework/errors");
const {
  getEcommerceDatabase,
  getEcommerceTenantDatabaseName,
  getEcommerceTenantKey,
  runWithEcommerceRequestScope
} = await import("../../apps/ecommerce/api/src/database/ecommerce-database.js");
const { ecommerceModuleKeys } =
  await import("../../apps/ecommerce/api/src/modules/ecommerce-composition/index.js");
const { upgradeProductVariantCanonicalOptions } =
  await import("../../apps/ecommerce/api/src/modules/product-variant/product-variant.migration.js");
const { migrateEcommerceTenantDatabase } =
  await import("../../apps/ecommerce/api/src/modules/ecommerce-composition/ecommerce-composition.migration.js");
const { ecommerceTenantMigrationVersions, ecommerceTenantMigrations } =
  await import("../../apps/ecommerce/api/src/modules/ecommerce-composition/ecommerce-composition.migration.js");
const { runMigrationBatch } = await import("@codexsun/framework/db");
const { PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH } =
  await import("../../apps/ecommerce/api/src/modules/product-variant/product-variant.identity.js");
const { tenantPublicStorageRoot } =
  await import("../../apps/platform/api/src/modules/storage-manager/storage-manager.paths.js");

const sharedHost = new URL(env.PLATFORM_WEB_ORIGIN).hostname;
const sharedOrigin = env.PLATFORM_WEB_ORIGIN;
const adminEmail = env.DEFAULT_TENANT_ADMIN_EMAIL.trim();
const adminPassword = env.DEFAULT_TENANT_ADMIN_PASSWORD;

assert.ok(adminEmail, "DEFAULT_TENANT_ADMIN_EMAIL is required for tenant login.");
assert.ok(adminPassword, "DEFAULT_TENANT_ADMIN_PASSWORD is required for tenant login.");

type FixtureCompanyPlan = {
  code: string;
  email: string;
  key: string;
  name: string;
  phone: string;
};

type FixtureContactPlan = {
  code: string;
  email: string;
  key: string;
  name: string;
  phone: string;
  typeName: "Customer" | "Supplier";
};

type FixtureProductPlan = {
  imageUrl?: string;
  key: string;
  price: number;
  publicationStatus: "draft" | "published";
  slug: string;
  title: string;
};

type FixturePlan = {
  companies: FixtureCompanyPlan[];
  contacts: FixtureContactPlan[];
  products: FixtureProductPlan[];
};

type TenantFixtures = {
  companyIds: Record<string, number>;
  contactIds: Record<string, number>;
  coreProductIds: Record<string, number>;
  financialYearId: number;
  productInformationIds: Record<string, number>;
};

const fixture = {
  companyOne: "E2E Tenancy Fixture Company One",
  companyThree: "E2E Tenancy Fixture Company Three",
  companyTwo: "E2E Tenancy Fixture Company Two",
  customerOne: "E2E Tenancy Customer One",
  customerThree: "E2E Tenancy Customer Three",
  customerTwo: "E2E Tenancy Customer Two",
  productAOnly: "E2E Tenancy A Only Product",
  productBOnlyOne: "E2E Tenancy B Only Product One",
  productBOnlyTwo: "E2E Tenancy B Only Product Two",
  vendorOne: "E2E Tenancy Vendor One",
  vendorTwo: "E2E Tenancy Vendor Two"
} as const;

const tenantAImageName = "tenant-a-only-evidence.png";
const tenantBImageName = "tenant-b-only-evidence.png";

const tenantAPlan: FixturePlan = {
  companies: [
    {
      code: "E2E-CMP-1",
      email: "a.company1@ecommerce-tenancy.test",
      key: "one",
      name: fixture.companyOne,
      phone: "9100000001"
    },
    {
      code: "E2E-CMP-2",
      email: "a.company2@ecommerce-tenancy.test",
      key: "two",
      name: fixture.companyTwo,
      phone: "9100000002"
    }
  ],
  contacts: [
    {
      code: "E2E-CUST-1",
      email: "a.customer1@ecommerce-tenancy.test",
      key: "customerOne",
      name: fixture.customerOne,
      phone: "9300000001",
      typeName: "Customer"
    },
    {
      code: "E2E-CUST-2",
      email: "a.customer2@ecommerce-tenancy.test",
      key: "customerTwo",
      name: fixture.customerTwo,
      phone: "9300000002",
      typeName: "Customer"
    },
    {
      code: "E2E-VEND-1",
      email: "a.vendor1@ecommerce-tenancy.test",
      key: "vendorOne",
      name: fixture.vendorOne,
      phone: "9300000003",
      typeName: "Supplier"
    },
    {
      code: "E2E-VEND-2",
      email: "a.vendor2@ecommerce-tenancy.test",
      key: "vendorTwo",
      name: fixture.vendorTwo,
      phone: "9300000004",
      typeName: "Supplier"
    }
  ],
  products: [
    {
      key: "aOnly",
      imageUrl: `/api/platform/storefront/product-images/${tenantAImageName}`,
      price: 150,
      publicationStatus: "published",
      slug: `${tenantASlug}-a-only-product`,
      title: fixture.productAOnly
    }
  ]
};

const tenantBPlan: FixturePlan = {
  companies: [
    {
      code: "E2E-CMP-1",
      email: "b.company1@ecommerce-tenancy.test",
      key: "one",
      name: fixture.companyOne,
      phone: "9200000001"
    },
    {
      code: "E2E-CMP-2",
      email: "b.company2@ecommerce-tenancy.test",
      key: "two",
      name: fixture.companyTwo,
      phone: "9200000002"
    },
    {
      code: "E2E-CMP-3",
      email: "b.company3@ecommerce-tenancy.test",
      key: "three",
      name: fixture.companyThree,
      phone: "9200000003"
    }
  ],
  contacts: [
    {
      code: "E2E-CUST-1",
      email: "b.customer1@ecommerce-tenancy.test",
      key: "customerOne",
      name: fixture.customerOne,
      phone: "9400000001",
      typeName: "Customer"
    },
    {
      code: "E2E-CUST-2",
      email: "b.customer2@ecommerce-tenancy.test",
      key: "customerTwo",
      name: fixture.customerTwo,
      phone: "9400000002",
      typeName: "Customer"
    },
    {
      code: "E2E-VEND-1",
      email: "b.vendor1@ecommerce-tenancy.test",
      key: "vendorOne",
      name: fixture.vendorOne,
      phone: "9400000003",
      typeName: "Supplier"
    },
    {
      code: "E2E-VEND-2",
      email: "b.vendor2@ecommerce-tenancy.test",
      key: "vendorTwo",
      name: fixture.vendorTwo,
      phone: "9400000004",
      typeName: "Supplier"
    },
    {
      code: "E2E-CUST-3",
      email: "b.customer3@ecommerce-tenancy.test",
      key: "customerThree",
      name: fixture.customerThree,
      phone: "9400000005",
      typeName: "Customer"
    }
  ],
  products: [
    {
      key: "bOnlyOne",
      price: 250,
      publicationStatus: "published",
      slug: `${tenantBSlug}-b-only-product-one`,
      title: fixture.productBOnlyOne
    },
    {
      key: "bOnlyTwo",
      price: 350,
      publicationStatus: "published",
      slug: `${tenantBSlug}-b-only-product-two`,
      title: fixture.productBOnlyTwo
    }
  ]
};

let app: Awaited<ReturnType<typeof createApp>> | undefined;
let tenantAConnection: Connection | undefined;
let tenantBConnection: Connection | undefined;
const dropWarnings: string[] = [];
const passLines: string[] = [];

const admin = await createConnection({
  host: env.DB_HOST,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  user: env.DB_USER
});

let mainError: unknown = null;
let cleanupError: unknown = null;

try {
  console.log(
    `[e2e] provisioning disposable master "${masterDatabaseName}", tenants "${tenantADatabaseName}" and "${tenantBDatabaseName}"`
  );
  await bootstrapPlatformDatabase();

  const tenantService = new TenantService();
  const maintenance = new DatabaseMaintenanceService();
  const disabledForTenantA = defaultTenantModuleKeys.filter(
    (key) => key !== "platform.application" && key !== "ecommerce"
  );
  const disabledForTenantB = defaultTenantModuleKeys.filter(
    (key) => key !== "platform.application"
  );

  const tenantA = await tenantService.createTenant({
    corporateId: tenantACode,
    dbHost: env.DB_HOST,
    dbName: tenantADatabaseName,
    dbPort: env.DB_PORT,
    dbSecretRef: "DB_PASSWORD",
    dbType: env.DB_DRIVER,
    dbUser: env.DB_USER,
    defaultLandingApp: "ecommerce",
    enabledModuleKeys: ["ecommerce"],
    mobile: null,
    payloadSettings: {
      apps: { disabled: disabledForTenantA, enabled: ["ecommerce"] },
      landing: { app: "ecommerce", mode: "tenant" },
      seed: { source: "ecommerce-tenancy-e2e" }
    },
    primaryDomain: tenantADomain,
    slug: tenantASlug,
    status: "active",
    tenantCode: tenantACode,
    tenantName: "Ecommerce Tenancy E2E Tenant A",
    uuid: tenantAUuid
  });
  const tenantB = await tenantService.createTenant({
    corporateId: tenantBCode,
    dbHost: env.DB_HOST,
    dbName: tenantBDatabaseName,
    dbPort: env.DB_PORT,
    dbSecretRef: "DB_PASSWORD",
    dbType: env.DB_DRIVER,
    dbUser: env.DB_USER,
    defaultLandingApp: "application",
    enabledModuleKeys: [],
    mobile: null,
    payloadSettings: {
      apps: { disabled: disabledForTenantB, enabled: ["platform.application"] },
      landing: { app: "application", mode: "tenant" },
      seed: { source: "ecommerce-tenancy-e2e" }
    },
    primaryDomain: tenantBDomain,
    slug: tenantBSlug,
    status: "active",
    tenantCode: tenantBCode,
    tenantName: "Ecommerce Tenancy E2E Tenant B",
    uuid: tenantBUuid
  });

  assert.ok(
    tenantA.enabledModuleKeys.includes("ecommerce"),
    "Tenant A must enable the Ecommerce module."
  );
  assert.equal(
    tenantB.enabledModuleKeys.includes("ecommerce"),
    false,
    "Tenant B must have the Ecommerce module disabled."
  );
  console.log(
    `[e2e] tenants registered: A uuid=${tenantA.uuid} code=${tenantA.tenantCode}; B uuid=${tenantB.uuid} code=${tenantB.tenantCode}`
  );

  for (const [label, tenant] of [
    ["A", tenantA],
    ["B", tenantB]
  ] as const) {
    console.log(`[e2e] provisioning tenant ${label} database "${tenant.dbName}"`);
    const run = await maintenance.setupTenant(tenant.id, {
      note: `EC-T01 tenancy E2E setup for tenant ${label}.`
    });
    assert.equal(run?.status, "completed", `Tenant ${label} setup did not complete.`);
    console.log(`[e2e] tenant ${label} database migrated and seeded`);
  }

  tenantAConnection = await createConnection({
    ...dbConnectionBase(),
    database: tenantADatabaseName
  });
  tenantBConnection = await createConnection({
    ...dbConnectionBase(),
    database: tenantBDatabaseName
  });

  // Verified domains are a disposable fixture for this harness only. Provisioning records the
  // tenant primary domain as pending/disabled, which is the production-safe default.
  await admin.changeUser({ database: masterDatabaseName });
  await admin.execute(
    "UPDATE tenant_domains SET status='active', verification_status='verified', verified_at=NOW() WHERE tenant_id IN (?,?)",
    [tenantA.id, tenantB.id]
  );
  const verifiedDomains = await queryRows(
    admin,
    "SELECT domain FROM tenant_domains WHERE tenant_id IN (?,?) AND status='active' AND verification_status='verified' ORDER BY domain",
    [tenantA.id, tenantB.id]
  );
  assert.deepEqual(
    verifiedDomains.map((row) => String(row.domain)).sort(),
    [tenantADomain, tenantBDomain].sort(),
    "Both disposable tenant domains must resolve for public storefront assertions."
  );

  console.log(`[e2e] creating Platform API application`);
  app = await createApp();
  await app.ready();
  console.log(`[e2e] Platform API ready; shared host "${sharedHost}"`);

  const fixturesA = await createTenantFixtures(tenantAConnection, tenantAPlan);
  const fixturesB = await createTenantFixtures(tenantBConnection, tenantBPlan);
  await writeTenantProductImage(tenantASlug, tenantAImageName);
  await writeTenantProductImage(tenantBSlug, tenantBImageName);
  console.log(
    `[e2e] fixtures created: A companies=${Object.keys(fixturesA.companyIds).length} contacts=${Object.keys(fixturesA.contactIds).length} products=${Object.keys(fixturesA.productInformationIds).length}; B companies=${Object.keys(fixturesB.companyIds).length} contacts=${Object.keys(fixturesB.contactIds).length} products=${Object.keys(fixturesB.productInformationIds).length}`
  );
  if (process.env.ECOM_TENANCY_FORCE_FAILURE === "1") {
    throw new Error("Forced EC-R08 cleanup drill after fixtures were created.");
  }

  const sessionA = await loginTenant(tenantACode);
  const sessionB = await loginTenant(tenantBCode);
  console.log(`[e2e] tenant sessions established for A and B`);

  const aOnlyTitle = fixture.productAOnly;
  const bOnlyTitles = [fixture.productBOnlyOne, fixture.productBOnlyTwo];
  const bOnlyProductInfoId = fixturesB.productInformationIds.bOnlyTwo!;
  const bOnlyCompanyId = fixturesB.companyIds.three!;
  const bOnlyContactId = fixturesB.contactIds.customerThree!;

  // ----- A1: tenant A staff read with a valid session --------------------------------
  await assertion(
    "A1",
    "tenant A staff read with a valid session returns 200 and tenant A Ecommerce data",
    async () => {
      const setting = await moduleSetting(tenantAConnection!, "ecommerce");
      assert.equal(Number(setting.enabled), 1, "Tenant A must show Ecommerce enabled.");
      assert.equal(String(setting.status), "active");
      const permissions = await scalar(
        tenantAConnection!,
        "SELECT COUNT(*) AS count FROM app_permissions WHERE `key` IN ('ecommerce.catalog.view','ecommerce.catalog.edit','ecommerce.storefront.view','ecommerce.storefront.manage') AND status='active'"
      );
      assert.equal(permissions, 4, "Tenant A must have the Ecommerce staff permissions seeded.");
      const rolePermission = await scalar(
        tenantAConnection!,
        "SELECT COUNT(*) AS count FROM app_role_permissions rolePermission INNER JOIN app_roles role ON role.id=rolePermission.role_id INNER JOIN app_permissions permission ON permission.id=rolePermission.permission_id WHERE role.`key`='admin' AND permission.`key`='ecommerce.catalog.view' AND rolePermission.status='active'"
      );
      assert.equal(rolePermission, 1, "Tenant A admin must hold ecommerce.catalog.view.");

      const response = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(response.statusCode, 200, response.body);
      const titles = catalogTitles(response);
      assert.ok(titles.includes(aOnlyTitle), "Tenant A staff catalog must include tenant A data.");
      assert.equal(titles.includes(bOnlyTitles[0]!), false);
      assert.equal(titles.includes(bOnlyTitles[1]!), false);
      assert.equal(
        await scalar(
          tenantAConnection!,
          "SELECT COUNT(*) AS count FROM ecommerce_product_information WHERE id=?",
          [fixturesA.productInformationIds.aOnly!]
        ),
        1
      );
    }
  );

  // ----- A2: no session / revoked session / absent slot ------------------------------
  await assertion(
    "A2",
    "no session, a revoked session, and an absent session slot are rejected with 401",
    async () => {
      const noSession = await app!.inject({
        headers: {
          host: sharedHost,
          origin: sharedOrigin,
          "x-tenant-db": tenantADatabaseName,
          "x-tenant-id": tenantA.uuid
        },
        method: "GET",
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(noSession.statusCode, 401, noSession.body);

      const secondSession = await loginTenant(tenantACode);
      const logout = await app!.inject({
        headers: secondSession.headers,
        method: "POST",
        url: "/auth/logout"
      });
      assert.equal(logout.statusCode, 200, logout.body);
      const revoked = await app!.inject({
        headers: secondSession.headers,
        method: "GET",
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(revoked.statusCode, 401, revoked.body);

      const absentSlot = await app!.inject({
        headers: {
          cookie: sessionA.cookie,
          host: sharedHost,
          origin: sharedOrigin,
          "x-codexsun-session-slot": "0".repeat(32),
          "x-tenant-db": tenantADatabaseName,
          "x-tenant-id": tenantA.uuid
        },
        method: "GET",
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(absentSlot.statusCode, 401, absentSlot.body);
    }
  );

  // ----- A3: forged tenant headers are replaced from trusted session ----------------
  await assertion(
    "A3",
    "forged x-tenant-db/x-tenant-id headers are ignored and tenant A data is returned",
    async () => {
      const forged = await app!.inject({
        headers: {
          ...sessionA.headers,
          "x-tenant-db": tenantBDatabaseName,
          "x-tenant-id": tenantB.uuid
        },
        method: "GET",
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(forged.statusCode, 200, forged.body);
      assert.equal(
        String(forged.headers["x-tenant-id"]),
        tenantA.uuid,
        "The response must carry the trusted tenant A id, not the forged tenant B id."
      );
      const titles = catalogTitles(forged);
      assert.ok(titles.includes(aOnlyTitle), "Forged headers must not change the read database.");
      for (const title of bOnlyTitles) {
        assert.equal(forged.body.includes(title), false, `Tenant B data leaked: ${title}`);
      }
    }
  );

  // ----- A4: cross-tenant record substitution ---------------------------------------
  await assertion(
    "A4",
    "an ID that exists only in tenant B is not returned through tenant A",
    async () => {
      assert.equal(
        await scalar(
          tenantAConnection!,
          "SELECT COUNT(*) AS count FROM ecommerce_product_information WHERE id=?",
          [bOnlyProductInfoId]
        ),
        0,
        "The substituted Ecommerce record id must not exist in tenant A."
      );
      assert.equal(
        await scalar(
          tenantBConnection!,
          "SELECT COUNT(*) AS count FROM ecommerce_product_information WHERE id=?",
          [bOnlyProductInfoId]
        ),
        1
      );
      const response = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/product-information/${bOnlyProductInfoId}`
      });
      assert.equal(response.statusCode, 404, response.body);

      // A tenant B company id used through tenant A must be rejected by the live reference check.
      assert.equal(
        await scalar(
          tenantAConnection!,
          "SELECT COUNT(*) AS count FROM core_companies WHERE id=?",
          [bOnlyCompanyId]
        ),
        0
      );
      assert.equal(
        await scalar(
          tenantBConnection!,
          "SELECT COUNT(*) AS count FROM core_companies WHERE id=?",
          [bOnlyCompanyId]
        ),
        1
      );
      const substituted = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          companyId: bOnlyCompanyId,
          displayName: "",
          financialYearId: fixturesA.financialYearId,
          logoFileName: null
        },
        url: "/ecommerce/storefront/organisation"
      });
      assert.equal(substituted.statusCode, 400, substituted.body);
      assert.match(substituted.body, /this tenant/iu);
    }
  );

  // ----- A5: tenant B with Ecommerce disabled -> 403, no leakage --------------------
  await assertion(
    "A5",
    "tenant B with Ecommerce disabled is rejected with 403 and leaks no data",
    async () => {
      const setting = await moduleSetting(tenantBConnection!, "ecommerce");
      assert.equal(Number(setting.enabled), 0, "Tenant B must show Ecommerce disabled.");
      assert.equal(String(setting.status), "inactive");
      assert.equal(
        await scalar(
          tenantBConnection!,
          "SELECT COUNT(*) AS count FROM app_permissions WHERE `key` LIKE 'ecommerce.%' AND status='active'"
        ),
        0,
        "Tenant B must not have Ecommerce permissions seeded."
      );

      const response = await app!.inject({
        headers: sessionB.headers,
        method: "GET",
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(response.statusCode, 403, response.body);
      for (const title of [...bOnlyTitles, aOnlyTitle]) {
        assert.equal(response.body.includes(title), false, `Denied response leaked: ${title}`);
      }

      const publicResponse = await app!.inject({
        headers: { host: tenantBDomain },
        method: "GET",
        url: "/storefront/bootstrap"
      });
      assert.equal(publicResponse.statusCode, 404, publicResponse.body);
      for (const title of bOnlyTitles) {
        assert.equal(publicResponse.body.includes(title), false);
      }
    }
  );

  // ----- A6: live permission check --------------------------------------------------
  await assertion(
    "A6",
    "removing ecommerce.catalog.view live returns 403 and restoring it returns 200",
    async () => {
      await setCatalogViewPermission(tenantAConnection!, "inactive");
      try {
        const denied = await app!.inject({
          headers: sessionA.headers,
          method: "GET",
          url: "/ecommerce/catalog/product-information"
        });
        assert.equal(denied.statusCode, 403, denied.body);
        assert.equal(
          denied.body.includes(aOnlyTitle),
          false,
          "Denied response leaked tenant data."
        );
        assert.match(denied.body, /ecommerce\.catalog\.view/u);
      } finally {
        await setCatalogViewPermission(tenantAConnection!, "active");
      }
      const restored = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(restored.statusCode, 200, restored.body);
      assert.ok(catalogTitles(restored).includes(aOnlyTitle));
    }
  );

  // ----- A9: fixtures and public-scope isolation ------------------------------------
  await assertion(
    "A9",
    "two companies, two customer contacts and two vendor contacts in tenant A stay tenant-bound and tenant B fixtures are invisible to the tenant A public scope",
    async () => {
      const companyRows = await queryRows(
        tenantAConnection!,
        "SELECT code,name,primary_phone FROM core_companies WHERE code IN ('E2E-CMP-1','E2E-CMP-2') ORDER BY code"
      );
      assert.equal(companyRows.length, 2, "Tenant A must contain two fixture companies.");
      assert.equal(String(companyRows[0]!.name), fixture.companyOne);

      const contactRows = await queryRows(
        tenantAConnection!,
        "SELECT code,name,type_name FROM core_contacts WHERE code IN ('E2E-CUST-1','E2E-CUST-2','E2E-VEND-1','E2E-VEND-2') ORDER BY code"
      );
      assert.equal(contactRows.length, 4, "Tenant A must contain two customers and two vendors.");
      assert.deepEqual(contactRows.map((row) => String(row.type_name)).sort(), [
        "Customer",
        "Customer",
        "Supplier",
        "Supplier"
      ]);

      const organisation = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          companyId: fixturesA.companyIds.one!,
          displayName: "",
          financialYearId: fixturesA.financialYearId,
          logoFileName: null
        },
        url: "/ecommerce/storefront/organisation"
      });
      assert.equal(organisation.statusCode, 200, organisation.body);

      const branding = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/branding"
      });
      assert.equal(branding.statusCode, 200, branding.body);
      const brandingData = (branding.json() as { data?: Record<string, unknown> }).data ?? {};
      assert.equal(String(brandingData.brandName), fixture.companyOne);
      assert.equal(String(brandingData.primaryPhone), "9100000001");
      assert.equal(
        branding.body.includes("9200000001"),
        false,
        "Tenant A public branding must not return tenant B company data."
      );

      const catalog = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/catalog"
      });
      assert.equal(catalog.statusCode, 200, catalog.body);
      const publicTitles = catalogTitles(catalog);
      assert.ok(publicTitles.includes(fixture.productAOnly));
      for (const title of bOnlyTitles) {
        assert.equal(publicTitles.includes(title), false, `Tenant B fixture leaked: ${title}`);
      }
      const ownProduct = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/storefront/products/${tenantAPlan.products[0]!.slug}`
      });
      assert.equal(ownProduct.statusCode, 200, ownProduct.body);
      assert.equal(
        String((ownProduct.json() as { data?: Record<string, unknown> }).data?.name),
        fixture.productAOnly
      );
      const foreignProduct = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/storefront/products/${tenantBPlan.products[1]!.slug}`
      });
      assert.equal(foreignProduct.statusCode, 404, foreignProduct.body);

      // Authorized count + no-count-inflation: the public catalog must return exactly the tenant's
      // own published product set. Tenant B rows are unreachable from tenant A's host.
      const publishedSlugs = (
        await queryRows(
          tenantAConnection!,
          "SELECT slug FROM ecommerce_product_information WHERE publication_status='published' AND status='active' ORDER BY slug"
        )
      ).map((row) => String(row.slug));
      const publicSlugs = (
        (catalog.json() as { data?: Array<Record<string, unknown>> }).data ?? []
      ).map((row) => String(row.slug));
      assert.deepEqual(
        [...publicSlugs].sort(),
        publishedSlugs,
        `Public catalog returned ${publicSlugs.length} rows for ${publishedSlugs.length} published tenant A products.`
      );
      assert.equal(
        publicSlugs.length,
        new Set(publicSlugs).size,
        "The public catalog returned duplicate rows for one tenant."
      );

      // Denied file/media access: the public image route must read only its own tenant folder.
      const ownImage = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/storefront/product-images/${tenantAImageName}`
      });
      assert.equal(ownImage.statusCode, 200, ownImage.body);
      assert.match(String(ownImage.headers["content-type"]), /^image\/png/u);
      const traversal = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/product-images/..%2F..%2F.env"
      });
      assert.ok(
        [400, 404].includes(traversal.statusCode),
        `Traversal image request was not rejected: ${traversal.statusCode} ${traversal.body}`
      );

      // Positive control for the foreign-image check: tenant B can read its own file only while its
      // Ecommerce module is active. Without this control the denial below would pass for a
      // nonexistent file and prove nothing.
      const tenantBRow = await firstRow(
        admin,
        "SELECT enabled_module_keys FROM tenants WHERE id=?",
        [tenantB.id]
      );
      assert.ok(tenantBRow, "Tenant B registry row must exist.");
      const originalModuleKeys = parseStringArray(tenantBRow.enabled_module_keys);
      await admin.execute("UPDATE tenants SET enabled_module_keys=? WHERE id=?", [
        JSON.stringify(Array.from(new Set([...originalModuleKeys, "ecommerce"]))),
        tenantB.id
      ]);
      await executeUpdate(
        tenantBConnection!,
        "UPDATE app_module_settings SET enabled=1,status='active' WHERE module_key='ecommerce'"
      );
      try {
        const tenantBImage = await app!.inject({
          headers: { host: tenantBDomain },
          method: "GET",
          url: `/storefront/product-images/${tenantBImageName}`
        });
        assert.equal(tenantBImage.statusCode, 200, tenantBImage.body);
        assert.match(String(tenantBImage.headers["content-type"]), /^image\/png/u);

        const foreignImage = await app!.inject({
          headers: { host: tenantADomain },
          method: "GET",
          url: `/storefront/product-images/${tenantBImageName}`
        });
        assert.equal(foreignImage.statusCode, 404, foreignImage.body);
      } finally {
        await executeUpdate(
          tenantBConnection!,
          "UPDATE app_module_settings SET enabled=0,status='inactive' WHERE module_key='ecommerce'"
        );
        await admin.execute("UPDATE tenants SET enabled_module_keys=? WHERE id=?", [
          JSON.stringify(originalModuleKeys),
          tenantB.id
        ]);
      }

      // The Ecommerce public scope binds its data accessors to the Platform-verified tenant
      // database. Tenant B-only fixture ids must not resolve through tenant A's scope.
      const scopeDatabase = {} as Kysely<EcommerceDatabase>;
      await runWithEcommerceRequestScope(
        scopeDatabase,
        tenantA.uuid,
        async () => {
          const databaseName = getEcommerceTenantDatabaseName();
          assert.equal(databaseName, tenantADatabaseName);
          assert.equal(getEcommerceTenantKey(), tenantA.uuid);
          const ownCustomer = await getActiveContactForDatabase(
            databaseName,
            fixturesA.contactIds.customerOne!
          );
          assert.equal(ownCustomer?.name, fixture.customerOne);
          const ownVendor = await getActiveContactForDatabase(
            databaseName,
            fixturesA.contactIds.vendorOne!
          );
          assert.equal(ownVendor?.name, fixture.vendorOne);
          assert.equal(
            await getActiveContactForDatabase(databaseName, bOnlyContactId),
            null,
            "Tenant B contact must not resolve through tenant A's Ecommerce scope."
          );
          const ownCompany = await getCompanyForDatabase(databaseName, fixturesA.companyIds.one!);
          assert.equal(ownCompany?.name, fixture.companyOne);
          assert.equal(
            await getCompanyForDatabase(databaseName, bOnlyCompanyId),
            null,
            "Tenant B company must not resolve through tenant A's Ecommerce scope."
          );
        },
        tenantADatabaseName,
        false
      );
    }
  );

  // ----- A10: composition and legacy cleanup (replacement for ecommerce-modules.e2e.ts) -----
  await assertion(
    "A10",
    "Platform composes every Ecommerce module, the data-source route hides secrets, and the legacy catalog cleanup ran",
    async () => {
      const health = await app!.inject({ method: "GET", url: "/health" });
      assert.equal(health.statusCode, 200, health.body);
      const modules = (
        health.json() as {
          data?: { checks?: Record<string, { details?: { modules?: string[] } }> };
        }
      ).data?.checks?.["platform-api"]?.details?.modules;
      assert.ok(Array.isArray(modules), "Health must list composed modules.");
      for (const key of ecommerceModuleKeys) {
        assert.ok(modules.includes(key), `${key} was not composed into Platform.`);
      }

      const dataSource = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: "/ecommerce/settings/data-source"
      });
      assert.equal(dataSource.statusCode, 200, dataSource.body);
      const dataSourceBody = dataSource.json() as {
        data?: { modules?: unknown; apiKey?: unknown };
      };
      assert.ok(Array.isArray(dataSourceBody.data?.modules));
      assert.equal(
        "apiKey" in (dataSourceBody.data ?? {}),
        false,
        "The data-source read leaked apiKey."
      );

      const duplicateFrappe = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {},
        url: "/ecommerce/settings/data-source/frappe"
      });
      assert.equal(duplicateFrappe.statusCode, 404, duplicateFrappe.body);

      const brandColumns = await queryRows(
        tenantAConnection!,
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='core_brands' AND COLUMN_NAME IN ('logo_url','logo_alt','show_on_storefront')"
      );
      assert.equal(brandColumns.length, 3, "Core brand storefront fields are missing.");
      const legacyTables = await queryRows(
        tenantAConnection!,
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('ecommerce_catalog','ecommerce_catalog_activity','ecommerce_storefront_config','ecommerce_storefront_quotes','ecommerce_storefront_quote_items','ecommerce_storefront_activity')"
      );
      assert.equal(legacyTables.length, 0, "Legacy catalog or quote tables remain.");
      const cleanupMigration = await scalar(
        tenantAConnection!,
        "SELECT COUNT(*) AS count FROM migration_schema WHERE name='ecommerce.modules.legacy-cleanup' AND status='applied'"
      );
      assert.equal(cleanupMigration, 1, "The legacy cleanup migration is not applied.");
    }
  );

  // ----- A11: EC-T03 catalog upsert, publication, variant options and optimistic edits -----
  await assertion(
    "A11",
    "catalog upsert enforces Core lookups, duplicate slugs/SKUs/options, optimistic edits and draft/public separation",
    async () => {
      const suffix = String(runId);
      const activeCore = await executeInsert(
        tenantAConnection!,
        "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 250, 'active', 'e2e:catalog')",
        [fixtureUuid(`catalog-core-active:${suffix}`), `E2E Catalog Active Core ${suffix}`]
      );
      const inactiveCore = await executeInsert(
        tenantAConnection!,
        "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 250, 'inactive', 'e2e:catalog')",
        [fixtureUuid(`catalog-core-inactive:${suffix}`), `E2E Catalog Inactive Core ${suffix}`]
      );
      const secondCore = await executeInsert(
        tenantAConnection!,
        "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 250, 'active', 'e2e:catalog')",
        [fixtureUuid(`catalog-core-second:${suffix}`), `E2E Catalog Second Core ${suffix}`]
      );
      const activeCoreId = Number(activeCore.insertId);
      const inactiveCoreId = Number(inactiveCore.insertId);
      const secondCoreId = Number(secondCore.insertId);
      const slug = `e2e-catalog-${suffix}`;

      const inactiveParent = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          coreProductId: inactiveCoreId,
          slug: `${slug}-inactive`,
          storefrontTitle: "Inactive parent"
        },
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(inactiveParent.statusCode, 400, inactiveParent.body);

      const createdResponse = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          coreProductId: activeCoreId,
          publicationStatus: "draft",
          slug,
          storefrontTitle: `E2E Catalog Draft ${suffix}`
        },
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(createdResponse.statusCode, 200, createdResponse.body);
      const created = (createdResponse.json() as { data: Record<string, unknown> }).data;
      const productId = Number(created.id);
      assert.equal(Number(created.revision), 1, "A new product must start at revision 1.");
      assert.ok(
        /^[0-9a-f]{8}$/u.test(String(created.uuid)),
        "Product UUID must be eight hex chars."
      );

      const draftPublic = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/storefront/products/${slug}`
      });
      assert.equal(draftPublic.statusCode, 404, "A draft product leaked to the public storefront.");

      const pageResponse = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: "/ecommerce/catalog/product-information?page=1&pageSize=100"
      });
      assert.equal(pageResponse.statusCode, 200, pageResponse.body);
      const page = (
        pageResponse.json() as {
          data: {
            items: Array<Record<string, unknown>>;
            page: number;
            pageSize: number;
            total: number;
          };
        }
      ).data;
      assert.equal(page.page, 1);
      assert.equal(page.pageSize, 100);
      assert.ok(page.total >= 1);
      assert.ok(page.items.some((item) => Number(item.id) === productId));
      const oversizedPage = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: "/ecommerce/catalog/product-information?pageSize=101"
      });
      assert.equal(oversizedPage.statusCode, 400, "Page size above 100 must be rejected.");

      const duplicateCore = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          coreProductId: activeCoreId,
          slug: `${slug}-other`,
          storefrontTitle: "Duplicate core"
        },
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(duplicateCore.statusCode, 409, duplicateCore.body);

      const duplicateSlug = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          coreProductId: secondCoreId,
          slug,
          storefrontTitle: "Duplicate slug"
        },
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(duplicateSlug.statusCode, 409, duplicateSlug.body);

      const staleEdit = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          coreProductId: activeCoreId,
          expectedRevision: 99,
          slug,
          storefrontTitle: "Stale edit"
        },
        url: `/ecommerce/catalog/product-information/${productId}`
      });
      assert.equal(staleEdit.statusCode, 409, staleEdit.body);

      const publishedResponse = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          coreProductId: activeCoreId,
          expectedRevision: 1,
          publicationStatus: "published",
          slug,
          storefrontTitle: `E2E Catalog Published ${suffix}`
        },
        url: `/ecommerce/catalog/product-information/${productId}`
      });
      assert.equal(publishedResponse.statusCode, 200, publishedResponse.body);
      const published = (publishedResponse.json() as { data: Record<string, unknown> }).data;
      assert.equal(Number(published.revision), 2, "A completed edit must increment the revision.");

      const publishedPublic = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/storefront/products/${slug}`
      });
      assert.equal(publishedPublic.statusCode, 200, publishedPublic.body);

      const variantResponse = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: " Color ",
          option1Value: " Red ",
          productInformationId: productId,
          sku: ` e2e-sku-${suffix} `,
          title: "Red variant"
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(variantResponse.statusCode, 200, variantResponse.body);
      const variant = (variantResponse.json() as { data: Record<string, unknown> }).data;
      assert.equal(String(variant.sku), `E2E-SKU-${suffix}`);
      assert.equal(String(variant.option1Name), "Color");
      assert.equal(Number(variant.revision), 1);

      const duplicateSku = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "Color",
          option1Value: "Blue",
          productInformationId: productId,
          sku: `E2E-SKU-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(duplicateSku.statusCode, 409, duplicateSku.body);

      const duplicateOption = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "color",
          option1Value: "red",
          productInformationId: productId,
          sku: `E2E-SKU-OTHER-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(duplicateOption.statusCode, 409, duplicateOption.body);

      const partialOption = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "Size",
          productInformationId: productId,
          sku: `E2E-SKU-PARTIAL-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(partialOption.statusCode, 400, partialOption.body);

      const twoOption = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "Size",
          option1Value: "M",
          option2Name: "Color",
          option2Value: "Red",
          productInformationId: productId,
          sku: `E2E-SKU-RED-M-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(twoOption.statusCode, 200, twoOption.body);
      const reorderedOption = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "color",
          option1Value: " red ",
          option2Name: "SIZE",
          option2Value: "m",
          productInformationId: productId,
          sku: `E2E-SKU-M-RED-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(
        reorderedOption.statusCode,
        409,
        `Equivalent reordered option combinations must collide: ${reorderedOption.body}`
      );

      const delimiterOne = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "a",
          option1Value: "b|c=d",
          productInformationId: productId,
          sku: `E2E-SKU-DELIMITER-ONE-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(delimiterOne.statusCode, 200, delimiterOne.body);
      const delimiterTwo = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "a",
          option1Value: "b",
          option2Name: "c",
          option2Value: "d",
          productInformationId: productId,
          sku: `E2E-SKU-DELIMITER-TWO-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(
        delimiterTwo.statusCode,
        200,
        `Distinct delimiter-bearing combinations must not collide: ${delimiterTwo.body}`
      );

      const maximumPayload = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          option1Name: "😀".repeat(80),
          option1Value: "🦄".repeat(120),
          option2Name: "😁".repeat(80),
          option2Value: "🐍".repeat(120),
          option3Name: "😂".repeat(80),
          option3Value: "🦊".repeat(120),
          productInformationId: productId,
          sku: `E2E-SKU-MAX-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(maximumPayload.statusCode, 200, maximumPayload.body);
      const maximumSignature = await scalar(
        tenantAConnection!,
        "SELECT LENGTH(option_signature) FROM ecommerce_product_variants WHERE sku=?",
        [`E2E-SKU-MAX-${suffix}`]
      );
      assert.equal(maximumSignature, 64, "The stored canonical signature must fit CHAR(64).");

      const variantId = Number(variant.id);
      const staleVariant = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          expectedRevision: 99,
          productInformationId: productId,
          sku: `E2E-SKU-${suffix}`,
          title: "Stale"
        },
        url: `/ecommerce/catalog/variants/${variantId}`
      });
      assert.equal(staleVariant.statusCode, 409, staleVariant.body);
      const updatedVariant = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          expectedRevision: 1,
          option1Name: "Color",
          option1Value: "Red",
          productInformationId: productId,
          sku: `E2E-SKU-${suffix}`,
          title: "Updated variant"
        },
        url: `/ecommerce/catalog/variants/${variantId}`
      });
      assert.equal(updatedVariant.statusCode, 200, updatedVariant.body);
      assert.equal(
        Number((updatedVariant.json() as { data: Record<string, unknown> }).data.revision),
        2
      );

      const reload = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/variants/${variantId}`
      });
      assert.equal(reload.statusCode, 200, reload.body);
      const reloaded = (reload.json() as { data: Record<string, unknown> }).data;
      assert.equal(String(reloaded.title), "Updated variant");
      assert.equal(Number(reloaded.revision), 2);
      const stored = await firstRow(
        tenantAConnection!,
        "SELECT revision,option_signature FROM ecommerce_product_variants WHERE id=?",
        [variantId]
      );
      assert.equal(Number(stored?.revision), 2);
      assert.equal(
        String(stored?.option_signature),
        createHash("sha256")
          .update(JSON.stringify([["color", "red"]]))
          .digest("hex")
      );

      const archivedParent = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          coreProductId: secondCoreId,
          slug: `${slug}-archived`,
          storefrontTitle: "Archived parent"
        },
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(archivedParent.statusCode, 200, archivedParent.body);
      const archivedId = Number(
        (archivedParent.json() as { data: Record<string, unknown> }).data.id
      );
      const archive = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {},
        url: `/ecommerce/catalog/product-information/${archivedId}/archive`
      });
      assert.equal(archive.statusCode, 200, archive.body);
      const variantUnderArchive = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          productInformationId: archivedId,
          sku: `E2E-SKU-ARCHIVED-${suffix}`
        },
        url: "/ecommerce/catalog/variants"
      });
      assert.equal(variantUnderArchive.statusCode, 400, variantUnderArchive.body);

      const storedProduct = await firstRow(
        tenantAConnection!,
        "SELECT revision,publication_status FROM ecommerce_product_information WHERE id=?",
        [productId]
      );
      assert.equal(Number(storedProduct?.revision), 2);
      assert.equal(String(storedProduct?.publication_status), "published");
    }
  );

  // ----- A12: mixed imported and native tenant-local projection ----------------------
  await assertion(
    "A12",
    "imported and native products, discovery counts, filters and content share one complete published projection",
    async () => {
      const suffix = String(runId);
      const importedSlug = `e2e-imported-${suffix}`;
      const nativeSlug = `e2e-native-${suffix}`;
      const importedTitle = `E2E Imported Projection ${suffix}`;
      const nativeTitle = `E2E Native Projection ${suffix}`;
      const importedCore = await executeInsert(
        tenantAConnection!,
        "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 125, 'active', 'e2e:projection')",
        [fixtureUuid(`projection-imported-core:${suffix}`), `${importedTitle} Core`]
      );
      const nativeCore = await executeInsert(
        tenantAConnection!,
        "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 175, 'active', 'e2e:projection')",
        [fixtureUuid(`projection-native-core:${suffix}`), `${nativeTitle} Core`]
      );
      const importedInfo = await executeInsert(
        tenantAConnection!,
        "INSERT INTO ecommerce_product_information (uuid, core_product_id, storefront_title, slug, description, bullet_points_json, publication_status, is_featured, frappe_item_code, frappe_modified_at) VALUES (?, ?, ?, ?, ?, '[]', 'published', 0, ?, NOW())",
        [
          fixtureUuid(`projection-imported-info:${suffix}`),
          Number(importedCore.insertId),
          importedTitle,
          importedSlug,
          `${importedTitle} imported fixture.`,
          `E2E-IMPORTED-${suffix}`
        ]
      );
      const nativeInfo = await executeInsert(
        tenantAConnection!,
        "INSERT INTO ecommerce_product_information (uuid, core_product_id, storefront_title, slug, description, bullet_points_json, publication_status, is_featured) VALUES (?, ?, ?, ?, ?, '[]', 'published', 0)",
        [
          fixtureUuid(`projection-native-info:${suffix}`),
          Number(nativeCore.insertId),
          nativeTitle,
          nativeSlug,
          `${nativeTitle} native fixture.`
        ]
      );
      assert.ok(Number(importedInfo.insertId) > 0 && Number(nativeInfo.insertId) > 0);

      const importedSlider = `e2e-imported-slider-${suffix}`;
      const nativeSlider = `e2e-native-slider-${suffix}`;
      const sliderImageUrl = `/api/platform/storefront/product-images/${tenantAImageName}`;
      await executeInsert(
        tenantAConnection!,
        "INSERT INTO ecommerce_storefront_sliders (slider_code, title, image_url, display_order, published, frappe_modified_at, status) VALUES (?, ?, ?, 20, 1, NOW(), 'active')",
        [importedSlider, `${importedTitle} Slider`, sliderImageUrl]
      );
      await executeInsert(
        tenantAConnection!,
        "INSERT INTO ecommerce_storefront_sliders (slider_code, title, image_url, display_order, published, frappe_modified_at, status) VALUES (?, ?, ?, 21, 1, NULL, 'active')",
        [nativeSlider, `${nativeTitle} Slider`, sliderImageUrl]
      );

      const catalogResponse = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/catalog?limit=100&sort=name"
      });
      assert.equal(catalogResponse.statusCode, 200, catalogResponse.body);
      const publicSlugs = (
        (catalogResponse.json() as { data?: Array<Record<string, unknown>> }).data ?? []
      ).map((row) => String(row.slug));
      const expectedSlugs = (
        await queryRows(
          tenantAConnection!,
          "SELECT info.slug FROM ecommerce_product_information info INNER JOIN core_products product ON product.id=info.core_product_id WHERE info.publication_status='published' AND info.status='active' AND product.status='active' AND product.deleted_at IS NULL ORDER BY info.slug"
        )
      ).map((row) => String(row.slug));
      assert.deepEqual(
        [...publicSlugs].sort(),
        expectedSlugs,
        "The public catalog must include every retained imported and native published product."
      );
      assert.ok(
        publicSlugs.includes(importedSlug) && publicSlugs.includes(nativeSlug),
        "Both provenance variants must survive the tenant-local published projection."
      );

      for (const slug of [importedSlug, nativeSlug]) {
        const detail = await app!.inject({
          headers: { host: tenantADomain },
          method: "GET",
          url: `/storefront/products/${slug}`
        });
        assert.equal(detail.statusCode, 200, `${slug}: ${detail.body}`);
      }
      const nativeSearch = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/storefront/catalog?search=${encodeURIComponent(nativeTitle)}`
      });
      assert.equal(nativeSearch.statusCode, 200, nativeSearch.body);
      assert.deepEqual(
        ((nativeSearch.json() as { data?: Array<Record<string, unknown>> }).data ?? []).map((row) =>
          String(row.slug)
        ),
        [nativeSlug]
      );

      const firstCategoryName = String(
        (
          await queryRows(
            tenantAConnection!,
            "SELECT name FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1"
          )
        )[0]?.name ?? ""
      );
      const expectedCategoryCount = Number(
        await scalar(
          tenantAConnection!,
          "SELECT COUNT(DISTINCT info.id) FROM ecommerce_product_information info INNER JOIN core_products product ON product.id=info.core_product_id INNER JOIN core_product_categories category ON category.id=product.product_category_id WHERE product.status='active' AND product.deleted_at IS NULL AND info.publication_status='published' AND info.status='active' AND category.name=?",
          [firstCategoryName]
        )
      );
      const categoryResponse = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/categories"
      });
      assert.equal(categoryResponse.statusCode, 200, categoryResponse.body);
      const firstCategory = (
        categoryResponse.json() as { data?: Array<{ name: string; productCount: number }> }
      ).data?.find((category) => category.name === firstCategoryName);
      assert.equal(
        firstCategory?.productCount,
        expectedCategoryCount,
        "Category counts must include imported and native published products."
      );

      const discovery = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/discovery"
      });
      assert.equal(discovery.statusCode, 200, discovery.body);
      assert.ok(
        Number(
          (discovery.json() as { data?: { priceRange?: { maximum?: number } } }).data?.priceRange
            ?.maximum ?? 0
        ) >= 175,
        "Discovery price range must include native products."
      );

      const sliders = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/sliders"
      });
      assert.equal(sliders.statusCode, 200, sliders.body);
      const sliderCodes = (
        (sliders.json() as { data?: Array<Record<string, unknown>> }).data ?? []
      ).map((row) => String(row.sliderCode));
      assert.ok(
        sliderCodes.includes(importedSlider) && sliderCodes.includes(nativeSlider),
        "Imported and native sliders must share one complete published projection."
      );
    }
  );

  // ----- A13: EC-T05 server pagination, filters and status totals -------------------
  await assertion(
    "A13",
    "catalog pages hide at one hundred rows, reset/clamp safely, and filter with backend status totals",
    async () => {
      type CatalogPage = {
        items: Array<Record<string, unknown>>;
        page: number;
        pageSize: number;
        statusCounts: Record<string, number>;
        total: number;
      };
      const suffix = String(runId);
      const searchTerm = `E2E Pagination ${suffix}`;
      let paginationProductId = 0;
      for (let index = 0; index < 130; index += 1) {
        const number = String(index + 1).padStart(3, "0");
        const core = await executeInsert(
          tenantAConnection!,
          "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 100, 'active', 'e2e:pagination')",
          [fixtureUuid(`pagination-core:${suffix}:${number}`), `${searchTerm} ${number} Core`]
        );
        const info = await executeInsert(
          tenantAConnection!,
          "INSERT INTO ecommerce_product_information (uuid, core_product_id, storefront_title, slug, description, bullet_points_json, publication_status, is_featured) VALUES (?, ?, ?, ?, ?, '[]', 'published', 0)",
          [
            fixtureUuid(`pagination-info:${suffix}:${number}`),
            Number(core.insertId),
            `${searchTerm} ${number}`,
            `e2e-pagination-${suffix}-${number}`,
            `Pagination fixture ${number}.`
          ]
        );
        if (index === 0) paginationProductId = Number(info.insertId);
      }
      for (let index = 1; index <= 105; index += 1) {
        const number = String(index).padStart(3, "0");
        await executeInsert(
          tenantAConnection!,
          "INSERT INTO ecommerce_product_variants (uuid, product_information_id, sku, title, option_1_name, option_1_value, option_signature, status) VALUES (?, ?, ?, ?, 'Size', ?, ?, ?)",
          [
            fixtureUuid(`pagination-variant:${suffix}:${number}`),
            paginationProductId,
            `E2E-PAGE-SKU-${suffix}-${number}`,
            `Pagination Variant ${number}`,
            `V${number}`,
            createHash("sha256")
              .update(JSON.stringify([["size", `v${number}`]]))
              .digest("hex"),
            index % 21 === 0 ? "inactive" : "active"
          ]
        );
      }

      const readProductPage = async (query: string) => {
        const response = await app!.inject({
          headers: sessionA.headers,
          method: "GET",
          url: `/ecommerce/catalog/product-information?search=${encodeURIComponent(searchTerm)}&${query}`
        });
        assert.equal(response.statusCode, 200, response.body);
        return (response.json() as { data: CatalogPage }).data;
      };
      const readVariantPage = async (query: string) => {
        const response = await app!.inject({
          headers: sessionA.headers,
          method: "GET",
          url: `/ecommerce/catalog/variants?search=${encodeURIComponent(`E2E-PAGE-SKU-${suffix}`)}&${query}`
        });
        assert.equal(response.statusCode, 200, response.body);
        return (response.json() as { data: CatalogPage }).data;
      };

      const productFirst = await readProductPage("page=1&pageSize=20");
      assert.equal(productFirst.total, 130);
      assert.equal(productFirst.items.length, 20);
      assert.deepEqual(productFirst.statusCounts, {
        all: 130,
        archived: 0,
        draft: 0,
        published: 130
      });
      const productSecond = await readProductPage("page=2&pageSize=20");
      assert.equal(productSecond.items.length, 20);
      assert.equal(
        productSecond.items.filter((row) => productFirst.items.some((first) => first.id === row.id))
          .length,
        0,
        "The second page must contain rows outside the first page."
      );
      const productLast = await readProductPage("page=7&pageSize=20");
      assert.equal(productLast.page, 7);
      assert.equal(productLast.items.length, 10);
      const productClamped = await readProductPage("page=99&pageSize=20");
      assert.equal(productClamped.page, 7);
      assert.equal(productClamped.items.length, 10);
      const productWideFirst = await readProductPage("page=1&pageSize=100");
      assert.equal(productWideFirst.items.length, 100);
      const productWideSecond = await readProductPage("page=2&pageSize=100");
      assert.equal(productWideSecond.items.length, 30);
      const productIds = new Set(
        [...productWideFirst.items, ...productWideSecond.items].map((row) => Number(row.id))
      );
      assert.equal(productIds.size, 130);

      const productNarrow = await readProductPage(
        `page=9&pageSize=20&storefrontTitle=${encodeURIComponent(`${searchTerm} 007`)}`
      );
      assert.equal(productNarrow.total, 1);
      assert.equal(productNarrow.page, 1);
      assert.equal(productNarrow.pageSize, 100);
      assert.equal(productNarrow.items.length, 1);
      assert.equal(String(productNarrow.items[0]?.slug), `e2e-pagination-${suffix}-007`);
      assert.equal(productNarrow.statusCounts.all, 1);

      const productCore = await readProductPage(
        `page=1&pageSize=20&coreProductName=${encodeURIComponent(`${searchTerm} 008`)}`
      );
      assert.equal(productCore.total, 1);
      const productSlug = await readProductPage(
        `page=1&pageSize=20&slug=${encodeURIComponent(`e2e-pagination-${suffix}-009`)}`
      );
      assert.equal(productSlug.total, 1);
      const productMissing = await readProductPage(
        `page=6&pageSize=20&storefrontTitle=${encodeURIComponent("missing-pagination-row")}`
      );
      assert.equal(productMissing.total, 0);
      assert.equal(productMissing.page, 1);
      assert.equal(productMissing.items.length, 0);
      const productDraft = await readProductPage("page=6&pageSize=20&status=draft");
      assert.equal(productDraft.total, 0);
      assert.equal(productDraft.items.length, 0);
      assert.equal(productDraft.statusCounts.all, 130);

      const variantFirst = await readVariantPage("page=1&pageSize=20");
      assert.equal(variantFirst.total, 105);
      assert.equal(variantFirst.items.length, 20);
      assert.deepEqual(variantFirst.statusCounts, { active: 100, all: 105, inactive: 5 });
      const variantLast = await readVariantPage("page=99&pageSize=20");
      assert.equal(variantLast.page, 6);
      assert.equal(variantLast.items.length, 5);
      const variantWide = await readVariantPage("page=2&pageSize=100");
      assert.equal(variantWide.items.length, 5);
      const variantInactive = await readVariantPage("page=9&pageSize=20&status=inactive");
      assert.equal(variantInactive.total, 5);
      assert.equal(variantInactive.page, 1);
      assert.equal(variantInactive.pageSize, 100);
      assert.equal(variantInactive.items.length, 5);
      assert.equal(variantInactive.statusCounts.all, 105);
      const variantSku = await readVariantPage(
        `page=1&pageSize=20&sku=${encodeURIComponent(`E2E-PAGE-SKU-${suffix}-007`)}`
      );
      assert.equal(variantSku.total, 1);
      const variantOptions = await readVariantPage(
        `page=1&pageSize=20&options=${encodeURIComponent("V007")}`
      );
      assert.equal(variantOptions.total, 1);
      const variantProduct = await readVariantPage(
        `page=1&pageSize=20&productTitle=${encodeURIComponent(`${searchTerm} 001`)}`
      );
      assert.equal(variantProduct.total, 105);
    }
  );

  // ----- A14: legacy variant schema upgrades without truncation or false collisions -----
  await assertion(
    "A14",
    "legacy variant rows upgrade with maximum Unicode options and delimiter-bearing values",
    async () => {
      const databaseName = `${masterDatabaseName}_legacy`;
      let database: Kysely<EcommerceDatabase> | undefined;
      try {
        await admin.query(
          `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        database = new Kysely<EcommerceDatabase>({
          dialect: new MysqlDialect({
            pool: createPool({
              charset: "utf8mb4",
              database: databaseName,
              host: env.DB_HOST,
              password: env.DB_PASSWORD,
              port: env.DB_PORT,
              timezone: "Z",
              user: env.DB_USER
            })
          })
        });
        await sql
          .raw(
            `CREATE TABLE ecommerce_product_information (
              id INT NOT NULL AUTO_INCREMENT PRIMARY KEY
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
          )
          .execute(database);
        await sql
          .raw(
            `CREATE TABLE ecommerce_product_variants (
              created_by VARCHAR(191) NOT NULL DEFAULT 'system:migration',
              id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
              uuid CHAR(8) NOT NULL UNIQUE,
              product_information_id INT NOT NULL,
              sku VARCHAR(120) NOT NULL,
              title VARCHAR(191) NOT NULL,
              barcode VARCHAR(120) NOT NULL DEFAULT '',
              option_1_name VARCHAR(80) NOT NULL DEFAULT '',
              option_1_value VARCHAR(120) NOT NULL DEFAULT '',
              option_2_name VARCHAR(80) NOT NULL DEFAULT '',
              option_2_value VARCHAR(120) NOT NULL DEFAULT '',
              option_3_name VARCHAR(80) NOT NULL DEFAULT '',
              option_3_value VARCHAR(120) NOT NULL DEFAULT '',
              price_adjustment DECIMAL(14,2) NOT NULL DEFAULT 0,
              compare_at_adjustment DECIMAL(14,2) NOT NULL DEFAULT 0,
              cost_adjustment DECIMAL(14,2) NOT NULL DEFAULT 0,
              option_signature VARCHAR(191) NOT NULL DEFAULT 'default',
              revision INT NOT NULL DEFAULT 1,
              weight DECIMAL(12,3) NOT NULL DEFAULT 0,
              sort_order INT NOT NULL DEFAULT 1000,
              status VARCHAR(24) NOT NULL DEFAULT 'active',
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY ecommerce_product_variants_sku_unique (sku),
              UNIQUE KEY ecommerce_product_variants_option_unique (product_information_id,option_signature),
              INDEX ecommerce_product_variants_product (product_information_id,status,sort_order),
              CONSTRAINT ecommerce_product_variants_product_fk FOREIGN KEY (product_information_id)
                REFERENCES ecommerce_product_information(id) ON DELETE RESTRICT
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
          )
          .execute(database);
        await sql`INSERT INTO ecommerce_product_information (id) VALUES (1)`.execute(database);

        const maximumName = "N".repeat(80);
        const maximumValue = "😀".repeat(120);
        await sql`INSERT INTO ecommerce_product_variants
          (uuid, product_information_id, sku, title, option_signature, option_1_name, option_1_value,
           option_2_name, option_2_value, option_3_name, option_3_value)
          VALUES ('l0000001', 1, 'LEGACY-MAX-1', 'Legacy maximum options', 'legacy-max-signature',
            ${maximumName}, ${maximumValue}, ${maximumName}, ${maximumValue},
            ${maximumName}, ${maximumValue})`.execute(database);
        await sql`INSERT INTO ecommerce_product_variants
          (uuid, product_information_id, sku, title, option_signature, option_1_name, option_1_value)
          VALUES ('l0000002', 1, 'LEGACY-DELIMITER-1', 'Legacy delimiter option',
            'legacy-delimiter-1', 'a', 'b|c=d')`.execute(database);
        await sql`INSERT INTO ecommerce_product_variants
          (uuid, product_information_id, sku, title, option_signature, option_1_name, option_1_value,
           option_2_name, option_2_value)
          VALUES ('l0000003', 1, 'LEGACY-DELIMITER-2', 'Legacy split option',
            'legacy-delimiter-2', 'a', 'b', 'c', 'd')`.execute(database);
        await sql`INSERT INTO ecommerce_product_variants
          (uuid, product_information_id, sku, title, option_signature, option_1_name, option_1_value)
          VALUES ('l0000004', 1, 'LEGACY-DUP-1', 'Legacy duplicate one',
            'legacy-duplicate-1', 'Color', 'Red')`.execute(database);
        await sql`INSERT INTO ecommerce_product_variants
          (uuid, product_information_id, sku, title, option_signature, option_1_name, option_1_value)
          VALUES ('l0000005', 1, 'LEGACY-DUP-2', 'Legacy duplicate two',
            'legacy-duplicate-2', ' color ', 'RED')`.execute(database);

        // Exact existing-schema path: the options step is already recorded as applied, the legacy
        // VARCHAR(191) signature and its unique index exist, and canonical identity must refuse the
        // duplicate before touching either rows or the index.
        await assert.rejects(
          () => upgradeProductVariantCanonicalOptions(database!),
          /canonical product option duplicate/iu
        );
        const untouched = await sql<{ total: number | string }>`
          SELECT COUNT(*) AS total FROM ecommerce_product_variants
          WHERE option_signature LIKE 'legacy-%'`.execute(database);
        assert.equal(Number(untouched.rows[0]?.total ?? 0), 5);
        await sql`DELETE FROM ecommerce_product_variants WHERE sku='LEGACY-DUP-2'`.execute(
          database
        );

        await upgradeProductVariantCanonicalOptions(database);

        const column = await sql<{ character_maximum_length: number | string | null }>`
          SELECT CHARACTER_MAXIMUM_LENGTH AS character_maximum_length
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ecommerce_product_variants'
            AND COLUMN_NAME='option_signature' LIMIT 1`.execute(database);
        assert.equal(
          Number(column.rows[0]?.character_maximum_length ?? 0),
          PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH
        );
        const index = await sql<{ total: number | string }>`
          SELECT COUNT(DISTINCT INDEX_NAME) AS total FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ecommerce_product_variants'
            AND INDEX_NAME='ecommerce_product_variants_option_unique'`.execute(database);
        assert.equal(Number(index.rows[0]?.total ?? 0), 1);

        const rows = await sql<{
          id: number | string;
          option_1_name: string;
          option_1_value: string;
          option_signature: string;
          sku: string;
        }>`SELECT id, sku, option_1_name, option_1_value, option_signature
          FROM ecommerce_product_variants ORDER BY id`.execute(database);
        assert.equal(rows.rows.length, 4);
        for (const row of rows.rows) {
          assert.match(row.option_signature, /^[0-9a-f]{64}$/u);
        }
        const maximum = rows.rows.find((row) => row.sku === "LEGACY-MAX-1");
        assert.equal(maximum?.option_1_name, maximumName);
        assert.equal([...(maximum?.option_1_value ?? "")].length, 120);
        const delimiterOne = rows.rows.find((row) => row.sku === "LEGACY-DELIMITER-1");
        const delimiterTwo = rows.rows.find((row) => row.sku === "LEGACY-DELIMITER-2");
        assert.notEqual(delimiterOne?.option_signature, delimiterTwo?.option_signature);
        assert.equal(new Set(rows.rows.map((row) => row.option_signature)).size, 4);

        // Existing-tenant deployment path: a database recorded the committed 1-34 ledger, so only
        // the appended EC-T03 steps may apply without a version/checksum mismatch and be repeatable.
        await runMigrationBatch(database, {
          batch: 1,
          scope: "ecommerce.test.bootstrap",
          version: "1",
          steps: [
            {
              name: "ecommerce.test.bootstrap",
              description: "Create the shared migration ledger for the compatibility test.",
              checksum: "ecommerce.test.bootstrap:v1",
              version: 1,
              up: async () => undefined
            }
          ]
        });
        const legacySteps = ecommerceTenantMigrations.filter(
          ({ name }) => (ecommerceTenantMigrationVersions[name] ?? Number.POSITIVE_INFINITY) <= 34
        );
        assert.equal(legacySteps.length, 34);
        for (const step of legacySteps) {
          const version = ecommerceTenantMigrationVersions[step.name]!;
          const checksum = createHash("sha256")
            .update(
              JSON.stringify({
                batch: 1,
                checksum: `${step.name}:v1`,
                name: step.name,
                scope: "ecommerce.modules",
                version
              })
            )
            .digest("hex");
          await sql`INSERT INTO migration_schema
            (uuid,scope,batch,version,name,checksum,description,status,created_by,applied_at)
            VALUES (${createHash("sha256").update(step.name).digest("hex").slice(0, 8)},
              'ecommerce.modules',1,${version},${step.name},${checksum},${step.description},'applied',
              'system:migration',CURRENT_TIMESTAMP(3))`.execute(database);
        }
        const upgrade = await migrateEcommerceTenantDatabase(database);
        assert.deepEqual(upgrade.applied, [
          "ecommerce.modules.product-attribute",
          "ecommerce.modules.product-attribute-revision",
          "ecommerce.modules.product-specification",
          "ecommerce.modules.product-specification-revision",
          "ecommerce.modules.product-collection",
          "ecommerce.modules.catalog-activity"
        ]);
        const repeat = await migrateEcommerceTenantDatabase(database);
        assert.equal(repeat.applied.length, 0);
        assert.equal(
          repeat.skipped.includes("ecommerce.modules.product-information-revision"),
          true
        );
        assert.equal(
          repeat.skipped.includes("ecommerce.modules.product-variant-canonical-options"),
          true
        );
        assert.equal(repeat.skipped.includes("ecommerce.modules.product-collection"), true);
      } finally {
        await database?.destroy().catch(() => undefined);
        await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``).catch((error: unknown) => {
          dropWarnings.push(
            `${databaseName}: ${error instanceof Error ? error.message : String(error)}`
          );
        });
      }
    }
  );

  // ----- A15: EC-T03 attributes, specifications and collections -----
  await assertion(
    "A15",
    "attributes, specifications and collections validate tenants, duplicates, publication and optimistic edits",
    async () => {
      const suffix = String(runId);
      const core = await executeInsert(
        tenantAConnection!,
        "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 100, 'active', 'e2e:catalog')",
        [fixtureUuid(`catalog-a15-core:${suffix}`), `E2E A15 Core ${suffix}`]
      );
      const productResponse = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          coreProductId: Number(core.insertId),
          publicationStatus: "published",
          slug: `e2e-a15-product-${suffix}`,
          storefrontTitle: `E2E A15 Product ${suffix}`
        },
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(productResponse.statusCode, 200, productResponse.body);
      const productId = Number(
        (productResponse.json() as { data: Record<string, unknown> }).data.id
      );
      const productActivity = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/product-information/${productId}/activity`
      });
      assert.equal(productActivity.statusCode, 200, productActivity.body);
      const productEvents = (productActivity.json() as { data: Array<Record<string, unknown>> })
        .data;
      assert.equal(productEvents[0]?.action, "created");
      assert.equal(String(productEvents[0]?.actorEmail ?? "").length > 0, true);

      const attributeResponse = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: { code: `  Colour ${suffix} `, dataType: "color", name: "Colour" },
        url: "/ecommerce/catalog/attributes"
      });
      assert.equal(attributeResponse.statusCode, 200, attributeResponse.body);
      const attribute = (attributeResponse.json() as { data: Record<string, unknown> }).data;
      const attributeId = Number(attribute.id);
      assert.equal(attribute.code, `colour-${suffix}`);
      const attributeActivity = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/attributes/${attributeId}/activity`
      });
      assert.equal(attributeActivity.statusCode, 200, attributeActivity.body);
      const attributeEvents = (attributeActivity.json() as { data: Array<Record<string, unknown>> })
        .data;
      assert.equal(attributeEvents.length >= 1, true, "Attribute activity was not recorded.");
      assert.equal(attributeEvents[0]?.action, "created");
      assert.equal(String(attributeEvents[0]?.actorEmail ?? "").length > 0, true);

      const duplicateAttribute = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: { code: `colour ${suffix}`, dataType: "text", name: "Duplicate" },
        url: "/ecommerce/catalog/attributes"
      });
      assert.equal(duplicateAttribute.statusCode, 409, duplicateAttribute.body);

      const assignmentResponse = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          values: [{ attributeId, values: [" #ff0000 ", "#FF0000", "#00ff00"] }]
        },
        url: `/ecommerce/catalog/attributes/assignments/${productId}`
      });
      assert.equal(assignmentResponse.statusCode, 200, assignmentResponse.body);
      const assignment = (assignmentResponse.json() as { data: Array<Record<string, unknown>> })
        .data;
      assert.deepEqual(assignment[0]?.values, ["#ff0000", "#00ff00"]);
      const assignmentActivity = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/attributes/${attributeId}/activity`
      });
      assert.equal(assignmentActivity.statusCode, 200, assignmentActivity.body);
      assert.equal(
        (assignmentActivity.json() as { data: Array<Record<string, unknown>> }).data.some(
          (event) => event.action === "assignment.updated"
        ),
        true,
        "Attribute assignment activity was not recorded."
      );

      const invalidColour = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: { values: [{ attributeId, values: ["red"] }] },
        url: `/ecommerce/catalog/attributes/assignments/${productId}`
      });
      assert.equal(invalidColour.statusCode, 400, invalidColour.body);

      const usedAttributeDelete = await app!.inject({
        headers: sessionA.headers,
        method: "DELETE",
        url: `/ecommerce/catalog/attributes/${attributeId}`
      });
      assert.equal(usedAttributeDelete.statusCode, 409, usedAttributeDelete.body);

      const inactiveAttributeResponse = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: { code: `size-${suffix}`, dataType: "text", name: "Size" },
        url: "/ecommerce/catalog/attributes"
      });
      const inactiveAttributeId = Number(
        (inactiveAttributeResponse.json() as { data: Record<string, unknown> }).data.id
      );
      await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {},
        url: `/ecommerce/catalog/attributes/${inactiveAttributeId}/deactivate`
      });
      const inactiveAssignment = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          values: [
            { attributeId, values: ["#ff0000"] },
            { attributeId: inactiveAttributeId, values: ["M"] }
          ]
        },
        url: `/ecommerce/catalog/attributes/assignments/${productId}`
      });
      assert.equal(inactiveAssignment.statusCode, 400, inactiveAssignment.body);

      const specificationResponse = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: { label: " Material ", productInformationId: productId, value: " Cotton " },
        url: "/ecommerce/catalog/specifications"
      });
      assert.equal(specificationResponse.statusCode, 200, specificationResponse.body);
      const specificationId = Number(
        (specificationResponse.json() as { data: Record<string, unknown> }).data.id
      );
      const specificationActivity = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/specifications/${specificationId}/activity`
      });
      assert.equal(specificationActivity.statusCode, 200, specificationActivity.body);
      assert.equal(
        (specificationActivity.json() as { data: Array<Record<string, unknown>> }).data[0]?.action,
        "created"
      );
      const duplicateSpecification = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: { label: "material", productInformationId: productId, value: "Linen" },
        url: "/ecommerce/catalog/specifications"
      });
      assert.equal(duplicateSpecification.statusCode, 409, duplicateSpecification.body);

      const collectionResponse = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          description: "A15 collection",
          productInformationIds: [productId],
          slug: `  A15 Featured ${suffix} `,
          title: "A15 featured"
        },
        url: "/ecommerce/catalog/collections"
      });
      assert.equal(collectionResponse.statusCode, 200, collectionResponse.body);
      const collection = (collectionResponse.json() as { data: Record<string, unknown> }).data;
      const collectionId = Number(collection.id);
      assert.equal(collection.slug, `a15-featured-${suffix}`);
      assert.equal(collection.itemCount, 1, "Collection create must save its items atomically.");

      const duplicateCollection = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: { slug: `a15 featured ${suffix}`, title: "Duplicate collection" },
        url: "/ecommerce/catalog/collections"
      });
      assert.equal(duplicateCollection.statusCode, 409, duplicateCollection.body);

      const collectionItems = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: { productInformationIds: [productId, productId] },
        url: `/ecommerce/catalog/collections/${collectionId}/items`
      });
      assert.equal(collectionItems.statusCode, 200, collectionItems.body);
      assert.equal(
        (collectionItems.json() as { data: Array<Record<string, unknown>> }).data.length,
        1
      );

      const missingCollectionProduct = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: { productInformationIds: [productId, 99999999] },
        url: `/ecommerce/catalog/collections/${collectionId}/items`
      });
      assert.equal(missingCollectionProduct.statusCode, 400, missingCollectionProduct.body);

      const failedAtomicCreate = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          productInformationIds: [productId, 99999999],
          slug: `a15-atomic-${suffix}`,
          title: `A15 atomic ${suffix}`
        },
        url: "/ecommerce/catalog/collections"
      });
      assert.equal(failedAtomicCreate.statusCode, 400, failedAtomicCreate.body);
      const afterFailedCreate = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: "/ecommerce/catalog/collections"
      });
      assert.equal(
        (afterFailedCreate.json() as { data: Array<Record<string, unknown>> }).data.some(
          (row) => row.slug === `a15-atomic-${suffix}`
        ),
        false,
        "A failed atomic collection create must not leave a record behind."
      );

      const failedAtomicUpdate = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          expectedRevision: Number(collection.revision),
          productInformationIds: [productId, 99999999],
          slug: String(collection.slug),
          title: "A15 featured"
        },
        url: `/ecommerce/catalog/collections/${collectionId}`
      });
      assert.equal(failedAtomicUpdate.statusCode, 400, failedAtomicUpdate.body);
      const afterFailedUpdate = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/collections/${collectionId}`
      });
      assert.equal(
        (afterFailedUpdate.json() as { data: Record<string, unknown> }).data.itemCount,
        1,
        "A failed atomic collection update must preserve the previous membership."
      );
      assert.equal(
        (afterFailedUpdate.json() as { data: Record<string, unknown> }).data.revision,
        collection.revision,
        "A failed atomic collection update must not advance the revision."
      );

      const draftCollectionPublic = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/ecommerce/storefront/collections/${String(collection.slug)}`
      });
      assert.equal(draftCollectionPublic.statusCode, 404, "A draft collection leaked publicly.");

      const publishCollection = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {},
        url: `/ecommerce/catalog/collections/${collectionId}/publish`
      });
      assert.equal(publishCollection.statusCode, 200, publishCollection.body);
      const publishedCollection = (publishCollection.json() as { data: Record<string, unknown> })
        .data;
      const updateCollectionWithItems = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          expectedRevision: Number(publishedCollection.revision),
          productInformationIds: [productId],
          publicationStatus: "published",
          slug: String(collection.slug),
          title: "A15 featured"
        },
        url: `/ecommerce/catalog/collections/${collectionId}`
      });
      assert.equal(updateCollectionWithItems.statusCode, 200, updateCollectionWithItems.body);
      assert.equal(
        (updateCollectionWithItems.json() as { data: Record<string, unknown> }).data.itemCount,
        1,
        "Collection update must save its items atomically."
      );
      const collectionActivity = await app!.inject({
        headers: sessionA.headers,
        method: "GET",
        url: `/ecommerce/catalog/collections/${collectionId}/activity`
      });
      assert.equal(collectionActivity.statusCode, 200, collectionActivity.body);
      assert.equal(
        (collectionActivity.json() as { data: Array<Record<string, unknown>> }).data.some(
          (event) => event.action === "published"
        ),
        true,
        "Collection publication activity was not recorded."
      );

      const publicCollection = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/ecommerce/storefront/collections/${String(collection.slug)}`
      });
      assert.equal(publicCollection.statusCode, 200, publicCollection.body);
      const publicItems = (
        publicCollection.json() as { data: { items: Array<Record<string, unknown>> } }
      ).data.items;
      assert.equal(publicItems.length, 1);
      assert.equal(Number(publicItems[0]?.productInformationId), productId);

      const staleCollection = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          expectedRevision: 99,
          slug: String(collection.slug),
          title: "Stale collection",
          publicationStatus: "published"
        },
        url: `/ecommerce/catalog/collections/${collectionId}`
      });
      assert.equal(staleCollection.statusCode, 409, staleCollection.body);

      const staleAttribute = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          code: `colour-${suffix}`,
          dataType: "color",
          expectedRevision: 99,
          name: "Stale colour"
        },
        url: `/ecommerce/catalog/attributes/${attributeId}`
      });
      assert.equal(staleAttribute.statusCode, 409, staleAttribute.body);

      const staleSpecification = await app!.inject({
        headers: sessionA.headers,
        method: "PUT",
        payload: {
          expectedRevision: 99,
          label: "Material",
          productInformationId: productId,
          value: "Stale cotton"
        },
        url: `/ecommerce/catalog/specifications/${specificationId}`
      });
      assert.equal(staleSpecification.statusCode, 409, staleSpecification.body);

      type PagedCatalogList = {
        items: Array<Record<string, unknown>>;
        page: number;
        pageSize: number;
        statusCounts: Record<string, number>;
        total: number;
      };
      const readPagedCatalog = async (path: string, label: string) => {
        const response = await app!.inject({
          headers: sessionA.headers,
          method: "GET",
          url: `${path}?page=1&pageSize=20`
        });
        assert.equal(response.statusCode, 200, response.body);
        const page = (response.json() as { data: PagedCatalogList }).data;
        assert.equal(Array.isArray(page.items), true, `${label} page must contain items.`);
        assert.equal(page.page, 1);
        assert.equal(page.pageSize, 100, `${label} must show all rows up to the threshold.`);
        assert.equal(page.total >= 1, true, `${label} total must include its fixture.`);
        assert.equal(page.statusCounts.all >= 1, true, `${label} status counts must be present.`);
        const legacy = await app!.inject({
          headers: sessionA.headers,
          method: "GET",
          url: path
        });
        assert.equal(legacy.statusCode, 200, legacy.body);
        assert.equal(
          Array.isArray((legacy.json() as { data: unknown }).data),
          true,
          `${label} unpaged reads must stay a bare array for cxmobile.`
        );
      };
      await readPagedCatalog("/ecommerce/catalog/attributes", "Attributes");
      await readPagedCatalog("/ecommerce/catalog/specifications", "Specifications");
      await readPagedCatalog("/ecommerce/catalog/collections", "Collections");

      const tenantBCollections = await app!.inject({
        headers: sessionB.headers,
        method: "GET",
        url: "/ecommerce/catalog/collections"
      });
      assert.equal(
        tenantBCollections.statusCode,
        403,
        "Tenant B must not see tenant A collections."
      );
      const tenantBAttribute = await app!.inject({
        headers: sessionB.headers,
        method: "GET",
        url: `/ecommerce/catalog/attributes/${attributeId}`
      });
      assert.equal(tenantBAttribute.statusCode, 403, tenantBAttribute.body);
      const tenantBPublicCollection = await app!.inject({
        headers: { host: tenantBDomain },
        method: "GET",
        url: `/ecommerce/storefront/collections/${String(collection.slug)}`
      });
      assert.equal(tenantBPublicCollection.statusCode, 404, tenantBPublicCollection.body);

      const archiveProduct = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {},
        url: `/ecommerce/catalog/product-information/${productId}/archive`
      });
      assert.equal(archiveProduct.statusCode, 200, archiveProduct.body);
      const archivedPublicCollection = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: `/ecommerce/storefront/collections/${String(collection.slug)}`
      });
      assert.equal(
        archivedPublicCollection.statusCode,
        404,
        "Archiving the only product must hide the public collection."
      );

      const browserCore = await executeInsert(
        tenantAConnection!,
        "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), 100, 'active', 'e2e:catalog')",
        [fixtureUuid(`catalog-a15-browser-core:${suffix}`), `E2E A15 Browser Core ${suffix}`]
      );
      const browserProduct = await app!.inject({
        headers: sessionA.headers,
        method: "POST",
        payload: {
          coreProductId: Number(browserCore.insertId),
          publicationStatus: "published",
          slug: `e2e-a15-browser-item-${suffix}`,
          storefrontTitle: `E2E A15 Browser Item ${suffix}`
        },
        url: "/ecommerce/catalog/product-information"
      });
      assert.equal(browserProduct.statusCode, 200, browserProduct.body);
    }
  );

  if (process.env.ECOM_TENANCY_BROWSER === "1") {
    await verifyFixtureBrowser(
      tenantADomain,
      tenantAPlan.products[0]!.slug,
      fixture.productAOnly,
      tenantAImageName,
      sessionA
    );
    passLines.push("PASS R04 fixture-backed storefront browser acceptance");
    console.log("PASS R04 fixture-backed storefront browser acceptance");
  }

  // ----- A7: unknown and suspended hosts in multi-tenant mode ----------------------
  await assertion(
    "A7",
    "unknown and suspended hosts return 404 for public storefront bootstrap in multi-tenant mode",
    async () => {
      assert.equal(
        isSingleTenantMode(),
        false,
        "This harness asserts multi-tenant public host behavior."
      );
      const unknownHost = await app!.inject({
        headers: { host: `unknown-${runId}.invalid` },
        method: "GET",
        url: "/storefront/bootstrap"
      });
      assert.equal(unknownHost.statusCode, 404, unknownHost.body);

      const liveHost = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/bootstrap"
      });
      assert.equal(liveHost.statusCode, 200, liveHost.body);

      await tenantService.suspendTenant(String(tenantA.id));
      try {
        const suspendedHost = await app!.inject({
          headers: { host: tenantADomain },
          method: "GET",
          url: "/storefront/bootstrap"
        });
        assert.equal(suspendedHost.statusCode, 404, suspendedHost.body);
      } finally {
        await tenantService.restoreTenant(String(tenantA.id));
      }
      const restoredHost = await app!.inject({
        headers: { host: tenantADomain },
        method: "GET",
        url: "/storefront/bootstrap"
      });
      assert.equal(restoredHost.statusCode, 200, restoredHost.body);
    }
  );

  // ----- A8: request-bound scope guard ---------------------------------------------
  await assertion(
    "A8",
    "Ecommerce data accessors outside runWithEcommerceRequestScope throw forbidden",
    async () => {
      assert.throws(
        () => getEcommerceDatabase(),
        (error: unknown) =>
          isAppError(error) && error.statusCode === 403 && /tenant context/iu.test(error.message)
      );
      assert.throws(
        () => getEcommerceTenantDatabaseName(),
        (error: unknown) =>
          isAppError(error) && error.statusCode === 403 && /tenant database/iu.test(error.message)
      );
      assert.throws(
        () => getEcommerceTenantKey(),
        (error: unknown) => isAppError(error)
      );
      const scopeDatabase = {} as Kysely<EcommerceDatabase>;
      const scoped = runWithEcommerceRequestScope(
        scopeDatabase,
        tenantA.uuid,
        () => ({
          database: getEcommerceDatabase(),
          databaseName: getEcommerceTenantDatabaseName(),
          tenantKey: getEcommerceTenantKey()
        }),
        tenantADatabaseName,
        false
      );
      assert.equal(scoped.database, scopeDatabase);
      assert.equal(scoped.databaseName, tenantADatabaseName);
      assert.equal(scoped.tenantKey, tenantA.uuid);
      assert.throws(
        () => getEcommerceDatabase(),
        (error: unknown) => isAppError(error)
      );
    }
  );
} catch (error) {
  mainError = error;
}

try {
  await cleanup();
} catch (error) {
  cleanupError = error;
}

if (mainError) throw mainError;
if (cleanupError) throw cleanupError;

console.log(
  `PASS summary: ${passLines.length} assertion groups; master=${masterDatabaseName}; tenantA=${tenantADatabaseName}; tenantB=${tenantBDatabaseName}`
);
for (const line of passLines) console.log(line);

// ---------------------------------------------------------------------------------------------
// Assertion printing
// ---------------------------------------------------------------------------------------------

async function assertion(id: string, detail: string, run: () => Promise<void>) {
  await run();
  const line = `PASS ${id} ${detail}`;
  passLines.push(line);
  console.log(line);
}

// ---------------------------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------------------------

type TenantSession = {
  cookie: string;
  headers: Record<string, string>;
  sessionSlot: string;
};

async function loginTenant(corporateId: string): Promise<TenantSession> {
  if (!app) throw new Error("Platform app is not ready.");
  const response = await app.inject({
    headers: {
      "content-type": "application/json",
      host: sharedHost,
      origin: sharedOrigin
    },
    method: "POST",
    payload: { corporateId, desk: "tenant", email: adminEmail, password: adminPassword },
    url: "/auth/login"
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json() as { data?: { sessionSlot?: string } };
  const sessionSlot = String(body.data?.sessionSlot ?? "");
  assert.match(sessionSlot, /^[0-9a-f]{32}$/u);
  const setCookie = response.headers["set-cookie"];
  const cookieValues = Array.isArray(setCookie) ? setCookie : [String(setCookie ?? "")];
  const cookie = cookieValues
    .map((value) => String(value).split(";")[0] ?? "")
    .filter(Boolean)
    .join("; ");
  assert.ok(
    cookie.includes("codexsun_session_"),
    "Login must return the encrypted session cookie."
  );
  return {
    cookie,
    headers: {
      cookie,
      host: sharedHost,
      origin: sharedOrigin,
      "x-codexsun-session-slot": sessionSlot
    },
    sessionSlot
  };
}

// ---------------------------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------------------------

async function createTenantFixtures(
  connection: Connection,
  plan: FixturePlan
): Promise<TenantFixtures> {
  const companyIds: Record<string, number> = {};
  for (const company of plan.companies) {
    const result = await executeInsert(
      connection,
      "INSERT INTO core_companies (uuid, code, name, primary_phone, primary_email, status, created_by) VALUES (?, ?, ?, ?, ?, 'active', 'e2e:tenancy')",
      [
        fixtureUuid(`company:${company.key}`),
        company.code,
        company.name,
        company.phone,
        company.email
      ]
    );
    assert.equal(result.affectedRows, 1, `Fixture company ${company.key} was not inserted.`);
    companyIds[company.key] = Number(result.insertId);
  }

  const contactIds: Record<string, number> = {};
  for (const contact of plan.contacts) {
    const result = await executeInsert(
      connection,
      "INSERT INTO core_contacts (uuid, code, name, type_id, type_name, primary_phone, primary_email, status, created_by) SELECT ?, ?, ?, type.id, type.name, ?, ?, 'active', 'e2e:tenancy' FROM core_contact_types type WHERE type.name=? AND type.status='active' LIMIT 1",
      [
        fixtureUuid(`contact:${contact.key}`),
        contact.code,
        contact.name,
        contact.phone,
        contact.email,
        contact.typeName
      ]
    );
    assert.equal(result.affectedRows, 1, `Fixture contact ${contact.key} was not inserted.`);
    contactIds[contact.key] = Number(result.insertId);
  }

  const coreProductIds: Record<string, number> = {};
  const productInformationIds: Record<string, number> = {};
  for (const product of plan.products) {
    const coreProduct = await executeInsert(
      connection,
      "INSERT INTO core_products (uuid, name, product_type_id, product_category_id, hsn_code_id, unit_id, gst_tax_id, opening_price, status, created_by) VALUES (?, ?, (SELECT id FROM core_product_types WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_product_categories WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_hsn_codes WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_units WHERE status='active' ORDER BY id LIMIT 1), (SELECT id FROM core_taxes WHERE status='active' ORDER BY id LIMIT 1), ?, 'active', 'e2e:tenancy')",
      [fixtureUuid(`core-product:${product.key}`), `${product.title} (Core)`, product.price]
    );
    assert.equal(coreProduct.affectedRows, 1, `Fixture core product ${product.key} failed.`);
    coreProductIds[product.key] = Number(coreProduct.insertId);

    const information = await executeInsert(
      connection,
      "INSERT INTO ecommerce_product_information (uuid, core_product_id, storefront_title, slug, description, bullet_points_json, publication_status, is_featured) VALUES (?, ?, ?, ?, ?, '[]', ?, ?)",
      [
        fixtureUuid(`product-information:${product.key}`),
        Number(coreProduct.insertId),
        product.title,
        product.slug,
        `${product.title} fixture record.`,
        product.publicationStatus,
        product.key === "aOnly" ? 1 : 0
      ]
    );
    assert.equal(information.affectedRows, 1, `Fixture product record ${product.key} failed.`);
    productInformationIds[product.key] = Number(information.insertId);
    if (product.imageUrl) {
      const image = await executeInsert(
        connection,
        "INSERT INTO ecommerce_product_images (uuid, product_information_id, url, alt_text, is_primary, status) VALUES (?, ?, ?, ?, 1, 'active')",
        [
          fixtureUuid(`product-image:${product.key}`),
          Number(information.insertId),
          product.imageUrl,
          `${product.title} image`
        ]
      );
      assert.equal(image.affectedRows, 1, `Fixture product image ${product.key} failed.`);
    }
  }

  const financialYear = await firstRow(
    connection,
    "SELECT id FROM core_financial_years WHERE status='active' ORDER BY is_current DESC, id LIMIT 1"
  );
  assert.ok(financialYear, "A seeded active financial year is required for organisation fixture.");
  return {
    companyIds,
    contactIds,
    coreProductIds,
    financialYearId: Number(financialYear.id),
    productInformationIds
  };
}

function fixtureUuid(label: string) {
  return createHash("sha256").update(`ecommerce-tenancy-e2e:${label}`).digest("hex").slice(0, 8);
}

async function writeTenantProductImage(tenantSlug: string, fileName: string) {
  const { default: sharp } = await import("sharp");
  const tenantRoot = resolve(tenantPublicStorageRoot(tenantSlug));
  const directory = resolve(tenantRoot, "ecommerce", "products");
  assert.ok(
    directory.startsWith(`${tenantRoot}${sep}`),
    "Fixture image path must stay inside the tenant public root."
  );
  await mkdir(directory, { recursive: true });
  const png = await sharp({
    create: {
      background: { alpha: 1, b: 60, g: 110, r: 180 },
      channels: 4,
      height: 600,
      width: 600
    }
  })
    .png()
    .toBuffer();
  await writeFile(join(directory, fileName), png);
}

// ---------------------------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------------------------

function dbConnectionBase() {
  return {
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    user: env.DB_USER
  };
}

async function moduleSetting(connection: Connection, moduleKey: string) {
  const row = await firstRow(
    connection,
    "SELECT enabled,status FROM app_module_settings WHERE module_key=?",
    [moduleKey]
  );
  assert.ok(row, `Tenant module setting "${moduleKey}" is missing.`);
  return row;
}

async function setCatalogViewPermission(connection: Connection, status: "active" | "inactive") {
  const [result] = await connection.execute(
    "UPDATE app_role_permissions rolePermission INNER JOIN app_roles role ON role.id=rolePermission.role_id INNER JOIN app_permissions permission ON permission.id=rolePermission.permission_id SET rolePermission.status=? WHERE role.`key`='admin' AND permission.`key`='ecommerce.catalog.view'",
    [status]
  );
  const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
  assert.equal(affectedRows, 1, `The live permission could not be set to ${status}.`);
}

async function executeInsert(
  connection: Connection,
  statement: string,
  params: Array<string | number | null>
) {
  const [result] = await connection.execute(statement, params);
  return result as { affectedRows: number; insertId: number };
}

async function executeUpdate(connection: Connection, statement: string) {
  const [result] = await connection.execute(statement);
  const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
  assert.equal(affectedRows, 1, `The fixture update did not affect exactly one row: ${statement}`);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function firstRow(
  connection: Connection,
  statement: string,
  params: Array<string | number | null> = []
): Promise<Record<string, unknown> | undefined> {
  const rows = await queryRows(connection, statement, params);
  return rows[0] as Record<string, unknown> | undefined;
}

async function queryRows(
  connection: Connection,
  statement: string,
  params: Array<string | number | null> = []
): Promise<RowDataPacket[]> {
  const [rows] = await connection.query(statement, params);
  return rows as RowDataPacket[];
}

async function scalar(
  connection: Connection,
  statement: string,
  params: Array<string | number | null> = []
) {
  const row = await firstRow(connection, statement, params);
  if (!row) return 0;
  return Number(Object.values(row)[0] ?? 0);
}

function catalogTitles(response: { json: () => unknown }) {
  const body = response.json() as {
    data?: Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> };
  };
  const rows = Array.isArray(body.data) ? body.data : body.data?.items;
  assert.ok(Array.isArray(rows), "Expected a contract-route data page or array.");
  return rows.map((row) => String(row.name ?? row.storefrontTitle ?? ""));
}

// ---------------------------------------------------------------------------------------------
// EC-R04 fixture-backed browser acceptance
// ---------------------------------------------------------------------------------------------

async function verifyFixtureBrowser(
  tenantDomain: string,
  productSlug: string,
  productName: string,
  imageName: string,
  session: TenantSession
) {
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const tailwindcss = (await import("@tailwindcss/vite")).default;
  const { BrowserPage } = await import("./tconnect-negotiation-browser.mjs");
  const { spawn } = await import("node:child_process");
  const { readFile: readBrowserFile } = await import("node:fs/promises");
  const browserRoot = `dist/ecommerce-scratch/ecommerce-browser-${runId}`;
  await mkdir(browserRoot, { recursive: true });
  const profile = resolve(browserRoot, "chrome");

  const server = await createServer({
    configFile: false,
    root: resolve("apps/ecommerce/web"),
    cacheDir: resolve("dist/.cache/vite/ecommerce-fixture-browser"),
    define: {
      __CODEXSUN_PLATFORM_WEB_PORT__: JSON.stringify(Number(env.PLATFORM_WEB_PORT))
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "ecommerce-fixture-api",
        configureServer(vite) {
          vite.middlewares.use("/api/platform", async (request, response) => {
            try {
              const chunks: Buffer[] = [];
              for await (const chunk of request) chunks.push(Buffer.from(chunk));
              const body = Buffer.concat(chunks).toString("utf8");
              const result = await app!.inject({
                method: request.method as "GET",
                url: String(request.url ?? "/"),
                headers: {
                  host: tenantDomain,
                  origin: `http://${tenantDomain}`,
                  ...(body ? { "content-type": "application/json" } : {})
                },
                ...(body ? { payload: body } : {})
              });
              response.statusCode = result.statusCode;
              response.setHeader(
                "content-type",
                String(result.headers["content-type"] ?? "application/octet-stream")
              );
              response.end(result.rawPayload);
            } catch {
              response.statusCode = 500;
              response.end("fixture-browser-api-failed");
            }
          });
        }
      }
    ],
    server: {
      host: "127.0.0.1",
      port: 0,
      hmr: false,
      fs: { allow: [process.cwd()] }
    }
  });
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = spawn(
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank"
    ],
    { stdio: "ignore", windowsHide: true }
  );
  let control: Awaited<ReturnType<typeof BrowserPage.connect>> | undefined;
  let page: Awaited<ReturnType<typeof BrowserPage.connect>> | undefined;
  let platformServer: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    let port = 0;
    for (let attempt = 0; attempt < 150 && !port; attempt++) {
      try {
        port = Number(
          (await readBrowserFile(resolve(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]
        );
      } catch {
        /* The port file appears once Chrome is ready. */
      }
      if (!port) await new Promise((done) => setTimeout(done, 100));
    }
    assert.ok(port, "Chrome did not start for fixture browser acceptance.");
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    control = await BrowserPage.connect(version.webSocketDebuggerUrl);
    const { targetId } = await control.send("Target.createTarget", { url: "about:blank" });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = await BrowserPage.connect(
      targets.find((target: { id: string }) => target.id === targetId).webSocketDebuggerUrl
    );
    await page.send("Page.enable");
    await page.send("Runtime.enable");

    for (const width of [1440, 390, 320]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height: width === 1440 ? 900 : 844,
        mobile: width !== 1440,
        width
      });
      await page.send("Page.navigate", { url: `${origin}/shop` });
      await page.waitFor(
        `document.readyState==='complete'&&Boolean(document.querySelector('.cx-product-card'))`,
        `fixture catalog at ${width}px`
      );
      await page.evaluate(
        "document.querySelector('.cx-product-card img')?.scrollIntoView({block:'center'})"
      );
      await page.waitFor(
        `[...document.images].every((image)=>!image.currentSrc||image.complete)&&Boolean(document.querySelector('.cx-product-card img')?.currentSrc)`,
        `fixture catalog images at ${width}px`
      );
      const catalog = JSON.parse(
        (await page.evaluate(`JSON.stringify((() => ({
        broken: [...document.images].filter((image)=>image.currentSrc&&image.naturalWidth===0).length,
        brokenUrls: [...document.images].filter((image)=>image.currentSrc&&image.naturalWidth===0).map((image)=>image.currentSrc),
        hasProduct: document.body.innerText.includes(${JSON.stringify(productName)}),
        overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
        productImage: Boolean(document.querySelector('.cx-product-card img')?.naturalWidth)
      }))())`)) as string
      ) as {
        broken: number;
        brokenUrls: string[];
        hasProduct: boolean;
        overflow: boolean;
        productImage: boolean;
      };
      if (catalog.broken) {
        console.log("[e2e] broken fixture images:", catalog.brokenUrls);
        console.log(
          "[e2e] image probe:",
          await page.evaluate(
            `fetch(document.querySelector('.cx-product-card img').currentSrc).then(async (response)=>JSON.stringify({status:response.status,type:response.headers.get('content-type'),bytes:(await response.arrayBuffer()).byteLength}))`
          )
        );
      }
      if (!catalog.hasProduct) {
        console.log(
          "[e2e] fixture browser page:",
          await page.evaluate("document.body.innerText.slice(0,1200)")
        );
      }
      assert.equal(catalog.hasProduct, true, `Fixture product missing at ${width}px.`);
      assert.equal(catalog.broken, 0, `Broken fixture images at ${width}px.`);
      assert.equal(catalog.overflow, false, `Fixture catalog overflowed at ${width}px.`);
      assert.equal(
        catalog.productImage,
        true,
        `Fixture product image did not render at ${width}px.`
      );
    }

    await page.send("Page.navigate", { url: `${origin}/cart` });
    await page.waitFor(
      `Boolean(document.querySelector('main.cx-cart'))&&document.querySelector('.cx-cart h1')?.textContent.trim()==='Shopping cart'`,
      "fixture cart route"
    );

    await page.send("Page.navigate", { url: `${origin}/shop/product/${productSlug}` });
    await page.waitFor(
      `Boolean(document.querySelector('main.cx-detail'))&&document.querySelector('.cx-detail h1')?.textContent.trim()===${JSON.stringify(productName)}`,
      "fixture product identity"
    );
    await page.waitFor(
      `(()=>{const image=document.querySelector('.cx-detail__image img');return Boolean(image&&image.complete&&image.naturalWidth>0);})()`,
      "fixture product image"
    );
    const detail = JSON.parse(
      (await page.evaluate(`JSON.stringify((() => ({
      heading: document.querySelector('.cx-detail h1')?.textContent.trim()??'',
      imageUrl: document.querySelector('.cx-detail__image img')?.currentSrc??'',
      overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    }))())`)) as string
    ) as { heading: string; imageUrl: string; overflow: boolean };
    assert.equal(detail.heading, productName);
    assert.match(detail.imageUrl, new RegExp(imageName, "u"));
    assert.equal(detail.overflow, false, "Fixture product page overflowed.");
    await page.screenshot(resolve(browserRoot, "fixture-product-1440.png"));

    platformServer = await createServer({
      configFile: resolve("apps/platform/web/vite.config.ts"),
      root: resolve("apps/platform/web"),
      plugins: [
        {
          name: "ecommerce-staff-fixture-api",
          configureServer(vite) {
            vite.middlewares.use(async (request, response, next) => {
              const path = String(request.url ?? "/");
              if (!path.startsWith("/api/")) return next();
              try {
                const chunks: Buffer[] = [];
                for await (const chunk of request) chunks.push(Buffer.from(chunk));
                const body = Buffer.concat(chunks).toString("utf8");
                const result = await app!.inject({
                  method: request.method as "GET",
                  url: path.replace(/^\/api\/(?:billing|core|platform)/u, "") || "/",
                  headers: {
                    ...session.headers,
                    ...(request.headers.cookie ? { cookie: String(request.headers.cookie) } : {}),
                    ...(request.headers["x-codexsun-session-slot"]
                      ? {
                          "x-codexsun-session-slot": String(
                            request.headers["x-codexsun-session-slot"]
                          )
                        }
                      : {}),
                    ...(body ? { "content-type": "application/json" } : {})
                  },
                  ...(body ? { payload: body } : {})
                });
                response.statusCode = result.statusCode;
                for (const [key, value] of Object.entries(result.headers)) {
                  if (key === "content-length" || value === undefined) continue;
                  response.setHeader(key, value as string | string[]);
                }
                response.end(result.rawPayload);
              } catch {
                response.statusCode = 500;
                response.end("fixture-staff-api-failed");
              }
            });
          }
        }
      ],
      server: {
        fs: { allow: [process.cwd()] },
        hmr: false,
        host: "127.0.0.1",
        port: 0
      }
    });
    await platformServer.listen();
    await platformServer.warmupRequest("/src/main.tsx").catch(() => undefined);
    await platformServer.transformRequest("/src/main.tsx").catch(() => undefined);
    let platformOptimized = false;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        if (
          (await readdir(resolve("dist/.cache/vite/platform-web/deps"))).includes("_metadata.json")
        ) {
          platformOptimized = true;
          break;
        }
      } catch {
        // The optimizer creates its cache directory after the first transform.
      }
      await new Promise((done) => setTimeout(done, 200));
    }
    assert.ok(platformOptimized, "Platform Vite dependency optimization did not finish.");
    await new Promise((done) => setTimeout(done, 500));
    const platformAddress = platformServer.httpServer.address();
    assert.ok(platformAddress && typeof platformAddress !== "string");
    const platformOrigin = `http://127.0.0.1:${platformAddress.port}`;
    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440
    });
    await page.send("Page.navigate", {
      url: `${platformOrigin}/login?corporateId=${encodeURIComponent(tenantACode)}`
    });
    await page.waitFor(
      `document.querySelector('input[type="password"]')!==null&&!document.body.innerText.includes('Checking this workspace')`,
      "staff login form",
      450
    );
    await page.waitFor(
      `(()=>{if(location.pathname.startsWith('/app/'))return true;const button=document.querySelector('button[type="submit"]');return button!==null&&!button.disabled&&button.textContent.trim()==='Sign in';})()`,
      "idle staff login form",
      450
    );
    await page.fill({
      corporateId: tenantACode,
      email: adminEmail,
      password: adminPassword
    });
    await page.evaluate(`document.querySelector('button[type="submit"]').click()`);
    await page.waitFor(
      `location.pathname.startsWith('/app/')&&!document.body.innerText.includes('Preparing your workspace')`,
      "staff authenticated workspace",
      900
    );
    const catalogShows = [
      {
        marker: "Item details",
        path: "product-information",
        query: `?q=${encodeURIComponent(`E2E A15 Browser Item ${runId}`)}`,
        term: `E2E A15 Browser Item ${runId}`,
        name: "product"
      },
      {
        marker: "Attribute details",
        path: "product-attributes",
        term: "Colour",
        name: "attribute"
      },
      {
        marker: "Specification details",
        path: "product-specifications",
        term: "Material",
        name: "specification"
      },
      {
        marker: "Collection details",
        path: "product-collections",
        term: "A15 featured",
        name: "collection"
      }
    ] as const;
    const loadStaffRoute = async (url: string, ready: string, label: string) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await page.send("Page.navigate", { url });
          await page.waitFor(ready, label, 120);
          return;
        } catch (error) {
          lastError = error;
          await new Promise((done) => setTimeout(done, 1000));
        }
      }
      throw lastError;
    };
    for (const show of catalogShows) {
      for (const width of [1440, 768, 390, 320]) {
        await page.send("Emulation.setDeviceMetricsOverride", {
          deviceScaleFactor: 1,
          height: width === 1440 ? 900 : 844,
          mobile: width !== 1440,
          width
        });
        await loadStaffRoute(
          `${platformOrigin}/app/ecommerce/${show.path}${"query" in show ? show.query : ""}`,
          `document.readyState==='complete'&&document.body.innerText.includes(${JSON.stringify(show.term)})`,
          `${show.name} list at ${width}px`
        );
        if (show.name === "product") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New item')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Item content')`,
            `product form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Select a Core product.')&&document.body.innerText.includes('Storefront title is required.')&&document.body.innerText.includes('Slug is required.')`,
            `product field errors at ${width}px`
          );
          const productFormOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(productFormOverflow, false, `Product form overflowed at ${width}px.`);
          await page.screenshot(resolve(browserRoot, `staff-product-form-errors-${width}.png`));
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `product list after validation at ${width}px`
          );
        }
        if (show.name === "attribute") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New attribute')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Attributes are reusable, filterable product characteristics.')`,
            `attribute form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Attribute code is required.')&&document.body.innerText.includes('Attribute name is required.')`,
            `attribute field errors at ${width}px`
          );
          const formOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(formOverflow, false, `Attribute form overflowed at ${width}px.`);
          await page.screenshot(resolve(browserRoot, `staff-attribute-form-errors-${width}.png`));
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `attribute list after validation at ${width}px`
          );
        }
        if (show.name === "specification") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New specification')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Specifications are labelled product facts shown on the storefront.')`,
            `specification form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Choose a product.')&&document.body.innerText.includes('Specification label is required.')&&document.body.innerText.includes('Specification value is required.')`,
            `specification field errors at ${width}px`
          );
          const formOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(formOverflow, false, `Specification form overflowed at ${width}px.`);
          await page.screenshot(
            resolve(browserRoot, `staff-specification-form-errors-${width}.png`)
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `specification list after validation at ${width}px`
          );
        }
        if (show.name === "collection") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New collection')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Curate an ordered product collection and publish it to the storefront.')`,
            `collection form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Collection slug is required.')&&document.body.innerText.includes('Collection title is required.')`,
            `collection field errors at ${width}px`
          );
          const formOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(formOverflow, false, `Collection form overflowed at ${width}px.`);
          await page.screenshot(resolve(browserRoot, `staff-collection-form-errors-${width}.png`));
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `collection list after validation at ${width}px`
          );
        }
        const opened = await page.evaluate(`(() => {
          const row = [...document.querySelectorAll('tbody tr')].find((candidate) =>
            candidate.innerText.includes(${JSON.stringify(show.term)})
          );
          const view = row
            ? [...row.querySelectorAll('button')].find(
                (button) => button.textContent.trim() === 'View'
              )
            : undefined;
          view?.click();
          return Boolean(view);
        })()`);
        assert.equal(opened, true, `${show.name} View action was missing at ${width}px.`);
        await page.waitFor(
          `location.search.includes('view=')&&document.body.innerText.includes(${JSON.stringify(show.marker)})&&document.body.innerText.includes('Activity')&&document.body.innerText.includes('created')`,
          `${show.name} show with activity at ${width}px`,
          450
        );
        const showState = JSON.parse(
          (await page.evaluate(`JSON.stringify((() => ({
            activity: document.body.innerText.includes('Recent changes by staff users.'),
            overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
            showAction: document.body.innerText.includes(${JSON.stringify(
              show.name === "product"
                ? "Archive"
                : show.name === "collection"
                  ? "Unpublish"
                  : "Deactivate"
            )})
          }))())`)) as string
        ) as { activity: boolean; overflow: boolean; showAction: boolean };
        assert.equal(showState.activity, true, `${show.name} activity was missing at ${width}px.`);
        assert.equal(showState.showAction, true, `${show.name} action was missing at ${width}px.`);
        assert.equal(showState.overflow, false, `${show.name} show overflowed at ${width}px.`);
        await page.screenshot(resolve(browserRoot, `staff-${show.name}-show-${width}.png`));
      }
    }

    const productQuery = `q=${encodeURIComponent(`E2E Pagination ${runId}`)}&page=2&pageSize=20`;
    for (const width of [1440, 1024, 390]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height: width === 390 ? 844 : 900,
        mobile: width === 390,
        width
      });
      await loadStaffRoute(
        `${platformOrigin}/app/ecommerce/product-information?${productQuery}`,
        `document.readyState==='complete'&&document.body.innerText.includes('Total product: 130')&&document.body.innerText.includes('Showing 21 to 40 of 130')`,
        `staff product pagination at ${width}px`
      );
      const staffProduct = JSON.parse(
        (await page.evaluate(`JSON.stringify((() => ({
          hasPager: document.body.innerText.includes('Rows per page')&&document.body.innerText.includes('Showing 21 to 40 of 130'),
          overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1
        }))())`)) as string
      ) as { hasPager: boolean; overflow: boolean };
      assert.equal(staffProduct.hasPager, true, `Staff product pager missing at ${width}px.`);
      assert.equal(staffProduct.overflow, false, `Staff product page overflowed at ${width}px.`);
      await page.screenshot(resolve(browserRoot, `staff-product-${width}.png`));
    }

    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440
    });
    await loadStaffRoute(
      `${platformOrigin}/app/ecommerce/product-information?${productQuery}`,
      `document.readyState==='complete'&&document.body.innerText.includes('Showing 21 to 40 of 130')`,
      "staff product page-size selector"
    );
    await page.evaluate(
      `document.querySelector('[role="combobox"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`
    );
    await page.waitFor(
      `document.querySelectorAll('[role="option"]').length>=3`,
      "staff page-size options"
    );
    const pageSizeOptions = JSON.parse(
      (await page.evaluate(
        `JSON.stringify([...document.querySelectorAll('[role="option"]')].map((option)=>option.textContent.trim()))`
      )) as string
    ) as string[];
    assert.deepEqual([...pageSizeOptions].sort(), ["100", "20", "50"]);

    const variantQuery = `q=${encodeURIComponent(`E2E-PAGE-SKU-${runId}`)}&page=2&pageSize=20`;
    for (const width of [1440, 1024, 390]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height: width === 390 ? 844 : 900,
        mobile: width === 390,
        width
      });
      await loadStaffRoute(
        `${platformOrigin}/app/ecommerce/product-variants?${variantQuery}`,
        `document.readyState==='complete'&&document.body.innerText.includes('Total variant: 105')&&document.body.innerText.includes('Showing 21 to 40 of 105')`,
        `staff variant pagination at ${width}px`
      );
      const staffVariant = JSON.parse(
        (await page.evaluate(`JSON.stringify((() => ({
          hasPager: document.body.innerText.includes('Rows per page')&&document.body.innerText.includes('Showing 21 to 40 of 105'),
          overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1
        }))())`)) as string
      ) as { hasPager: boolean; overflow: boolean };
      assert.equal(staffVariant.hasPager, true, `Staff variant pager missing at ${width}px.`);
      assert.equal(staffVariant.overflow, false, `Staff variant page overflowed at ${width}px.`);
      await page.screenshot(resolve(browserRoot, `staff-variant-${width}.png`));
    }

    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440
    });
    await loadStaffRoute(
      `${platformOrigin}/app/ecommerce/product-information?q=${encodeURIComponent(`E2E Pagination ${runId} 007`)}&page=9&pageSize=20`,
      `document.readyState==='complete'&&document.body.innerText.includes(${JSON.stringify(`E2E Pagination ${runId} 007`)})&&!document.body.innerText.includes('Rows per page')`,
      "staff single-row product page"
    );
    const staffNarrow = JSON.parse(
      (await page.evaluate(`JSON.stringify((() => ({
        hasPager: document.body.innerText.includes('Rows per page'),
        search: location.search
      }))())`)) as string
    ) as { hasPager: boolean; search: string };
    assert.equal(
      staffNarrow.hasPager,
      false,
      "Staff pager must hide at one hundred rows or fewer."
    );
    assert.equal(new URLSearchParams(staffNarrow.search).has("page"), false);
    assert.equal(new URLSearchParams(staffNarrow.search).has("pageSize"), false);
    await page.screenshot(resolve(browserRoot, "staff-single-row-1440.png"));
    console.log(`[e2e] fixture browser screenshots in ${browserRoot}`);
  } finally {
    await page?.send("Browser.close").catch(() => undefined);
    await control?.send("Browser.close").catch(() => undefined);
    browser.kill();
    await platformServer?.close();
    await server.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------------------------

async function cleanup() {
  const closeWarnings: string[] = [];
  if (app) {
    await app.close().catch((error: unknown) => {
      closeWarnings.push(`app.close: ${error instanceof Error ? error.message : String(error)}`);
    });
    app = undefined;
  }
  await tenantAConnection?.end().catch((error: unknown) => {
    closeWarnings.push(`tenant A connection: ${String(error)}`);
  });
  await tenantBConnection?.end().catch((error: unknown) => {
    closeWarnings.push(`tenant B connection: ${String(error)}`);
  });
  tenantAConnection = undefined;
  tenantBConnection = undefined;
  await closeAllBillingDatabases().catch((error: unknown) => {
    closeWarnings.push(`billing pools: ${String(error)}`);
  });
  await closeCoreDatabase().catch((error: unknown) => {
    closeWarnings.push(`core pools: ${String(error)}`);
  });
  await closeAllTenantDatabases().catch((error: unknown) => {
    closeWarnings.push(`tenant pools: ${String(error)}`);
  });
  await closePlatformDatabase().catch((error: unknown) => {
    closeWarnings.push(`platform pool: ${String(error)}`);
  });

  await admin.changeUser({ database: "information_schema" }).catch(() => undefined);
  for (const databaseName of [tenantADatabaseName, tenantBDatabaseName, masterDatabaseName]) {
    // Refuse to drop anything this run did not create, even if the name list above is ever edited.
    assert.ok(
      databaseName.startsWith(masterDatabaseName),
      `Refusing to drop a database this run did not generate: ${databaseName}`
    );
    try {
      await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    } catch (error) {
      dropWarnings.push(
        `${databaseName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  await admin.end().catch(() => undefined);

  const verify = await createConnection(dbConnectionBase());
  let remaining = -1;
  try {
    remaining = await scalar(
      verify,
      "SELECT COUNT(*) AS count FROM information_schema.schemata WHERE schema_name IN (?,?,?)",
      [masterDatabaseName, tenantADatabaseName, tenantBDatabaseName]
    );
  } finally {
    await verify.end().catch(() => undefined);
  }

  for (const storageKey of [tenantAUuid, tenantBUuid, tenantASlug, tenantBSlug]) {
    await removeGeneratedStorageKey(storageKey);
  }
  await removeDisposableStorageRoot();

  console.log(
    `[e2e] cleanup: generated databases remaining=${remaining}; close warnings=${closeWarnings.length}; drop warnings=${dropWarnings.length}`
  );
  if (dropWarnings.length) throw new Error(`Cleanup drop warnings: ${dropWarnings.join(" | ")}`);
  if (remaining !== 0) {
    throw new Error(`Cleanup left ${remaining} generated database(s) behind.`);
  }
}

async function removeGeneratedStorageKey(key: string) {
  const generatedKeys = new Set([tenantAUuid, tenantBUuid, tenantASlug, tenantBSlug]);
  assert.ok(
    generatedKeys.has(key),
    `Refusing to remove a storage key this run did not generate: ${key}`
  );
  const storageRoot = resolve(process.cwd(), "storage");
  const target = resolve(storageRoot, key);
  assert.equal(dirname(target), storageRoot, `Storage target escaped ${storageRoot}: ${target}`);
  assert.equal(basename(target), key, `Storage target is not the generated key: ${target}`);
  const stats = await lstat(target).catch(() => null);
  if (!stats) return;
  assert.equal(stats.isSymbolicLink(), false, `Refusing to recurse through a symlink: ${target}`);
  await rm(target, { force: true, recursive: true });
}

async function removeDisposableStorageRoot() {
  const expected = resolve(process.cwd(), "dist", "ecommerce-scratch", "storage", String(runId));
  assert.equal(
    fixtureStorageRoot,
    expected,
    "Refusing to remove a STORAGE_ROOT this run did not create."
  );
  const stats = await lstat(fixtureStorageRoot).catch(() => null);
  if (!stats) return;
  assert.equal(
    stats.isSymbolicLink(),
    false,
    `Refusing to remove a symlinked STORAGE_ROOT: ${fixtureStorageRoot}`
  );
  await rm(fixtureStorageRoot, { force: true, recursive: true });
}

// A standalone E2E must not hang a CI job after its assertions and cleanup already completed.
// The Platform API can leave long-lived handles (telemetry/queue timers) that are unrelated to this
// run's evidence; exit explicitly once the cleanup above has succeeded. A thrown assertion above
// bypasses this line and keeps the real non-zero exit code.
setTimeout(() => process.exit(0), 250);
