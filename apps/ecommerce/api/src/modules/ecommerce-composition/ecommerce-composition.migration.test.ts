import assert from "node:assert/strict";
import test from "node:test";
import { ecommerceTenantMigrationVersions } from "./ecommerce-composition.migration.js";

const legacyNames = [
  "product-information",
  "product-information-details",
  "product-information-revision",
  "product-variant",
  "product-variant-options",
  "product-variant-canonical-options",
  "product-image",
  "storefront-slider",
  "promotion-card",
  "promotion-card-badge",
  "featured-card",
  "season-strip",
  "storefront-announcement",
  "storefront-profile",
  "storefront-profile-social",
  "storefront-profile-content",
  "storefront-profile-payments",
  "catalog-matching",
  "catalog-matching-uuid",
  "catalog-data-source",
  "catalog-data-source-audit",
  "catalog-module-sources",
  "catalog-source-compatibility",
  "catalog-ux-sources",
  "catalog-erpnext-links",
  "catalog-cache-compatibility",
  "catalog-cache-seed-compatibility",
  "catalog-storefront-slider",
  "storefront-section-visibility",
  "storefront-schema",
  "storefront-performance",
  "legacy-cleanup",
  "storefront-organisation",
  "storefront-organisation-branding"
] as const;
test("applied legacy migration versions never shift", () => {
  legacyNames.forEach((name, index) => {
    assert.equal(
      ecommerceTenantMigrationVersions[`ecommerce.modules.${name}`],
      index + 1,
      `${name} must keep its recorded version ${index + 1}.`
    );
  });
});

test("new forward migrations append after the committed ledger", () => {
  assert.equal(
    ecommerceTenantMigrationVersions["ecommerce.modules.product-attribute"],
    legacyNames.length + 1
  );
  assert.equal(
    ecommerceTenantMigrationVersions["ecommerce.modules.product-attribute-revision"],
    legacyNames.length + 2
  );
  assert.equal(
    ecommerceTenantMigrationVersions["ecommerce.modules.product-specification"],
    legacyNames.length + 3
  );
  assert.equal(
    ecommerceTenantMigrationVersions["ecommerce.modules.product-specification-revision"],
    legacyNames.length + 4
  );
  assert.equal(
    ecommerceTenantMigrationVersions["ecommerce.modules.product-collection"],
    legacyNames.length + 5
  );
  assert.equal(
    ecommerceTenantMigrationVersions["ecommerce.modules.catalog-activity"],
    legacyNames.length + 6
  );
});
