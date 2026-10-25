/**
 * Ecommerce Mobile Parity Domain Types & Contracts
 * Based on M0 route inventory, @codexsun/ecommerce-web exports, and Fastify route schemas.
 */

// ==========================================
// 1. ROUTE & PERMISSION TYPES
// ==========================================

export type EcommerceRouteSection =
  "overview" | "catalog" | "storefront" | "integrations" | "preview";

export type EcommerceRouteKey =
  | "ecommerce.overview"
  | "ecommerce.catalog"
  | "ecommerce.product-information"
  | "ecommerce.product-variants"
  | "ecommerce.product-images"
  | "ecommerce.product-attributes"
  | "ecommerce.product-specifications"
  | "ecommerce.product-collections"
  | "ecommerce.catalog-data-source"
  | "ecommerce.storefront"
  | "ecommerce.storefront-sliders"
  | "ecommerce.promotions"
  | "ecommerce.featured-cards"
  | "ecommerce.season-strips"
  | "ecommerce.campaign-events"
  | "ecommerce.service-banner"
  | "ecommerce.trusted-strip"
  | "ecommerce.organisation"
  | "ecommerce.categories"
  | "ecommerce.products"
  | "ecommerce.brands-strip"
  | "storefront.preview";

export type EcommercePermissionKey =
  | "ecommerce.overview.view"
  | "ecommerce.catalog.view"
  | "ecommerce.catalog.edit"
  | "ecommerce.storefront.manage"
  | "core.master.product-category.view"
  | "core.master.product.view"
  | "core.master.brand.view";

export interface EcommerceRouteMetadata {
  description: string;
  id: EcommerceRouteKey;
  label: string;
  requiredPermissions: EcommercePermissionKey[];
  section: EcommerceRouteSection;
  shortTitle: string;
}

// ==========================================
// 2. STATUS & ENUM TYPES
// ==========================================

export type PublicationStatus = "draft" | "published" | "archived";
export type VariantStatus = "active" | "inactive";
export type ImageStatus = "active" | "inactive";
export type ComponentStatus = "active" | "inactive";
export type CatalogDataSourceProvider = "own" | "frappe";
export type CatalogDataSourceModuleKey =
  | "products"
  | "variants"
  | "images"
  | "sliders"
  | "promotions"
  | "featured-cards"
  | "season-strips"
  | "campaign-events";

export type BadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// ==========================================
// 3. OVERVIEW & HEALTH METRICS
// ==========================================

export interface EcommerceOverview {
  actorEmail: string;
  appKey: "ecommerce";
  checkedAt: string;
  label: string;
  tenantCode: string;
  tenantName: string;
}

export interface EcommerceStorefrontRuntime {
  port: number | null;
  state: "running" | "starting" | "stopped" | "unavailable" | "unhealthy";
}

export interface CatalogHealthMetrics {
  activeVariants: number;
  archivedProducts: number;
  draftProducts: number;
  frappeConfigured: boolean;
  frappeEnabled: boolean;
  frappeStatus: "live" | "offline" | "unverified";
  publishedProducts: number;
  totalCollections: number;
  totalImages: number;
  totalProducts: number;
  totalVariants: number;
}

// ==========================================
// 4. PRODUCT INFORMATION
// ==========================================

export interface ProductInformationSaveInput {
  brandId?: number | null | undefined;
  bulletPoints?: string[] | undefined;
  coreProductId: number;
  countryOfOrigin?: string | undefined;
  description?: string | undefined;
  height?: number | undefined;
  isFeatured?: boolean | undefined;
  length?: number | undefined;
  manufacturer?: string | undefined;
  material?: string | undefined;
  maximumOrderQuantity?: number | null | undefined;
  minimumOrderQuantity?: number | undefined;
  publicationStatus?: PublicationStatus | undefined;
  returnPolicy?: string | undefined;
  seoDescription?: string | undefined;
  seoTitle?: string | undefined;
  shippingClass?: string | undefined;
  shortDescription?: string | undefined;
  slug: string;
  storefrontTitle: string;
  subtitle?: string | undefined;
  warranty?: string | undefined;
  weight?: number | undefined;
  width?: number | undefined;
}

