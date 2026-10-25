/**
 * Ecommerce Route Registry, Permission Boundaries, and Preview Security
 * Implements M0 Ecommerce parity while enforcing boundary isolation and credential prevention.
 */

import type {
  EcommercePermissionKey,
  EcommerceRouteKey,
  EcommerceRouteMetadata,
  EcommerceRouteSection,
  StorefrontPreviewConfig
} from "./types.js";

export class EcommercePermissionDeniedError extends Error {
  public readonly requiredPermission: string;
  public readonly routeKey?: string | undefined;

  constructor(message: string, requiredPermission: string, routeKey?: string | undefined) {
    super(message);
    this.name = "EcommercePermissionDeniedError";
    this.requiredPermission = requiredPermission;
    this.routeKey = routeKey;
  }
}

export const ECOMMERCE_ROUTE_REGISTRY: Record<EcommerceRouteKey, EcommerceRouteMetadata> = {
  "ecommerce.overview": {
    description: "Storefront overview, catalog count cards, sync indicators, and live runtime controls.",
    id: "ecommerce.overview",
    label: "Overview",
    requiredPermissions: ["ecommerce.overview.view"],
    section: "overview",
    shortTitle: "Overview"
  },
  "ecommerce.catalog": {
    description: "Catalog health dashboard, Core product linking, and publication flow status.",
    id: "ecommerce.catalog",
    label: "Catalog Overview",
    requiredPermissions: ["ecommerce.catalog.view"],
    section: "catalog",
    shortTitle: "Catalog"
  },
  "ecommerce.product-information": {
    description: "Product information editor, titles, descriptions, SEO, specs, and publication lifecycle.",
    id: "ecommerce.product-information",
    label: "Product Information",
    requiredPermissions: ["ecommerce.catalog.view"],
    section: "catalog",
    shortTitle: "Products"
  },
  "ecommerce.product-variants": {
    description: "Product variants, SKUs, option dimensions (size, colour, material), barcode, and pricing adjustments.",
    id: "ecommerce.product-variants",
    label: "Product Variants",
    requiredPermissions: ["ecommerce.catalog.view"],
    section: "catalog",
    shortTitle: "Variants"
  },
  "ecommerce.product-images": {
    description: "Product photo gallery, high-res uploads, sort ordering, primary image assignment, and variant linking.",
    id: "ecommerce.product-images",
    label: "Product Images",
    requiredPermissions: ["ecommerce.catalog.view"],
    section: "catalog",
    shortTitle: "Images"
  },
  "ecommerce.product-attributes": {
    description: "Custom filterable attribute definitions (text, number, select, color) and per-product assignments.",
    id: "ecommerce.product-attributes",
    label: "Attributes",
    requiredPermissions: ["ecommerce.catalog.view"],
    section: "catalog",
    shortTitle: "Attributes"
  },
  "ecommerce.product-specifications": {
    description: "Technical specification parameters and category-specific property structures.",
    id: "ecommerce.product-specifications",
    label: "Specifications",
    requiredPermissions: ["ecommerce.catalog.view"],
    section: "catalog",
    shortTitle: "Specifications"
  },
  "ecommerce.product-collections": {
    description: "Curated product collections, hero imagery, slugs, and assigned catalog items.",
    id: "ecommerce.product-collections",
    label: "Collections",
    requiredPermissions: ["ecommerce.catalog.view"],
    section: "catalog",
    shortTitle: "Collections"
  },
  "ecommerce.catalog-data-source": {
    description: "Catalog data source settings, provider toggling (own vs Frappe), and live sync execution.",
    id: "ecommerce.catalog-data-source",
    label: "Catalog Data Source",
    requiredPermissions: ["ecommerce.catalog.edit"],
    section: "integrations",
    shortTitle: "Data Source"
  },
  "ecommerce.storefront": {
    description: "Public storefront profile, customer-facing tagline, social links, and accepted payment badges.",
    id: "ecommerce.storefront",
    label: "Storefront Profile",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Storefront"
  },
  "ecommerce.storefront-sliders": {
    description: "Homepage hero banner carousel sliders, action CTAs, and promotional image uploads.",
    id: "ecommerce.storefront-sliders",
    label: "Hero Sliders",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Sliders"
  },
  "ecommerce.promotions": {
    description: "Promotional marketing cards, discount badges, offer pricing, and scheduled campaign periods.",
    id: "ecommerce.promotions",
    label: "Promotion Cards",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Promotions"
  },
  "ecommerce.featured-cards": {
    description: "Curated product highlight cards displayed on the storefront home grid.",
    id: "ecommerce.featured-cards",
    label: "Featured Cards",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Featured"
  },
  "ecommerce.season-strips": {
    description: "Seasonal promotional strip banners (Festive, Summer, Year-End) with custom badges.",
    id: "ecommerce.season-strips",
    label: "Season Strips",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Season Strips"
  },
  "ecommerce.campaign-events": {
    description: "Flash sale events, banner alerts, and scheduled storefront campaign announcements.",
    id: "ecommerce.campaign-events",
    label: "Campaign Events",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Campaigns"
  },
  "ecommerce.service-banner": {
    description: "Customer service policy banner (e.g. 24/7 support, free return policy, helpline info).",
    id: "ecommerce.service-banner",
    label: "Service Banner",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Service"
  },
  "ecommerce.trusted-strip": {
    description: "Trust assurance badges (Free Shipping, Certified Genuine, Secure Checkout) beneath the hero.",
    id: "ecommerce.trusted-strip",
    label: "Trust Strip",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Trust"
  },
  "ecommerce.organisation": {
    description: "Legal company identity, display name, financial year linkage, and brand logo upload.",
    id: "ecommerce.organisation",
    label: "Organisation & Brand",
    requiredPermissions: ["ecommerce.storefront.manage"],
    section: "storefront",
    shortTitle: "Organisation"
  },
  "ecommerce.categories": {
    description: "Core product categories lookup tree mapped to storefront catalog navigation.",
    id: "ecommerce.categories",
    label: "Categories",
    requiredPermissions: ["core.master.product-category.view"],
    section: "catalog",
    shortTitle: "Categories"
  },
  "ecommerce.products": {
    description: "Core product master lookup records available for storefront publication.",
    id: "ecommerce.products",
    label: "Core Products",
    requiredPermissions: ["core.master.product.view"],
    section: "catalog",
    shortTitle: "Core Products"
  },
  "ecommerce.brands-strip": {
    description: "Core brand master lookup records displayed in the storefront brand carousel strip.",
    id: "ecommerce.brands-strip",
    label: "Brands Strip",
    requiredPermissions: ["core.master.brand.view"],
    section: "storefront",
    shortTitle: "Brands"
  },
  "storefront.preview": {
    description: "Live storefront customer preview mode bound to tenant domain without forwarding staff credentials.",
    id: "storefront.preview",
    label: "Customer Preview",
    requiredPermissions: ["ecommerce.overview.view"],
    section: "preview",
    shortTitle: "Preview"
  }
};

