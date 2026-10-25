import assert from "node:assert/strict";
import { createApp } from "../../apps/platform/api/src/app.js";

const app = await createApp();

try {
  await app.ready();

  const healthResponse = await app.inject({ method: "GET", url: "/health" });
  assert.equal(healthResponse.statusCode, 200);
  const health = healthResponse.json() as {
    data?: { checks?: { "platform-api"?: { details?: { modules?: string[] } } } };
    success?: boolean;
  };
  assert.equal(health.success, true);
  const modules = health.data?.checks?.["platform-api"]?.details?.modules ?? [];
  assert.ok(modules.includes("core.common"), "Core package was not composed into Platform API.");
  assert.ok(
    modules.includes("billing.sales"),
    "Billing package was not composed into Platform API."
  );
  assert.ok(modules.includes("mail"), "Mail package was not composed into Platform API.");
  assert.ok(
    !modules.includes("project-manager.platform-registry"),
    "Retired Project Manager module is still exposed."
  );

  assert.ok(
    modules.includes("ecommerce.catalog.product-information"),
    "Ecommerce product information was not composed into Platform API."
  );
  const catalogResponse = await app.inject({
    method: "GET",
    url: "/ecommerce/catalog/product-information",
    headers: { "x-tenant-db": "codexsun_composed_runtime_probe", "x-tenant-id": "00000000" }
  });
  assert.equal(
    catalogResponse.statusCode,
    401,
    "Ecommerce catalog is not protected inside Platform API."
  );

  const corsResponse = await app.inject({
    headers: {
      "access-control-request-headers": "content-type",
      "access-control-request-method": "POST",
      origin: "http://127.0.0.1:7020"
    },
    method: "OPTIONS",
    url: "/auth/login"
  });
  assert.equal(corsResponse.statusCode, 204);
  assert.equal(
    corsResponse.headers["access-control-allow-origin"],
    "http://127.0.0.1:7020",
    "Platform login preflight did not allow the local web origin."
  );
  assert.equal(corsResponse.headers["access-control-allow-credentials"], "true");

  const rejectedCorsResponse = await app.inject({
    headers: {
      "access-control-request-method": "POST",
      origin: "https://untrusted.example"
    },
    method: "OPTIONS",
    url: "/auth/login"
  });
  assert.equal(
    rejectedCorsResponse.headers["access-control-allow-origin"],
    undefined,
    "Platform API reflected an unconfigured web origin."
  );

  const coreResponse = await app.inject({
    headers: {
      "x-tenant-db": "codexsun_composed_runtime_probe",
      "x-tenant-id": "00000000"
    },
    method: "GET",
    url: "/core/common/location/countries"
  });
  assert.equal(coreResponse.statusCode, 401, "Core route is not protected inside Platform API.");

  const billingResponse = await app.inject({
    headers: {
      "x-company-id": "1",
      "x-financial-year-id": "1",
      "x-tenant-db": "codexsun_composed_runtime_probe",
      "x-tenant-id": "00000000"
    },
    method: "GET",
    url: "/billing/quotations"
  });
  assert.equal(
    billingResponse.statusCode,
    401,
    "Billing route is not protected inside Platform API."
  );

  const projectManagerResponse = await app.inject({
    method: "GET",
    url: "/project-manager/admin/platform-registry/result"
  });
  assert.equal(
    projectManagerResponse.statusCode,
    404,
    "Retired Project Manager route must return 404."
  );

  const applicationHost = new URL(process.env.PLATFORM_WEB_ORIGIN ?? "http://app.codexsun.test");
  const sharedContextResponse = await app.inject({
    headers: { host: applicationHost.host },
    method: "GET",
    url: "/auth/tenant-context"
  });
  assert.equal(sharedContextResponse.statusCode, 200, sharedContextResponse.body);
  const sharedContext = sharedContextResponse.json() as {
    data?: { corporateIdRequired?: boolean; mode?: string };
  };
  assert.equal(sharedContext.data?.mode, "shared_domain");
  assert.equal(sharedContext.data?.corporateIdRequired, true);

  const localContextResponse = await app.inject({
    headers: { host: "127.0.0.1:7020" },
    method: "GET",
    url: "/auth/tenant-context"
  });
  assert.equal(localContextResponse.statusCode, 200, localContextResponse.body);
  const localContext = localContextResponse.json() as {
    data?: { corporateIdRequired?: boolean; mode?: string };
  };
  assert.equal(localContext.data?.mode, "shared_domain");
  assert.equal(localContext.data?.corporateIdRequired, true);

  const missingCorporateIdResponse = await app.inject({
    headers: {
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "POST",
    payload: {
      desk: "tenant",
      email: process.env.DEFAULT_TENANT_ADMIN_EMAIL,
      password: process.env.DEFAULT_TENANT_ADMIN_PASSWORD
    },
    url: "/auth/login"
  });
  assert.equal(missingCorporateIdResponse.statusCode, 400, missingCorporateIdResponse.body);
  assert.equal(missingCorporateIdResponse.json().error?.code, "AUTH_CORPORATE_ID_REQUIRED");

  const missingCustomDomainCorporateIdResponse = await app.inject({
    headers: {
      host: "tenant.example.test",
      origin: "https://tenant.example.test"
    },
    method: "POST",
    payload: {
      desk: "tenant",
      email: process.env.DEFAULT_TENANT_ADMIN_EMAIL,
      password: process.env.DEFAULT_TENANT_ADMIN_PASSWORD
    },
    url: "/auth/login"
  });
  assert.equal(
    missingCustomDomainCorporateIdResponse.statusCode,
    400,
    missingCustomDomainCorporateIdResponse.body
  );
  assert.equal(
    missingCustomDomainCorporateIdResponse.json().error?.code,
    "AUTH_CORPORATE_ID_REQUIRED"
  );

  const loginResponse = await app.inject({
    headers: {
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "POST",
    payload: {
      desk: "tenant",
      corporateId: process.env.DEFAULT_TENANT_CORPORATE_ID,
      email: process.env.DEFAULT_TENANT_ADMIN_EMAIL,
      password: process.env.DEFAULT_TENANT_ADMIN_PASSWORD
    },
    url: "/auth/login"
  });
  assert.equal(loginResponse.statusCode, 200, loginResponse.body);
  const previousSlot = loginResponse.json().data.sessionSlot as string;
  assert.match(previousSlot, /^[0-9a-f]{32}$/);
  const previousCookies = loginResponse.cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const previousSessionCookie = loginResponse.cookies.findLast(
    (cookie) => cookie.name.endsWith(`codexsun_session_${previousSlot}`) && cookie.value.length > 0
  );
  assert.ok(previousSessionCookie, "Tenant login did not issue a session cookie.");

  const freshLoginResponse = await app.inject({
    headers: {
      cookie: previousCookies,
      "x-codexsun-session-slot": previousSlot,
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "POST",
    payload: {
      desk: "tenant",
      corporateId: process.env.DEFAULT_TENANT_CORPORATE_ID,
      email: process.env.DEFAULT_TENANT_ADMIN_EMAIL,
      password: process.env.DEFAULT_TENANT_ADMIN_PASSWORD
    },
    url: "/auth/login"
  });
  assert.equal(freshLoginResponse.statusCode, 200, freshLoginResponse.body);
  const freshSlot = freshLoginResponse.json().data.sessionSlot as string;
  assert.notEqual(freshSlot, previousSlot);
  const freshSessionCookie = freshLoginResponse.cookies.findLast(
    (cookie) => cookie.name.endsWith(`codexsun_session_${freshSlot}`) && cookie.value.length > 0
  );
  assert.ok(freshSessionCookie, "Fresh login did not issue a replacement session cookie.");
  assert.notEqual(
    freshSessionCookie.value,
    previousSessionCookie.value,
    "Fresh login reused the existing session cookie."
  );

  const logoutResponse = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: {
      cookie: previousCookies,
      "x-codexsun-session-slot": previousSlot,
      host: applicationHost.host,
      origin: applicationHost.origin
    }
  });
  assert.equal(logoutResponse.statusCode, 200, logoutResponse.body);
  const retiredSessionResponse = await app.inject({
    headers: {
      cookie: `${previousSessionCookie.name}=${previousSessionCookie.value}`,
      "x-codexsun-session-slot": previousSlot,
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "GET",
    url: "/auth/session"
  });
  assert.equal(retiredSessionResponse.statusCode, 401, retiredSessionResponse.body);
  assert.equal(retiredSessionResponse.json().error?.code, "AUTH_SESSION_EXPIRED");

  const cookies = `${freshSessionCookie.name}=${freshSessionCookie.value}`;
  const freshSessionResponse = await app.inject({
    headers: {
      cookie: cookies,
      "x-codexsun-session-slot": freshSlot,
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "GET",
    url: "/auth/session"
  });
  assert.equal(freshSessionResponse.statusCode, 200, freshSessionResponse.body);
  assert.equal(freshSessionResponse.json().data?.authenticated, true);

  const authenticatedProjectManagerResponse = await app.inject({
    headers: {
      cookie: cookies,
      "x-codexsun-session-slot": freshSlot,
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "GET",
    url: "/project-manager/admin/platform-registry/result"
  });
  assert.equal(
    authenticatedProjectManagerResponse.statusCode,
    404,
    "Retired Project Manager route must return 404 for tenant sessions."
  );
  for (const retiredPath of [
    "/devkit/admin/platform-registry/result",
    "/devkit/admin/project-manager/result",
    "/devkit/task-manager/todos",
    "/devkit/github-dashboard/projects",
    "/devkit/planning/boards",
    "/devkit/admin/sync/status"
  ]) {
    const retiredResponse = await app.inject({
      headers: {
        cookie: cookies,
        "x-codexsun-session-slot": freshSlot,
        host: applicationHost.host,
        origin: applicationHost.origin
      },
      method: "GET",
      url: retiredPath
    });
    assert.equal(retiredResponse.statusCode, 404, `${retiredPath} remains registered.`);
  }

  const tenantTaskLookups = await app.inject({
    headers: {
      cookie: cookies,
      "x-codexsun-session-slot": freshSlot,
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "GET",
    url: "/task-manager/lookups"
  });
  assert.equal(tenantTaskLookups.statusCode, 200, tenantTaskLookups.body);
  assert.ok(
    tenantTaskLookups
      .json()
      .data.some(
        (lookup: { kind: string; value: string }) =>
          lookup.kind === "status" && lookup.value === "open"
      ),
    "Tenant Task Manager defaults were not available through the composed API."
  );

  const superAdminLoginResponse = await app.inject({
    headers: {
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "POST",
    payload: {
      desk: "sa",
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD
    },
    url: "/auth/login"
  });
  assert.equal(superAdminLoginResponse.statusCode, 200, superAdminLoginResponse.body);
  const superAdminCookies = superAdminLoginResponse.cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const masterProjectManagerResponse = await app.inject({
    headers: {
      cookie: superAdminCookies,
      "x-codexsun-session-slot": superAdminLoginResponse.json().data.sessionSlot,
      host: applicationHost.host,
      origin: applicationHost.origin
    },
    method: "GET",
    url: "/project-manager/admin/platform-registry/result"
  });
  assert.equal(masterProjectManagerResponse.statusCode, 404, masterProjectManagerResponse.body);

  console.log("Composed Platform runtime E2E passed", {
    apiPort: 7010,
    composedPackages: ["core", "billing", "mail"],
    corsOrigin: "http://127.0.0.1:7020",
    webPort: 7020
  });
} finally {
  await app.close();
}
