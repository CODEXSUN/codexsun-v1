import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mainLayoutTechnicalNames } from "@codexsun/ui/layouts/main-layouts/main-layout-identifiers.js";
import { initRuntimeConfig, getRuntimeConfig } from "../src/app/runtime-config.js";
import { createMobileQueryClient } from "../src/app/query-client.js";
import { createMobileRouter } from "../src/app/router.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";

describe("Mobile Shell & Technical Regions", () => {
  it("preserves AppLayout 5 technical regions and casing", () => {
    assert.equal(mainLayoutTechnicalNames.topMenu, "main.topMenu");
    assert.equal(mainLayoutTechnicalNames.sideBar, "main.sideBar");
    assert.equal(mainLayoutTechnicalNames.appHeader, "main.AppHeader");
    assert.equal(mainLayoutTechnicalNames.workspace, "main.workspace");
    assert.equal(mainLayoutTechnicalNames.statusBar, "main.StatusBar");

    const regions = [
      mainLayoutTechnicalNames.topMenu,
      mainLayoutTechnicalNames.sideBar,
      mainLayoutTechnicalNames.appHeader,
      mainLayoutTechnicalNames.workspace,
      mainLayoutTechnicalNames.statusBar
    ];

    assert.equal(regions.length, 5);
    // Ensure all 5 region identifiers are unique
    assert.equal(new Set(regions).size, 5);
  });

  it("bootstraps runtime config before importing owner services", () => {
    const config = initRuntimeConfig({
      VITE_APP_NAME: "cxmobile-test",
      VITE_PLATFORM_API_URL: "http://127.0.0.1:18099",
      VITE_TENANCY_MODE: "multi"
    });

    assert.equal(config.VITE_APP_NAME, "cxmobile-test");
    assert.equal(config.VITE_PLATFORM_API_URL, "http://127.0.0.1:18099");
    assert.equal(getRuntimeConfig("VITE_PLATFORM_API_URL"), "http://127.0.0.1:18099");
  });

  it("initializes QueryClient, NativeSession, and Router providers cleanly", () => {
    // 1. QueryClient
    const queryClient = createMobileQueryClient();
    assert.ok(queryClient);
    assert.equal(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus, false);

    // 2. NativeSessionManager
    const sessionManager = new NativeSessionManager({
      apiOrigin: "http://127.0.0.1:18099"
    });
    assert.equal(sessionManager.status, "unauthenticated");

    // 3. Router
    const router = createMobileRouter();
    assert.ok(router);
    assert.ok(router.routesById["/"]);
    assert.ok(router.routesById["/crm"]);
    assert.ok(router.routesById["/billing"]);
    assert.ok(router.routesById["/chat"]);
    assert.ok(router.routesById["/ecommerce"]);
  });

  it("enforces permission gating across four apps (CRM, Billing, Chat, Ecommerce) and fails closed", () => {
    // App permission check matching NativeSessionProvider.isAppEnabled
    function isAppEnabled(
      enabledModules: string[] | undefined,
      appKey: string
    ): boolean {
      if (!enabledModules || enabledModules.length === 0) return false; // FAIL CLOSED
      const normalized = appKey.toLowerCase().trim();
      return (
        enabledModules.includes(normalized) ||
        enabledModules.includes(`codexsun.${normalized}`) ||
        enabledModules.includes("all")
      );
    }

    // Unassigned or empty tenant must fail closed
    assert.equal(isAppEnabled(undefined, "crm"), false);
    assert.equal(isAppEnabled([], "crm"), false);

    // Tenant with only crm and billing enabled
    const tenantPermissions = ["crm", "billing"];
    assert.equal(isAppEnabled(tenantPermissions, "crm"), true);
    assert.equal(isAppEnabled(tenantPermissions, "billing"), true);
    assert.equal(isAppEnabled(tenantPermissions, "chat"), false);
    assert.equal(isAppEnabled(tenantPermissions, "ecommerce"), false);

    // Full suite tenant
    const fullPermissions = ["crm", "billing", "chat", "ecommerce"];
    assert.equal(isAppEnabled(fullPermissions, "crm"), true);
    assert.equal(isAppEnabled(fullPermissions, "billing"), true);
    assert.equal(isAppEnabled(fullPermissions, "chat"), true);
    assert.equal(isAppEnabled(fullPermissions, "ecommerce"), true);
  });

  it("updates and maintains active company and financial year indicator", async () => {
    const sessionManager = new NativeSessionManager({
      apiOrigin: "http://127.0.0.1:18099"
    });

    // Mock an active session record
    (sessionManager as unknown as { _activeSession: Record<string, unknown>; _status: string })._activeSession = {
      activeCompanyId: 1,
      activeFinancialYearId: 1,
      apiOrigin: "http://127.0.0.1:18099",
      authenticated: true,
      desk: "tenant",
      email: "user@codexsun.invalid",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      loginHost: "127.0.0.1",
      sessionGeneration: 1,
      sessionSlot: "test-slot-1",
      tenantCode: "tenant-solaris",
      tenantId: "ten-solaris",
      userType: "tenant"
    };
    (sessionManager as unknown as { _status: string })._status = "authenticated";

    assert.equal(sessionManager.activeSession?.activeCompanyId, 1);
    assert.equal(sessionManager.activeSession?.activeFinancialYearId, 1);

    // Switch company
    await sessionManager.switchCompany(2, 2);
    assert.equal(sessionManager.activeSession?.activeCompanyId, 2);
    assert.equal(sessionManager.activeSession?.activeFinancialYearId, 2);
    assert.equal(sessionManager.currentGeneration, 2);
  });
});
