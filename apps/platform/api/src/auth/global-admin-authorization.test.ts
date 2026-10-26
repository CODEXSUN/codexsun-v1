import assert from "node:assert/strict";
import test from "node:test";
import { hasActiveSuperAdminSession, parseSessionAuthority } from "./auth-session-authority.js";
import { isGlobalPlatformAdminRoute } from "./super-admin.guard.js";
import { authCookieName, encryptSessionCookie, sessionSlotHeader } from "./session-cookie.js";
import { createGlobalAdminFixture, identity, operations } from "./global-admin.fixture.js";
test("actual global admin reads and writes require active Super Admin authority", async (t) => {
  const { app, sessions, businessCalls } = await createGlobalAdminFixture(t);
  try {
    await app.ready();
    for (const caller of ["tenant_admin", "tenant_user", "staff", "anonymous"]) {
      await t.test(`${caller} cannot execute any global read or write`, async () => {
        const auth =
          caller === "anonymous" ? null : identity(caller === "staff" ? "staff" : "tenant", caller);
        if (auth) {
          auth.session.context.safeSettings = {
            role: caller === "tenant_admin" ? "super-admin" : "user",
            permissions: ["*"]
          };
          sessions.set(auth.payload.jti, auth.session);
        }
        for (const [method, url] of operations) {
          const response = await app.inject({
            method,
            url,
            headers: {
              ...(auth ? { authorization: `Bearer ${auth.token}` } : {}),
              "x-user-type": "super_admin",
              "x-role": "super-admin",
              "x-tenant-id": "another-tenant"
            },
            ...(["POST", "PUT"].includes(method)
              ? { payload: { userType: "super_admin", desk: "sa" } }
              : {})
          });
          assert.equal(response.statusCode, 403, `${method} ${url}`);
          if (method !== "HEAD") assert.equal(response.json().error.code, "SUPER_ADMIN_REQUIRED");
        }
        assert.equal(businessCalls(), 0);
      });
    }
    await t.test(
      "signed claims alone, mismatched sessions, expired and revoked records grant no access",
      async () => {
        const operator = identity("super_admin", "operator");
        for (const session of [
          null,
          { ...operator.session, userType: "staff" as const },
          { ...operator.session, expiresAt: new Date(0) },
          { ...operator.session, revokedAt: new Date() }
        ]) {
          sessions.clear();
          if (session) sessions.set(operator.payload.jti, session);
          const response = await app.inject({
            url: "/admin/tenants",
            headers: { authorization: `Bearer ${operator.token}` }
          });
          assert.ok([401, 403].includes(response.statusCode));
          assert.equal(businessCalls(), 0);
        }
        const forged = await app.inject({
          url: "/admin/tenants",
          headers: { authorization: "Bearer forged-super-admin" }
        });
        assert.equal(forged.statusCode, 401);
        assert.equal(businessCalls(), 0);
      }
    );
    await t.test(
      "a tenant browser cookie cannot inherit a Super Admin bearer identity",
      async () => {
        const tenant = identity("tenant", "browser_tenant");
        const operator = identity("super_admin", "browser_operator");
        sessions.set(tenant.payload.jti, tenant.session);
        sessions.set(operator.payload.jti, operator.session);
        const slot = "a".repeat(32);
        const response = await app.inject({
          url: "/admin/tenants",
          headers: {
            cookie: `${authCookieName(slot)}=${encryptSessionCookie(tenant.token)}`,
            [sessionSlotHeader]: slot,
            authorization: `Bearer ${operator.token}`
          }
        });
        assert.equal(response.statusCode, 403);
        assert.equal(businessCalls(), 0);
      }
    );
    await t.test("active server-backed Super Admin retains global reads and writes", async () => {
      const operator = identity("super_admin", "operator");
      sessions.set(operator.payload.jti, operator.session);
      for (const url of [
        "/admin/tenants",
        "/api/platform/admin/tenants",
        "/admin/plans",
        "/admin/subscriptions",
        "/admin/entitlements",
        "/admin/access-control",
        "/admin/apps",
        "/admin/industries",
        "/admin/platform-activity",
        "/admin/future-operation"
      ]) {
        assert.equal(
          (await app.inject({ url, headers: { authorization: `Bearer ${operator.token}` } }))
            .statusCode,
          200,
          url
        );
      }
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/admin/tenants",
            headers: { authorization: `Bearer ${operator.token}` },
            payload: {}
          })
        ).statusCode,
        200
      );
      const slot = "b".repeat(32);
      const cookieResponse = await app.inject({
        url: "/admin/tenants",
        headers: {
          cookie: `${authCookieName(slot)}=${encryptSessionCookie(operator.token)}`,
          [sessionSlotHeader]: slot
        }
      });
      assert.equal(cookieResponse.statusCode, 200);
      assert.equal(businessCalls(), 12);
    });
    await t.test("staff keeps its own session route and public paths remain public", async () => {
      const staff = identity("staff", "staff");
      sessions.set(staff.payload.jti, staff.session);
      assert.equal(
        (
          await app.inject({
            url: "/auth/session",
            headers: { authorization: `Bearer ${staff.token}` }
          })
        ).json().userType,
        "staff"
      );
      assert.equal((await app.inject({ url: "/public/admin-information" })).statusCode, 200);
    });
  } finally {
    await app.close();
  }
});

test("authority parsing never defaults unknown metadata to Super Admin or platform mode", () => {
  assert.equal(parseSessionAuthority("unknown", "platform"), null);
  assert.equal(parseSessionAuthority("super_admin", "unknown"), null);
  assert.equal(parseSessionAuthority("", ""), null);
  assert.deepEqual(parseSessionAuthority("super_admin", "platform"), {
    userType: "super_admin",
    tenantAccessMode: "platform"
  });
  assert.equal(hasActiveSuperAdminSession(undefined), false);
  const operator = identity("super_admin", "operator");
  assert.equal(hasActiveSuperAdminSession(operator), true);
  assert.equal(
    hasActiveSuperAdminSession({ ...operator, payload: { ...operator.payload, exp: 0 } }),
    false
  );
  assert.equal(
    hasActiveSuperAdminSession({
      ...operator,
      session: { ...operator.session, userUuid: "other" }
    }),
    false
  );
});

test("only the global admin namespace is selected from registered route patterns", () => {
  for (const path of ["/admin", "/admin/tenants/:id", "/api/platform/admin/tenants"])
    assert.equal(isGlobalPlatformAdminRoute(path), true);
  for (const path of [
    "/administrator",
    "/public/admin",
    "/tenant/roles",
    "/api/other/admin",
    "/auth/session"
  ])
    assert.equal(isGlobalPlatformAdminRoute(path), false);
});
