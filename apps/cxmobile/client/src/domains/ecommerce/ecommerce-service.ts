/**
 * Ecommerce Service Layer for cxmobile Native Transport
 * Exposes all supported M0 workflows, role/permission checks, and catalog lifecycle parity.
 */

import type { NativeHttpTransport } from "../../native/http.js";
import { assertStaffParityBoundary } from "./ecommerce-cart.js";
import { assertEcommercePermission, buildStorefrontPreviewConfig } from "./ecommerce-routes.js";
import type {
  AttributeAssignment,
  CatalogDataSourceConnection,
  CatalogDataSourceModuleKey,
  CatalogDataSourceProvider,
  CatalogDataSourceSettings,
  CatalogDataSourceSyncResult,
  CatalogHealthMetrics,
  CoreBrandOption,
  CoreProductOption,
  EcommerceOverview,
  EcommerceStorefrontRuntime,
  FeaturedCardRecord,
  FeaturedCardSaveInput,
  FrappeItem,
  ImageVariantOption,
  ProductAttributeRecord,
  ProductAttributeSaveInput,
  ProductCollectionRecord,
  ProductCollectionSaveInput,
  ProductImageFilters,
  ProductImageRecord,
  ProductImageSaveInput,
  ProductImageUpdateInput,
  ProductImageUploadResult,
  ProductInformationFilters,
  ProductInformationPage,
  ProductInformationRecord,
  ProductInformationSaveInput,
  ProductInformationUpdateInput,
  ProductSpecificationRecord,
  ProductSpecificationSaveInput,
  ProductVariantFilters,
  ProductVariantPage,
  ProductVariantRecord,
  ProductVariantSaveInput,
  ProductVariantUpdateInput,
  PromotionCardRecord,
  PromotionCardSaveInput,
  SeasonStripRecord,
  SeasonStripSaveInput,
  StorefrontAnnouncementRecord,
  StorefrontAnnouncementSaveInput,
  StorefrontBootstrap,
  StorefrontBranding,
  StorefrontCategory,
  StorefrontDiscovery,
  StorefrontOrganisation,
  StorefrontOrganisationOptions,
  StorefrontOrganisationSaveInput,
  StorefrontPreviewConfig,
  StorefrontProduct,
  StorefrontProductDetail,
  StorefrontProfile,
  StorefrontSliderRecord,
  StorefrontSliderSaveInput,
  VariantProductOption
} from "./types.js";

export class EcommerceService {
  private readonly transport: NativeHttpTransport;
  private readonly hasPermissionFn: (perm: string) => boolean;

  constructor(transport: NativeHttpTransport, hasPermissionFn: (perm: string) => boolean = () => true) {
    this.transport = transport;
    this.hasPermissionFn = hasPermissionFn;
  }

  // ==========================================
  // 1. OVERVIEW & HEALTH METRICS
  // ==========================================

  public async getOverview(): Promise<EcommerceOverview> {
    assertEcommercePermission("ecommerce.overview.view", this.hasPermissionFn, "ecommerce.overview");
    return this.transport.get<EcommerceOverview>("/ecommerce/overview");
  }

  public async getStorefrontRuntimeStatus(): Promise<EcommerceStorefrontRuntime> {
    assertEcommercePermission("ecommerce.overview.view", this.hasPermissionFn, "ecommerce.overview");
    return this.transport.get<EcommerceStorefrontRuntime>("/ecommerce/overview/storefront-runtime");
  }

