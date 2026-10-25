import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport } from "../src/native/http.js";
import {
  HostVerificationError,
  StaleResponseError,
  TenantIsolationError
} from "../src/session/session-types.js";

describe("Tenant and Session Isolation", () => {
  let server: Server;
  let serverPort: number;
  let serverOrigin: string;

  before(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      if (url.pathname === "/api/delayed") {
        const delayMs = Number(url.searchParams.get("delay") ?? "100");
        const timer = setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                message: "Delayed data for original account",
                tenantId: req.headers["x-tenant-id"]
              },
              success: true
            })
          );
        }, delayMs);
        req.on("close", () => clearTimeout(timer));
        return;
      }

      if (url.pathname === "/api/tenant-check") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: { receivedTenant: req.headers["x-tenant-id"] },
            success: true
          })
        );
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: { ok: true }, success: true }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address && typeof address === "object") {
          serverPort = address.port;
          serverOrigin = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("enforces two-tenant denial: blocks cross-tenant access between Tenant A and Tenant B", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });

    // Sign in as Tenant Alpha
    sessionManager["_activeSession"] = {
      activeCompanyId: 10,
      activeFinancialYearId: 2026,
      apiOrigin: serverOrigin,
      authenticated: true,
      desk: "tenant",
      email: "staff@alpha.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "aaaa0000bbbb1111cccc2222dddd3333",
      tenantCode: "ALPHA",
      tenantDbName: "tenant_alpha",
      tenantId: "tenant-alpha-uuid",
      tenantUuid: "tenant-alpha-uuid",
      token: "alpha-token",
      userType: "tenant"
    };
    sessionManager["_status"] = "authenticated";

    // 1. Calling assertTenantAccess for Tenant Beta must fail
    assert.throws(
      () => sessionManager.assertTenantAccess("tenant-beta-uuid"),
      (err) => err instanceof TenantIsolationError && err.message.includes("Cross-tenant access denied")
    );

    // 2. Calling assertTenantAccess for Tenant Alpha succeeds
    assert.doesNotThrow(() => sessionManager.assertTenantAccess("tenant-alpha-uuid"));

    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    // 3. Transport blocks cross-tenant request targeting Tenant Beta
    await assert.rejects(
      async () => {
        await transport.get("/api/tenant-check", { tenantId: "tenant-beta-uuid" });
      },
      (err: unknown) => {
        assert.ok(err instanceof TenantIsolationError);
        assert.ok(err.message.includes('request tenant "tenant-beta-uuid" does not match'));
        return true;
      }
    );

    // 4. Transport allows matching tenant request
    const allowed = await transport.get<{ receivedTenant: string }>("/api/tenant-check", {
      tenantId: "tenant-alpha-uuid"
    });
    assert.equal(allowed.receivedTenant, "tenant-alpha-uuid");
  });

  it("rejects wrong hosts, unapproved domains, and insecure remote origins", async () => {
    const verifier = new HostVerifier({
      allowedOrigins: ["https://api.codexsun.com"],
      allowLoopback: false
    });
    const sessionManager = new NativeSessionManager({
      apiOrigin: "https://api.codexsun.com",
      hostVerifier: verifier
    });
    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    // 1. Calling unapproved foreign domain
    await assert.rejects(
      async () => {
        await transport.get("https://untrusted-thirdparty.com/api/steal");
      },
      (err: unknown) => {
        assert.ok(err instanceof HostVerificationError);
        assert.ok(err.message.includes("not in the approved origins"));
        return true;
      }
    );

    // 2. Calling plain HTTP remote domain
    await assert.rejects(
      async () => {
        await transport.get("http://api.codexsun.com/api/data");
      },
      (err: unknown) => {
        assert.ok(err instanceof HostVerificationError);
        assert.ok(err.message.includes("Insecure HTTP is forbidden"));
        return true;
      }
    );

    // 3. Register custom domain for Tenant 1, verify Tenant 2 cannot claim it
    verifier.registerCustomDomain("tenant1.portal.com", "tenant-1-id");
    assert.equal(verifier.isCustomDomainVerified("tenant1.portal.com", "tenant-1-id"), true);
    assert.equal(verifier.isCustomDomainVerified("tenant1.portal.com", "tenant-2-id"), false);
  });

  it("discards delayed in-flight responses when account or context changes", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });

    sessionManager["_activeSession"] = {
      activeCompanyId: 1,
      activeFinancialYearId: 2026,
      apiOrigin: serverOrigin,
      authenticated: true,
      desk: "tenant",
      email: "user1@company.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "11112222333344445555666677778888",
      tenantCode: "CORP_A",
      tenantDbName: "corp_a_db",
      tenantId: "corp-a-uuid",
      userType: "tenant"
    };
    sessionManager["_status"] = "authenticated";

    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    // Launch slow request for account context (takes 100ms)
    const delayedRequest = transport.get("/api/delayed?delay=100");

    // While slow request is still traveling across network, simulate company switch or account change
    await new Promise((r) => setTimeout(r, 20));
    await sessionManager.switchCompany(2, 2027);

    // Generation counter has advanced: delayed response must be discarded!
    await assert.rejects(
      async () => {
        await delayedRequest;
      },
      (err: unknown) => {
        assert.ok(err instanceof StaleResponseError);
        assert.equal(err.message, "Response was discarded because session context changed.");
        return true;
      }
    );
  });

  it("discards delayed in-flight responses when user logs out", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });

    sessionManager["_activeSession"] = {
      activeCompanyId: 1,
      activeFinancialYearId: 2026,
      apiOrigin: serverOrigin,
      authenticated: true,
      desk: "tenant",
      email: "user1@company.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "11112222333344445555666677778888",
      tenantCode: "CORP_A",
      tenantDbName: "corp_a_db",
      tenantId: "corp-a-uuid",
      userType: "tenant"
    };
    sessionManager["_status"] = "authenticated";

    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    // Launch slow request
    const delayedRequest = transport.get("/api/delayed?delay=100");

    // In-flight logout
    await new Promise((r) => setTimeout(r, 20));
    await sessionManager.logout();

    // Delayed response must be discarded with StaleResponseError
    await assert.rejects(
      async () => {
        await delayedRequest;
      },
      (err: unknown) => {
        assert.ok(err instanceof StaleResponseError);
        return true;
      }
    );
  });
});
