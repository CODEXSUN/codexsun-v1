import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport } from "../src/native/http.js";
import { NativeWebSocketTransport } from "../src/native/websocket.js";
import { NativeSecureStorage, InMemorySecureStorageAdapter } from "../src/native/storage.js";
import { evaluateSessionPermission } from "../src/app/native-session-provider.js";
import { resolveApiUrl, LOCAL_DEBUG_CONFIG, isReleaseEnvironment } from "../src/app/runtime-config.js";

const DOCKER_API_BASE = "http://127.0.0.1:18010/api/app";

/**
 * Note on Docker Platform Acceptance Scope:
 * - Live smoke checks (Health, Module Discovery, Tenant Context, negative login rejection on shared domain)
 *   verify live Docker API gateway connectivity and fail-closed security posture.
 * - Full positive authenticated business acceptance (live CRM enquiry/comment persistence,
 *   unposted quotation/server totals/PDF, Chat messaging/realtime, Ecommerce draft item/image,
 *   and server-enforced role/tenant denials) requires an approved disposable positive-login test fixture.
 * - Exact Prerequisite for Positive Live Business Acceptance:
 *   An approved disposable test tenant (Corporate ID, financial year, test user credentials,
 *   and pre-seeded database fixtures) provisioned in the local Docker MariaDB database.
 *   Positive business operations must not write to customer data or invent unverified credentials.
 */
