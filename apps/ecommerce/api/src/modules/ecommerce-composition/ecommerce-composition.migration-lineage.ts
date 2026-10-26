import {
  migrationChecksum,
  type MigrationLedgerEntry,
  type MigrationStep
} from "@codexsun/framework/db";

// Historical identities are explicit. Never derive them from execution order.
export const ecommerceMigrationVersions = Object.freeze({
  legacy31: Object.freeze({
    "ecommerce.modules.product-information": 1,
    "ecommerce.modules.product-information-details": 2,
    "ecommerce.modules.product-variant": 3,
    "ecommerce.modules.product-image": 4,
    "ecommerce.modules.storefront-slider": 5,
    "ecommerce.modules.promotion-card": 6,
    "ecommerce.modules.promotion-card-badge": 7,
    "ecommerce.modules.featured-card": 8,
    "ecommerce.modules.season-strip": 9,
    "ecommerce.modules.storefront-announcement": 10,
    "ecommerce.modules.storefront-profile": 11,
    "ecommerce.modules.storefront-profile-social": 12,
    "ecommerce.modules.storefront-profile-content": 13,
    "ecommerce.modules.storefront-profile-payments": 14,
    "ecommerce.modules.catalog-matching": 15,
    "ecommerce.modules.catalog-matching-uuid": 16,
    "ecommerce.modules.catalog-data-source": 17,
    "ecommerce.modules.catalog-data-source-audit": 18,
    "ecommerce.modules.catalog-module-sources": 19,
    "ecommerce.modules.catalog-source-compatibility": 20,
    "ecommerce.modules.catalog-ux-sources": 21,
    "ecommerce.modules.catalog-erpnext-links": 22,
    "ecommerce.modules.catalog-cache-compatibility": 23,
    "ecommerce.modules.catalog-cache-seed-compatibility": 24,
    "ecommerce.modules.catalog-storefront-slider": 25,
    "ecommerce.modules.storefront-section-visibility": 26,
    "ecommerce.modules.storefront-schema": 27,
    "ecommerce.modules.storefront-performance": 28,
    "ecommerce.modules.legacy-cleanup": 29,
    "ecommerce.modules.storefront-organisation": 30,
    "ecommerce.modules.storefront-organisation-branding": 31,
    "ecommerce.modules.product-information-revision": 32,
    "ecommerce.modules.product-variant-options": 33,
    "ecommerce.modules.product-variant-canonical-options": 34,
    "ecommerce.modules.product-attribute": 35,
    "ecommerce.modules.product-attribute-revision": 36,
    "ecommerce.modules.product-specification": 37,
    "ecommerce.modules.product-specification-revision": 38,
    "ecommerce.modules.product-collection": 39,
    "ecommerce.modules.catalog-activity": 40
  }),
  stable34: Object.freeze({
    "ecommerce.modules.product-information": 1,
    "ecommerce.modules.product-information-details": 2,
    "ecommerce.modules.product-information-revision": 3,
    "ecommerce.modules.product-variant": 4,
    "ecommerce.modules.product-variant-options": 5,
    "ecommerce.modules.product-variant-canonical-options": 6,
    "ecommerce.modules.product-image": 7,
    "ecommerce.modules.storefront-slider": 8,
    "ecommerce.modules.promotion-card": 9,
    "ecommerce.modules.promotion-card-badge": 10,
    "ecommerce.modules.featured-card": 11,
    "ecommerce.modules.season-strip": 12,
    "ecommerce.modules.storefront-announcement": 13,
    "ecommerce.modules.storefront-profile": 14,
    "ecommerce.modules.storefront-profile-social": 15,
    "ecommerce.modules.storefront-profile-content": 16,
    "ecommerce.modules.storefront-profile-payments": 17,
    "ecommerce.modules.catalog-matching": 18,
    "ecommerce.modules.catalog-matching-uuid": 19,
    "ecommerce.modules.catalog-data-source": 20,
    "ecommerce.modules.catalog-data-source-audit": 21,
    "ecommerce.modules.catalog-module-sources": 22,
    "ecommerce.modules.catalog-source-compatibility": 23,
    "ecommerce.modules.catalog-ux-sources": 24,
    "ecommerce.modules.catalog-erpnext-links": 25,
    "ecommerce.modules.catalog-cache-compatibility": 26,
    "ecommerce.modules.catalog-cache-seed-compatibility": 27,
    "ecommerce.modules.catalog-storefront-slider": 28,
    "ecommerce.modules.storefront-section-visibility": 29,
    "ecommerce.modules.storefront-schema": 30,
    "ecommerce.modules.storefront-performance": 31,
    "ecommerce.modules.legacy-cleanup": 32,
    "ecommerce.modules.storefront-organisation": 33,
    "ecommerce.modules.storefront-organisation-branding": 34,
    "ecommerce.modules.product-attribute": 35,
    "ecommerce.modules.product-attribute-revision": 36,
    "ecommerce.modules.product-specification": 37,
    "ecommerce.modules.product-specification-revision": 38,
    "ecommerce.modules.product-collection": 39,
    "ecommerce.modules.catalog-activity": 40
  })
});

