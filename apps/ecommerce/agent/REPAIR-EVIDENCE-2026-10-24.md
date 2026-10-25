# Ecommerce repair evidence - EC-R01-EC-R09

Date: 2026-10-24. Effective model: `opencode/deepseek-v4.1-flash-free`.
Source: `ef5b3b356ff20378d4c8414d541216ca3ceb2bfd` plus the EC-R repair working tree.
Raw artifacts: `dist/ecommerce-scratch/evidence/` (git-ignored). Durable disposition: `TASK.md`.

No real tenant, master database, external provider, or Git remote was modified.

## EC-R01 / EC-R02 - local-only public catalog

Changed: `apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.service.ts` and its
focused test. Removed Frappe availability-window, cache-refresh timer, and remote `operation()`
fallback from public reads. Public reads use the local projection with a local cached fallback.

Pre-fix reproduction:

- Restored HEAD service plus `catalog-data-source.availability.ts`.
- `node --import tsx --test apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.service.test.ts`
- Exit `1`; 5 failures, each `Remote Frappe operation "catalog" must not run during a public read.`
- Log: `dist/ecommerce-scratch/evidence/ec-r02-prefix-failure.txt`.

Repair:

- Same command: exit `0`; 9 tests passed, 0 failed. The zero-remote-call test passes.

## EC-R03 - browser route and identity

Changed: `tools/e2e/ecommerce-storefront-browser.e2e.mjs`.

- Uses `/cart` (the actual storefront route), asserts the cart heading and item/empty state.
- Requires `main.cx-detail`, exact product name, a loaded hero image, `object-fit: contain`, and no
  horizontal overflow. It no longer treats generic body text as page proof.
- Raw HTML remains a recorded SEO limit, not a pass.

Live smoke run: exit `0`; all viewports and `/cart` passed. The configured local tenant had no
published product, so the product branch was reported as a limit, not silently accepted. Fixture proof
is EC-R04 below. Log: `dist/ecommerce-scratch/evidence/ec-r03-browser.log`.

## EC-R04 - fixture-backed browser acceptance

Changed: `tools/e2e/ecommerce-tenancy.e2e.ts` (`ECOM_TENANCY_BROWSER=1`).

The disposable tenant A fixture creates one published product with a real 600x600 PNG in the verified
tenant public root. Vite serves the real `apps/ecommerce/web` app; `/api/platform/*` is injected into
the same live Platform app with the fixture tenant host. Chrome checks:

- `/shop` at 1440/390/320: fixture product visible, product image loaded, no broken images, no overflow.
- `/cart`: cart-specific heading/state on the real route.
- `/shop/product/<fixture-slug>`: exact product name, image URL contains the fixture asset, no overflow.
- Screenshot: `dist/ecommerce-scratch/ecommerce-browser-<runId>/fixture-product-1440.png`.

Command: `ECOM_TENANCY_BROWSER=1 node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts`
Exit `0`; 11 assertion groups, including `PASS R04 fixture-backed storefront browser acceptance`.
Log: `dist/ecommerce-scratch/evidence/ec-r04-tenancy-browser.log`.

## EC-R05 - foreign tenant asset and exact counts

Changed: `tools/e2e/ecommerce-tenancy.e2e.ts` A9.

- Real tenant A and tenant B images are written under their verified tenant roots.
- Positive control: B serves its own image only while B's registry and module activation are enabled.
- Negative: tenant A gets `404` for the same B filename.
- Public catalog slugs are compared for exact equality with tenant A's published+active set, plus a
  duplicate check. This distinguishes tenant isolation from "an empty/short list passed".
- Company scope is exercised through two companies; customer/vendor principal scope remains blocked by
  EC-C02 and is not claimed.

Command: `node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts`
Exit `0`; 10 assertion groups. Log: `dist/ecommerce-scratch/evidence/ec-r09-tenancy.log`.

## EC-R06 - ledger reconciliation

Updated `TASK.md` current status, evidence limits, test inventory, `EXECUTION.md`, `README.md`,
`CONTRACTS.md`, `E2E-PLAN.md`, and `tasks/EC-T04-MEDIA.md`. Historical execution sections are retained
and explicitly marked superseded.

## EC-R07 - provider packets

Added `apps/ecommerce/agent/contracts/`: C02 portal principals, C03 Billing handoff, C06 queue/outbox,
C08 Mail/Chat, C10 marketplace finance, plus an index. Each records existing behavior, gap, proposed
schema/permissions/retries/consumers/tests, and the remaining owner decision. No provider code changed.

## EC-R08 - legacy suites and cleanup

- `tools/e2e/ecommerce-access.e2e.ts` and `ecommerce-modules.e2e.ts` are retired shims that exit `2`
  with the replacement command. Coverage moved to tenancy A1-A6/A10.
- Root scripts `test:e2e:ecommerce` and `test:e2e:ecommerce-modules` now run the tenancy harness.
- Cleanup verifies generated-key membership, resolved parent, basename, and symlink refusal before
  recursive removal. The disposable `STORAGE_ROOT` is removed with the same checks.
