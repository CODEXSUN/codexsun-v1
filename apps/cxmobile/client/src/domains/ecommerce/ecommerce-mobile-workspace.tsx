import React, { useMemo, useState } from "react";
import {
  ExternalLinkIcon,
  EyeIcon,
  LayoutDashboardIcon,
  LockIcon,
  PackageIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  StoreIcon
} from "lucide-react";
import { useNativeSession } from "../../app/native-session-provider.js";
import {
  ECOMMERCE_ROUTE_REGISTRY,
  getEcommerceRoutesBySection,
  hasRequiredEcommercePermission
} from "./ecommerce-routes.js";
import type {
  EcommerceOverview,
  EcommerceRouteKey,
  EcommerceRouteSection
} from "./types.js";

// Workspaces and modules from @codexsun/ecommerce-web public contracts
import {
  EcommerceModuleWorkspace,
  type EcommerceModulePage
} from "@codexsun/ecommerce-web";
import {
  EcommerceOverviewWorkspace,
  type EcommerceOverviewGateway
} from "@codexsun/ecommerce-web/modules/overview";
import { StorefrontPage } from "@codexsun/ecommerce-web/modules/storefront";

const SECTION_LABELS: Record<EcommerceRouteSection, { icon: React.ReactNode; label: string }> = {
  overview: {
    icon: <LayoutDashboardIcon className="size-3.5" />,
    label: "Overview"
  },
  catalog: {
    icon: <PackageIcon className="size-3.5" />,
    label: "Catalog"
  },
  storefront: {
    icon: <StoreIcon className="size-3.5" />,
    label: "Storefront"
  },
  integrations: {
    icon: <RefreshCwIcon className="size-3.5" />,
    label: "Integrations"
  },
  preview: {
    icon: <EyeIcon className="size-3.5" />,
    label: "Preview"
  }
};

export interface EcommerceMobileWorkspaceProps {
  initialRoute?: EcommerceRouteKey | undefined;
  onNavigateRoute?: ((route: EcommerceRouteKey) => void) | undefined;
}