export type EcommerceMigrationLineage = keyof typeof ecommerceMigrationVersions;
const historicalStepCounts = { legacy31: 31, stable34: 34 } as const;
const identity = { batch: 1, scope: "ecommerce.modules", description: "Ecommerce", version: "1" };

export function resolveEcommerceMigrationPlan<Database>(
  steps: readonly MigrationStep<Database>[],
  ledger: readonly MigrationLedgerEntry[]
) {
  const byName = validateImplementations(steps);
  validateLedger(ledger);
  const lineages = ["legacy31", "stable34"] as const;
  const matching =
    ledger.length === 0
      ? ["stable34" as const]
      : lineages.filter((lineage) => matchesLineage(lineage, steps, byName, ledger));
  if (matching.length !== 1) {
    throw new Error(
      "Ecommerce migration history is unknown, mixed, incomplete, or ambiguous. Preserve the ledger and review its lineage."
    );
  }
  const lineage = matching[0]!;
  const manifest: Readonly<Record<string, number>> = ecommerceMigrationVersions[lineage];
  return { lineage, steps: steps.map((step) => ({ ...step, version: manifest[step.name]! })) };
}

function validateImplementations<Database>(steps: readonly MigrationStep<Database>[]) {
  const byName = new Map(steps.map((step) => [step.name, step]));
  for (const manifest of Object.values(ecommerceMigrationVersions)) {
    if (
      byName.size !== steps.length ||
      byName.size !== Object.keys(manifest).length ||
      steps.some((step) => !(step.name in manifest))
    ) {
      throw new Error("Ecommerce migration implementation differs from its frozen manifests.");
    }
  }
  return byName;
}

function validateLedger(ledger: readonly MigrationLedgerEntry[]) {
  const names = new Set(ledger.map((row) => row.name));
  if (
    names.size !== ledger.length ||
    ledger.some(
      (row) =>
        row.scope !== identity.scope || row.batch !== identity.batch || row.status !== "applied"
    )
  ) {
    throw new Error(
      "Ecommerce migration history is duplicated, failed, running, rolled back, or outside its scope/batch."
    );
  }
}

function matchesLineage<Database>(
  lineage: EcommerceMigrationLineage,
  steps: readonly MigrationStep<Database>[],
  byName: ReadonlyMap<string, MigrationStep<Database>>,
  ledger: readonly MigrationLedgerEntry[]
) {
  const manifest: Readonly<Record<string, number>> = ecommerceMigrationVersions[lineage];
  const names = new Set(ledger.map((row) => row.name));
  const baseComplete = Object.entries(manifest).every(
    ([name, version]) => version > historicalStepCounts[lineage] || names.has(name)
  );
  return (
    baseComplete &&
    ledger.every((row) => {
      const step = byName.get(row.name);
      return (
        step &&
        row.version === manifest[row.name] &&
        row.checksum ===
          migrationChecksum({ ...identity, steps }, { ...step, version: row.version })
      );
    })
  );
}