export interface ProductInformationUpdateInput extends ProductInformationSaveInput {
  expectedRevision: number;
}

export interface ProductInformationRecord extends Required<ProductInformationSaveInput> {
  brandName: string | null;
  coreProductName: string;
  createdAt: string;
  id: number;
  revision: number;
  updatedAt: string;
  uuid: string;
}

export interface ProductInformationFilters {
  brandName?: string | undefined;
  coreProductName?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
  slug?: string | undefined;
  status?: PublicationStatus | undefined;
  storefrontTitle?: string | undefined;
}

export interface ProductInformationPage {
  items: ProductInformationRecord[];
  page: number;
  pageSize: number;
  statusCounts: {
    all: number;
    archived: number;
    draft: number;
    published: number;
  };
  total: number;
}

export interface CoreProductOption {
  id: number;
  name: string;
}

export interface CoreBrandOption {
  id: number;
  name: string;
}

// ==========================================
// 5. PRODUCT VARIANTS
// ==========================================

export interface ProductVariantSaveInput {
  barcode?: string | undefined;
  compareAtAdjustment?: number | undefined;
  costAdjustment?: number | undefined;
  option1Name?: string | undefined;
  option1Value?: string | undefined;
  option2Name?: string | undefined;
  option2Value?: string | undefined;
  option3Name?: string | undefined;
  option3Value?: string | undefined;
  priceAdjustment?: number | undefined;
  productInformationId: number;
  sku: string;
  sortOrder?: number | undefined;
  status?: VariantStatus | undefined;
  title?: string | undefined;
  weight?: number | undefined;
}

export interface ProductVariantUpdateInput extends ProductVariantSaveInput {
  expectedRevision?: number | undefined;
}

export interface ProductVariantRecord extends Required<ProductVariantSaveInput> {
  createdAt: string;
  id: number;
  productTitle: string;
  revision: number;
  updatedAt: string;
  uuid: string;
}

export interface ProductVariantFilters {
  options?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  productInformationId?: number | undefined;
  productTitle?: string | undefined;
  search?: string | undefined;
  sku?: string | undefined;
  status?: VariantStatus | undefined;
  title?: string | undefined;
}

export interface ProductVariantPage {
  items: ProductVariantRecord[];
  page: number;
  pageSize: number;
  statusCounts: {
    all: number;
    active: number;
    inactive: number;
  };
  total: number;
}

export interface VariantProductOption {
  id: number;
  title: string;
}

// ==========================================
// 6. PRODUCT IMAGES
// ==========================================

export interface ProductImageSaveInput {
  altText: string;
  caption?: string | undefined;
  isPrimary?: boolean | undefined;
  productInformationId: number;
  sortOrder?: number | undefined;
  status?: ImageStatus | undefined;
  url: string;
  variantId?: number | null | undefined;
}

export interface ProductImageUpdateInput extends ProductImageSaveInput {
  expectedRevision?: number | undefined;
}

export interface ProductImageRecord extends Required<ProductImageSaveInput> {
  createdAt: string;
  id: number;
  productTitle: string;
  updatedAt: string;
  uuid: string;
  variantTitle: string | null;
}

export interface ProductImageFilters {
  productInformationId?: number | undefined;
  search?: string | undefined;
  status?: ImageStatus | undefined;
}