export function EcommerceMobileWorkspace({
  initialRoute = "ecommerce.overview",
  onNavigateRoute
}: EcommerceMobileWorkspaceProps) {
  const { hasPermission, session, transport } = useNativeSession();

  const [activeSection, setActiveSection] = useState<EcommerceRouteSection>("overview");
  const [activeRoute, setActiveRoute] = useState<EcommerceRouteKey>(initialRoute);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const overviewGateway = useMemo<EcommerceOverviewGateway>(
    () => ({
      get: () => transport.get<EcommerceOverview>("/ecommerce/overview")
    }),
    [transport]
  );

  const currentRouteMeta = ECOMMERCE_ROUTE_REGISTRY[activeRoute];

  function handleSelectRoute(routeKey: EcommerceRouteKey) {
    const meta = ECOMMERCE_ROUTE_REGISTRY[routeKey];
    if (meta) {
      setActiveSection(meta.section);
    }
    setActiveRoute(routeKey);
    if (routeKey === "storefront.preview") {
      setIsPreviewOpen(true);
    } else {
      setIsPreviewOpen(false);
    }
    onNavigateRoute?.(routeKey);
  }

  const isPermitted =
    currentRouteMeta &&
    currentRouteMeta.requiredPermissions.every((perm) => hasPermission(perm));

  function renderContent() {
    if (!isPermitted) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-destructive/20 mt-4">
          <ShieldAlertIcon className="size-10 text-destructive mb-3" />
          <h3 className="text-base font-semibold text-foreground">Access Restricted</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Your current role lacks the required permission:
          </p>
          <div className="flex flex-wrap gap-1 mt-3 justify-center">
            {currentRouteMeta?.requiredPermissions.map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 text-xs font-mono bg-destructive/10 text-destructive rounded"
              >
                {perm}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (activeRoute === "storefront.preview" || isPreviewOpen) {
      const tenantCode = session?.tenantCode ?? "DEMO";
      const tenantDomain = `${tenantCode.toLowerCase()}.localhost`;

      return (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <div>
              <span className="font-semibold">Customer Storefront Preview Mode</span>
              <p className="mt-0.5 text-[11px] opacity-90">
                Bound to tenant domain: <span className="font-mono">{tenantDomain}</span>. Staff credentials (auth tokens &amp; session cookies) are isolated and not transferred.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="text-xs px-2 py-1 bg-background rounded border border-border hover:bg-muted"
            >
              Exit Preview
            </button>
          </div>
          <div className="border rounded-lg overflow-hidden bg-background">
            <StorefrontPage />
          </div>
        </div>
      );
    }

    if (activeRoute === "ecommerce.overview") {
      return (
        <EcommerceOverviewWorkspace
          gateway={overviewGateway}
          onOpenDesk={() => {
            handleSelectRoute("storefront.preview");
          }}
        />
      );
    }

    // Map other routes to EcommerceModuleWorkspace
    const pageMapping: Partial<Record<EcommerceRouteKey, EcommerceModulePage>> = {
      "ecommerce.campaign-events": "ecommerce.campaign-events",
      "ecommerce.catalog": "ecommerce.catalog",
      "ecommerce.catalog-data-source": "ecommerce.catalog-data-source",
      "ecommerce.featured-cards": "ecommerce.featured-cards",
      "ecommerce.organisation": "ecommerce.organisation",
      "ecommerce.product-attributes": "ecommerce.product-attributes",
      "ecommerce.product-collections": "ecommerce.product-collections",
      "ecommerce.product-images": "ecommerce.product-images",
      "ecommerce.product-information": "ecommerce.product-information",
      "ecommerce.product-specifications": "ecommerce.product-specifications",
      "ecommerce.product-variants": "ecommerce.product-variants",
      "ecommerce.promotions": "ecommerce.promotions",
      "ecommerce.season-strips": "ecommerce.season-strips",
      "ecommerce.service-banner": "ecommerce.service-banner",
      "ecommerce.storefront": "ecommerce.storefront",
      "ecommerce.storefront-sliders": "ecommerce.storefront-sliders",
      "ecommerce.trusted-strip": "ecommerce.trusted-strip"
    };

    const modulePage = pageMapping[activeRoute];
    if (modulePage) {
      return (
        <EcommerceModuleWorkspace
          page={modulePage}
          onOpenStore={() => {
            handleSelectRoute("storefront.preview");
          }}
        />
      );
    }

    // Lookups fallback view
    return (
      <div className="p-4 bg-card rounded-lg border">
        <h3 className="font-semibold">{currentRouteMeta.label}</h3>
        <p className="text-sm text-muted-foreground mt-1">{currentRouteMeta.description}</p>
      </div>
    );
  }

  const routesForActiveSection = getEcommerceRoutesBySection(activeSection, hasPermission);

  return (
    <div className="flex flex-col min-h-full pb-8">
      {/* Top Section Nav Tabs */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-2 py-1.5 flex gap-1 overflow-x-auto no-scrollbar">
        {(Object.keys(SECTION_LABELS) as EcommerceRouteSection[]).map((sectionKey) => {
          const sectionConfig = SECTION_LABELS[sectionKey];
          const hasAccessibleRoutes = getEcommerceRoutesBySection(sectionKey, hasPermission).length > 0;
          if (!hasAccessibleRoutes) return null;

          const isActive = activeSection === sectionKey;
          return (
            <button
              key={sectionKey}
              type="button"
              onClick={() => {
                setActiveSection(sectionKey);
                const sectionRoutes = getEcommerceRoutesBySection(sectionKey, hasPermission);
                const first = sectionRoutes[0];
                if (first && first.id !== activeRoute) {
                  handleSelectRoute(first.id);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {sectionConfig.icon}
              <span>{sectionConfig.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-route Pills (when section has multiple routes) */}
      {routesForActiveSection.length > 1 && (
        <div className="px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto no-scrollbar">
          {routesForActiveSection.map((routeMeta) => {
            const isRouteActive = activeRoute === routeMeta.id;
            const permitted = hasRequiredEcommercePermission(routeMeta.id, hasPermission);

            return (
              <button
                key={routeMeta.id}
                type="button"
                onClick={() => handleSelectRoute(routeMeta.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap border transition-colors ${
                  isRouteActive
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border/60 bg-card text-foreground hover:bg-muted/50"
                } ${!permitted ? "opacity-50" : ""}`}
              >
                {!permitted && <LockIcon className="size-2.5 text-muted-foreground" />}
                <span>{routeMeta.shortTitle}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Header bar */}
      <div className="px-4 py-3 flex items-center justify-between border-b bg-card/50">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {currentRouteMeta?.label}
          </h2>
          <p className="text-[11px] text-muted-foreground line-clamp-1">
            {currentRouteMeta?.description}
          </p>
        </div>
        {activeRoute !== "storefront.preview" && (
          <button
            type="button"
            onClick={() => handleSelectRoute("storefront.preview")}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 font-medium"
          >
            <ExternalLinkIcon className="size-3" />
            <span>Store Preview</span>
          </button>
        )}
      </div>

      {/* Main Workspace Body */}
      <div className="p-3 flex-1">{renderContent()}</div>
    </div>
  );
}
