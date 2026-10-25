import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  LayersIcon,
  MenuIcon,
  PlusIcon,
  WifiIcon,
  WifiOffIcon
} from "lucide-react";
import { mainLayoutTechnicalNames } from "@codexsun/ui/layouts/main-layouts/main-layout-identifiers.js";
import { useNativeSession } from "../app/native-session-provider.js";
import { NetworkMonitor } from "../native/network.js";
import { AppSwitcher } from "./app-switcher.js";
import { MobileDrawer } from "./mobile-drawer.js";
import { MobileLogin } from "./mobile-login.js";

const BillingMobileWorkspace = React.lazy(() =>
  import("../domains/billing/index.js").then((m) => ({ default: m.BillingMobileWorkspace }))
);
const ChatMobileWorkspace = React.lazy(() =>
  import("../domains/chat/index.js").then((m) => ({ default: m.ChatMobileWorkspace }))
);
const CrmMobileWorkspace = React.lazy(() =>
  import("../domains/crm/index.js").then((m) => ({ default: m.CrmMobileWorkspace }))
);
const EcommerceMobileWorkspace = React.lazy(() =>
  import("../domains/ecommerce/index.js").then((m) => ({ default: m.EcommerceMobileWorkspace }))
);

const APP_META = {
  billing: {
    actionLabel: "New Quotation",
    breadcrumb: "Billing / Quotations",
    color: "text-emerald-500",
    title: "Billing"
  },
  chat: {
    actionLabel: "New Message",
    breadcrumb: "Chat / Team Field",
    color: "text-violet-500",
    title: "Chat"
  },
  crm: {
    actionLabel: "New Enquiry",
    breadcrumb: "CRM / Enquiries",
    color: "text-sky-500",
    title: "CRM"
  },
  ecommerce: {
    actionLabel: "New Draft",
    breadcrumb: "Ecommerce / Catalog",
    color: "text-amber-500",
    title: "Ecommerce"
  }
};

declare const __APP_VERSION__: string | undefined;

export function MobileShell() {
  const { activeApp, session, status } = useNativeSession();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const networkMonitor = useMemo(() => new NetworkMonitor(), []);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((netStatus) => {
      setIsOnline(netStatus.connected);
    });
    return () => {
      unsubscribe();
      networkMonitor.destroy();
    };
  }, [networkMonitor]);

  const isAuthenticated = status === "authenticated" && session !== null;
  const currentAppMeta = APP_META[activeApp];

  const tenantCode = session?.tenantCode ?? session?.tenantId ?? "tenant";
  const companyId = session?.activeCompanyId ?? session?.context?.defaultCompany?.companyId ?? 1;
  const financialYearId = session?.activeFinancialYearId ?? session?.context?.defaultCompany?.financialYearId ?? 1;
  const appVersion = typeof __APP_VERSION__ !== "undefined" ? `v${__APP_VERSION__}` : "v1.1.61";

  return (
    <div className="cxmobile-shell" data-testid="cxmobile-app-shell">
      {/* 1. Technical Region: main.topMenu */}
      <header
        className="cxmobile-topmenu"
        data-region={mainLayoutTechnicalNames.topMenu}
        aria-label="Mobile Top Menu"
      >
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Open Navigation Drawer"
            >
              <MenuIcon className="size-5" />
            </button>
          )}

          {/* App Switcher Button / Indicator */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setSwitcherOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-card-foreground hover:bg-accent hover:border-border transition-colors"
              aria-label="Open App Switcher"
            >
              <span className={currentAppMeta.color}>{currentAppMeta.title}</span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          ) : (
            <span className="text-xs font-bold text-primary">CODEXSUN Mobile</span>
          )}
        </div>

        {/* Tenant / Company / Year Badge */}
        {isAuthenticated && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <button
              type="button"
              onClick={() => setSwitcherOpen(true)}
              className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 border border-border text-foreground font-mono hover:bg-accent"
            >
              <span className="text-primary font-semibold">{tenantCode}</span>
              <span className="text-muted-foreground">•</span>
              <span>C:{companyId}</span>
              <span className="text-muted-foreground">•</span>
              <span>Y:{financialYearId}</span>
            </button>

            <button
              type="button"
              onClick={() => setSwitcherOpen(true)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Switch App"
            >
              <LayersIcon className="size-4" />
            </button>
          </div>
        )}
      </header>

      {/* 2. Technical Region: main.sideBar as Mobile Drawer */}
      {isAuthenticated && (
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onOpenAppSwitcher={() => setSwitcherOpen(true)}
        />
      )}

      {/* App Switcher Modal / Sheet */}
      {isAuthenticated && (
        <AppSwitcher
          isOpen={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {/* Main Workspace Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 3. Technical Region: main.AppHeader */}
        {isAuthenticated && (
          <div
            className="cxmobile-appheader"
            data-region={mainLayoutTechnicalNames.appHeader}
            aria-label="Mobile App Header"
          >
            <div className="flex items-center gap-1 text-xs font-medium text-foreground">
              <span className="text-muted-foreground">{currentAppMeta.breadcrumb}</span>
            </div>

            <button
              type="button"
              className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <PlusIcon className="size-3" />
              <span>{currentAppMeta.actionLabel}</span>
            </button>
          </div>
        )}

        {/* 4. Technical Region: main.workspace - Parity Owner Workspaces */}
        <main
          className="cxmobile-workspace flex-1 overflow-y-auto overflow-x-hidden"
          data-region={mainLayoutTechnicalNames.workspace}
          aria-label="Mobile Workspace Content"
        >
          {!isAuthenticated ? (
            <MobileLogin />
          ) : (
            <React.Suspense
              fallback={
                <div className="flex h-64 flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
                  <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs">Loading {currentAppMeta.title}...</span>
                </div>
              }
            >
              {activeApp === "crm" ? (
                <CrmMobileWorkspace />
              ) : activeApp === "billing" ? (
                <BillingMobileWorkspace />
              ) : activeApp === "chat" ? (
                <ChatMobileWorkspace />
              ) : activeApp === "ecommerce" ? (
                <EcommerceMobileWorkspace />
              ) : null}
            </React.Suspense>
          )}
        </main>
      </div>

      {/* 5. Technical Region: main.StatusBar */}
      <footer
        className="cxmobile-statusbar"
        data-region={mainLayoutTechnicalNames.statusBar}
        aria-label="Mobile Status Bar"
      >
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <>
              <WifiIcon className="size-3 text-emerald-500" />
              <span className="text-emerald-500 font-medium">Online</span>
            </>
          ) : (
            <>
              <WifiOffIcon className="size-3 text-destructive" />
              <span className="text-destructive font-medium">Offline</span>
            </>
          )}
          <span className="text-muted-foreground/60">|</span>
          <span>{isAuthenticated ? currentAppMeta.title : "Sign In Required"}</span>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <span>{tenantCode} • Co #{companyId}</span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">{appVersion}</span>
        </div>
      </footer>
    </div>
  );
}
