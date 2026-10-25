import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  storefrontOrganisationModule,
  type StorefrontCompanyLogoReader
} from "../storefront-organisation/index.js";
import type { FrappeSettings } from "@codexsun/frappe-api";
import { productInformationModule } from "../product-information/product-information.module.js";
import { productAttributeModule } from "../product-attribute/product-attribute.module.js";
import { productSpecificationModule } from "../product-specification/product-specification.module.js";
import { productCollectionModule } from "../product-collection/product-collection.module.js";
import { registerProductCollectionPublicRoutes } from "../product-collection/product-collection.routes.js";
import { productVariantModule } from "../product-variant/product-variant.module.js";
import { productImageModule } from "../product-image/product-image.module.js";
import { registerProductImagePublicRoutes } from "../product-image/product-image.routes.js";
import { storefrontSliderModule } from "../storefront-slider/storefront-slider.module.js";
import { registerStorefrontSliderImageRoutes } from "../storefront-slider/storefront-slider.image-routes.js";
import { promotionCardModule } from "../promotion-card/promotion-card.module.js";
import { featuredCardModule } from "../featured-card/featured-card.module.js";
import { seasonStripModule } from "../season-strip/season-strip.module.js";
import { storefrontAnnouncementModule } from "../storefront-announcement/storefront-announcement.module.js";
import { registerStorefrontAnnouncementPublicRoutes } from "../storefront-announcement/storefront-announcement.routes.js";
import { registerStorefrontProfilePublicRoutes } from "../storefront-profile/storefront-profile.routes.js";
import { storefrontProfileModule } from "../storefront-profile/storefront-profile.module.js";
import { catalogMatchingModule } from "../catalog-matching/catalog-matching.module.js";
import { CatalogDataSourceService } from "../catalog-data-source/catalog-data-source.service.js";
import { createCatalogDataSourceControl } from "../catalog-data-source/catalog-data-source.control.js";
import { registerCatalogDataSourceRoutes } from "../catalog-data-source/catalog-data-source.routes.js";
import { StorefrontService } from "../storefront/storefront.service.js";
import { registerStorefrontRoutes } from "../storefront/storefront.routes.js";

export const ecommerceModuleKeys = [
  productInformationModule.key,
  productAttributeModule.key,
  productSpecificationModule.key,
  productCollectionModule.key,
  productVariantModule.key,
  productImageModule.key,
  storefrontSliderModule.key,
  promotionCardModule.key,
  featuredCardModule.key,
  seasonStripModule.key,
  storefrontAnnouncementModule.key,
  catalogMatchingModule.key,
  storefrontProfileModule.key,
  storefrontOrganisationModule.key,
  "ecommerce.catalog.data-source",
  "ecommerce.storefront.public"
] as const;

export async function registerEcommerceStaffModules(
  app: FastifyInstance,
  encryptionSecret: string,
  frappeSettings: FrappeSettings,
  resolveActorEmail: (request: FastifyRequest) => string
) {
  await productInformationModule.register(app, resolveActorEmail);
  await productAttributeModule.register(app, resolveActorEmail);
  await productSpecificationModule.register(app, resolveActorEmail);
  await productCollectionModule.register(app, resolveActorEmail);
  await productVariantModule.register(app);
  await productImageModule.register(app);
  await storefrontSliderModule.register(app);
  await promotionCardModule.register(app);
  await featuredCardModule.register(app);
  await seasonStripModule.register(app);
  await storefrontAnnouncementModule.register(app);
  await catalogMatchingModule.register(app);
  await storefrontProfileModule.register(app, resolveActorEmail);
  await storefrontOrganisationModule.register(app, resolveActorEmail);
  const control = createCatalogDataSourceControl(encryptionSecret, frappeSettings);
  await registerCatalogDataSourceRoutes(
    app,
    () => new CatalogDataSourceService(control),
    resolveActorEmail
  );
}

export async function registerEcommercePublicModules(
  app: FastifyInstance,
  encryptionSecret: string,
  frappeSettings: FrappeSettings,
  readCompanyLogo?: StorefrontCompanyLogoReader
) {
  const control = createCatalogDataSourceControl(encryptionSecret, frappeSettings);
  await registerStorefrontRoutes(
    app,
    () => new StorefrontService(new CatalogDataSourceService(control)),
    readCompanyLogo
  );
  await registerStorefrontAnnouncementPublicRoutes(app);
  await registerStorefrontProfilePublicRoutes(app);
  await registerProductImagePublicRoutes(app);
  await registerStorefrontSliderImageRoutes(app);
  await registerProductCollectionPublicRoutes(app);
}