  public async startStorefrontRuntime(): Promise<EcommerceStorefrontRuntime> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.overview");
    return this.transport.post<EcommerceStorefrontRuntime>("/ecommerce/overview/storefront-runtime/start", {});
  }

  public async getCatalogHealthMetrics(): Promise<CatalogHealthMetrics> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.catalog");

    const [productsPage, variantsPage, images, collections, dataSource] = await Promise.all([
      this.transport.get<ProductInformationPage>("/ecommerce/catalog/product-information?pageSize=1"),
      this.transport.get<ProductVariantPage>("/ecommerce/catalog/variants?pageSize=1"),
      this.transport.get<ProductImageRecord[]>("/ecommerce/catalog/images"),
      this.transport.get<ProductCollectionRecord[]>("/ecommerce/catalog/collections").catch(() => []),
      this.transport
        .get<CatalogDataSourceSettings>("/ecommerce/settings/data-source")
        .catch(() => ({
          frappeConfigured: false,
          frappeEnabled: false,
          frappeUrl: null,
          modules: [],
          verificationStatus: "offline" as const
        }))
    ]);

    const imageList = Array.isArray(images) ? images : [];
    const collectionList = Array.isArray(collections) ? collections : [];

    return {
      activeVariants: variantsPage?.statusCounts?.active ?? 0,
      archivedProducts: productsPage?.statusCounts?.archived ?? 0,
      draftProducts: productsPage?.statusCounts?.draft ?? 0,
      frappeConfigured: dataSource.frappeConfigured,
      frappeEnabled: dataSource.frappeEnabled,
      frappeStatus: dataSource.verificationStatus,
      publishedProducts: productsPage?.statusCounts?.published ?? 0,
      totalCollections: collectionList.length,
      totalImages: imageList.length,
      totalProducts: productsPage?.total ?? 0,
      totalVariants: variantsPage?.total ?? 0
    };
  }

  // ==========================================
  // 2. PRODUCT INFORMATION
  // ==========================================

  public async listProductInformation(
    filters: ProductInformationFilters = {}
  ): Promise<ProductInformationPage> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-information");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.storefrontTitle) params.set("storefrontTitle", filters.storefrontTitle);
    if (filters.coreProductName) params.set("coreProductName", filters.coreProductName);
    if (filters.brandName) params.set("brandName", filters.brandName);
    if (filters.slug) params.set("slug", filters.slug);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.transport.get<ProductInformationPage>(`/ecommerce/catalog/product-information${qs}`);
  }

  public async getProductInformation(id: number): Promise<ProductInformationRecord> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-information");
    return this.transport.get<ProductInformationRecord>(`/ecommerce/catalog/product-information/${id}`);
  }

  public async createProductInformation(
    input: ProductInformationSaveInput
  ): Promise<ProductInformationRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-information");
    return this.transport.post<ProductInformationRecord>("/ecommerce/catalog/product-information", input);
  }

  public async updateProductInformation(
    id: number,
    input: ProductInformationUpdateInput
  ): Promise<ProductInformationRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-information");
    return this.transport.put<ProductInformationRecord>(`/ecommerce/catalog/product-information/${id}`, input);
  }

  public async archiveProductInformation(id: number): Promise<ProductInformationRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-information");
    return this.transport.post<ProductInformationRecord>(
      `/ecommerce/catalog/product-information/${id}/archive`,
      {}
    );
  }

  public async publishProductInformation(
    id: number,
    expectedRevision: number,
    currentData: ProductInformationSaveInput
  ): Promise<ProductInformationRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-information");
    return this.updateProductInformation(id, {
      ...currentData,
      expectedRevision,
      publicationStatus: "published"
    });
  }

  public async unpublishProductInformation(
    id: number,
    expectedRevision: number,
    currentData: ProductInformationSaveInput
  ): Promise<ProductInformationRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-information");
    return this.updateProductInformation(id, {
      ...currentData,
      expectedRevision,
      publicationStatus: "draft"
    });
  }

  public async getCoreProductOptions(): Promise<CoreProductOption[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-information");
    return this.transport.get<CoreProductOption[]>("/ecommerce/catalog/product-information/core-products");
  }

  public async getCoreBrandOptions(): Promise<CoreBrandOption[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-information");
    return this.transport.get<CoreBrandOption[]>("/ecommerce/catalog/product-information/core-brands");
  }

  // ==========================================
  // 3. PRODUCT VARIANTS
  // ==========================================

  public async listProductVariants(filters: ProductVariantFilters = {}): Promise<ProductVariantPage> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-variants");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.productInformationId) params.set("productInformationId", String(filters.productInformationId));
    if (filters.sku) params.set("sku", filters.sku);
    if (filters.title) params.set("title", filters.title);
    if (filters.productTitle) params.set("productTitle", filters.productTitle);
    if (filters.options) params.set("options", filters.options);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.transport.get<ProductVariantPage>(`/ecommerce/catalog/variants${qs}`);
  }

  public async getProductVariant(id: number): Promise<ProductVariantRecord> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-variants");
    return this.transport.get<ProductVariantRecord>(`/ecommerce/catalog/variants/${id}`);
  }

  public async createProductVariant(input: ProductVariantSaveInput): Promise<ProductVariantRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-variants");
    return this.transport.post<ProductVariantRecord>("/ecommerce/catalog/variants", input);
  }

  public async updateProductVariant(
    id: number,
    input: ProductVariantUpdateInput
  ): Promise<ProductVariantRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-variants");
    return this.transport.put<ProductVariantRecord>(`/ecommerce/catalog/variants/${id}`, input);
  }

  public async activateProductVariant(id: number): Promise<ProductVariantRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-variants");
    return this.transport.post<ProductVariantRecord>(`/ecommerce/catalog/variants/${id}/activate`, {});
  }

  public async deactivateProductVariant(id: number): Promise<ProductVariantRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-variants");
    return this.transport.post<ProductVariantRecord>(`/ecommerce/catalog/variants/${id}/deactivate`, {});
  }

  public async getVariantProductOptions(): Promise<VariantProductOption[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-variants");
    return this.transport.get<VariantProductOption[]>("/ecommerce/catalog/variants/products");
  }

  // ==========================================
  // 4. PRODUCT IMAGES
  // ==========================================

  public async listProductImages(filters: ProductImageFilters = {}): Promise<ProductImageRecord[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-images");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.productInformationId) params.set("productInformationId", String(filters.productInformationId));

    const qs = params.toString() ? `?${params.toString()}` : "";
    const result = await this.transport.get<ProductImageRecord[]>(`/ecommerce/catalog/images${qs}`);
    return Array.isArray(result) ? result : [];
  }

  public async getProductImage(id: number): Promise<ProductImageRecord> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.get<ProductImageRecord>(`/ecommerce/catalog/images/${id}`);
  }

  public async uploadProductImage(
    fileName: string,
    contentBase64: string
  ): Promise<ProductImageUploadResult> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.post<ProductImageUploadResult>("/ecommerce/catalog/images/upload", {
      contentBase64,
      fileName
    });
  }

  public async createProductImage(input: ProductImageSaveInput): Promise<ProductImageRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.post<ProductImageRecord>("/ecommerce/catalog/images", input);
  }

  public async updateProductImage(
    id: number,
    input: ProductImageUpdateInput
  ): Promise<ProductImageRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.put<ProductImageRecord>(`/ecommerce/catalog/images/${id}`, input);
  }

  public async activateProductImage(id: number): Promise<ProductImageRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.post<ProductImageRecord>(`/ecommerce/catalog/images/${id}/activate`, {});
  }

  public async deactivateProductImage(id: number): Promise<ProductImageRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.post<ProductImageRecord>(`/ecommerce/catalog/images/${id}/deactivate`, {});
  }

  public async getImageProductOptions(): Promise<Array<{ id: number; title: string }>> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.get<Array<{ id: number; title: string }>>("/ecommerce/catalog/images/products");
  }

  public async getImageVariantOptions(): Promise<ImageVariantOption[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-images");
    return this.transport.get<ImageVariantOption[]>("/ecommerce/catalog/images/variants");
  }

  public async reorderProductImages(
    productInformationId: number,
    orderedImageIds: number[]
  ): Promise<void> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-images");
    const images = await this.listProductImages({ productInformationId });
    const imageMap = new Map(images.map((img) => [img.id, img]));

    for (let index = 0; index < orderedImageIds.length; index += 1) {
      const id = orderedImageIds[index];
      if (id === undefined) continue;
      const current = imageMap.get(id);
      if (current) {
        await this.updateProductImage(id, {
          altText: current.altText,
          caption: current.caption,
          isPrimary: current.isPrimary,
          productInformationId: current.productInformationId,
          sortOrder: (index + 1) * 10,
          status: current.status,
          url: current.url,
          variantId: current.variantId
        });
      }
    }
  }

  public async setPrimaryProductImage(
    productInformationId: number,
    primaryImageId: number
  ): Promise<void> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-images");
    const images = await this.listProductImages({ productInformationId });

    for (const img of images) {
      const shouldBePrimary = img.id === primaryImageId;
      if (img.isPrimary !== shouldBePrimary) {
        await this.updateProductImage(img.id, {
          altText: img.altText,
          caption: img.caption,
          isPrimary: shouldBePrimary,
          productInformationId: img.productInformationId,
          sortOrder: img.sortOrder,
          status: img.status,
          url: img.url,
          variantId: img.variantId
        });
      }
    }
  }

  // ==========================================
  // 5. ATTRIBUTES, SPECIFICATIONS & COLLECTIONS
  // ==========================================

  public async listProductAttributes(): Promise<ProductAttributeRecord[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-attributes");
    const res = await this.transport.get<ProductAttributeRecord[]>("/ecommerce/catalog/attributes");
    return Array.isArray(res) ? res : [];
  }

  public async getProductAttribute(id: number): Promise<ProductAttributeRecord> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-attributes");
    return this.transport.get<ProductAttributeRecord>(`/ecommerce/catalog/attributes/${id}`);
  }

  public async createProductAttribute(
    input: ProductAttributeSaveInput
  ): Promise<ProductAttributeRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-attributes");
    return this.transport.post<ProductAttributeRecord>("/ecommerce/catalog/attributes", input);
  }

  public async updateProductAttribute(
    id: number,
    input: ProductAttributeSaveInput
  ): Promise<ProductAttributeRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-attributes");
    return this.transport.put<ProductAttributeRecord>(`/ecommerce/catalog/attributes/${id}`, input);
  }

  public async getProductAttributeAssignments(
    productInformationId: number
  ): Promise<AttributeAssignment[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-attributes");
    const res = await this.transport.get<AttributeAssignment[]>(
      `/ecommerce/catalog/attributes/products/${productInformationId}`
    );
    return Array.isArray(res) ? res : [];
  }

  public async assignProductAttributes(
    productInformationId: number,
    values: Array<{ attributeId: number; values: string[] }>
  ): Promise<AttributeAssignment[]> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-attributes");
    return this.transport.put<AttributeAssignment[]>(
      `/ecommerce/catalog/attributes/products/${productInformationId}`,
      { values }
    );
  }

  public async listProductSpecifications(): Promise<ProductSpecificationRecord[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-specifications");
    const res = await this.transport.get<ProductSpecificationRecord[]>("/ecommerce/catalog/specifications");
    return Array.isArray(res) ? res : [];
  }

  public async getProductSpecification(id: number): Promise<ProductSpecificationRecord> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-specifications");
    return this.transport.get<ProductSpecificationRecord>(`/ecommerce/catalog/specifications/${id}`);
  }

  public async createProductSpecification(
    input: ProductSpecificationSaveInput
  ): Promise<ProductSpecificationRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-specifications");
    return this.transport.post<ProductSpecificationRecord>("/ecommerce/catalog/specifications", input);
  }

  public async updateProductSpecification(
    id: number,
    input: ProductSpecificationSaveInput
  ): Promise<ProductSpecificationRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-specifications");
    return this.transport.put<ProductSpecificationRecord>(`/ecommerce/catalog/specifications/${id}`, input);
  }

  public async listProductCollections(): Promise<ProductCollectionRecord[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-collections");
    const res = await this.transport.get<ProductCollectionRecord[]>("/ecommerce/catalog/collections");
    return Array.isArray(res) ? res : [];
  }

  public async getProductCollection(id: number): Promise<ProductCollectionRecord> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.product-collections");
    return this.transport.get<ProductCollectionRecord>(`/ecommerce/catalog/collections/${id}`);
  }

  public async createProductCollection(
    input: ProductCollectionSaveInput
  ): Promise<ProductCollectionRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-collections");
    return this.transport.post<ProductCollectionRecord>("/ecommerce/catalog/collections", input);
  }

  public async updateProductCollection(
    id: number,
    input: ProductCollectionSaveInput & { expectedRevision?: number | undefined }
  ): Promise<ProductCollectionRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-collections");
    return this.transport.put<ProductCollectionRecord>(`/ecommerce/catalog/collections/${id}`, input);
  }

  public async assignCollectionItems(
    collectionId: number,
    productInformationIds: number[]
  ): Promise<ProductCollectionRecord> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.product-collections");
    return this.transport.put<ProductCollectionRecord>(
      `/ecommerce/catalog/collections/${collectionId}/items`,
      { productInformationIds }
    );
  }

  // ==========================================
  // 6. CATALOG DATA SOURCE (FRAPPE SYNC)
  // ==========================================

  public async getCatalogDataSourceSettings(): Promise<CatalogDataSourceSettings> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.catalog-data-source");
    return this.transport.get<CatalogDataSourceSettings>("/ecommerce/settings/data-source");
  }

  public async switchDataSourceProvider(
    module: CatalogDataSourceModuleKey,
    provider: CatalogDataSourceProvider
  ): Promise<CatalogDataSourceSettings> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.catalog-data-source");
    return this.transport.put<CatalogDataSourceSettings>("/ecommerce/settings/data-source", {
      module,
      provider
    });
  }

  public async switchDataSourceVisibility(
    module: CatalogDataSourceModuleKey,
    enabled: boolean
  ): Promise<CatalogDataSourceSettings> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.catalog-data-source");
    return this.transport.put<CatalogDataSourceSettings>("/ecommerce/settings/data-source/visibility", {
      enabled,
      module
    });
  }

  public async testDataSourceConnection(
    provider: CatalogDataSourceProvider
  ): Promise<CatalogDataSourceConnection> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.catalog-data-source");
    return this.transport.post<CatalogDataSourceConnection>("/ecommerce/settings/data-source/test", {
      provider
    });
  }

  public async syncPullFromFrappe(): Promise<CatalogDataSourceSyncResult> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.catalog-data-source");
    return this.transport.post<CatalogDataSourceSyncResult>("/ecommerce/settings/data-source/sync/pull", {});
  }

  public async syncPushToFrappe(): Promise<CatalogDataSourceSyncResult> {
    assertEcommercePermission("ecommerce.catalog.edit", this.hasPermissionFn, "ecommerce.catalog-data-source");
    return this.transport.post<CatalogDataSourceSyncResult>("/ecommerce/settings/data-source/sync/push", {});
  }

  public async searchFrappeItems(search = ""): Promise<FrappeItem[]> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.catalog-data-source");
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await this.transport.get<FrappeItem[]>(`/ecommerce/settings/data-source/frappe-items${qs}`);
    return Array.isArray(res) ? res : [];
  }

  public async getFrappeItem(itemCode: string): Promise<FrappeItem> {
    assertEcommercePermission("ecommerce.catalog.view", this.hasPermissionFn, "ecommerce.catalog-data-source");
    return this.transport.get<FrappeItem>(
      `/ecommerce/settings/data-source/frappe-items/${encodeURIComponent(itemCode)}`
    );
  }

  // ==========================================
  // 7. STOREFRONT COMPONENTS
  // ==========================================

  // --- Sliders ---
  public async listStorefrontSliders(filters: { search?: string | undefined; status?: string | undefined } = {}): Promise<StorefrontSliderRecord[]> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront-sliders");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await this.transport.get<StorefrontSliderRecord[]>(`/ecommerce/storefront/sliders${qs}`);
    return Array.isArray(res) ? res : [];
  }

  public async getStorefrontSlider(id: number): Promise<StorefrontSliderRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront-sliders");
    return this.transport.get<StorefrontSliderRecord>(`/ecommerce/storefront/sliders/${id}`);
  }

  public async createStorefrontSlider(input: StorefrontSliderSaveInput): Promise<StorefrontSliderRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront-sliders");
    return this.transport.post<StorefrontSliderRecord>("/ecommerce/storefront/sliders", input);
  }

  public async updateStorefrontSlider(id: number, input: StorefrontSliderSaveInput): Promise<StorefrontSliderRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront-sliders");
    return this.transport.put<StorefrontSliderRecord>(`/ecommerce/storefront/sliders/${id}`, input);
  }

  public async activateStorefrontSlider(id: number): Promise<StorefrontSliderRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront-sliders");
    return this.transport.post<StorefrontSliderRecord>(`/ecommerce/storefront/sliders/${id}/activate`, {});
  }

  public async deactivateStorefrontSlider(id: number): Promise<StorefrontSliderRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront-sliders");
    return this.transport.post<StorefrontSliderRecord>(`/ecommerce/storefront/sliders/${id}/deactivate`, {});
  }

  public async uploadStorefrontSliderImage(fileName: string, contentBase64: string): Promise<{ fileName: string }> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront-sliders");
    return this.transport.post<{ fileName: string }>("/ecommerce/storefront/sliders/images", {
      contentBase64,
      fileName
    });
  }

  // --- Promotions ---
  public async listPromotionCards(filters: { search?: string | undefined; status?: string | undefined } = {}): Promise<PromotionCardRecord[]> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.promotions");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await this.transport.get<PromotionCardRecord[]>(`/ecommerce/storefront/promotions${qs}`);
    return Array.isArray(res) ? res : [];
  }

  public async getPromotionCard(id: number): Promise<PromotionCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.promotions");
    return this.transport.get<PromotionCardRecord>(`/ecommerce/storefront/promotions/${id}`);
  }

  public async createPromotionCard(input: PromotionCardSaveInput): Promise<PromotionCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.promotions");
    return this.transport.post<PromotionCardRecord>("/ecommerce/storefront/promotions", input);
  }

  public async updatePromotionCard(id: number, input: PromotionCardSaveInput): Promise<PromotionCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.promotions");
    return this.transport.put<PromotionCardRecord>(`/ecommerce/storefront/promotions/${id}`, input);
  }

  public async activatePromotionCard(id: number): Promise<PromotionCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.promotions");
    return this.transport.post<PromotionCardRecord>(`/ecommerce/storefront/promotions/${id}/activate`, {});
  }

  public async deactivatePromotionCard(id: number): Promise<PromotionCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.promotions");
    return this.transport.post<PromotionCardRecord>(`/ecommerce/storefront/promotions/${id}/deactivate`, {});
  }

  // --- Featured Cards ---
  public async listFeaturedCards(filters: { search?: string | undefined; status?: string | undefined } = {}): Promise<FeaturedCardRecord[]> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.featured-cards");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await this.transport.get<FeaturedCardRecord[]>(`/ecommerce/storefront/featured-cards${qs}`);
    return Array.isArray(res) ? res : [];
  }

  public async getFeaturedCard(id: number): Promise<FeaturedCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.featured-cards");
    return this.transport.get<FeaturedCardRecord>(`/ecommerce/storefront/featured-cards/${id}`);
  }

  public async createFeaturedCard(input: FeaturedCardSaveInput): Promise<FeaturedCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.featured-cards");
    return this.transport.post<FeaturedCardRecord>("/ecommerce/storefront/featured-cards", input);
  }

  public async updateFeaturedCard(id: number, input: FeaturedCardSaveInput): Promise<FeaturedCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.featured-cards");
    return this.transport.put<FeaturedCardRecord>(`/ecommerce/storefront/featured-cards/${id}`, input);
  }

  public async activateFeaturedCard(id: number): Promise<FeaturedCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.featured-cards");
    return this.transport.post<FeaturedCardRecord>(`/ecommerce/storefront/featured-cards/${id}/activate`, {});
  }

  public async deactivateFeaturedCard(id: number): Promise<FeaturedCardRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.featured-cards");
    return this.transport.post<FeaturedCardRecord>(`/ecommerce/storefront/featured-cards/${id}/deactivate`, {});
  }

  // --- Season Strips ---
  public async listSeasonStrips(filters: { search?: string | undefined; status?: string | undefined } = {}): Promise<SeasonStripRecord[]> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.season-strips");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await this.transport.get<SeasonStripRecord[]>(`/ecommerce/storefront/season-strips${qs}`);
    return Array.isArray(res) ? res : [];
  }

  public async getSeasonStrip(id: number): Promise<SeasonStripRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.season-strips");
    return this.transport.get<SeasonStripRecord>(`/ecommerce/storefront/season-strips/${id}`);
  }

  public async createSeasonStrip(input: SeasonStripSaveInput): Promise<SeasonStripRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.season-strips");
    return this.transport.post<SeasonStripRecord>("/ecommerce/storefront/season-strips", input);
  }

  public async updateSeasonStrip(id: number, input: SeasonStripSaveInput): Promise<SeasonStripRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.season-strips");
    return this.transport.put<SeasonStripRecord>(`/ecommerce/storefront/season-strips/${id}`, input);
  }

  public async activateSeasonStrip(id: number): Promise<SeasonStripRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.season-strips");
    return this.transport.post<SeasonStripRecord>(`/ecommerce/storefront/season-strips/${id}/activate`, {});
  }

  public async deactivateSeasonStrip(id: number): Promise<SeasonStripRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.season-strips");
    return this.transport.post<SeasonStripRecord>(`/ecommerce/storefront/season-strips/${id}/deactivate`, {});
  }

  // --- Campaign Events & Announcements ---
  public async listStorefrontAnnouncements(): Promise<StorefrontAnnouncementRecord[]> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.campaign-events");
    const res = await this.transport.get<StorefrontAnnouncementRecord[]>("/ecommerce/storefront/announcements");
    return Array.isArray(res) ? res : [];
  }

  public async createStorefrontAnnouncement(
    input: StorefrontAnnouncementSaveInput
  ): Promise<StorefrontAnnouncementRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.campaign-events");
    return this.transport.post<StorefrontAnnouncementRecord>("/ecommerce/storefront/announcements", input);
  }

  public async updateStorefrontAnnouncement(
    id: number,
    input: StorefrontAnnouncementSaveInput
  ): Promise<StorefrontAnnouncementRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.campaign-events");
    return this.transport.put<StorefrontAnnouncementRecord>(`/ecommerce/storefront/announcements/${id}`, input);
  }

  public async activateStorefrontAnnouncement(id: number): Promise<StorefrontAnnouncementRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.campaign-events");
    return this.transport.post<StorefrontAnnouncementRecord>(
      `/ecommerce/storefront/announcements/${id}/activate`,
      {}
    );
  }

  public async deactivateStorefrontAnnouncement(id: number): Promise<StorefrontAnnouncementRecord> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.campaign-events");
    return this.transport.post<StorefrontAnnouncementRecord>(
      `/ecommerce/storefront/announcements/${id}/deactivate`,
      {}
    );
  }

  // ==========================================
  // 8. PROFILE, TRUST STRIP & SERVICE BANNER
  // ==========================================

  public async getStorefrontProfile(): Promise<StorefrontProfile> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront");
    return this.transport.get<StorefrontProfile>("/ecommerce/storefront/profile");
  }

  public async updateStorefrontProfile(input: StorefrontProfile): Promise<StorefrontProfile> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.storefront");
    return this.transport.put<StorefrontProfile>("/ecommerce/storefront/profile", input);
  }

  // ==========================================
  // 9. ORGANISATION & BRANDING
  // ==========================================

  public async getStorefrontOrganisation(): Promise<StorefrontOrganisation> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.organisation");
    return this.transport.get<StorefrontOrganisation>("/ecommerce/storefront/organisation");
  }

  public async updateStorefrontOrganisation(
    input: StorefrontOrganisationSaveInput
  ): Promise<StorefrontOrganisation> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.organisation");
    return this.transport.put<StorefrontOrganisation>("/ecommerce/storefront/organisation", input);
  }

  public async uploadStorefrontOrganisationLogo(contentBase64: string): Promise<{ logoFileName: string }> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.organisation");
    return this.transport.post<{ logoFileName: string }>("/ecommerce/storefront/organisation/logo", {
      contentBase64
    });
  }

  public async getStorefrontOrganisationOptions(): Promise<StorefrontOrganisationOptions> {
    assertEcommercePermission("ecommerce.storefront.manage", this.hasPermissionFn, "ecommerce.organisation");
    return this.transport.get<StorefrontOrganisationOptions>("/ecommerce/storefront/organisation/options");
  }

  public async getStorefrontBranding(): Promise<StorefrontBranding> {
    return this.transport.get<StorefrontBranding>("/storefront/branding");
  }

  // ==========================================
  // 10. CORE LOOKUPS & STOREFRONT DISCOVERY
  // ==========================================

  public async getCategories(): Promise<StorefrontCategory[]> {
    assertEcommercePermission("core.master.product-category.view", this.hasPermissionFn, "ecommerce.categories");
    const res = await this.transport.get<StorefrontCategory[]>("/storefront/categories");
    return Array.isArray(res) ? res : [];
  }

  public async getDiscovery(): Promise<StorefrontDiscovery> {
    assertEcommercePermission("core.master.brand.view", this.hasPermissionFn, "ecommerce.brands-strip");
    return this.transport.get<StorefrontDiscovery>("/storefront/discovery");
  }

  public async getBootstrap(): Promise<StorefrontBootstrap> {
    return this.transport.get<StorefrontBootstrap>("/storefront/bootstrap");
  }

  public async getCatalog(filters: {
    brand?: string | undefined;
    category?: string | undefined;
    limit?: number | undefined;
    maxPrice?: number | undefined;
    minPrice?: number | undefined;
    offset?: number | undefined;
    search?: string | undefined;
    sort?: string | undefined;
  } = {}): Promise<StorefrontProduct[]> {
    assertEcommercePermission("core.master.product.view", this.hasPermissionFn, "ecommerce.products");
    const params = new URLSearchParams();
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.category) params.set("category", filters.category);
    if (filters.search) params.set("search", filters.search);
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
    if (filters.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters.offset !== undefined) params.set("offset", String(filters.offset));

    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await this.transport.get<StorefrontProduct[]>(`/storefront/catalog${qs}`);
    return Array.isArray(res) ? res : [];
  }

  public async getProductDetail(slug: string): Promise<StorefrontProductDetail> {
    return this.transport.get<StorefrontProductDetail>(`/storefront/products/${encodeURIComponent(slug)}`);
  }

  // ==========================================
  // 11. CUSTOMER STOREFRONT PREVIEW (NO STAFF CREDENTIALS)
  // ==========================================

  public getStorefrontPreviewConfig(
    apiOrigin: string,
    tenantCode: string,
    tenantDomain?: string | undefined
  ): StorefrontPreviewConfig {
    assertEcommercePermission("ecommerce.overview.view", this.hasPermissionFn, "storefront.preview");
    return buildStorefrontPreviewConfig(apiOrigin, tenantCode, tenantDomain);
  }

  public async previewStorefrontCatalog(options: {
    category?: string | undefined;
    search?: string | undefined;
    tenantDomain?: string | undefined;
  } = {}): Promise<StorefrontProduct[]> {
    // Assert boundary: purchasing/checkout is strictly prohibited
    assertStaffParityBoundary("preview_catalog");

    const params = new URLSearchParams();
    if (options.category) params.set("category", options.category);
    if (options.search) params.set("search", options.search);

    const qs = params.toString() ? `?${params.toString()}` : "";
    // Note: preview mode requests must not forward staff authorization tokens or cookies
    const headers: Record<string, string> = {
      "x-storefront-preview": "true"
    };
    if (options.tenantDomain) {
      headers["x-tenant-domain"] = options.tenantDomain;
    }

    const res = await this.transport.get<StorefrontProduct[]>(`/storefront/catalog${qs}`, {
      headers
    });
    return Array.isArray(res) ? res : [];
  }
}