- Forced-failure drill: `ECOM_TENANCY_FORCE_FAILURE=1` threw after fixtures; exit `1`, cleanup reported
  `generated databases remaining=0`, and no generated fixture storage directories remained.
  Log: `dist/ecommerce-scratch/evidence/ec-r08-failure-cleanup.log`.

## EC-R09 - tenant media root

Changed: `apps/ecommerce/api/src/env.ts`, `product-image.storage.ts`,
`storefront-slider.storage.ts`, `database/ecommerce-database.ts`, and the tenancy fixture.

- HTTP uploads/reads use the Platform-provided verified tenant public root:
  `storage/<tenant>/public/ecommerce/{products,sliders}`.
- Legacy app-root files are copied lazily and idempotently into the new root on first read; the public
  URL and stored record link are unchanged. A read-only root still serves the legacy bytes.
- Non-HTTP callers keep a legacy-root fallback so focused tests and seed jobs do not need a request.
- Focused tests: `node --import tsx --test apps/ecommerce/api/src/modules/product-image/product-image.storage.test.ts`
  exit `0`, 2/2 passed (product and slider copy, survival after legacy removal, cross-tenant 404).
- Tenancy A9 now writes real cross-tenant images under the new root and passes (exit `0`).

## N01 - unified imported/native projection

Changed the Ecommerce storefront repository/query path so imported (`frappe_modified_at IS NOT NULL`)
and native (`IS NULL`) records share one published projection for list, details, categories, discovery
and content. The provenance partition and `frappeCacheOnly` behavior are removed.

- `node --import tsx --test apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.projection.test.ts`
  passes; the focused 32-test suite below includes both projection tests.
- Tenancy A12 compares the exact published projection and mixed imported/native records; exit `0`.

## N02 / N03 - canonical option identity and bounded storage

Changed `product-variant.identity.ts`, migration/service/seed/routes and composition migration
`1.0.85`:

- Names and values are trimmed and lowercased; partial option slots and case-insensitive duplicate
  names are rejected. Complete pairs are sorted and JSON-stringified before SHA-256.
- Signature storage is `CHAR(64)`; the migration detects canonical collisions before adding the
  unique index, and legacy partial columns normalize without throwing.
- Equivalent slot orders collide; delimiter-bearing values do not collide; duplicate writes become
  `409` conflicts rather than internal errors; maximum legal Unicode payloads remain bounded.
- The migration is registered as `product-variant-canonical-options` in
  `ecommerce-composition.migration.ts`; composition version is `1.0.85`.
- Seed uses `canonicalOptionSignatureFor` instead of MySQL `CONCAT`.

Verification (exit `0`, 32/32 tests):

```text
node --import tsx --test \
  apps/ecommerce/api/src/modules/catalog-pagination.test.ts \
  apps/ecommerce/api/src/modules/product-variant/product-variant.identity.test.ts \
  apps/ecommerce/api/src/modules/product-variant/product-variant.service.test.ts \
  apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.service.test.ts \
  apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.projection.test.ts \
  apps/ecommerce/api/src/modules/product-image/product-image.storage.test.ts
```

A11 passes with reordered duplicate `409`, delimiter-distinct `200`, maximum-payload `200`, and
`LENGTH(option_signature)=64`. Post-fix non-browser E2E:
`dist/ecommerce-scratch/evidence/ec-n01-n03-postfix.log`, exit `0`.

## N04 - staff pagination, filters and counts

Changed `catalog-pagination.ts` plus product-information/variant repositories, routes, types, hooks,
services and workspaces. The duplicate `web/src/shared/catalog-paging.tsx` is deleted.

- Totals <=100 return one page of 100 and the UI hides paging. Above 100, supported choices are
  20/50/100; out-of-range pages clamp and unsupported sizes cap at 100.
- Search/column/status changes reset `page` to 1. A single filtered row clears URL `page`/`pageSize`.
- Filters execute in SQL over the complete authorized dataset. Status counts use the base filters;
  the selected status determines `total`; rows come from the clamped server page.
- Products support storefront title, Core product, brand and slug filters plus
  all/draft/published/archived counts. Variants support SKU, title, product title and options filters
  plus all/active/inactive counts.

Evidence:

- `node --import tsx --test apps/ecommerce/api/src/modules/catalog-pagination.test.ts` exit `0`;
  totals `0/20/99/100/101/250`, clamping and page-size cap pass (4/4).
- A13 inserts 130 products and 105 variants (5 inactive) and verifies exact totals/counts, second-page
  non-overlap, page 7/10 rows, page 99 clamp, 100/30 split, narrow filter page reset, backend filters,
  zero results, status totals and inactive-row behavior.
- Full non-browser E2E: exit `0`, 13 assertion groups, cleanup `remaining=0`
  (`dist/ecommerce-scratch/evidence/ec-n04-postfix.log`).
