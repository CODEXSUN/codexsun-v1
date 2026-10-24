/**
 * Retired EC-R08 entry point.
 *
 * This script asserted against the developer's real `codexsun_dev_*` databases and was not safe or
 * reproducible. Its checks now live in `tools/e2e/ecommerce-tenancy.e2e.ts`:
 *   A1-A6  session, forged headers, disabled module, live permission denial
 *   A10    module composition and legacy cleanup
 *
 * Run: node --import tsx tools/e2e/ecommerce-tenancy.e2e.ts
 */
console.error(
  "ecommerce-access.e2e.ts is retired. Run node --import tsx tools/e2e/ecommerce-tenancy.e2e.ts (A1-A6, A10)."
);
process.exit(2);
