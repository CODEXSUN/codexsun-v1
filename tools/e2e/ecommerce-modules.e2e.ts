/**
 * Retired EC-R08 entry point.
 *
 * This script opened the developer's real development tenant and asserted legacy-cleanup state
 * outside a disposable database. Its checks now live in
 * `tools/e2e/ecommerce-tenancy.e2e.ts` A10 (module composition, data-source secrecy, brand fields,
 * legacy tables, and the applied cleanup migration).
 *
 * Run: node --import tsx tools/e2e/ecommerce-tenancy.e2e.ts
 */
console.error(
  "ecommerce-modules.e2e.ts is retired. Run node --import tsx tools/e2e/ecommerce-tenancy.e2e.ts (A10)."
);
process.exit(2);