export interface ProductImageUploadResult {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface ImageVariantOption {
  id: number;
  productInformationId: number;
  sku: string;
  title: string;
}

// ==========================================
// 7. PRODUCT ATTRIBUTES & SPECIFICATIONS & COLLECTIONS
// ==========================================

export type AttributeDataType = "text" | "number" | "boolean" | "select" | "color";

export interface ProductAttributeSaveInput {
  code: string;
  dataType: AttributeDataType;
  isFilterable?: boolean | undefined;
  name: string;
  sortOrder?: number | undefined;
  status?: ComponentStatus | undefined;
  unit?: string | undefined;
}

export interface ProductAttributeRecord extends Required<ProductAttributeSaveInput> {
  createdAt: string;
  id: number;
  revision: number;
  updatedAt: string;
  uuid: string;
  valueCount: number;
}

export interface ProductAttributeUpdateInput extends ProductAttributeSaveInput {
  expectedRevision: number;
}

export interface AttributeAssignment {
  attributeId: number;
  code: string;
  dataType: AttributeDataType;
  name: string;
  unit: string;
  values: string[];
}

export interface ProductSpecificationSaveInput {
  label: string;
  productInformationId: number;
  sortOrder?: number | undefined;
  status?: ComponentStatus | undefined;
  value: string;
}

export interface ProductSpecificationUpdateInput extends ProductSpecificationSaveInput {
  expectedRevision: number;
}

export interface ProductSpecificationRecord extends Required<ProductSpecificationSaveInput> {
  createdAt: string;
  id: number;
  productTitle: string;
  revision: number;
  updatedAt: string;
  uuid: string;
}

export interface ProductCollectionSaveInput {
  description?: string | undefined;
  heroImageUrl?: string | undefined;
  publicationStatus?: PublicationStatus | undefined;
  slug: string;
  sortOrder?: number | undefined;
  title: string;
}

export interface ProductCollectionRecord extends Required<ProductCollectionSaveInput> {
  createdAt: string;
  id: number;
  itemCount: number;
  revision: number;
  updatedAt: string;
  uuid: string;
}

export interface ProductCollectionUpdateInput extends ProductCollectionSaveInput {
  expectedRevision: number;
}

// ==========================================
// 8. CATALOG DATA SOURCE (FRAPPE SYNC)
// ==========================================

export interface CatalogDataSourceModuleSetting {
  description: string;
  enabled: boolean;
  label: string;
  module: CatalogDataSourceModuleKey;
  provider: CatalogDataSourceProvider;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CatalogDataSourceSettings {
  frappeConfigured: boolean;
  frappeEnabled: boolean;
  frappeUrl: string | null;
  modules: CatalogDataSourceModuleSetting[];
  verificationStatus: "live" | "offline" | "unverified";
}

export interface CatalogDataSourceConnection {
  connected: boolean;
  latencyMs: number;
  message: string;
  provider: CatalogDataSourceProvider;
  providerLabel: string;
}

export interface CatalogDataSourceSyncResult {
  brandStrips: number;
  campaignEvents: number;
  catalogs: number;
  direction: "frappe-to-own" | "own-to-frappe";
  erpnextItems: number;
  featuredCards: number;
  items: number;
  message: string;
  promotions: number;
  seasonStrips: number;
  sliders: number;
}

export interface FrappeItem {
  brand?: string | null | undefined;
  description?: string | null | undefined;
  disabled?: number | undefined;
  image?: string | null | undefined;
  is_stock_item?: number | undefined;
  item_code: string;
  item_group?: string | null | undefined;
  item_name: string;
  standard_rate?: number | string | null | undefined;
  stock_uom?: string | null | undefined;
}

// ==========================================
// 9. STOREFRONT COMPONENTS
// ==========================================

export interface StorefrontSliderSaveInput {
  actionLabel?: string | undefined;
  actionUrl?: string | undefined;
  description?: string | undefined;
  displayOrder?: number | undefined;
  endsAt?: string | null | undefined;
  eyebrow?: string | undefined;
  imageUrl?: string | undefined;
  ishopItem?: string | null | undefined;
  published?: boolean | undefined;
  sliderCode: string;
  startsAt?: string | null | undefined;
  status?: ComponentStatus | undefined;
  title: string;
}

export interface StorefrontSliderRecord extends Required<StorefrontSliderSaveInput> {
  createdAt: string;
  frappeDocumentName: string;
  frappeModifiedAt: string | null;
  id: number;
  updatedAt: string;
  uuid: string;
}

export interface PromotionCardSaveInput {
  actionLabel?: string | undefined;
  actionUrl?: string | undefined;
  badge?: string | undefined;
  badgePosition?: BadgePosition | undefined;
  badgeTextColor?: string | undefined;
  badgeTint?: string | undefined;
  description?: string | undefined;
  displayOrder?: number | undefined;
  endsAt?: string | null | undefined;
  eyebrow?: string | undefined;
  imageUrl?: string | undefined;
  ishopItem?: string | null | undefined;
  offerPrice: number;
  originalPrice?: number | null | undefined;
  promotionCode: string;
  published?: boolean | undefined;
  startsAt?: string | null | undefined;
  status?: ComponentStatus | undefined;
  title: string;
}

export interface PromotionCardRecord extends Required<PromotionCardSaveInput> {
  createdAt: string;
  frappeDocumentName: string;
  frappeModifiedAt: string | null;
  id: number;
  updatedAt: string;
  uuid: string;
}

export interface FeaturedCardSaveInput {
  actionLabel?: string | undefined;
  actionUrl?: string | undefined;
  badge?: string | undefined;
  badgePosition?: BadgePosition | undefined;
  badgeTextColor?: string | undefined;
  badgeTint?: string | undefined;
  description?: string | undefined;
  displayOrder?: number | undefined;
  endsAt?: string | null | undefined;
  eyebrow?: string | undefined;
  featuredCode: string;
  imageUrl?: string | undefined;
  ishopItem?: string | null | undefined;
  offerPrice: number;
  originalPrice?: number | null | undefined;
  published?: boolean | undefined;
  startsAt?: string | null | undefined;
  status?: ComponentStatus | undefined;
  title: string;
}

export interface FeaturedCardRecord extends Required<FeaturedCardSaveInput> {
  createdAt: string;
  frappeDocumentName: string;
  frappeModifiedAt: string | null;
  id: number;
  updatedAt: string;
  uuid: string;
}

export interface SeasonStripSaveInput {
  actionLabel?: string | undefined;
  actionUrl?: string | undefined;
  badge?: string | undefined;
  badgePosition?: BadgePosition | undefined;
  badgeTextColor?: string | undefined;
  badgeTint?: string | undefined;
  description?: string | undefined;
  displayOrder?: number | undefined;
  endsAt?: string | null | undefined;
  eyebrow?: string | undefined;
  imageUrl?: string | undefined;
  ishopItem?: string | null | undefined;
  offerPrice?: number | undefined;
  originalPrice?: number | null | undefined;
  published?: boolean | undefined;
  seasonCode: string;
  startsAt?: string | null | undefined;
  status?: ComponentStatus | undefined;
  title: string;
}

export interface SeasonStripRecord extends Required<SeasonStripSaveInput> {
  createdAt: string;
  frappeDocumentName: string;
  frappeModifiedAt: string | null;
  id: number;
  updatedAt: string;
  uuid: string;
}

export interface StorefrontAnnouncementSaveInput {
  displayDurationMs?: number | undefined;
  endsAt?: string | null | undefined;
  message: string;
  startsAt?: string | undefined;
  status?: ComponentStatus | undefined;
}

export interface StorefrontAnnouncementRecord extends Required<StorefrontAnnouncementSaveInput> {
  createdAt: string;
  eventKey: string;
  id: number;
  updatedAt: string;
}

// ==========================================
// 10. STOREFRONT & ORGANISATION PROFILES
// ==========================================

export interface StorefrontPaymentMethod {
  logoUrl: string;
  name: string;
}

export interface StorefrontProfile {
  aboutUs: string;
  copyrightText: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  paymentMethods: StorefrontPaymentMethod[];
  poweredByText: string;
  serviceActionLabel: string;
  serviceActionUrl: string;
  serviceDescription: string;
  serviceEyebrow: string;
  serviceTitle: string;
  tagline: string;
  threadsUrl: string;
  trustedDescription: string;
  trustedEyebrow: string;
  trustedProofPoints: string;
  trustedTitle: string;
  whatsappUrl: string;
  xUrl: string;
  youtubeUrl: string;
}

export interface StorefrontOrganisation {
  companyId: number | null;
  displayName: string;
  financialYearId: number | null;
  logoFileName: string | null;
}

export interface StorefrontOrganisationSaveInput {
  companyId: number;
  displayName?: string | undefined;
  financialYearId: number;
  logoFileName?: string | null | undefined;
}

export interface StorefrontOrganisationOptions {
  companies: Array<{ id: number; label: string }>;
  financialYears: Array<{ id: number; label: string }>;
}

export interface StorefrontBranding {
  brandName: string;
  logoDarkUrl: string | null;
  logoUrl: string | null;
  primaryPhone: string | null;
}

// ==========================================
// 11. CORE LOOKUPS & STOREFRONT DISCOVERY
// ==========================================

export interface StorefrontCategory {
  name: string;
  productCount: number;
}

export interface StorefrontBrand {
  logoAlt: string;
  logoUrl: string;
  name: string;
  productCount: number;
}

export interface StorefrontProduct {
  brand: string | null;
  category: string;
  compareAtPrice: number | null;
  description: string;
  featured: boolean;
  featuredOrder: number | null;
  imageAlt: string;
  imageUrl: string;
  name: string;
  price: number;
  shortDescription: string;
  slug: string;
  subtitle: string;
  variantCount: number;
}

export interface StorefrontProductDetail extends StorefrontProduct {
  bulletPoints: string[];
  returnPolicy: string;
  variants: Array<{
    id: number;
    price: number;
    sku: string;
    title: string;
  }>;
  warranty: string;
}

export interface StorefrontDiscovery {
  brands: StorefrontBrand[];
  categories: StorefrontCategory[];
  priceRange: {
    maximum: number;
    minimum: number;
  };
}

export interface StorefrontSiteNavigation {
  about: string;
  copyrightText: string;
  groups: Array<{
    links: Array<{ href: string; label: string }>;
    title: string;
  }>;
  paymentMethods: StorefrontPaymentMethod[];
  poweredByText: string;
  serviceBanner: {
    actionLabel: string;
    actionUrl: string;
    description: string;
    eyebrow: string;
    title: string;
  };
  socialLinks: Array<{ href: string; label: string }>;
  tagline: string;
  trustedStrip: {
    description: string;
    eyebrow: string;
    proofPoints: string[];
    title: string;
  };
}

export interface StorefrontBootstrap {
  announcement: StorefrontAnnouncementRecord | null;
  brandStrips: StorefrontBrand[];
  campaignEvents: PromotionCardRecord[];
  discovery: StorefrontDiscovery;
  featuredCards: FeaturedCardRecord[];
  promotions: PromotionCardRecord[];
  seasonStrips: SeasonStripRecord[];
  siteNavigation: StorefrontSiteNavigation | null;
  sliders: StorefrontSliderRecord[];
}

// ==========================================
// 12. STOREFRONT PREVIEW CONFIGURATION
// ==========================================

export interface StorefrontPreviewConfig {
  credentialsForwarded: false;
  headers: Record<string, string>;
  previewMode: true;
  previewUrl: string;
  tenantCode: string;
  tenantDomain: string;
}

// ==========================================
// 13. LOCAL SHOPPING CART (AUDIT A14 BOUNDARY)
// ==========================================

export interface StorefrontCartItem {
  imageAlt: string;
  imageUrl: string;
  name: string;
  price: number;
  quantity: number;
  slug: string;
}

export interface LocalCartState {
  isServerCheckoutSupported: false;
  items: StorefrontCartItem[];
  subtotal: number;
  totalCount: number;
}
