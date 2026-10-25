import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport } from "../src/native/http.js";
import { PlatformApiError } from "../src/session/session-types.js";
import {
  ECOMMERCE_ROUTE_REGISTRY,
  EcommercePermissionDeniedError,
  assertEcommercePermission,
  buildStorefrontPreviewConfig,
  getAccessibleEcommerceRoutes,
  getEcommerceRoutesBySection,
  hasRequiredEcommercePermission
} from "../src/domains/ecommerce/ecommerce-routes.js";
import {
  EcommerceBoundaryViolationError,
  StorefrontPreviewCartManager,
  assertStaffParityBoundary
} from "../src/domains/ecommerce/ecommerce-cart.js";
import { EcommerceService } from "../src/domains/ecommerce/ecommerce-service.js";
import type {
  FeaturedCardRecord,
  ProductAttributeRecord,
  ProductCollectionRecord,
  ProductImageRecord,
  ProductInformationRecord,
  ProductSpecificationRecord,
  ProductVariantRecord,
  PromotionCardRecord,
  SeasonStripRecord,
  StorefrontAnnouncementRecord,
  StorefrontOrganisation,
  StorefrontProfile,
  StorefrontSliderRecord
} from "../src/domains/ecommerce/types.js";

describe("Ecommerce Mobile Parity - M0 Workflow Verification", () => {
  let server: Server;
  let serverPort: number;
  let serverOrigin: string;

  // In-memory test stores partitioned by tenantId
  const products = new Map<string, Map<number, ProductInformationRecord>>();
  const variants = new Map<string, Map<number, ProductVariantRecord>>();
  const images = new Map<string, Map<number, ProductImageRecord>>();
  const attributes = new Map<string, Map<number, ProductAttributeRecord>>();
  const attributeAssignments = new Map<
    string,
    Map<number, Array<{ attributeId: number; values: string[] }>>
  >();
  const specifications = new Map<string, Map<number, ProductSpecificationRecord>>();
  const collections = new Map<string, Map<number, ProductCollectionRecord>>();
  const collectionItems = new Map<string, Map<number, number[]>>();
  const sliders = new Map<string, Map<number, StorefrontSliderRecord>>();
  const promotions = new Map<string, Map<number, PromotionCardRecord>>();
  const featuredCards = new Map<string, Map<number, FeaturedCardRecord>>();
  const seasonStrips = new Map<string, Map<number, SeasonStripRecord>>();
  const announcements = new Map<string, Map<number, StorefrontAnnouncementRecord>>();
  const profiles = new Map<string, StorefrontProfile>();
  const organisations = new Map<string, StorefrontOrganisation>();

  let productCounter = 1;
  let variantCounter = 1;
  let imageCounter = 1;
  let attributeCounter = 1;
  let specificationCounter = 1;
  let collectionCounter = 1;
  let sliderCounter = 1;
  let promotionCounter = 1;
  let featuredCardCounter = 1;
  let seasonStripCounter = 1;
  let announcementCounter = 1;

  function getTenantStore<K, V>(store: Map<string, Map<K, V>>, tenantId: string): Map<K, V> {
    let tStore = store.get(tenantId);
    if (!tStore) {
      tStore = new Map<K, V>();
      store.set(tenantId, tStore);
    }
    return tStore;
  }

  before(async () => {
    // Seed Tenant A default profile & organisation
    profiles.set("ten-a", {
      aboutUs: "Handcrafted artisan garments and textiles.",
      copyrightText: "© 2026 Solaris Textiles. All rights reserved.",
      facebookUrl: "https://facebook.com/solaristextiles",
      instagramUrl: "https://instagram.com/solaristextiles",
      linkedinUrl: "",
      paymentMethods: [{ logoUrl: "/api/platform/storefront/product-images/upi.png", name: "UPI" }],
      poweredByText: "Powered by Codexsun Commerce",
      serviceActionLabel: "Contact Support",
      serviceActionUrl: "/support",
      serviceDescription: "Round-the-clock dedicated customer assistance.",
      serviceEyebrow: "Customer Care",
      serviceTitle: "24/7 Support Desk",
      tagline: "Timeless Elegance & Comfort",
      threadsUrl: "",
      trustedDescription: "Certified authentic and sustainably sourced.",
      trustedEyebrow: "Our Promise",
      trustedProofPoints: "Free Delivery\nEasy 30-Day Returns\n100% Genuine",
      trustedTitle: "Why Shop With Us",
      whatsappUrl: "https://wa.me/1234567890",
      xUrl: "",
      youtubeUrl: ""
    });

    organisations.set("ten-a", {
      companyId: 1,
      displayName: "Solaris Textiles Private Limited",
      financialYearId: 1,
      logoFileName: "a1b2c3d4e5f60718293a4b5c6d7e8f90.png"
    });

    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      let rawBody = "";

      req.on("data", (chunk) => {
        rawBody += chunk;
      });

      req.on("end", () => {
        let body: Record<string, unknown> = {};
        if (rawBody) {
          try {
            body = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            // raw string or multipart
          }
        }

        const sendJson = (status: number, data: unknown) => {
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        };

        const sessionSlot = req.headers["x-codexsun-session-slot"] as string | undefined;
        const tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? "ten-a";

        // Unauthenticated check for non-public routes
        const isPublicRoute =
          url.pathname.startsWith("/storefront/") ||
          url.pathname === "/storefront/branding" ||
          url.pathname === "/storefront/bootstrap" ||
          url.pathname === "/storefront/discovery" ||
          url.pathname === "/storefront/catalog" ||
          url.pathname === "/storefront/categories";

        if (!isPublicRoute && (!sessionSlot || sessionSlot === "invalid-slot")) {
          sendJson(401, {
            error: { code: "UNAUTHORIZED", message: "Session expired or unauthenticated." },
            success: false
          });
          return;
        }

        // ==========================================
        // 1. Overview & Runtime
        // ==========================================
        if (url.pathname === "/ecommerce/overview" && req.method === "GET") {
          sendJson(200, {
            data: {
              actorEmail: "staff@codexsun.invalid",
              appKey: "ecommerce",
              checkedAt: new Date().toISOString(),
              label: "Ecommerce Overview",
              tenantCode: tenantId === "ten-a" ? "TEN-A" : "TEN-B",
              tenantName: tenantId === "ten-a" ? "Solaris Textiles" : "Foreign Mart"
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/overview/storefront-runtime" && req.method === "GET") {
          sendJson(200, {
            data: { port: 4200, state: "running" },
            success: true
          });
          return;
        }

        if (
          url.pathname === "/ecommerce/overview/storefront-runtime/start" &&
          req.method === "POST"
        ) {
          sendJson(200, {
            data: { port: 4200, state: "running" },
            success: true
          });
          return;
        }

        // ==========================================
        // 2. Product Information
        // ==========================================
        const tProducts = getTenantStore(products, tenantId);

        if (
          url.pathname === "/ecommerce/catalog/product-information/core-products" &&
          req.method === "GET"
        ) {
          sendJson(200, {
            data: [
              { id: 101, name: "Pure Linen Shirt" },
              { id: 102, name: "Oxford Cotton Trouser" }
            ],
            success: true
          });
          return;
        }

        if (
          url.pathname === "/ecommerce/catalog/product-information/core-brands" &&
          req.method === "GET"
        ) {
          sendJson(200, {
            data: [
              { id: 501, name: "Solaris Heritage" },
              { id: 502, name: "Aura Essentials" }
            ],
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/product-information" && req.method === "GET") {
          const search = url.searchParams.get("search")?.toLowerCase();
          const statusFilter = url.searchParams.get("status");

          const items = Array.from(tProducts.values()).filter((p) => {
            if (statusFilter && p.publicationStatus !== statusFilter) return false;
            if (
              search &&
              !p.storefrontTitle.toLowerCase().includes(search) &&
              !p.slug.toLowerCase().includes(search)
            ) {
              return false;
            }
            return true;
          });

          const allItems = Array.from(tProducts.values());
          sendJson(200, {
            data: {
              items,
              page: 1,
              pageSize: 50,
              statusCounts: {
                all: allItems.length,
                archived: allItems.filter((p) => p.publicationStatus === "archived").length,
                draft: allItems.filter((p) => p.publicationStatus === "draft").length,
                published: allItems.filter((p) => p.publicationStatus === "published").length
              },
              total: items.length
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/product-information" && req.method === "POST") {
          const id = productCounter++;
          const rec: ProductInformationRecord = {
            brandId: (body.brandId as number) ?? null,
            brandName: body.brandId === 501 ? "Solaris Heritage" : null,
            bulletPoints: (body.bulletPoints as string[]) ?? [],
            coreProductId: (body.coreProductId as number) ?? 101,
            coreProductName: "Pure Linen Shirt",
            countryOfOrigin: (body.countryOfOrigin as string) ?? "India",
            createdAt: new Date().toISOString(),
            description: (body.description as string) ?? "",
            height: (body.height as number) ?? 0,
            id,
            isFeatured: (body.isFeatured as boolean) ?? false,
            length: (body.length as number) ?? 0,
            manufacturer: (body.manufacturer as string) ?? "Solaris Mills",
            material: (body.material as string) ?? "100% Linen",
            maximumOrderQuantity: (body.maximumOrderQuantity as number) ?? null,
            minimumOrderQuantity: (body.minimumOrderQuantity as number) ?? 1,
            publicationStatus:
              (body.publicationStatus as "draft" | "published" | "archived") ?? "draft",
            returnPolicy: (body.returnPolicy as string) ?? "30-day returns",
            revision: 1,
            seoDescription: (body.seoDescription as string) ?? "",
            seoTitle: (body.seoTitle as string) ?? "",
            shippingClass: (body.shippingClass as string) ?? "standard",
            shortDescription: (body.shortDescription as string) ?? "",
            slug: (body.slug as string) ?? `product-${id}`,
            storefrontTitle: (body.storefrontTitle as string) ?? "Untitled Product",
            subtitle: (body.subtitle as string) ?? "",
            updatedAt: new Date().toISOString(),
            uuid: `prod${id.toString().padStart(4, "0")}`,
            warranty: (body.warranty as string) ?? "6 months",
            weight: (body.weight as number) ?? 250,
            width: (body.width as number) ?? 0
          };
          tProducts.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const productMatch = url.pathname.match(
          /^\/ecommerce\/catalog\/product-information\/(\d+)$/
        );
        if (productMatch) {
          const id = Number(productMatch[1]);
          const existing = tProducts.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Product not found." }, success: false });
            return;
          }

          if (req.method === "GET") {
            sendJson(200, { data: existing, success: true });
            return;
          }

          if (req.method === "PUT") {
            const expectedRev = body.expectedRevision as number | undefined;
            if (expectedRev !== undefined && expectedRev !== existing.revision) {
              sendJson(409, {
                error: {
                  message: "This product was changed by someone else. Reload and try again."
                },
                success: false
              });
              return;
            }

            const updated: ProductInformationRecord = {
              ...existing,
              ...body,
              revision: existing.revision + 1,
              updatedAt: new Date().toISOString()
            } as ProductInformationRecord;
            tProducts.set(id, updated);
            sendJson(200, { data: updated, success: true });
            return;
          }
        }

        const productArchiveMatch = url.pathname.match(
          /^\/ecommerce\/catalog\/product-information\/(\d+)\/archive$/
        );
        if (productArchiveMatch && req.method === "POST") {
          const id = Number(productArchiveMatch[1]);
          const existing = tProducts.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Product not found." }, success: false });
            return;
          }
          existing.publicationStatus = "archived";
          existing.updatedAt = new Date().toISOString();
          sendJson(200, { data: existing, success: true });
          return;
        }

        // ==========================================
        // 3. Product Variants
        // ==========================================
        const tVariants = getTenantStore(variants, tenantId);

        if (url.pathname === "/ecommerce/catalog/variants/products" && req.method === "GET") {
          sendJson(200, {
            data: Array.from(tProducts.values()).map((p) => ({
              id: p.id,
              title: p.storefrontTitle
            })),
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/variants" && req.method === "GET") {
          const sku = url.searchParams.get("sku")?.toLowerCase();
          const pInfoId = url.searchParams.get("productInformationId");

          const items = Array.from(tVariants.values()).filter((v) => {
            if (pInfoId && v.productInformationId !== Number(pInfoId)) return false;
            if (sku && !v.sku.toLowerCase().includes(sku)) return false;
            return true;
          });

          sendJson(200, {
            data: {
              items,
              page: 1,
              pageSize: 50,
              statusCounts: {
                active: Array.from(tVariants.values()).filter((v) => v.status === "active").length,
                all: tVariants.size,
                inactive: Array.from(tVariants.values()).filter((v) => v.status === "inactive")
                  .length
              },
              total: items.length
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/variants" && req.method === "POST") {
          const id = variantCounter++;
          const rec: ProductVariantRecord = {
            barcode: (body.barcode as string) ?? "",
            compareAtAdjustment: (body.compareAtAdjustment as number) ?? 0,
            costAdjustment: (body.costAdjustment as number) ?? 0,
            createdAt: new Date().toISOString(),
            id,
            option1Name: (body.option1Name as string) ?? "Size",
            option1Value: (body.option1Value as string) ?? "M",
            option2Name: (body.option2Name as string) ?? "Color",
            option2Value: (body.option2Value as string) ?? "Blue",
            option3Name: (body.option3Name as string) ?? "",
            option3Value: (body.option3Value as string) ?? "",
            priceAdjustment: (body.priceAdjustment as number) ?? 0,
            productInformationId: (body.productInformationId as number) ?? 1,
            productTitle: "Pure Linen Shirt",
            revision: 1,
            sku: (body.sku as string) ?? `SKU-${id}`,
            sortOrder: (body.sortOrder as number) ?? 1000,
            status: (body.status as "active" | "inactive") ?? "active",
            title: (body.title as string) ?? "M / Blue",
            updatedAt: new Date().toISOString(),
            uuid: `var${id.toString().padStart(4, "0")}`,
            weight: (body.weight as number) ?? 0
          };
          tVariants.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const variantMatch = url.pathname.match(/^\/ecommerce\/catalog\/variants\/(\d+)$/);
        if (variantMatch) {
          const id = Number(variantMatch[1]);
          const existing = tVariants.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Variant not found." }, success: false });
            return;
          }

          if (req.method === "GET") {
            sendJson(200, { data: existing, success: true });
            return;
          }

          if (req.method === "PUT") {
            const updated = {
              ...existing,
              ...body,
              revision: existing.revision + 1,
              updatedAt: new Date().toISOString()
            } as ProductVariantRecord;
            tVariants.set(id, updated);
            sendJson(200, { data: updated, success: true });
            return;
          }
        }

        const variantActionMatch = url.pathname.match(
          /^\/ecommerce\/catalog\/variants\/(\d+)\/(activate|deactivate)$/
        );
        if (variantActionMatch && req.method === "POST") {
          const id = Number(variantActionMatch[1]);
          const action = variantActionMatch[2];
          const existing = tVariants.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Variant not found." }, success: false });
            return;
          }
          existing.status = action === "activate" ? "active" : "inactive";
          existing.updatedAt = new Date().toISOString();
          sendJson(200, { data: existing, success: true });
          return;
        }

        // ==========================================
        // 4. Product Images
        // ==========================================
        const tImages = getTenantStore(images, tenantId);

        if (url.pathname === "/ecommerce/catalog/images/upload" && req.method === "POST") {
          const fileName = (body.fileName as string) ?? "photo.webp";
          sendJson(200, {
            data: {
              fileName,
              mimeType: "image/webp",
              sizeBytes: 10240,
              url: `/api/platform/storefront/product-images/${fileName}`
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/images/products" && req.method === "GET") {
          sendJson(200, {
            data: Array.from(tProducts.values()).map((p) => ({
              id: p.id,
              title: p.storefrontTitle
            })),
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/images/variants" && req.method === "GET") {
          sendJson(200, {
            data: Array.from(tVariants.values()).map((v) => ({
              id: v.id,
              productInformationId: v.productInformationId,
              sku: v.sku,
              title: v.title
            })),
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/images" && req.method === "GET") {
          const pInfoId = url.searchParams.get("productInformationId");
          const items = Array.from(tImages.values()).filter((img) => {
            if (pInfoId && img.productInformationId !== Number(pInfoId)) return false;
            return true;
          });
          sendJson(200, { data: items, success: true });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/images" && req.method === "POST") {
          const id = imageCounter++;
          const rec: ProductImageRecord = {
            altText: (body.altText as string) ?? "Product photo",
            caption: (body.caption as string) ?? "",
            createdAt: new Date().toISOString(),
            id,
            isPrimary: (body.isPrimary as boolean) ?? false,
            productInformationId: (body.productInformationId as number) ?? 1,
            productTitle: "Pure Linen Shirt",
            sortOrder: (body.sortOrder as number) ?? 1000,
            status: (body.status as "active" | "inactive") ?? "active",
            updatedAt: new Date().toISOString(),
            url: (body.url as string) ?? "/images/1.webp",
            uuid: `img${id.toString().padStart(4, "0")}`,
            variantId: (body.variantId as number) ?? null,
            variantTitle: null
          };
          tImages.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const imageMatch = url.pathname.match(/^\/ecommerce\/catalog\/images\/(\d+)$/);
        if (imageMatch) {
          const id = Number(imageMatch[1]);
          const existing = tImages.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Image not found." }, success: false });
            return;
          }

          if (req.method === "GET") {
            sendJson(200, { data: existing, success: true });
            return;
          }

          if (req.method === "PUT") {
            const updated = {
              ...existing,
              ...body,
              updatedAt: new Date().toISOString()
            } as ProductImageRecord;
            tImages.set(id, updated);
            sendJson(200, { data: updated, success: true });
            return;
          }
        }

        const imageActionMatch = url.pathname.match(
          /^\/ecommerce\/catalog\/images\/(\d+)\/(activate|deactivate)$/
        );
        if (imageActionMatch && req.method === "POST") {
          const id = Number(imageActionMatch[1]);
          const action = imageActionMatch[2];
          const existing = tImages.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Image not found." }, success: false });
            return;
          }
          existing.status = action === "activate" ? "active" : "inactive";
          existing.updatedAt = new Date().toISOString();
          sendJson(200, { data: existing, success: true });
          return;
        }

        // ==========================================
        // 5. Attributes, Specifications & Collections
        // ==========================================
        const tAttributes = getTenantStore(attributes, tenantId);
        const tAssignments = getTenantStore(attributeAssignments, tenantId);
        const tSpecifications = getTenantStore(specifications, tenantId);
        const tCollections = getTenantStore(collections, tenantId);
        const tCollectionItems = getTenantStore(collectionItems, tenantId);

        if (url.pathname === "/ecommerce/catalog/attributes" && req.method === "GET") {
          sendJson(200, { data: Array.from(tAttributes.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/attributes" && req.method === "POST") {
          const id = attributeCounter++;
          const rec: ProductAttributeRecord = {
            code: (body.code as string) ?? "attr",
            createdAt: new Date().toISOString(),
            dataType:
              (body.dataType as "text" | "number" | "boolean" | "select" | "color") ?? "text",
            id,
            isFilterable: (body.isFilterable as boolean) ?? true,
            name: (body.name as string) ?? "Attribute",
            revision: 1,
            sortOrder: (body.sortOrder as number) ?? 1000,
            status: (body.status as "active" | "inactive") ?? "active",
            unit: (body.unit as string) ?? "",
            updatedAt: new Date().toISOString(),
            uuid: `attr${id.toString().padStart(4, "0")}`,
            valueCount: 0
          };
          tAttributes.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const attrMatch = url.pathname.match(/^\/ecommerce\/catalog\/attributes\/(\d+)$/);
        if (attrMatch && req.method === "PUT") {
          const id = Number(attrMatch[1]);
          const existing = tAttributes.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Attribute not found." }, success: false });
            return;
          }
          if (body.expectedRevision !== existing.revision) {
            sendJson(409, { error: { message: "Stale attribute." }, success: false });
            return;
          }
          const updated = {
            ...existing,
            ...body,
            revision: existing.revision + 1,
            updatedAt: new Date().toISOString()
          };
          tAttributes.set(id, updated);
          sendJson(200, { data: updated, success: true });
          return;
        }

        const attrProdMatch = url.pathname.match(
          /^\/ecommerce\/catalog\/attributes\/products\/(\d+)$/
        );
        if (attrProdMatch) {
          const pId = Number(attrProdMatch[1]);
          if (req.method === "GET") {
            const list = tAssignments.get(pId) ?? [];
            sendJson(200, {
              data: list.map((a) => ({
                attributeId: a.attributeId,
                code: "color",
                dataType: "select",
                name: "Color",
                unit: "",
                values: a.values
              })),
              success: true
            });
            return;
          }
          if (req.method === "PUT") {
            const valList = (body.values as Array<{ attributeId: number; values: string[] }>) ?? [];
            tAssignments.set(pId, valList);
            sendJson(200, {
              data: valList.map((a) => ({
                attributeId: a.attributeId,
                code: "color",
                dataType: "select",
                name: "Color",
                unit: "",
                values: a.values
              })),
              success: true
            });
            return;
          }
        }

        if (url.pathname === "/ecommerce/catalog/specifications" && req.method === "GET") {
          sendJson(200, { data: Array.from(tSpecifications.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/specifications" && req.method === "POST") {
          const id = specificationCounter++;
          const rec: ProductSpecificationRecord = {
            createdAt: new Date().toISOString(),
            id,
            label: (body.label as string) ?? "Spec",
            productInformationId: (body.productInformationId as number) ?? 1,
            productTitle: "Test product",
            revision: 1,
            sortOrder: (body.sortOrder as number) ?? 1000,
            status: (body.status as "active" | "inactive") ?? "active",
            updatedAt: new Date().toISOString(),
            uuid: `spec${id.toString().padStart(4, "0")}`,
            value: (body.value as string) ?? "Value"
          };
          tSpecifications.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const specMatch = url.pathname.match(/^\/ecommerce\/catalog\/specifications\/(\d+)$/);
        if (specMatch && req.method === "PUT") {
          const id = Number(specMatch[1]);
          const existing = tSpecifications.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Specification not found." }, success: false });
            return;
          }
          if (body.expectedRevision !== existing.revision) {
            sendJson(409, { error: { message: "Stale specification." }, success: false });
            return;
          }
          const updated = {
            ...existing,
            ...body,
            revision: existing.revision + 1,
            updatedAt: new Date().toISOString()
          };
          tSpecifications.set(id, updated);
          sendJson(200, { data: updated, success: true });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/collections" && req.method === "GET") {
          sendJson(200, { data: Array.from(tCollections.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/catalog/collections" && req.method === "POST") {
          const id = collectionCounter++;
          const rec: ProductCollectionRecord = {
            createdAt: new Date().toISOString(),
            description: (body.description as string) ?? "",
            heroImageUrl: (body.heroImageUrl as string) ?? "",
            id,
            itemCount: 0,
            publicationStatus:
              (body.publicationStatus as "draft" | "published" | "archived") ?? "draft",
            revision: 1,
            slug: (body.slug as string) ?? `coll-${id}`,
            sortOrder: (body.sortOrder as number) ?? 1000,
            title: (body.title as string) ?? "Collection",
            updatedAt: new Date().toISOString(),
            uuid: `coll${id.toString().padStart(4, "0")}`
          };
          tCollections.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const collMatch = url.pathname.match(/^\/ecommerce\/catalog\/collections\/(\d+)$/);
        if (collMatch && req.method === "PUT") {
          const id = Number(collMatch[1]);
          const existing = tCollections.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Collection not found." }, success: false });
            return;
          }
          if (body.expectedRevision !== existing.revision) {
            sendJson(409, { error: { message: "Stale collection." }, success: false });
            return;
          }
          const updated = {
            ...existing,
            ...body,
            revision: existing.revision + 1,
            updatedAt: new Date().toISOString()
          };
          tCollections.set(id, updated);
          sendJson(200, { data: updated, success: true });
          return;
        }

        const collItemMatch = url.pathname.match(
          /^\/ecommerce\/catalog\/collections\/(\d+)\/items$/
        );
        if (collItemMatch && req.method === "PUT") {
          const id = Number(collItemMatch[1]);
          const pIds = (body.productInformationIds as number[]) ?? [];
          tCollectionItems.set(id, pIds);
          const coll = tCollections.get(id);
          if (coll) {
            coll.itemCount = pIds.length;
          }
          sendJson(200, { data: coll, success: true });
          return;
        }

        // ==========================================
        // 6. Catalog Data Source (Frappe Sync)
        // ==========================================
        if (url.pathname === "/ecommerce/settings/data-source" && req.method === "GET") {
          sendJson(200, {
            data: {
              frappeConfigured: true,
              frappeEnabled: true,
              frappeUrl: "https://frappe.internal.invalid",
              modules: [
                {
                  description: "Sync items from Frappe ERP",
                  enabled: true,
                  label: "Products",
                  module: "products",
                  provider: "own",
                  updatedAt: new Date().toISOString(),
                  updatedBy: "admin@codexsun.invalid"
                }
              ],
              verificationStatus: "live"
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/settings/data-source" && req.method === "PUT") {
          sendJson(200, {
            data: {
              frappeConfigured: true,
              frappeEnabled: true,
              frappeUrl: "https://frappe.internal.invalid",
              modules: [
                {
                  description: "Sync items from Frappe ERP",
                  enabled: true,
                  label: "Products",
                  module: body.module ?? "products",
                  provider: body.provider ?? "frappe",
                  updatedAt: new Date().toISOString(),
                  updatedBy: "admin@codexsun.invalid"
                }
              ],
              verificationStatus: "live"
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/settings/data-source/visibility" && req.method === "PUT") {
          sendJson(200, {
            data: {
              frappeConfigured: true,
              frappeEnabled: true,
              frappeUrl: "https://frappe.internal.invalid",
              modules: [
                {
                  description: "Sync items from Frappe ERP",
                  enabled: body.enabled ?? true,
                  label: "Products",
                  module: body.module ?? "products",
                  provider: "own",
                  updatedAt: new Date().toISOString(),
                  updatedBy: "admin@codexsun.invalid"
                }
              ],
              verificationStatus: "live"
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/settings/data-source/test" && req.method === "POST") {
          sendJson(200, {
            data: {
              connected: true,
              latencyMs: 42,
              message: "Frappe ERP connection verified successfully.",
              provider: "frappe",
              providerLabel: "Frappe ERP"
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/settings/data-source/sync/pull" && req.method === "POST") {
          sendJson(200, {
            data: {
              brandStrips: 2,
              campaignEvents: 1,
              catalogs: 1,
              direction: "frappe-to-own",
              erpnextItems: 14,
              featuredCards: 4,
              items: 14,
              message: "Pulled 14 items from Frappe successfully.",
              promotions: 3,
              seasonStrips: 1,
              sliders: 2
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/settings/data-source/sync/push" && req.method === "POST") {
          sendJson(200, {
            data: {
              brandStrips: 0,
              campaignEvents: 0,
              catalogs: 1,
              direction: "own-to-frappe",
              erpnextItems: 8,
              featuredCards: 0,
              items: 8,
              message: "Pushed 8 items to Frappe successfully.",
              promotions: 0,
              seasonStrips: 0,
              sliders: 0
            },
            success: true
          });
          return;
        }

        if (
          url.pathname === "/ecommerce/settings/data-source/frappe-items" &&
          req.method === "GET"
        ) {
          sendJson(200, {
            data: [
              {
                brand: "Frappe Originals",
                description: "Imported raw cotton garment",
                disabled: 0,
                image: "/files/shirt.png",
                is_stock_item: 1,
                item_code: "FRP-ITEM-01",
                item_group: "Apparel",
                item_name: "Frappe Linen Top",
                standard_rate: 1499,
                stock_uom: "Nos"
              }
            ],
            success: true
          });
          return;
        }

        const frappeItemMatch = url.pathname.match(
          /^\/ecommerce\/settings\/data-source\/frappe-items\/([^/]+)$/
        );
        if (frappeItemMatch && req.method === "GET") {
          const itemCode = decodeURIComponent(frappeItemMatch[1] ?? "");
          sendJson(200, {
            data: {
              brand: "Frappe Originals",
              description: "Imported raw cotton garment",
              disabled: 0,
              image: "/files/shirt.png",
              is_stock_item: 1,
              item_code: itemCode,
              item_group: "Apparel",
              item_name: "Frappe Linen Top",
              standard_rate: 1499,
              stock_uom: "Nos"
            },
            success: true
          });
          return;
        }

        // ==========================================
        // 7. Storefront Components
        // ==========================================
        const tSliders = getTenantStore(sliders, tenantId);
        const tPromotions = getTenantStore(promotions, tenantId);
        const tFeatured = getTenantStore(featuredCards, tenantId);
        const tSeasons = getTenantStore(seasonStrips, tenantId);
        const tAnnouncements = getTenantStore(announcements, tenantId);

        // Sliders
        if (url.pathname === "/ecommerce/storefront/sliders" && req.method === "GET") {
          sendJson(200, { data: Array.from(tSliders.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/storefront/sliders" && req.method === "POST") {
          const id = sliderCounter++;
          const rec: StorefrontSliderRecord = {
            actionLabel: (body.actionLabel as string) ?? "Shop Now",
            actionUrl: (body.actionUrl as string) ?? "/shop",
            createdAt: new Date().toISOString(),
            description: (body.description as string) ?? "Summer collection",
            displayOrder: (body.displayOrder as number) ?? 1,
            endsAt: null,
            eyebrow: (body.eyebrow as string) ?? "New Arrival",
            frappeDocumentName: `SLD-${id}`,
            frappeModifiedAt: null,
            id,
            imageUrl: (body.imageUrl as string) ?? "/sliders/1.webp",
            ishopItem: null,
            published: (body.published as boolean) ?? true,
            sliderCode: (body.sliderCode as string) ?? `SLIDER-${id}`,
            startsAt: null,
            status: (body.status as "active" | "inactive") ?? "active",
            title: (body.title as string) ?? "Summer Sale Banner",
            updatedAt: new Date().toISOString(),
            uuid: `sld${id.toString().padStart(4, "0")}`
          };
          tSliders.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        if (url.pathname === "/ecommerce/storefront/sliders/images" && req.method === "POST") {
          sendJson(200, {
            data: { fileName: (body.fileName as string) ?? "banner.webp" },
            success: true
          });
          return;
        }

        const sliderMatch = url.pathname.match(/^\/ecommerce\/storefront\/sliders\/(\d+)$/);
        if (sliderMatch) {
          const id = Number(sliderMatch[1]);
          const existing = tSliders.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Slider not found." }, success: false });
            return;
          }
          if (req.method === "GET") {
            sendJson(200, { data: existing, success: true });
            return;
          }
          if (req.method === "PUT") {
            const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
            tSliders.set(id, updated);
            sendJson(200, { data: updated, success: true });
            return;
          }
        }

        const sliderActionMatch = url.pathname.match(
          /^\/ecommerce\/storefront\/sliders\/(\d+)\/(activate|deactivate)$/
        );
        if (sliderActionMatch && req.method === "POST") {
          const id = Number(sliderActionMatch[1]);
          const action = sliderActionMatch[2];
          const existing = tSliders.get(id);
          if (!existing) {
            sendJson(404, { error: { message: "Slider not found." }, success: false });
            return;
          }
          existing.status = action === "activate" ? "active" : "inactive";
          sendJson(200, { data: existing, success: true });
          return;
        }

        // Promotions
        if (url.pathname === "/ecommerce/storefront/promotions" && req.method === "GET") {
          sendJson(200, { data: Array.from(tPromotions.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/storefront/promotions" && req.method === "POST") {
          const id = promotionCounter++;
          const rec: PromotionCardRecord = {
            actionLabel: (body.actionLabel as string) ?? "Claim Offer",
            actionUrl: (body.actionUrl as string) ?? "/offers",
            badge: (body.badge as string) ?? "30% OFF",
            badgePosition:
              (body.badgePosition as "top-left" | "top-right" | "bottom-left" | "bottom-right") ??
              "top-right",
            badgeTextColor: (body.badgeTextColor as string) ?? "#ffffff",
            badgeTint: (body.badgeTint as string) ?? "brand",
            createdAt: new Date().toISOString(),
            description: (body.description as string) ?? "Special festival discount",
            displayOrder: 1,
            endsAt: null,
            eyebrow: (body.eyebrow as string) ?? "Festival Special",
            frappeDocumentName: `PRM-${id}`,
            frappeModifiedAt: null,
            id,
            imageUrl: (body.imageUrl as string) ?? "/promos/1.webp",
            ishopItem: null,
            offerPrice: (body.offerPrice as number) ?? 999,
            originalPrice: (body.originalPrice as number) ?? 1499,
            promotionCode: (body.promotionCode as string) ?? `PROMO-${id}`,
            published: true,
            startsAt: null,
            status: "active",
            title: (body.title as string) ?? "Festival Linen Bundle",
            updatedAt: new Date().toISOString(),
            uuid: `prm${id.toString().padStart(4, "0")}`
          };
          tPromotions.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        // Featured Cards
        if (url.pathname === "/ecommerce/storefront/featured-cards" && req.method === "GET") {
          sendJson(200, { data: Array.from(tFeatured.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/storefront/featured-cards" && req.method === "POST") {
          const id = featuredCardCounter++;
          const rec: FeaturedCardRecord = {
            actionLabel: (body.actionLabel as string) ?? "View Item",
            actionUrl: (body.actionUrl as string) ?? "/product/featured",
            badge: (body.badge as string) ?? "Bestseller",
            badgePosition: "top-right",
            badgeTextColor: "#ffffff",
            badgeTint: "#0f766e",
            createdAt: new Date().toISOString(),
            description: (body.description as string) ?? "Featured item",
            displayOrder: 1,
            endsAt: null,
            eyebrow: (body.eyebrow as string) ?? "Editor's Pick",
            featuredCode: (body.featuredCode as string) ?? `FEAT-${id}`,
            frappeDocumentName: `FET-${id}`,
            frappeModifiedAt: null,
            id,
            imageUrl: (body.imageUrl as string) ?? "/featured/1.webp",
            ishopItem: null,
            offerPrice: (body.offerPrice as number) ?? 1299,
            originalPrice: (body.originalPrice as number) ?? 1799,
            published: true,
            startsAt: null,
            status: "active",
            title: (body.title as string) ?? "Classic Linen Blazer",
            updatedAt: new Date().toISOString(),
            uuid: `fet${id.toString().padStart(4, "0")}`
          };
          tFeatured.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        // Season Strips
        if (url.pathname === "/ecommerce/storefront/season-strips" && req.method === "GET") {
          sendJson(200, { data: Array.from(tSeasons.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/storefront/season-strips" && req.method === "POST") {
          const id = seasonStripCounter++;
          const rec: SeasonStripRecord = {
            actionLabel: "Explore Collection",
            actionUrl: "/season",
            badge: "Autumn 2026",
            badgePosition: "top-left",
            badgeTextColor: "#ffffff",
            badgeTint: "brand",
            createdAt: new Date().toISOString(),
            description: "Warm tones and fine weaves.",
            displayOrder: 1,
            endsAt: null,
            eyebrow: "Season Spotlight",
            frappeDocumentName: `SSN-${id}`,
            frappeModifiedAt: null,
            id,
            imageUrl: "/season/1.webp",
            ishopItem: null,
            offerPrice: 0,
            originalPrice: null,
            published: true,
            seasonCode: (body.seasonCode as string) ?? `SEASON-${id}`,
            startsAt: null,
            status: "active",
            title: (body.title as string) ?? "Autumn Breeze Strip",
            updatedAt: new Date().toISOString(),
            uuid: `ssn${id.toString().padStart(4, "0")}`
          };
          tSeasons.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        // Announcements
        if (url.pathname === "/ecommerce/storefront/announcements" && req.method === "GET") {
          sendJson(200, { data: Array.from(tAnnouncements.values()), success: true });
          return;
        }

        if (url.pathname === "/ecommerce/storefront/announcements" && req.method === "POST") {
          const id = announcementCounter++;
          const rec: StorefrontAnnouncementRecord = {
            createdAt: new Date().toISOString(),
            displayDurationMs: (body.displayDurationMs as number) ?? 12000,
            endsAt: null,
            eventKey: `EVENT-${id}`,
            id,
            message: (body.message as string) ?? "Flash Sale Live!",
            startsAt: new Date().toISOString(),
            status: "active",
            updatedAt: new Date().toISOString()
          };
          tAnnouncements.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        // Storefront Profile
        if (url.pathname === "/ecommerce/storefront/profile") {
          if (req.method === "GET") {
            const prof = profiles.get(tenantId) ?? profiles.get("ten-a")!;
            sendJson(200, { data: prof, success: true });
            return;
          }
          if (req.method === "PUT") {
            profiles.set(tenantId, body as unknown as StorefrontProfile);
            sendJson(200, { data: body, success: true });
            return;
          }
        }

        // Storefront Organisation
        if (url.pathname === "/ecommerce/storefront/organisation") {
          if (req.method === "GET") {
            const org = organisations.get(tenantId) ?? organisations.get("ten-a")!;
            sendJson(200, { data: org, success: true });
            return;
          }
          if (req.method === "PUT") {
            organisations.set(tenantId, body as unknown as StorefrontOrganisation);
            sendJson(200, { data: body, success: true });
            return;
          }
        }

        if (url.pathname === "/ecommerce/storefront/organisation/logo" && req.method === "POST") {
          sendJson(200, {
            data: { logoFileName: "d4e5f6a1b2c30718293a4b5c6d7e8f90.png" },
            success: true
          });
          return;
        }

        if (url.pathname === "/ecommerce/storefront/organisation/options" && req.method === "GET") {
          sendJson(200, {
            data: {
              companies: [{ id: 1, label: "Solaris Corp" }],
              financialYears: [{ id: 1, label: "FY 2026-27" }]
            },
            success: true
          });
          return;
        }

        // ==========================================
        // 8. Public Storefront & Core Lookups
        // ==========================================
        if (url.pathname === "/storefront/branding" && req.method === "GET") {
          sendJson(200, {
            data: {
              brandName: "Solaris Textiles",
              logoDarkUrl: "/logos/dark.png",
              logoUrl: "/logos/light.png",
              primaryPhone: "+91 98765 43210"
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/storefront/categories" && req.method === "GET") {
          sendJson(200, {
            data: [
              { name: "Shirts", productCount: 12 },
              { name: "Trousers", productCount: 8 }
            ],
            success: true
          });
          return;
        }

        if (url.pathname === "/storefront/discovery" && req.method === "GET") {
          sendJson(200, {
            data: {
              brands: [
                {
                  logoAlt: "Solaris Heritage",
                  logoUrl: "/brands/solaris.png",
                  name: "Solaris Heritage",
                  productCount: 15
                }
              ],
              categories: [{ name: "Shirts", productCount: 12 }],
              priceRange: { maximum: 5000, minimum: 500 }
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/storefront/bootstrap" && req.method === "GET") {
          sendJson(200, {
            data: {
              announcement: null,
              brandStrips: [
                {
                  logoAlt: "Solaris",
                  logoUrl: "/brands/solaris.png",
                  name: "Solaris",
                  productCount: 10
                }
              ],
              campaignEvents: [],
              discovery: {
                brands: [],
                categories: [{ name: "Shirts", productCount: 5 }],
                priceRange: { maximum: 5000, minimum: 500 }
              },
              featuredCards: [],
              promotions: [],
              seasonStrips: [],
              siteNavigation: null,
              sliders: []
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/storefront/catalog" && req.method === "GET") {
          // Public preview catalog query
          sendJson(200, {
            data: [
              {
                brand: "Solaris Heritage",
                category: "Shirts",
                compareAtPrice: 1999,
                description: "Handcrafted pure linen shirt.",
                featured: true,
                featuredOrder: 1,
                imageAlt: "Linen Shirt",
                imageUrl: "/images/linen.webp",
                name: "Pure Linen Shirt",
                price: 1499,
                shortDescription: "Breathable linen shirt",
                slug: "pure-linen-shirt",
                subtitle: "Summer Staple",
                variantCount: 4
              }
            ],
            success: true
          });
          return;
        }

        const publicProductMatch = url.pathname.match(/^\/storefront\/products\/([^/]+)$/);
        if (publicProductMatch && req.method === "GET") {
          const slug = decodeURIComponent(publicProductMatch[1] ?? "");
          sendJson(200, {
            data: {
              brand: "Solaris Heritage",
              bulletPoints: ["100% European Flax", "Pre-washed for softness"],
              category: "Shirts",
              compareAtPrice: 1999,
              description: "Handcrafted pure linen shirt.",
              featured: true,
              featuredOrder: 1,
              imageAlt: "Linen Shirt",
              imageUrl: "/images/linen.webp",
              name: "Pure Linen Shirt",
              price: 1499,
              returnPolicy: "30-day hassle-free returns",
              shortDescription: "Breathable linen shirt",
              slug,
              subtitle: "Summer Staple",
              variantCount: 4,
              variants: [
                { id: 1, price: 1499, sku: "LINEN-M", title: "M / Natural" },
                { id: 2, price: 1499, sku: "LINEN-L", title: "L / Natural" }
              ],
              warranty: "6 months seam guarantee"
            },
            success: true
          });
          return;
        }

        // Default 404 for unknown endpoints
        sendJson(404, {
          error: { message: `Route ${req.method} ${url.pathname} not found.` },
          success: false
        });
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          serverPort = addr.port;
          serverOrigin = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function createTestEcommerceService(
    options: {
      role?: "admin" | "editor" | "viewer" | undefined;
      tenantId?: string | undefined;
      tenantCode?: string | undefined;
      unauthenticated?: boolean | undefined;
    } = {}
  ): {
    ecommerce: EcommerceService;
    sessionManager: NativeSessionManager;
    transport: NativeHttpTransport;
  } {
    const role = options.role ?? "admin";
    const tenantId = options.tenantId ?? "ten-a";
    const tenantCode = options.tenantCode ?? "TEN-A";

    const sessionManager = new NativeSessionManager({ apiOrigin: serverOrigin });

    const perms =
      role === "admin"
        ? [
            "admin",
            "super-admin",
            "ecommerce.overview.view",
            "ecommerce.catalog.view",
            "ecommerce.catalog.edit",
            "ecommerce.storefront.manage",
            "core.master.product-category.view",
            "core.master.product.view",
            "core.master.brand.view"
          ]
        : role === "editor"
          ? [
              "ecommerce.overview.view",
              "ecommerce.catalog.view",
              "ecommerce.catalog.edit",
              "core.master.product-category.view",
              "core.master.product.view",
              "core.master.brand.view"
            ]
          : ["ecommerce.overview.view"]; // viewer

    const hasPermissionFn = (p: string) => perms.includes(p);

    const transport = new NativeHttpTransport({
      hostVerifier: new HostVerifier({ allowLoopback: true }),
      sessionManager
    });

    if (!options.unauthenticated) {
      const sessionRecord = {
        activeCompanyId: 1,
        activeFinancialYearId: 1,
        authenticated: true,
        context: {
          cachedAt: new Date().toISOString(),
          company: { code: "CORP01", id: 1, name: "Solaris Corp" },
          defaultCompany: {
            companyId: 1,
            companyName: "Solaris Corp",
            financialYearId: 1,
            financialYearName: "FY 2026-27",
            landingApp: "ecommerce"
          },
          enabledModuleKeys: ["ecommerce"],
          landingPage: "/ecommerce",
          safeSettings: {},
          tenant: {
            code: tenantCode,
            id: tenantId,
            name: tenantId === "ten-a" ? "Solaris Textiles" : "Foreign Mart"
          }
        },
        desk: "tenant" as const,
        email: "staff@codexsun.invalid",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        loginHost: "127.0.0.1",
        name: "Ecommerce Staff",
        role,
        sessionGeneration: 1,
        sessionIssuedAt: Date.now(),
        sessionSlot: `slot-ecom-${role}-${tenantId}`,
        tenantCode,
        tenantDbName: `codexsun_${tenantId}`,
        tenantId,
        tenantUuid: tenantId,
        token: `mock-token-${tenantId}`,
        userType: "tenant"
      };

      (
        sessionManager as unknown as { _activeSession: typeof sessionRecord; _status: string }
      )._activeSession = sessionRecord;
      (sessionManager as unknown as { _status: string })._status = "authenticated";
    }

    const ecommerce = new EcommerceService(transport, hasPermissionFn);
    return { ecommerce, sessionManager, transport };
  }

  // ==========================================
  // Test Suite 1: Route Registry & Navigation
  // ==========================================
  it("covers all 22 M0 Ecommerce routes with metadata and section groupings", () => {
    const routeKeys = Object.keys(ECOMMERCE_ROUTE_REGISTRY);
    assert.equal(routeKeys.length, 22, "Must register exactly 22 supported M0 ecommerce routes");

    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.overview"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.catalog"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.product-information"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.product-variants"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.product-images"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.product-attributes"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.product-specifications"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.product-collections"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.catalog-data-source"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.storefront"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.storefront-sliders"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.promotions"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.featured-cards"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.season-strips"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.campaign-events"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.service-banner"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.trusted-strip"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.organisation"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.categories"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.products"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["ecommerce.brands-strip"]);
    assert.ok(ECOMMERCE_ROUTE_REGISTRY["storefront.preview"]);

    // Test permission filtering
    const adminPerms = (_p: string) => true;
    const viewerPerms = (p: string) => p === "ecommerce.overview.view";

    const adminRoutes = getAccessibleEcommerceRoutes(adminPerms);
    assert.equal(adminRoutes.length, 22);

    const viewerRoutes = getAccessibleEcommerceRoutes(viewerPerms);
    assert.equal(viewerRoutes.length, 2); // overview & preview
    assert.ok(hasRequiredEcommercePermission("ecommerce.overview", viewerPerms));
    assert.equal(
      hasRequiredEcommercePermission("ecommerce.product-information", viewerPerms),
      false
    );

    const catalogRoutes = getEcommerceRoutesBySection("catalog", adminPerms);
    assert.ok(catalogRoutes.length >= 6);
  });

  // ==========================================
  // Test Suite 2: Overview & Catalog Health Metrics
  // ==========================================
  it("retrieves overview, starts storefront runtime, and aggregates catalog health metrics", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    const overview = await ecommerce.getOverview();
    assert.equal(overview.appKey, "ecommerce");
    assert.equal(overview.tenantCode, "TEN-A");
    assert.ok(overview.checkedAt);

    const runtimeStatus = await ecommerce.getStorefrontRuntimeStatus();
    assert.equal(runtimeStatus.state, "running");
    assert.equal(runtimeStatus.port, 4200);

    const startResult = await ecommerce.startStorefrontRuntime();
    assert.equal(startResult.state, "running");

    const health = await ecommerce.getCatalogHealthMetrics();
    assert.equal(typeof health.totalProducts, "number");
    assert.equal(typeof health.draftProducts, "number");
    assert.equal(typeof health.publishedProducts, "number");
    assert.equal(typeof health.archivedProducts, "number");
    assert.equal(typeof health.totalVariants, "number");
    assert.equal(typeof health.totalImages, "number");
    assert.equal(health.frappeConfigured, true);
    assert.equal(health.frappeStatus, "live");
  });

  // ==========================================
  // Test Suite 3: Product Information Lifecycle (Draft -> Published -> Archived)
  // ==========================================
  it("executes product information creation, revision conflict rejection, and full publication lifecycle", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    // 1. Lookups
    const coreProducts = await ecommerce.getCoreProductOptions();
    assert.ok(coreProducts.length > 0);
    const coreBrands = await ecommerce.getCoreBrandOptions();
    assert.ok(coreBrands.length > 0);

    // 2. Draft Creation
    const created = await ecommerce.createProductInformation({
      brandId: coreBrands[0]?.id,
      bulletPoints: ["100% Pure Flax", "Machine washable"],
      coreProductId: coreProducts[0]?.id ?? 101,
      countryOfOrigin: "India",
      description: "Premium handcrafted linen shirt.",
      manufacturer: "Solaris Heritage Mills",
      material: "European Linen",
      minimumOrderQuantity: 1,
      publicationStatus: "draft",
      returnPolicy: "30-day exchange or refund",
      seoDescription: "Shop pure linen shirt online.",
      seoTitle: "Pure Linen Shirt - Solaris",
      shippingClass: "standard",
      shortDescription: "Breathable linen shirt for everyday wear.",
      slug: "solaris-pure-linen-shirt",
      storefrontTitle: "Solaris Pure Linen Shirt",
      subtitle: "Comfort in every thread",
      warranty: "6 months stitching warranty",
      weight: 220
    });

    assert.equal(created.storefrontTitle, "Solaris Pure Linen Shirt");
    assert.equal(created.slug, "solaris-pure-linen-shirt");
    assert.equal(created.publicationStatus, "draft");
    assert.equal(created.revision, 1);

    // 3. Retrieval
    const fetched = await ecommerce.getProductInformation(created.id);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.storefrontTitle, created.storefrontTitle);

    // 4. Concurrency conflict rejection
    await assert.rejects(
      async () => {
        await ecommerce.updateProductInformation(created.id, {
          ...created,
          expectedRevision: 999, // Stale revision
          storefrontTitle: "Conflict Attempt"
        });
      },
      (err: Error) => {
        assert.ok(err instanceof PlatformApiError);
        assert.equal((err as PlatformApiError).statusCode, 409);
        return true;
      }
    );

    // 5. Valid update
    const updated = await ecommerce.updateProductInformation(created.id, {
      ...created,
      expectedRevision: 1,
      storefrontTitle: "Solaris Classic Pure Linen Shirt"
    });
    assert.equal(updated.storefrontTitle, "Solaris Classic Pure Linen Shirt");
    assert.equal(updated.revision, 2);

    // 6. Publication: Draft -> Published
    const published = await ecommerce.publishProductInformation(created.id, 2, updated);
    assert.equal(published.publicationStatus, "published");
    assert.equal(published.revision, 3);

    // 7. Unpublish: Published -> Draft
    const unpublished = await ecommerce.unpublishProductInformation(created.id, 3, published);
    assert.equal(unpublished.publicationStatus, "draft");
    assert.equal(unpublished.revision, 4);

    // 8. Archival: Draft -> Archived
    const archived = await ecommerce.archiveProductInformation(created.id);
    assert.equal(archived.publicationStatus, "archived");

    // 9. Filtered List
    const list = await ecommerce.listProductInformation({ status: "archived" });
    assert.ok(list.items.some((p) => p.id === created.id));
    assert.ok(list.statusCounts.archived >= 1);
  });

  // ==========================================
  // Test Suite 4: Product Variants
  // ==========================================
  it("manages product variants: SKU, attributes, pricing adjustments, weight, and activation toggle", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    // Lookups
    const variantProductOptions = await ecommerce.getVariantProductOptions();
    assert.ok(Array.isArray(variantProductOptions));

    // Create variant
    const variant = await ecommerce.createProductVariant({
      barcode: "8901234567890",
      compareAtAdjustment: 200,
      costAdjustment: 100,
      option1Name: "Size",
      option1Value: "XL",
      option2Name: "Color",
      option2Value: "Olive Green",
      priceAdjustment: 150,
      productInformationId: 1,
      sku: "LINEN-XL-OLIVE",
      sortOrder: 10,
      status: "active",
      title: "XL / Olive Green",
      weight: 240
    });

    assert.equal(variant.sku, "LINEN-XL-OLIVE");
    assert.equal(variant.option1Value, "XL");
    assert.equal(variant.option2Value, "Olive Green");
    assert.equal(variant.priceAdjustment, 150);
    assert.equal(variant.status, "active");

    // Fetch
    const fetched = await ecommerce.getProductVariant(variant.id);
    assert.equal(fetched.id, variant.id);

    // Update
    const updated = await ecommerce.updateProductVariant(variant.id, {
      ...variant,
      priceAdjustment: 175
    });
    assert.equal(updated.priceAdjustment, 175);

    // Deactivate
    const deactivated = await ecommerce.deactivateProductVariant(variant.id);
    assert.equal(deactivated.status, "inactive");

    // Reactivate
    const reactivated = await ecommerce.activateProductVariant(variant.id);
    assert.equal(reactivated.status, "active");

    // Listing
    const page = await ecommerce.listProductVariants({ sku: "LINEN-XL" });
    assert.ok(page.items.some((v) => v.id === variant.id));
    assert.ok(page.statusCounts.active >= 1);
  });

  // ==========================================
  // Test Suite 5: Product Images (Upload, Reorder, Primary Exclusivity)
  // ==========================================
  it("manages product images: base64 upload, primary flag exclusivity, sequential reordering, and status toggle", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    // Lookups
    const prodOpts = await ecommerce.getImageProductOptions();
    assert.ok(Array.isArray(prodOpts));
    const varOpts = await ecommerce.getImageVariantOptions();
    assert.ok(Array.isArray(varOpts));

    // 1. Upload base64 image
    const uploadRes = await ecommerce.uploadProductImage(
      "shirt-front.webp",
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    );
    assert.equal(uploadRes.fileName, "shirt-front.webp");
    assert.ok(uploadRes.url.includes("shirt-front.webp"));

    // 2. Create image 1 (primary)
    const img1 = await ecommerce.createProductImage({
      altText: "Shirt Front View",
      caption: "Front Angle",
      isPrimary: true,
      productInformationId: 1,
      sortOrder: 10,
      status: "active",
      url: uploadRes.url
    });
    assert.equal(img1.isPrimary, true);

    // 3. Create image 2 (non-primary)
    const img2 = await ecommerce.createProductImage({
      altText: "Shirt Back View",
      caption: "Back Angle",
      isPrimary: false,
      productInformationId: 1,
      sortOrder: 20,
      status: "active",
      url: "/images/shirt-back.webp"
    });
    assert.equal(img2.isPrimary, false);

    // 4. Primary exclusivity switch
    await ecommerce.setPrimaryProductImage(1, img2.id);
    const updatedImg1 = await ecommerce.getProductImage(img1.id);
    const updatedImg2 = await ecommerce.getProductImage(img2.id);
    assert.equal(updatedImg2.isPrimary, true, "Image 2 should now be primary");
    assert.equal(updatedImg1.isPrimary, false, "Image 1 should no longer be primary");

    // 5. Reordering
    await ecommerce.reorderProductImages(1, [img2.id, img1.id]);
    const reorderedImg2 = await ecommerce.getProductImage(img2.id);
    const reorderedImg1 = await ecommerce.getProductImage(img1.id);
    assert.equal(reorderedImg2.sortOrder, 10);
    assert.equal(reorderedImg1.sortOrder, 20);

    // 6. Deactivate & Activate
    const deactivated = await ecommerce.deactivateProductImage(img1.id);
    assert.equal(deactivated.status, "inactive");
    const reactivated = await ecommerce.activateProductImage(img1.id);
    assert.equal(reactivated.status, "active");
  });

  // ==========================================
  // Test Suite 6: Attributes, Specifications & Collections
  // ==========================================
  it("manages product attributes, assignments, specifications, and collections with assigned items", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    // Attributes
    const attr = await ecommerce.createProductAttribute({
      code: "color_swatch",
      dataType: "color",
      isFilterable: true,
      name: "Color Swatch",
      sortOrder: 10,
      status: "active",
      unit: ""
    });
    assert.equal(attr.code, "color_swatch");
    const updatedAttr = await ecommerce.updateProductAttribute(attr.id, {
      code: "color_swatch",
      dataType: "color",
      expectedRevision: attr.revision,
      isFilterable: true,
      name: "Colour swatch",
      sortOrder: 20,
      status: "active",
      unit: ""
    });
    assert.equal(updatedAttr.name, "Colour swatch");
    assert.equal(updatedAttr.revision, 2);
    await assert.rejects(
      () =>
        ecommerce.updateProductAttribute(attr.id, {
          code: "color_swatch",
          dataType: "color",
          expectedRevision: attr.revision,
          name: "Stale swatch"
        }),
      (err: unknown) => err instanceof PlatformApiError && err.statusCode === 409
    );

    const assigned = await ecommerce.assignProductAttributes(1, [
      { attributeId: attr.id, values: ["#FFFFFF", "#000000"] }
    ]);
    assert.ok(assigned.length > 0);

    const fetchedAssignments = await ecommerce.getProductAttributeAssignments(1);
    assert.ok(fetchedAssignments.length > 0);

    // Specifications
    const spec = await ecommerce.createProductSpecification({
      label: "Thread count",
      productInformationId: 1,
      sortOrder: 10,
      status: "active",
      value: "400"
    });
    assert.equal(spec.label, "Thread count");
    const updatedSpec = await ecommerce.updateProductSpecification(spec.id, {
      expectedRevision: spec.revision,
      label: "Thread count",
      productInformationId: 1,
      sortOrder: 20,
      status: "active",
      value: "500"
    });
    assert.equal(updatedSpec.value, "500");
    assert.equal(updatedSpec.revision, 2);
    await assert.rejects(
      () =>
        ecommerce.updateProductSpecification(spec.id, {
          expectedRevision: spec.revision,
          label: "Thread count",
          productInformationId: 1,
          value: "600"
        }),
      (err: unknown) => err instanceof PlatformApiError && err.statusCode === 409
    );

    // Collections
    const coll = await ecommerce.createProductCollection({
      description: "Our handpicked favorites for warm climates.",
      heroImageUrl: "/collections/summer.webp",
      publicationStatus: "published",
      slug: "summer-breeze",
      title: "Summer Breeze Collection"
    });
    assert.equal(coll.slug, "summer-breeze");
    const updatedCollection = await ecommerce.updateProductCollection(coll.id, {
      expectedRevision: coll.revision,
      publicationStatus: "published",
      slug: "summer-breeze",
      title: "Summer Breeze"
    });
    assert.equal(updatedCollection.title, "Summer Breeze");
    assert.equal(updatedCollection.revision, 2);
    await assert.rejects(
      () =>
        ecommerce.updateProductCollection(coll.id, {
          expectedRevision: coll.revision,
          slug: "summer-breeze",
          title: "Stale breeze"
        }),
      (err: unknown) => err instanceof PlatformApiError && err.statusCode === 409
    );

    const collWithItems = await ecommerce.assignCollectionItems(coll.id, [1, 2]);
    assert.equal(collWithItems.itemCount, 2);
  });

  // ==========================================
  // Test Suite 7: Catalog Data Source (Frappe Sync & Supplier Integration)
  // ==========================================
  it("manages catalog data source settings, provider switching, visibility toggles, and Frappe sync pull/push", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    const settings = await ecommerce.getCatalogDataSourceSettings();
    assert.equal(settings.frappeConfigured, true);
    assert.equal(settings.verificationStatus, "live");

    const switchedProvider = await ecommerce.switchDataSourceProvider("products", "frappe");
    assert.ok(
      switchedProvider.modules.some((m) => m.module === "products" && m.provider === "frappe")
    );

    const switchedVisibility = await ecommerce.switchDataSourceVisibility("products", false);
    assert.ok(
      switchedVisibility.modules.some((m) => m.module === "products" && m.enabled === false)
    );

    const connTest = await ecommerce.testDataSourceConnection("frappe");
    assert.equal(connTest.connected, true);
    assert.ok(connTest.latencyMs >= 0);

    const pullResult = await ecommerce.syncPullFromFrappe();
    assert.equal(pullResult.direction, "frappe-to-own");
    assert.equal(pullResult.items, 14);

    const pushResult = await ecommerce.syncPushToFrappe();
    assert.equal(pushResult.direction, "own-to-frappe");
    assert.equal(pushResult.items, 8);

    const frappeItems = await ecommerce.searchFrappeItems("shirt");
    assert.ok(frappeItems.length > 0);
    assert.equal(frappeItems[0]?.item_code, "FRP-ITEM-01");

    const itemDetail = await ecommerce.getFrappeItem("FRP-ITEM-01");
    assert.equal(itemDetail.item_code, "FRP-ITEM-01");
  });

  // ==========================================
  // Test Suite 8: Storefront Components (Sliders, Promotions, Featured, Season, Announcements)
  // ==========================================
  it("manages storefront components: sliders, promotions, featured cards, season strips, announcements, trust strip, and service banner", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    // 1. Slider
    const sliderImg = await ecommerce.uploadStorefrontSliderImage("hero-sale.webp", "base64data");
    assert.equal(sliderImg.fileName, "hero-sale.webp");

    const slider = await ecommerce.createStorefrontSlider({
      actionLabel: "Shop Sale",
      actionUrl: "/sale",
      description: "Midseason exclusive discounts",
      displayOrder: 1,
      eyebrow: "Limited Time",
      imageUrl: "/sliders/hero-sale.webp",
      published: true,
      sliderCode: "SLIDER-SUMMER",
      status: "active",
      title: "Midseason Clearance"
    });
    assert.equal(slider.sliderCode, "SLIDER-SUMMER");

    const deactivatedSlider = await ecommerce.deactivateStorefrontSlider(slider.id);
    assert.equal(deactivatedSlider.status, "inactive");

    const activatedSlider = await ecommerce.activateStorefrontSlider(slider.id);
    assert.equal(activatedSlider.status, "active");

    // 2. Promotion Card
    const promo = await ecommerce.createPromotionCard({
      actionLabel: "Get Deal",
      actionUrl: "/deals",
      badge: "Save 25%",
      badgePosition: "top-right",
      badgeTextColor: "#ffffff",
      badgeTint: "brand",
      description: "Bundle discount for linen shirts",
      displayOrder: 1,
      eyebrow: "Bundle Offer",
      imageUrl: "/promos/bundle.webp",
      offerPrice: 1999,
      originalPrice: 2699,
      promotionCode: "BUNDLE-25",
      published: true,
      status: "active",
      title: "Twin Pack Linen"
    });
    assert.equal(promo.promotionCode, "BUNDLE-25");
    assert.equal(promo.offerPrice, 1999);

    // 3. Featured Card
    const featured = await ecommerce.createFeaturedCard({
      actionLabel: "View Blazer",
      actionUrl: "/products/linen-blazer",
      badge: "Trending",
      badgePosition: "top-right",
      badgeTextColor: "#ffffff",
      badgeTint: "#0f766e",
      description: "Structured silhouette with relaxed feel",
      displayOrder: 1,
      eyebrow: "Editor Choice",
      featuredCode: "FEAT-BLAZER",
      imageUrl: "/featured/blazer.webp",
      offerPrice: 3499,
      originalPrice: 4499,
      published: true,
      status: "active",
      title: "Linen Notch Blazer"
    });
    assert.equal(featured.featuredCode, "FEAT-BLAZER");

    // 4. Season Strip
    const season = await ecommerce.createSeasonStrip({
      actionLabel: "Explore Festive",
      actionUrl: "/festive",
      badge: "Diwali 2026",
      badgePosition: "top-left",
      badgeTextColor: "#ffffff",
      badgeTint: "brand",
      description: "Celebration collection with hand-spun threads",
      displayOrder: 1,
      eyebrow: "Festive Edit",
      imageUrl: "/season/festive.webp",
      offerPrice: 0,
      published: true,
      seasonCode: "FESTIVE-2026",
      status: "active",
      title: "Festive Splendor Strip"
    });
    assert.equal(season.seasonCode, "FESTIVE-2026");

    // 5. Storefront Announcement / Campaign Events
    const announcement = await ecommerce.createStorefrontAnnouncement({
      displayDurationMs: 15000,
      message: "Mega Summer Fest Live Now! Flat 20% Off Storewide.",
      status: "active"
    });
    assert.equal(announcement.displayDurationMs, 15000);
    assert.ok(announcement.message.includes("Mega Summer Fest"));

    // 6. Storefront Profile (Trust Strip & Service Banner)
    const profile = await ecommerce.getStorefrontProfile();
    assert.ok(profile.trustedProofPoints.includes("Free Delivery"));
    assert.equal(profile.serviceTitle, "24/7 Support Desk");

    const updatedProfile = await ecommerce.updateStorefrontProfile({
      ...profile,
      serviceTitle: "Priority 24/7 Customer Care",
      trustedTitle: "Certified Quality Assurance"
    });
    assert.equal(updatedProfile.serviceTitle, "Priority 24/7 Customer Care");
    assert.equal(updatedProfile.trustedTitle, "Certified Quality Assurance");
  });

  // ==========================================
  // Test Suite 9: Organization Profile & Branding
  // ==========================================
  it("manages organisation profile, brand settings, logo upload, and organisation options", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    const org = await ecommerce.getStorefrontOrganisation();
    assert.equal(org.displayName, "Solaris Textiles Private Limited");

    const orgOptions = await ecommerce.getStorefrontOrganisationOptions();
    assert.ok(orgOptions.companies.length > 0);
    assert.ok(orgOptions.financialYears.length > 0);

    const logoRes = await ecommerce.uploadStorefrontOrganisationLogo("base64pngdata");
    assert.ok(logoRes.logoFileName.endsWith(".png"));

    const updatedOrg = await ecommerce.updateStorefrontOrganisation({
      companyId: 1,
      displayName: "Solaris Global Textiles Ltd.",
      financialYearId: 1,
      logoFileName: logoRes.logoFileName
    });
    assert.equal(updatedOrg.displayName, "Solaris Global Textiles Ltd.");

    const branding = await ecommerce.getStorefrontBranding();
    assert.equal(branding.brandName, "Solaris Textiles");
    assert.ok(branding.primaryPhone);
  });

  // ==========================================
  // Test Suite 10: Core Lookups & Storefront Discovery
  // ==========================================
  it("loads public categories, catalog discovery, bootstrap configuration, and product detail", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin" });

    const categories = await ecommerce.getCategories();
    assert.ok(categories.length > 0);
    assert.ok(categories[0]?.productCount);

    const discovery = await ecommerce.getDiscovery();
    assert.ok(discovery.brands.length > 0);
    assert.ok(discovery.priceRange.maximum >= discovery.priceRange.minimum);

    const bootstrap = await ecommerce.getBootstrap();
    assert.ok(bootstrap.brandStrips);
    assert.ok(bootstrap.discovery);

    const catalog = await ecommerce.getCatalog({ category: "Shirts" });
    assert.ok(catalog.length > 0);
    assert.equal(catalog[0]?.name, "Pure Linen Shirt");

    const detail = await ecommerce.getProductDetail("pure-linen-shirt");
    assert.equal(detail.slug, "pure-linen-shirt");
    assert.ok(detail.bulletPoints.length > 0);
    assert.ok(detail.variants.length > 0);
  });

  // ==========================================
  // Test Suite 11: Customer Storefront Preview (Isolated without Staff Credentials)
  // ==========================================
  it("generates customer preview with tenant domain binding without forwarding staff credentials", async () => {
    const { ecommerce } = createTestEcommerceService({ role: "admin", tenantCode: "TEN-A" });

    // Test direct helper and service method
    const helperConfig = buildStorefrontPreviewConfig(
      serverOrigin,
      "TEN-A",
      "solaris-textiles.localhost"
    );
    assert.equal(helperConfig.credentialsForwarded, false);

    const previewConfig = ecommerce.getStorefrontPreviewConfig(
      serverOrigin,
      "TEN-A",
      "solaris-textiles.localhost"
    );

    assert.equal(previewConfig.previewMode, true);
    assert.equal(previewConfig.credentialsForwarded, false);
    assert.equal(previewConfig.tenantCode, "TEN-A");
    assert.equal(previewConfig.tenantDomain, "solaris-textiles.localhost");

    // Guarantee that staff session tokens and auth cookies are NOT in preview headers
    assert.equal(previewConfig.headers["Authorization"], undefined);
    assert.equal(previewConfig.headers["x-codexsun-session-slot"], undefined);
    assert.equal(previewConfig.headers["cookie"], undefined);
    assert.equal(previewConfig.headers["x-storefront-preview"], "true");

    // Execute preview catalog query
    const previewProducts = await ecommerce.previewStorefrontCatalog({
      category: "Shirts",
      tenantDomain: "solaris-textiles.localhost"
    });
    assert.ok(previewProducts.length > 0);
  });

  // ==========================================
  // Test Suite 12: AUDIT A14 Boundary Preservation (Local Cart Preview vs EC1 Exclusion)
  // ==========================================
  it("preserves AUDIT A14 boundary: local client shopping cart functions while server checkout/payments throw boundary violation", () => {
    const cart = new StorefrontPreviewCartManager();

    // 1. Local cart operations
    cart.addItem({
      imageAlt: "Pure Linen Shirt",
      imageUrl: "/images/shirt.webp",
      name: "Pure Linen Shirt",
      price: 1499,
      quantity: 1,
      slug: "pure-linen-shirt"
    });

    cart.addItem({
      imageAlt: "Oxford Trouser",
      imageUrl: "/images/trouser.webp",
      name: "Oxford Trouser",
      price: 1899,
      quantity: 2,
      slug: "oxford-trouser"
    });

    let state = cart.getState();
    assert.equal(state.totalCount, 3);
    assert.equal(state.subtotal, 1499 + 1899 * 2);
    assert.equal(state.isServerCheckoutSupported, false);

    // Update quantity
    cart.updateQuantity("pure-linen-shirt", 3);
    state = cart.getState();
    assert.equal(state.totalCount, 5);

    // Remove item
    cart.removeItem("oxford-trouser");
    state = cart.getState();
    assert.equal(state.items.length, 1);
    assert.equal(state.totalCount, 3);

    // Clear
    cart.clear();
    assert.equal(cart.getState().totalCount, 0);

    // 2. AUDIT A14 Boundary Enforcement: server checkout, payment, stock reservation are forbidden
    assert.throws(
      () => assertStaffParityBoundary("checkout"),
      (err: Error) => {
        assert.ok(err instanceof EcommerceBoundaryViolationError);
        assert.equal(err.attemptedAction, "checkout");
        assert.equal(err.targetPhase, "EC1");
        return true;
      }
    );

    assert.throws(
      () => assertStaffParityBoundary("payment"),
      (err: Error) => {
        assert.ok(err instanceof EcommerceBoundaryViolationError);
        assert.equal(err.attemptedAction, "payment");
        assert.equal(err.targetPhase, "EC1");
        return true;
      }
    );

    assert.throws(
      () => assertStaffParityBoundary("stock_reservation"),
      (err: Error) => {
        assert.ok(err instanceof EcommerceBoundaryViolationError);
        assert.equal(err.attemptedAction, "stock_reservation");
        assert.equal(err.targetPhase, "EC1");
        return true;
      }
    );
  });

  // ==========================================
  // Test Suite 13: Negative Tests (Unauthenticated, Permission Denial, Tenant Isolation)
  // ==========================================
  it("enforces negative security: unauthenticated rejection, permission denial, and cross-tenant isolation", async () => {
    // 1. Unauthenticated request -> 401
    const { ecommerce: unauthEcommerce } = createTestEcommerceService({ unauthenticated: true });
    await assert.rejects(
      async () => {
        await unauthEcommerce.getOverview();
      },
      (err: Error) => {
        assert.ok(err instanceof PlatformApiError);
        assert.equal((err as PlatformApiError).statusCode, 401);
        return true;
      }
    );

    // 2. Unauthorized publishing / editing transition -> EcommercePermissionDeniedError
    const { ecommerce: viewerEcommerce } = createTestEcommerceService({ role: "viewer" });

    assert.throws(
      () => {
        assertEcommercePermission(
          "ecommerce.catalog.edit",
          () => false,
          "ecommerce.product-information"
        );
      },
      (err: Error) => {
        assert.ok(err instanceof EcommercePermissionDeniedError);
        assert.equal(err.requiredPermission, "ecommerce.catalog.edit");
        assert.equal(err.routeKey, "ecommerce.product-information");
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await viewerEcommerce.createProductInformation({
          coreProductId: 101,
          slug: "unauthorized-product",
          storefrontTitle: "Unauthorized Product"
        });
      },
      (err: Error) => {
        assert.ok(err instanceof EcommercePermissionDeniedError);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await viewerEcommerce.createStorefrontSlider({
          sliderCode: "UNAUTHORIZED-SLIDER",
          title: "Unauthorized"
        });
      },
      (err: Error) => {
        assert.ok(err instanceof EcommercePermissionDeniedError);
        return true;
      }
    );

    // 3. Foreign tenant catalog isolation: Tenant A cannot access Tenant B's catalog record
    const { ecommerce: tenantAEcommerce } = createTestEcommerceService({
      role: "admin",
      tenantCode: "TEN-A",
      tenantId: "ten-a"
    });
    const { ecommerce: tenantBEcommerce } = createTestEcommerceService({
      role: "admin",
      tenantCode: "TEN-B",
      tenantId: "ten-b"
    });

    // Create item in Tenant B
    const tenantBProduct = await tenantBEcommerce.createProductInformation({
      coreProductId: 102,
      slug: "tenant-b-exclusive",
      storefrontTitle: "Tenant B Secret Line"
    });
    assert.ok(tenantBProduct.id > 0);

    // Tenant A attempts to read Tenant B's product -> 404 Not Found
    await assert.rejects(
      async () => {
        await tenantAEcommerce.getProductInformation(tenantBProduct.id);
      },
      (err: Error) => {
        assert.ok(err instanceof PlatformApiError);
        assert.equal((err as PlatformApiError).statusCode, 404);
        return true;
      }
    );

    // Tenant A attempts to update Tenant B's product -> 404 Not Found
    await assert.rejects(
      async () => {
        await tenantAEcommerce.updateProductInformation(tenantBProduct.id, {
          ...tenantBProduct,
          expectedRevision: 1,
          storefrontTitle: "Tenant A Tamper Attempt"
        });
      },
      (err: Error) => {
        assert.ok(err instanceof PlatformApiError);
        assert.equal((err as PlatformApiError).statusCode, 404);
        return true;
      }
    );
  });
});
