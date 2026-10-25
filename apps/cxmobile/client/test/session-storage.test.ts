import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NativeSecureStorage, InMemorySecureStorageAdapter } from "../src/native/storage.js";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import {
  HostVerificationError,
  PlatformApiError,
  type SessionRecord
} from "../src/session/session-types.js";

describe("Native Session Storage and Host Verification", () => {
  it("securely stores session credentials without plain text leaks", async () => {
    const adapter = new InMemorySecureStorageAdapter();
    const storage = new NativeSecureStorage({ adapter, namespace: "codexsun.cxmobile.test" });

    const session: SessionRecord = {
      activeCompanyId: 10,
      activeFinancialYearId: 2026,
      apiOrigin: "https://api.codexsun.com",
      authenticated: true,
      desk: "tenant",
      email: "engineer@tenant.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: "api.codexsun.com",
      name: "Test Engineer",
      sessionGeneration: 1,
      sessionSlot: "11223344556677889900aabbccddeeff",
      tenantCode: "CORP001",
      tenantDbName: "tenant_corp001",
      tenantId: "tenant-uuid-1",
      token: "secret-token-value-must-not-leak",
      userType: "tenant"
    };

    await storage.storeSession(session);

    const retrieved = await storage.getStoredSession();
    assert.ok(retrieved);
    assert.equal(retrieved.email, "engineer@tenant.com");
    assert.equal(retrieved.sessionSlot, "11223344556677889900aabbccddeeff");
    assert.equal(retrieved.tenantCode, "CORP001");

    const slot = await storage.getSessionSlot();
    assert.equal(slot, "11223344556677889900aabbccddeeff");

    const secret = await storage.getSessionSecret();
    assert.equal(secret, "secret-token-value-must-not-leak");

    // Clear session
    await storage.clearSession();
    const afterClear = await storage.getStoredSession();
    assert.equal(afterClear, null);
    assert.equal(await storage.getSessionSecret(), null);
    assert.equal(await storage.getSessionSlot(), null);
  });

  it("verifies and restricts API origins through HostVerifier", () => {
    const verifier = new HostVerifier({
      allowedOrigins: ["https://api.codexsun.com", "https://platform.codexsun.com"],
      allowLoopback: false
    });

    // Allowed HTTPS origin
    const { origin, host } = verifier.assertHostAllowed("https://api.codexsun.com/auth/login");
    assert.equal(origin, "https://api.codexsun.com");
    assert.equal(host, "api.codexsun.com");

    // Insecure HTTP rejected
    assert.throws(
      () => verifier.assertHostAllowed("http://api.codexsun.com"),
      (err) => err instanceof HostVerificationError && err.message.includes("Insecure HTTP is forbidden")
    );

    // Unapproved domain rejected
    assert.throws(
      () => verifier.assertHostAllowed("https://malicious-domain.com"),
      (err) => err instanceof HostVerificationError && err.message.includes("not in the approved origins")
    );

    // Custom domain support
    verifier.registerCustomDomain("acme.customcorp.com", "tenant-acme-uuid");
    const acmeCheck = verifier.assertHostAllowed("https://acme.customcorp.com/api");
    assert.equal(acmeCheck.host, "acme.customcorp.com");
    assert.equal(verifier.isCustomDomainVerified("acme.customcorp.com", "tenant-acme-uuid"), true);
    assert.equal(verifier.isCustomDomainVerified("acme.customcorp.com", "wrong-tenant-uuid"), false);

    // Loopback handling when allowed
    const devVerifier = new HostVerifier({
      allowLoopback: true,
      allowedOrigins: ["https://api.codexsun.com"]
    });
    const local = devVerifier.assertHostAllowed("http://localhost:3000/ready");
    assert.equal(local.host, "localhost:3000");
  });

  it("enforces Corporate ID for tenant login on shared domains", async () => {
    const verifier = new HostVerifier({
      allowedOrigins: ["https://api.codexsun.com"]
    });
    const manager = new NativeSessionManager({
      apiOrigin: "https://api.codexsun.com",
      hostVerifier: verifier
    });

    await assert.rejects(
      async () => {
        await manager.login({
          desk: "tenant",
          identifier: "user@test.com",
          password: "password123"
          // Missing corporateId / tenantCode
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof PlatformApiError);
        assert.equal(err.code, "AUTH_CORPORATE_ID_REQUIRED");
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it("handles login, session slot issuance, restore, server revocation, and logout", async () => {
    const mockDb = {
      serverRevoked: false,
      session: {
        authenticated: true,
        context: {
          cachedAt: new Date().toISOString(),
          company: { code: "ACME", id: 101, name: "Acme Corp" },
          defaultCompany: {
            companyId: 101,
            companyName: "Acme Corp",
            financialYearId: 2026,
            financialYearName: "2026-2027",
            landingApp: "crm"
          },
          enabledModuleKeys: ["crm", "billing", "chat"],
          landingPage: "/app/crm",
          safeSettings: {},
          tenant: { code: "ACME", id: "tenant-acme", name: "Acme Industries" }
        },
        email: "staff@acme.com",
        expiresAt: new Date(Date.now() + 10_000).toISOString(),
        name: "Acme Staff",
        sessionIssuedAt: Date.now(),
        sessionSlot: "3344556677889900aabbccddeeff0011",
        tenantCode: "ACME",
        tenantDbName: "tenant_acme",
        tenantId: "tenant-acme",
        tenantUuid: "tenant-acme",
        userType: "tenant"
      }
    };

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/auth/login")) {
        const body = JSON.parse(String(init?.body)) as { corporateId?: string; password?: string };
        if (body.password === "bad-password") {
          return new Response(
            JSON.stringify({
              error: { code: "AUTH_INVALID_CREDENTIALS", message: "Invalid credentials." },
              success: false
            }),
            { status: 401 }
          );
        }
        return new Response(
          JSON.stringify({
            data: mockDb.session,
            success: true
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/auth/session")) {
        if (mockDb.serverRevoked) {
          return new Response(
            JSON.stringify({
              error: { code: "AUTH_SESSION_EXPIRED", message: "Session expired." },
              success: false
            }),
            { status: 401 }
          );
        }
        return new Response(
          JSON.stringify({
            data: mockDb.session,
            success: true
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/auth/logout")) {
        return new Response(JSON.stringify({ data: { loggedOut: true }, success: true }), {
          status: 200
        });
      }

      return new Response("Not found", { status: 404 });
    };

    const storage = new NativeSecureStorage();
    const verifier = new HostVerifier({ allowedOrigins: ["https://api.codexsun.com"] });
    const manager = new NativeSessionManager({
      apiOrigin: "https://api.codexsun.com",
      fetchImpl: mockFetch as typeof fetch,
      hostVerifier: verifier,
      storage
    });

    const states: string[] = [];
    manager.subscribe((state) => states.push(state.status));

    // 1. Login
    const session = await manager.login({
      corporateId: "ACME",
      desk: "tenant",
      identifier: "staff@acme.com",
      password: "valid-password"
    });

    assert.equal(session.authenticated, true);
    assert.equal(session.sessionSlot, "3344556677889900aabbccddeeff0011");
    assert.equal(session.activeCompanyId, 101);
    assert.equal(manager.status, "authenticated");
    assert.equal(manager.currentGeneration, 2);

    // 2. Restore session
    const restored = await manager.restoreSession("tenant");
    assert.ok(restored);
    assert.equal(restored.email, "staff@acme.com");
    assert.equal(restored.tenantId, "tenant-acme");

    // 3. Server revocation
    mockDb.serverRevoked = true;
    const revoked = await manager.restoreSession("tenant");
    assert.equal(revoked, null);
    assert.equal(manager.status, "expired");
    assert.equal(await storage.getStoredSession(), null);

    // 4. Re-login and explicit logout
    mockDb.serverRevoked = false;
    await manager.login({
      corporateId: "ACME",
      desk: "tenant",
      identifier: "staff@acme.com",
      password: "valid-password"
    });
    assert.equal(manager.status, "authenticated");

    await manager.logout();
    assert.equal(manager.status, "unauthenticated");
    assert.equal(manager.activeSession, null);
    assert.equal(await storage.getStoredSession(), null);
  });
});
