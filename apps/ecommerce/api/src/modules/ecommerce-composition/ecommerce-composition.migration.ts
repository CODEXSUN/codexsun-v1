import type { Kysely } from "kysely";
import {
  migrateStorefrontOrganisation,
  upgradeStorefrontOrganisationBranding
} from "../storefront-organisation/index.js";
import { runMigrationBatch, type MigrationBatch } from "@codexsun/framework/db";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";
import {
  migrateProductInformationModule,
  upgradeProductInformationDetails,
  upgradeProductInformationRevision
} from "../product-information/product-information.migration.js";
import {
  migrateProductVariantModule,
  upgradeProductVariantCanonicalOptions,
  upgradeProductVariantOptions
} from "../product-variant/product-variant.migration.js";
import {
  migrateProductAttributeModule,
  upgradeProductAttributeRevision
} from "../product-attribute/product-attribute.migration.js";
import {
  migrateProductSpecificationModule,
  upgradeProductSpecificationRevision
} from "../product-specification/product-specification.migration.js";
import { migrateProductCollectionModule } from "../product-collection/product-collection.migration.js";
import { migrateCatalogActivityModule } from "../catalog-activity/catalog-activity.migration.js";
import { migrateProductImageModule } from "../product-image/product-image.migration.js";
import { migrateStorefrontSliderModule } from "../storefront-slider/storefront-slider.migration.js";
import {
  migratePromotionCardModule,
  upgradePromotionCardBadgeTextColor
} from "../promotion-card/promotion-card.migration.js";
import { migrateFeaturedCardModule } from "../featured-card/featured-card.migration.js";
import {
  migrateSeasonStripModule,
  upgradeStorefrontSectionVisibility
} from "../season-strip/season-strip.migration.js";
import { migrateStorefrontAnnouncementModule } from "../storefront-announcement/storefront-announcement.migration.js";
import {
  migrateStorefrontProfileModule,
  upgradeStorefrontProfileSocialLinks,
  upgradeStorefrontProfileUxContent,
  upgradeStorefrontProfilePaymentMethods
} from "../storefront-profile/storefront-profile.migration.js";
import {
  migrateCatalogMatchingModule,
  upgradeCatalogMatchingUuidWidth
} from "../catalog-matching/catalog-matching.migration.js";
import {
  migrateCatalogDataSourceSync,
  upgradeCatalogDataSourceAudit,
  migrateCatalogModuleDataSources,
  upgradeCatalogStorefrontSourceCompatibility,
  upgradeCatalogStorefrontUxSources,
  upgradeCatalogStorefrontErpnextLinks,
  upgradeCatalogDataSourceCompatibility,
  upgradeCatalogDataSourceSeedCompatibility,
  upgradeCatalogStorefrontSlider
} from "../catalog-data-source/catalog-data-source.migration.js";
import { standardizeStorefrontSchema } from "../storefront/storefront-schema.migration.js";
import { upgradeStorefrontReadPerformance } from "../storefront/storefront-performance.migration.js";

// Versions 1-34 are the committed 27135c9a ledger. They are immutable: tenants may already
// have recorded them, so new forward steps are appended at 35 and above without renumbering.
const steps = [
  ["product-information", migrateProductInformationModule],
  ["product-information-details", upgradeProductInformationDetails],
  ["product-information-revision", upgradeProductInformationRevision],
  ["product-variant", migrateProductVariantModule],
  ["product-variant-options", upgradeProductVariantOptions],
  ["product-variant-canonical-options", upgradeProductVariantCanonicalOptions],
  ["product-image", migrateProductImageModule],
  ["storefront-slider", migrateStorefrontSliderModule],
  ["promotion-card", migratePromotionCardModule],
  ["promotion-card-badge", upgradePromotionCardBadgeTextColor],
  ["featured-card", migrateFeaturedCardModule],
  ["season-strip", migrateSeasonStripModule],
  ["storefront-announcement", migrateStorefrontAnnouncementModule],
  ["storefront-profile", migrateStorefrontProfileModule],
  ["storefront-profile-social", upgradeStorefrontProfileSocialLinks],
  ["storefront-profile-content", upgradeStorefrontProfileUxContent],
  ["storefront-profile-payments", upgradeStorefrontProfilePaymentMethods],
  ["catalog-matching", migrateCatalogMatchingModule],
  ["catalog-matching-uuid", upgradeCatalogMatchingUuidWidth],
  ["catalog-data-source", migrateCatalogDataSourceSync],
  ["catalog-data-source-audit", upgradeCatalogDataSourceAudit],
  ["catalog-module-sources", migrateCatalogModuleDataSources],
  ["catalog-source-compatibility", upgradeCatalogStorefrontSourceCompatibility],
  ["catalog-ux-sources", upgradeCatalogStorefrontUxSources],
  ["catalog-erpnext-links", upgradeCatalogStorefrontErpnextLinks],
  ["catalog-cache-compatibility", upgradeCatalogDataSourceCompatibility],
  ["catalog-cache-seed-compatibility", upgradeCatalogDataSourceSeedCompatibility],
  ["catalog-storefront-slider", upgradeCatalogStorefrontSlider],
  ["storefront-section-visibility", upgradeStorefrontSectionVisibility],
  ["storefront-schema", standardizeStorefrontSchema],
  ["storefront-performance", upgradeStorefrontReadPerformance],
  ["legacy-cleanup", preserveLegacyEcommerceTables],
  ["storefront-organisation", migrateStorefrontOrganisation],
  ["storefront-organisation-branding", upgradeStorefrontOrganisationBranding],
  ["product-attribute", migrateProductAttributeModule],
  ["product-attribute-revision", upgradeProductAttributeRevision],
  ["product-specification", migrateProductSpecificationModule],
  ["product-specification-revision", upgradeProductSpecificationRevision],
  ["product-collection", migrateProductCollectionModule],
  ["catalog-activity", migrateCatalogActivityModule]
] as const;
const versionedSteps = steps.map(([name, up], index) => ({
  name: `ecommerce.modules.${name}`,
  description: `Migrate ecommerce ${name}.`,
  checksum: `ecommerce.modules.${name}:v1`,
  version: index + 1,
  up
}));
const sourcePreferenceStep = versionedSteps.find(
  (step) => step.name === "ecommerce.modules.catalog-module-sources"
);
if (!sourcePreferenceStep) throw new Error("Ecommerce source preference migration is missing.");
const orderedSteps = [
  ...versionedSteps.slice(0, 2),
  sourcePreferenceStep,
  ...versionedSteps.slice(2).filter((step) => step !== sourcePreferenceStep)
];

const batch: MigrationBatch<EcommerceDatabase> = {
  batch: 1,
  scope: "ecommerce.modules",
  description: "Install Ecommerce modules while preserving legacy catalog and quote data.",
  version: "1.0.85",
  steps: orderedSteps
};

export const ecommerceTenantMigrations = batch.steps.map(({ name, description }) => ({
  name,
  description
}));

export const ecommerceTenantMigrationVersions: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(batch.steps.map(({ name, version }) => [name, version]))
);

export async function migrateEcommerceTenantDatabase(database: Kysely<EcommerceDatabase>) {
  return runMigrationBatch(database, batch);
}

export async function rollbackEcommerceTenantDatabase(database: Kysely<EcommerceDatabase>) {
  void database;
  throw new Error("Ecommerce rollback requires a reviewed, data-preserving migration plan.");
}

async function preserveLegacyEcommerceTables(database: Kysely<EcommerceDatabase>) {
  void database;
  // The recorded step name remains stable for databases that already applied it.
  // New upgrades retain legacy rows until an explicit archival migration exists.
}
