# Ecommerce: Product Variant

This page records the `product-variant` module in the Ecommerce owner. The application business context is: product enrichment, merchandising and storefront configuration.

## Workflow role

Ecommerce owns merchandising. Verify current source files for paid checkout/order capabilities; do not infer them from a store page.

Trace this module's concrete entry points below before changing its behavior. Its service is the authority for validation, lifecycle and dependency decisions; frontend controls cannot grant permissions.

## Source contracts

- `apps/ecommerce/api/src/modules/product-variant/index.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.migration.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.module.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.repository.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.routes.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.seed.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.service.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.types.ts`
- `apps/ecommerce/web/src/modules/product-variant/index.ts`
- `apps/ecommerce/web/src/modules/product-variant/product-variant.form.tsx`
- `apps/ecommerce/web/src/modules/product-variant/product-variant.hooks.ts`
- `apps/ecommerce/web/src/modules/product-variant/product-variant.list.tsx`
- `apps/ecommerce/web/src/modules/product-variant/product-variant.schema.ts`
- `apps/ecommerce/web/src/modules/product-variant/product-variant.services.ts`
- `apps/ecommerce/web/src/modules/product-variant/product-variant.types.ts`
- `apps/ecommerce/web/src/modules/product-variant/product-variant.workspace.tsx`

## Explicit route declarations

- `${base}/:id`
- `${base}/:id/${action}`
- `${base}/products`

## Tables created by this leaf

- `ecommerce_product_variants`

## Legacy writer compatibility

Forward Ecommerce migration 41 adds deterministic normalization, JSON encoding, and signature functions in the tenant schema.
Insert and update triggers compute the canonical signature for both old and new writers.
The existing product/signature unique index remains active. Distinct variants do not share a constant default identity.
The default sentinel only admits omitted legacy fields before the insert trigger computes their signature.
Update triggers also increment revision for legacy writers. Existing application validation remains in force.

Frozen Unicode 17 data, final-sigma context, ECMAScript trimming, JSON escaping, and UTF-16 pair sorting preserve application signatures.
The migration rejects canonical duplicates and runs parity probes before it installs triggers or changes business rows.
It also compares actual existing-row SQL signatures with the application implementation.
All first-40 migration identities remain unchanged across both historical lineages.

`product-variant.writer-verification.ts` supplies explicit disposable-staging tests with a synthetic product.
It checks actual SQL parity, old/new inserts, multiple variants, duplicate rejection, updates, and revision changes inside a rolled-back transaction.
Source tests do not establish MariaDB acceptance. Required routine/trigger privileges must already exist.
Never change server privileges or configuration to bypass a failed migration.

## Permission declarations

No permission literal was detected. Check injected authorisation and app/host guards in the public composition contract.

## Request and change flow

```text
authenticated context → owning route schema → service decisions → repository/read contract
frontend gateway → owner query hooks → workspace/form/list → fixed API operation
```

Do not infer CRUD capabilities from file names. Review request/response schemas, parent lookups, transaction/audit writes, status policy and delete blockers in the listed source files. Applied migration checksums must not be rewritten.