- Chrome E2E: exit `0`, 14 assertion groups. Staff product/variant pages at 1440/1024/390 show exact
  totals and rows, 20/50/100 options, hidden pager at one filtered row, cleared URL paging state and
  no document overflow. Screenshots:
  `dist/ecommerce-scratch/ecommerce-browser-1792864760930/staff-{product,variant}-{1440,1024,390}.png`
  and `staff-single-row-1440.png`. Log: `dist/ecommerce-scratch/evidence/ec-n04-browser.log`.

This is N04 paging/filter evidence, not full EC-T05 acceptance. Show/App Header actions, activity,
invalid-field feedback and 768/320 checks remain.

## N05 - provider contract reconciliation

`agent/contracts/C02-PORTAL-PRINCIPALS.md` and `C03-BILLING-HANDOFF.md` now use integer tenant-local
Core references, `CHAR(8)` lowercase-hex public IDs and `VARCHAR` status domains. `C02` explicitly
separates master registry identity from tenant-local Core contact/company references and forbids
duplicating tenant data globally. `C02`/`C03`/`C06`/`C08`/`C10` add no `BIGINT`, `CHAR(36)` or MySQL
`ENUM`; migration-ordering/FK and session-claim exceptions are stated.

No provider code or staff authentication behavior changed. Restricted portal provider/consumer proof
is deferred to EC-T07 because no portal principal code exists yet; EC-T07 remains blocked.

## N06 - status and evidence reconciliation

Updated this evidence file, `TASK.md` current status/test inventory, and the current entry point in
`EXECUTION.md`. Historical execution/review records remain present and explicitly superseded.
Independent review of N01-N06 is still required before acceptance.

## Remaining gates

- Independent re-review of EC-R01-EC-R05/R08/R09 and EC-T02 re-acceptance.
- EC-T03/T04/T05 implementation; EC-T06 depends on them.
- EC-T07+ remain blocked on the packet reviews/decisions listed above.
- Live-tenant content acceptance still requires a tenant with published products; the fixture run does
  not claim production content.

## Final verification after reconciliation (EC-R10)

- `node --import tsx --test apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.service.test.ts apps/ecommerce/api/src/modules/product-image/product-image.storage.test.ts`
  exit `0`; 11 tests passed, 0 failed.
- `npm run typecheck -w @codexsun/ecommerce-api` exit `0`.
- `npx prettier --check` on every touched source/doc file exit `0` after formatting.
- Normal tenancy run exit `0`; 10 assertion groups; `generated databases remaining=0`.
  Log: `dist/ecommerce-scratch/evidence/ec-r10-tenancy-final.log`.
- Browser tenancy run exit `0`; 11 assertion groups, including `PASS R04`; cleanup remaining 0.
  Log: `dist/ecommerce-scratch/evidence/ec-r10-tenancy-browser-final.log`.
- The preflight storefront on port 7030 was stopped after verification; port 7030 is free.

Formatting did not change behavior: the same focused and tenancy suites passed after it.

## EC-T03/EC-T05 catalog slice - 2026-10-25

This supersedes the N04-only limit above. HEAD `5b1685bc` contains the attribute, specification,
collection, activity, paging and atomic-save slice; the current uncommitted delta is the E2E login/wait
repair plus the cxmobile consumer contract.

- Migration: `ecommerce-composition.migration.test.ts` exit `0` (2/2). 34 applied versions stay fixed;
  `product-attribute`, `product-attribute-revision`, `product-specification`,
  `product-specification-revision`, `product-collection` and `catalog-activity` append at 35-40.
- Paging contract: all three lists return a bare array when no `page`/`pageSize` is sent
  (cxmobile-compatible) and a `{items,page,pageSize,total,statusCounts}` envelope when paged. A15
  asserts both shapes and the app-level status counts.
- Atomic collection save: create and update insert/replace membership in one transaction. A15 proves
  create-with-items, update-with-items, failed create leaves no row and failed update keeps item count
  and revision. Unit coverage proves invalid membership is rejected before the repository write.
- Concurrency: attribute, specification and collection updates require `expectedRevision`; stale
  updates return 409 in unit tests and A15. Collection status changes also advance revision.
- Browser: `ECOM_TENANCY_BROWSER=1` tenancy run exit `0`, 16 groups, cleanup `remaining=0`
  (`ec-supervisor-browser-2026-10-25n.log` / `.exit`). Staff List/Show/Upsert, activity, header
  actions and field errors pass at 1440/768/390/320 for product, variant, attribute, specification and
  collection; product/variant paging also passes at 1024. Screenshots:
  `dist/ecommerce-scratch/ecommerce-browser-1792934411662/`.
- Earlier `...-k.exit` is `1` (workspace wait expired after 90 seconds during cold Vite optimization);
  `...-l.log` has no summary. Those are failure records, not acceptance.
- Focused catalog tests: 60/60 pass. cxmobile parity: 13/13 pass, including paged-list compatibility
  and revision-aware updates with 409 rejection. Typecheck/lint/boundaries pass.
- Remaining: independent review before accepting EC-T03/EC-T05; then EC-T04. Raw HTML SEO remains a
  known failure; no checkout/payment/vendor capability is claimed.