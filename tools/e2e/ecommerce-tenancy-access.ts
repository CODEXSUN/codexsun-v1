import assert from "node:assert/strict";
import type { Connection } from "mysql2/promise";
import type { createApp } from "../../apps/platform/api/src/app.js";
import { catalogTitles, moduleSetting, scalar, setCatalogViewPermission } from "./ecommerce-tenancy-queries.js";

type Session = { cookie: string; headers: Record<string, string>; sessionSlot: string };
type AccessContext = {
  app: Awaited<ReturnType<typeof createApp>>;
  assertion: (id: string, detail: string, run: () => Promise<void>) => Promise<void>;
  tenantAConnection: Connection; tenantBConnection: Connection;
  sessionA: Session; sessionB: Session; tenantACode: string; tenantBDomain: string;
  tenantADatabaseName: string; tenantBDatabaseName: string;
  fixturesA: { productInformationIds: Record<string, number>; financialYearId: number };
  aOnlyTitle: string; bOnlyTitles: string[]; bOnlyProductInfoId: number; bOnlyCompanyId: number;
  sharedHost: string; sharedOrigin: string; tenantA: { uuid: string }; tenantB: { uuid: string };
  loginTenant: (corporateId: string) => Promise<Session>;
};

export async function runAccessAssertions(context: AccessContext) {
  const { app, assertion, tenantAConnection, tenantBConnection, sessionA, sessionB, tenantACode,
    tenantBDomain, tenantADatabaseName, tenantBDatabaseName, fixturesA, aOnlyTitle, bOnlyTitles, bOnlyProductInfoId, bOnlyCompanyId, sharedHost,
    sharedOrigin, tenantA, tenantB, loginTenant } = context;
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

}