/**
 * Asserts that the current session possesses the required permission.
 */
export function assertEcommercePermission(
  permission: EcommercePermissionKey,
  hasPermissionFn: (perm: string) => boolean,
  routeKey?: EcommerceRouteKey | undefined
): void {
  if (!hasPermissionFn(permission)) {
    throw new EcommercePermissionDeniedError(
      `Permission denied: Missing '${permission}' required for ecommerce operation.`,
      permission,
      routeKey
    );
  }
}

/**
 * Checks whether the user can access a specific ecommerce route.
 */
export function hasRequiredEcommercePermission(
  routeKey: EcommerceRouteKey,
  hasPermissionFn: (perm: string) => boolean
): boolean {
  const meta = ECOMMERCE_ROUTE_REGISTRY[routeKey];
  if (!meta) return false;
  return meta.requiredPermissions.every((perm) => hasPermissionFn(perm));
}

/**
 * Returns all routes accessible by the current user.
 */
export function getAccessibleEcommerceRoutes(
  hasPermissionFn: (perm: string) => boolean
): EcommerceRouteMetadata[] {
  return Object.values(ECOMMERCE_ROUTE_REGISTRY).filter((meta) =>
    meta.requiredPermissions.every((perm) => hasPermissionFn(perm))
  );
}

/**
 * Returns accessible routes grouped under a specific section.
 */
export function getEcommerceRoutesBySection(
  section: EcommerceRouteSection,
  hasPermissionFn: (perm: string) => boolean
): EcommerceRouteMetadata[] {
  return Object.values(ECOMMERCE_ROUTE_REGISTRY).filter(
    (meta) => meta.section === section && meta.requiredPermissions.every((perm) => hasPermissionFn(perm))
  );
}

/**
 * Constructs a secure storefront preview configuration bound to tenant domain.
 * Strictly guarantees that staff credentials (tokens, session slots, auth cookies)
 * are NEVER forwarded to the public customer preview surface.
 */
export function buildStorefrontPreviewConfig(
  apiOrigin: string,
  tenantCode: string,
  tenantDomain?: string | undefined
): StorefrontPreviewConfig {
  const normalizedOrigin = apiOrigin.replace(/\/+$/u, "");
  const normalizedDomain = tenantDomain?.trim() || `${tenantCode.toLowerCase()}.localhost`;

  // Build clean preview URL with tenant domain binding
  const previewUrl = normalizedDomain.includes("://")
    ? `${normalizedDomain}/shop?preview=1&tenant=${encodeURIComponent(tenantCode)}`
    : `${normalizedOrigin}/storefront/${encodeURIComponent(tenantCode)}?preview=1`;

  // Public customer preview headers: explicitly omit authorization or session slot
  const headers: Record<string, string> = {
    "x-storefront-preview": "true",
    "x-tenant-code": tenantCode
  };

  return {
    credentialsForwarded: false,
    headers,
    previewMode: true,
    previewUrl,
    tenantCode,
    tenantDomain: normalizedDomain
  };
}