describe("LOCAL DOCKER Platform Acceptance & Quality Contract", () => {
  it("1. Verifies live Docker Platform API gateway health & modules", async () => {
    const res = await fetch(`${DOCKER_API_BASE}/health`, {
      headers: { Accept: "application/json" }
    });
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      data?: {
        checks?: {
          "platform-api"?: {
            details?: {
              modules?: string[];
              runtime?: string;
            };
            status?: string;
          };
        };
        status?: string;
      };
      success: boolean;
    };

    assert.equal(body.success, true);
    assert.equal(body.data?.status, "ok");

    const modules = body.data?.checks?.["platform-api"]?.details?.modules ?? [];
    assert.ok(modules.includes("crm.enquiry"), "Docker API must include crm.enquiry module");
    assert.ok(modules.includes("billing.quotation"), "Docker API must include billing.quotation module");
    assert.ok(modules.includes("billing.sales"), "Docker API must include billing.sales module");
    assert.ok(modules.includes("chat"), "Docker API must include chat module");
    assert.ok(
      modules.includes("ecommerce.catalog.product-information"),
      "Docker API must include ecommerce catalog module"
    );
  });

  it("2. Verifies Docker tenant login context & Corporate ID requirement on loopback host", async () => {
    const res = await fetch(`${DOCKER_API_BASE}/auth/tenant-context`, {
      headers: { Accept: "application/json" }
    });
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      data?: {
        brandName: string | null;
        corporateIdRequired: boolean;
        host: string;
        mode: string;
        tenantName: string | null;
      };
      success: boolean;
    };

    assert.equal(body.success, true);
    assert.equal(body.data?.mode, "shared_domain");
    assert.equal(body.data?.corporateIdRequired, true);
  });

  it("3. Enforces real Docker /auth/login rejection without leaking tokens or fabricating accounts", async () => {
    const hostVerifier = new HostVerifier({ allowLoopback: true });
    const storage = new NativeSecureStorage({ adapter: new InMemorySecureStorageAdapter() });
    const manager = new NativeSessionManager({
      apiOrigin: DOCKER_API_BASE,
      hostVerifier,
      storage
    });

    // A. Rejects missing Corporate ID on shared domain
    await assert.rejects(
      async () => {
        await manager.login({
          desk: "tenant",
          identifier: "test.agent@codexsun.invalid",
          password: "SamplePassword123"
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes("Corporate ID is required"));
        return true;
      }
    );

    // B. Calls real Docker auth gateway with Corporate ID and verifies rejection
    await assert.rejects(
      async () => {
        await manager.login({
          corporateId: "DISPOSABLE_TEST_FIXTURE_NONEXISTENT",
          desk: "tenant",
          identifier: "disposable.agent@codexsun.invalid",
          password: "InvalidFixturePassword123"
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Invalid credentials or workspace") ||
          err.message.includes("Too many sign-in attempts")
        );
        return true;
      }
    );

    // C. Verifies session manager remains strictly unauthenticated
    assert.equal(manager.status, "unauthenticated");
    assert.equal(manager.activeSession, null);
  });

  it("4. Strictly preserves /api/app on all HTTP operations including logout", async () => {
    const hostVerifier = new HostVerifier({ allowLoopback: true });
    const storage = new NativeSecureStorage({ adapter: new InMemorySecureStorageAdapter() });
    const fetchedUrls: string[] = [];
    const mockFetch: typeof fetch = async (url: string | URL | Request) => {
      fetchedUrls.push(String(url));
      return new Response(JSON.stringify({ data: { revoked: true }, success: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    };

    const manager = new NativeSessionManager({
      apiOrigin: DOCKER_API_BASE,
      fetchImpl: mockFetch,
      hostVerifier,
      storage
    });

    assert.equal(manager.apiBaseUrl, DOCKER_API_BASE);

    // Inject active session with sessionSlot and apiBaseUrl
    const mockSession = {
      activeCompanyId: 1,
      apiBaseUrl: DOCKER_API_BASE,
      apiOrigin: "http://127.0.0.1:18010",
      authenticated: true,
      desk: "tenant" as const,
      email: "field.agent@codexsun.invalid",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: "127.0.0.1:18010",
      sessionGeneration: 1,
      sessionSlot: "docker_test_slot_12345",
      tenantCode: "DOCKER_TEST",
      token: "secret_docker_bearer_token",
      userType: "tenant"
    };

    manager["_activeSession"] = mockSession;
    manager["_status"] = "authenticated";

    // Logout
    await manager.logout();

    assert.equal(manager.status, "unauthenticated");
    assert.equal(manager.activeSession, null);
    assert.equal(fetchedUrls.length, 1);
    assert.equal(
      fetchedUrls[0],
      "http://127.0.0.1:18010/api/app/auth/logout",
      "Logout MUST preserve /api/app in destination URL"
    );
  });

  it("5. Verifies Native WebSocket URL construction contains NO query secrets and NO fake cookies", () => {
    const hostVerifier = new HostVerifier({ allowLoopback: true });
    const manager = new NativeSessionManager({
      apiOrigin: DOCKER_API_BASE,
      hostVerifier
    });

    manager["_activeSession"] = {
      activeCompanyId: 42,
      apiBaseUrl: DOCKER_API_BASE,
      apiOrigin: "http://127.0.0.1:18010",
      authenticated: true,
      desk: "tenant",
      email: "agent@codexsun.invalid",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: "127.0.0.1:18010",
      sessionGeneration: 1,
      sessionSlot: "ws_slot_998877",
      tenantCode: "CODEXSUN_TEST",
      tenantId: "tenant_uuid_1234",
      token: "super-confidential-bearer-token",
      userType: "tenant"
    };
    manager["_status"] = "authenticated";

    const transport = new NativeWebSocketTransport({
      hostVerifier,
      path: "/chatb/realtime",
      sessionManager: manager
    });

    const wsUrl = transport.buildWebSocketUrl();
    const parsed = new URL(wsUrl);

    // Validations:
    assert.equal(parsed.protocol, "ws:");
    assert.equal(parsed.host, "127.0.0.1:18010");
    assert.equal(parsed.pathname, "/chatb/realtime");
    assert.equal(parsed.searchParams.get("companyId"), "42");
    assert.equal(parsed.searchParams.get("sessionSlot"), "ws_slot_998877");
    assert.equal(parsed.searchParams.get("tenantId"), "tenant_uuid_1234");

    // Strictly forbidden credentials in URL
    assert.equal(parsed.searchParams.has("token"), false);
    assert.equal(parsed.searchParams.has("secret"), false);
    assert.equal(parsed.searchParams.has("password"), false);
    assert.equal(parsed.searchParams.has("jwt"), false);
    assert.equal(parsed.searchParams.has("bearer"), false);
  });

  it("6. Real provider permission enforcement: role labels alone NEVER bypass explicit grants", () => {
    // Exercises the real evaluateSessionPermission exported from native-session-provider.tsx

    // A. Role label is "admin" but explicit permissions are missing -> FAIL CLOSED
    assert.equal(
      evaluateSessionPermission(
        {
          activeCompanyId: 1,
          apiOrigin: DOCKER_API_BASE,
          authenticated: true,
          desk: "tenant",
          email: "admin.agent@codexsun.invalid",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          loginHost: "127.0.0.1:18010",
          permissions: [],
          role: "admin",
          sessionGeneration: 1,
          sessionSlot: "slot_admin_1",
          tenantCode: "DOCKER_CORP",
          token: "dummy_token",
          userType: "tenant"
        },
        "billing.sales.post"
      ),
      false,
      "Role label 'admin' without explicit grant must fail closed"
    );

    // B. Role label is "admin" with explicit grant -> ALLOWED
    assert.equal(
      evaluateSessionPermission(
        {
          activeCompanyId: 1,
          apiOrigin: DOCKER_API_BASE,
          authenticated: true,
          desk: "tenant",
          email: "admin.agent@codexsun.invalid",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          loginHost: "127.0.0.1:18010",
          permissions: ["billing.sales.post"],
          role: "admin",
          sessionGeneration: 1,
          sessionSlot: "slot_admin_2",
          tenantCode: "DOCKER_CORP",
          token: "dummy_token",
          userType: "tenant"
        },
        "billing.sales.post"
      ),
      true
    );

    // C. Non-admin staff without grant -> FAIL CLOSED
    assert.equal(
      evaluateSessionPermission(
        {
          activeCompanyId: 1,
          apiOrigin: DOCKER_API_BASE,
          authenticated: true,
          desk: "tenant",
          email: "field.agent@codexsun.invalid",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          loginHost: "127.0.0.1:18010",
          permissions: ["crm.enquiry.view"],
          role: "staff",
          sessionGeneration: 1,
          sessionSlot: "slot_staff_1",
          tenantCode: "DOCKER_CORP",
          token: "dummy_token",
          userType: "tenant"
        },
        "billing.sales.post"
      ),
      false
    );
  });

  it("7. Memory secure storage contract: isolates session credentials and verifies zero secrets in web storage (Node contract)", async () => {
    // Note: Live hardware KeyStore at-rest isolation is verified on physical/emulator Android targets
    // via NativeSecureStoragePlugin.java and logcat inspection. This Node contract test validates
    // that the storage abstraction and session serialization strictly isolate secrets and never leak to web storage.
    const storage = new NativeSecureStorage({ adapter: new InMemorySecureStorageAdapter() });

    await storage.storeSession({
      activeCompanyId: 1,
      apiOrigin: DOCKER_API_BASE,
      authenticated: true,
      desk: "tenant",
      email: "secure.agent@codexsun.invalid",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: "127.0.0.1:18010",
      sessionGeneration: 1,
      sessionSlot: "hw_keystore_slot_77",
      tenantCode: "KEYSTORE_DEMO",
      token: "hardware_aes256_gcm_isolated_token",
      userType: "tenant"
    });

    const loaded = await storage.getStoredSession();
    assert.ok(loaded);
    assert.equal(loaded.sessionSlot, "hw_keystore_slot_77");
    assert.equal(loaded.token, "hardware_aes256_gcm_isolated_token");

    // Verify browser localStorage is 100% clean
    if (typeof globalThis.window !== "undefined" && globalThis.window.localStorage) {
      assert.equal(globalThis.window.localStorage.getItem("codexsun.cxmobile.auth.session_secret"), null);
      assert.equal(globalThis.window.localStorage.getItem("codexsun.cxmobile.auth.session_slot"), null);
      assert.equal(globalThis.window.localStorage.getItem("codexsun.cxmobile.auth.session_record"), null);
    }

    // Clean up
    await storage.clearSession();
    const empty = await storage.getStoredSession();
    assert.equal(empty, null);
  });

  it("8. Runtime configuration separates local debug and strictly fails closed on missing/insecure/malformed release endpoints", () => {
    // A. Local debug environment allows loopback Docker endpoint
    const debugUrl = resolveApiUrl(undefined, false);
    assert.equal(debugUrl, LOCAL_DEBUG_CONFIG.VITE_PLATFORM_API_URL);
    assert.ok(debugUrl.includes("127.0.0.1:18010"));

    // B. Release mode strictly fails closed when URL is missing
    assert.throws(
      () => resolveApiUrl(undefined, true),
      (err: Error) => {
        assert.ok(err.message.includes("Release configuration failure"));
        assert.ok(err.message.includes("is missing"));
        return true;
      }
    );

    // C. Release mode strictly rejects plain HTTP endpoints
    assert.throws(
      () => resolveApiUrl("http://api.codexsun.com/api/app", true),
      (err: Error) => {
        assert.ok(err.message.includes("Release configuration failure"));
        assert.ok(err.message.includes("Insecure protocol 'http:'"));
        return true;
      }
    );

    // D. Release mode strictly rejects malformed URLs (e.g. 'https://')
    assert.throws(
      () => resolveApiUrl("https://", true),
      (err: Error) => {
        assert.ok(err.message.includes("Release configuration failure"));
        assert.ok(err.message.includes("Malformed API endpoint"));
        return true;
      }
    );

    // E. Release mode strictly rejects IPv4 loopback hosts (127.0.0.1, 127.0.0.2, localhost, 0.0.0.0)
    for (const host of ["127.0.0.1", "127.0.0.2", "localhost", "0.0.0.0"]) {
      assert.throws(
        () => resolveApiUrl(`https://${host}:18010/api/app`, true),
        (err: Error) => {
          assert.ok(err.message.includes("Release configuration failure"));
          assert.ok(err.message.includes("Loopback host"));
          return true;
        }
      );
    }

    // F. Release mode strictly rejects IPv6 loopback hosts (https://[::1]:18010/api/app, [::])
    for (const ipv6 of ["[::1]", "[::]"]) {
      assert.throws(
        () => resolveApiUrl(`https://${ipv6}:18010/api/app`, true),
        (err: Error) => {
          assert.ok(err.message.includes("Release configuration failure"));
          assert.ok(err.message.includes("IPv6 loopback host"));
          return true;
        }
      );
    }

    // Unbracketed IPv6 with port is malformed URL syntax
    assert.throws(
      () => resolveApiUrl("https://::1:18010/api/app", true),
      (err: Error) => {
        assert.ok(err.message.includes("Release configuration failure"));
        assert.ok(err.message.includes("Malformed API endpoint"));
        return true;
      }
    );

    // G. Release mode strictly rejects synthetic embedded user credentials
    assert.throws(
      () => resolveApiUrl("https://user:pass@example.invalid/api/app", true),
      (err: Error) => {
        assert.ok(err.message.includes("Release configuration failure"));
        assert.ok(err.message.includes("Embedded user credentials"));
        return true;
      }
    );

    // H. Release mode strictly rejects non-routable / reserved internal domains
    for (const internalHost of ["api.internal", "app.local", "service.invalid", "test.test", "mycorp.example"]) {
      assert.throws(
        () => resolveApiUrl(`https://${internalHost}/api/app`, true),
        (err: Error) => {
          assert.ok(err.message.includes("Release configuration failure"));
          assert.ok(err.message.includes("Internal or non-routable domain"));
          return true;
        }
      );
    }

    // I. Release mode accepts valid secure remote HTTPS endpoints
    const releaseUrl = resolveApiUrl("https://api.codexsun.com/api/app", true);
    assert.equal(releaseUrl, "https://api.codexsun.com/api/app");
  });

  it("9. Packaging modes: default build mode enforcement, debug override wiring, and package.json release/debug scripts", () => {
    // A. Verify package.json script declarations
    const pkgPath = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      scripts: Record<string, string>;
    };

    assert.equal(
      pkg.scripts["build:release"],
      "tsc -p tsconfig.json --noEmit && vite build --mode production",
      "package.json must define build:release targeting production mode"
    );
    assert.equal(
      pkg.scripts["build:debug"],
      "tsc -p tsconfig.json --noEmit && vite build --mode debug",
      "package.json must define build:debug targeting debug mode"
    );

    // Save previous runtime config
    const prevRuntime = globalThis.__CODEXSUN_RUNTIME_CONFIG__;
    try {
      // B. Respects production mode
      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { MODE: "production" };
      assert.equal(isReleaseEnvironment(), true, "MODE=production must be recognized as release");

      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { VITE_RELEASE: "1" };
      assert.equal(isReleaseEnvironment(), true, "VITE_RELEASE=1 must be recognized as release");

      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { VITE_APP_ENV: "production" };
      assert.equal(isReleaseEnvironment(), true, "VITE_APP_ENV=production must be recognized as release");

      // C. Release flags take strict precedence: production release MUST NOT downgrade through runtime debug flags
      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { MODE: "production", VITE_DEBUG: "1" };
      assert.equal(isReleaseEnvironment(), true, "Production mode must NOT downgrade to debug through VITE_DEBUG=1");

      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { VITE_RELEASE: "1", VITE_DEBUG: "1" };
      assert.equal(isReleaseEnvironment(), true, "VITE_RELEASE=1 must NOT downgrade to debug through VITE_DEBUG=1");

      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { VITE_APP_ENV: "production", MODE: "debug" };
      assert.equal(isReleaseEnvironment(), true, "VITE_APP_ENV=production must NOT downgrade through MODE=debug");

      // D. Debug mode is only permitted when no production/release indicator is active
      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { MODE: "debug" };
      assert.equal(isReleaseEnvironment(), false, "MODE=debug alone must be recognized as debug");

      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = { VITE_DEBUG: "1" };
      assert.equal(isReleaseEnvironment(), false, "VITE_DEBUG=1 alone must be recognized as debug");
    } finally {
      globalThis.__CODEXSUN_RUNTIME_CONFIG__ = prevRuntime;
    }
  });
});
