# Ecommerce tasks

## Current status - authoritative, 2026-10-24 (N01-N06 reconciliation)

This section is the single current status source. Every section below it is historical evidence and
must not be read as a current acceptance claim.

Current HEAD is `8d67a35115585838c8b8cfaeed7958ecbede32e9`. The Ecommerce repair work is an uncommitted
working tree on the earlier `ef5b3b3` baseline; unrelated workstream commits advanced HEAD during the
session. EC-T00 contracts were frozen at `fec76ade`; the independent reviewer re-verified them at
`61710dd9`. This repair session ran in OpenCode with effective model
`opencode/deepseek-v4.1-flash-free`. The earlier DeepSeek Harness session (`deepseek-flash`) remains
historical and no repair work is claimed under it.

### Task status

| ID     | Status                           | Basis / next action                                                                                                                                                                 |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EC-T00 | accepted                         | Contracts/CDECISIONS frozen; independent review findings repaired.                                                                                                                  |
| EC-T01 | accepted-partial                 | Tenant-boundary evidence only. Exact published-set equality, real cross-tenant image controls and domain checks now pass; portal record scope and DNS verification remain untested. |
| EC-T02 | repaired, pending re-review      | Public reads are local-only again; focused tests and pre-fix failure evidence recorded in REPAIR-EVIDENCE-2026-10-24.md.                                                            |
| EC-R01 | done, pending independent review | Public read path no longer consults Frappe availability, cache refresh or remote operation fallback.                                                                                |
| EC-R02 | done, pending independent review | Zero-remote-call assertion fails 5/9 on the pre-fix commit and passes 9/9 on the repair.                                                                                            |
| EC-R03 | done, pending independent review | Browser suite uses `/cart`, asserts cart heading/state, exact product identity and contained images.                                                                                |
| EC-R04 | done, pending independent review | Disposable published fixture + Vite + Chrome acceptance at 1440/390/320, screenshot captured.                                                                                       |
| EC-R05 | done, pending independent review | Real tenant-B image loads under B before the tenant-A denial; public catalog equals the exact published set.                                                                        |
| EC-R06 | done                             | This reconciliation and REPAIR-EVIDENCE-2026-10-24.md.                                                                                                                              |
| EC-R07 | done, pending owner review       | Five concrete packets under `agent/contracts/`; no provider code changed.                                                                                                           |
| EC-R08 | done, pending independent review | Legacy scripts retired to their disposable replacements; cleanup guards and a forced-failure drill pass.                                                                            |
| EC-R09 | done, pending review             | Product/slider media now use the verified tenant public root, with idempotent legacy copy-on-read and migration tests.                                                              |
| EC-T03 | in progress                      | Product/variant upsert, publication and optimistic edits pass A11; paging, filters and browser checks pass A13/N04. Attributes, specifications, collections and full staff acceptance remain. |
| EC-T04 | pending                          | Amended by EC-R09; media and gallery.                                                                                                                                               |
| EC-T05 | pending                          | Shared paging/filter contract passes A13 and browser checks. List/Show/Upsert, App Header actions, activity, validation and 768/320 checks remain.                                  |
| EC-T06 | pending                          | Depends on EC-T03/EC-T04/EC-T05.                                                                                                                                                    |
| EC-T07 | blocked                          | EC-C02 portal principal contract (EC-R07 packet 01).                                                                                                                                |
| EC-T08 | design-ready                     | Stock allocation design is EC-owned (EC-D02); Billing price/tax handoff blocked by EC-R07 packet 02.                                                                                |
| EC-T09 | blocked                          | EC-T07 + EC-T08.                                                                                                                                                                    |
| EC-T10 | blocked                          | EC-T09 + Billing idempotency handoff.                                                                                                                                               |
| EC-T11 | blocked                          | EC-T09 + EC-T10.                                                                                                                                                                    |
| EC-T12 | blocked                          | EC-T10 + EC-T11.                                                                                                                                                                    |
| EC-T13 | blocked                          | EC-T07-T12 + marketplace finance decision (EC-R07 packet 05).                                                                                                                       |
| EC-T14 | design-ready                     | Queue/outbox design in EC-R07 packet 03; Mail/Chat in packet 04.                                                                                                                    |
| EC-T15 | blocked                          | EC-T03/EC-T08/EC-T09/EC-T11/EC-T12/EC-T13.                                                                                                                                          |
| EC-T16 | pending                          | Needs EC-T01-T15 and EC-R03/EC-R04/EC-R05 acceptance evidence.                                                                                                                      |
| EC-T17 | deferred                         | Local acceptance gate not reached; no remote write enabled.                                                                                                                         |

### Latest review repairs N01-N06

| ID  | State                          | Evidence / remaining gate                                                                                                                                                                                                        |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01 | verified                       | Public list, details, categories, discovery and content share one imported/native projection. Projection tests and A12 pass.                                                                                                     |
| N02 | verified                       | Canonical option names/values, complete slots, sorted JSON and SHA-256 `CHAR(64)` signatures; migration detects collisions before DDL. Identity tests pass.                                                                       |
| N03 | verified                       | Delimiter-bearing values cannot collide, duplicate writes return 409, maximum legal payloads fit 64 hex characters. A11 passes.                                                                                                  |
| N04 | verified                       | Shared pager, hidden at totals <=100, 20/50/100 above 100, backend filters/counts, page reset/clamp. Helper tests 4/4, A13 passes, staff browser passes 1440/1024/390. Show/App Header/activity/invalid-field and 768/320 checks remain. |
| N05 | contract reconciled, review    | C02/C03/C06/C08/C10 use integer tenant-local IDs, `CHAR(8)` public UUIDs and VARCHAR domains; portal master/tenant identity is explicit. No provider behavior changed. Restricted portal proof remains blocked on EC-T07 code.     |
| N06 | reconciliation done, review    | This ledger, EXECUTION, REPAIR-EVIDENCE, test inventory and entry points are current; historical records are retained. Independent N01-N06 review is still required.                                                              |

### Current evidence limits (must accompany any summary)

- EC-R04 browser evidence is a disposable published fixture rendered through the real Ecommerce web
  app with Platform `app.inject`; it is visual acceptance for that fixture, not a production CDN or
  real-tenant content claim. The older live-tenant smoke run remains a limit-only record.
- EC-T01 evidence is tenant-database boundary evidence. Company/customer/vendor record scope and
  portal principals are not tested because no portal principal contract exists.
- EC-T03 A11-A13 are API/database evidence through the composed Platform app. N04 staff browser checks
  cover paging/filtering at 1440/1024/390 only; Show/App Header actions, activity, invalid-field
  feedback, 768/320, attributes, specifications, collections and an independent review remain.
- Raw HTML SEO is a known failing requirement (client-only SPA), not a pass.
- No checkout, payment, fulfillment, return, refund or vendor capability exists or is claimed.
- Only disposable databases and generated storage roots were mutated. The real tenants
  (`codexsun_db`, `sukraa_db`, `altex_db`) and `codexsun_master_db` are unchanged.
- Deliberately unrun in this session: production deployment, provider sandboxes, live Frappe, real
  payments, external messages, Git push.
- Provider packets are proposals only. EC-T07-EC-T14 remain blocked until their owner accepts and
  lands the contract.

### Test file inventory at reconciliation (paths relative to repository root)

- `apps/ecommerce/api/src/modules/catalog-pagination.test.ts`
- `apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.service.test.ts`
- `apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.projection.test.ts`
- `apps/ecommerce/api/src/modules/catalog-data-source/catalog-data-source.frappe.test.ts`
- `apps/ecommerce/api/src/modules/catalog-matching/catalog-matching.domain.test.ts`
- `apps/ecommerce/api/src/modules/overview/overview.storefront-runtime.test.ts`
- `apps/ecommerce/api/src/modules/product-image/product-image.service.test.ts`
- `apps/ecommerce/api/src/modules/product-image/product-image.storage.test.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.identity.test.ts`
- `apps/ecommerce/api/src/modules/product-variant/product-variant.service.test.ts`
- `apps/ecommerce/api/src/modules/storefront-organisation/storefront-organisation.storage.test.ts`
- `apps/ecommerce/web/src/modules/storefront/storefront.blog.test.ts`
- `tools/e2e/ecommerce-tenancy.e2e.ts` (A1-A13; `ECOM_TENANCY_BROWSER=1` adds R04 and staff N04 checks)
- `tools/e2e/ecommerce-storefront-browser.e2e.mjs` (live-tenant smoke; empty-catalog limit only)
- `tools/e2e/ecommerce-access.e2e.ts` (retired shim; replacement is tenancy A1-A6/A10)
- `tools/e2e/ecommerce-modules.e2e.ts` (retired shim; replacement is tenancy A10)

## Supervisor execution ledger (historical - superseded by Current status above)

— 2026-10-24

Supervisor: `deepseek-flash` (DeepSeek Harness, this session). Authorized model request:
`opencode/deepseek-v4.1-flash-free`. Effective runtime: the harness exposes one provider
(`deepseek-flash`) for the Lead and for native teammates; there is no OpenCode provider in this
runtime. No work is claimed under a model that did not run it.

Base revision at EC-T00: `fec76ade4adb787c8bf3f2bc812d564bd5d7e807` (branch `main`). The tree then advanced to `61710dd91c9716b767101e47b0e289b2cc2e8ce0` ("#1.55 - Data Migration production API proxy repair", an unrelated commit made by another workstream during this session). EC-T01/EC-T02 were implemented and reviewed against `61710dd9`; EC-T00 contract claims were re-verified by the independent reviewer at `61710dd9`.
Dirty baseline captured in `dist/ecommerce-scratch/baseline/` (`git-status.txt`, `git-head.txt`,
`untracked.txt`): 62 entries, 45 tracked files modified, untracked CodeIT devkit work,
`apps/core` favicon work, `apps/docs` content and the pre-existing Ecommerce agent documents.
`dist/` is git-ignored runtime output and is never part of the deliverable.

That unrelated work is preserved. This delivery does not modify CodeIT, Core favicon files,
`apps/docs`, or any other pending owner change.

### Status legend

`pending` → `ready` → `running` → `review` → `changes-required` → `blocked` → `accepted`.
Accepted means implemented, reviewed, integrated and verified against the current combined source.
A later contract change invalidates dependent evidence until the supervisor reruns affected checks.

| Task   | Status      | State / reason                                                                                             |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------- |
| EC-T00 | accepted    | Accepted 2026-10-24 after independent review (ACCEPT WITH FINDINGS, R1-R8 repaired).                       |
| EC-T01 | accepted    | Disposable two-tenant harness green 9/9; supervisor-verified; independently reviewed.                      |
| EC-T02 | accepted    | Local-authoritative read path; 4 gates green; independently reviewed.                                      |
| EC-T03 | in progress | Prerequisites EC-T00, EC-T01, EC-T02. Product/variant slice passed A11; collections/specifications remain. |
| EC-T04 | pending     | Prerequisites EC-T00, EC-T01.                                                                              |
| EC-T05 | pending     | Prerequisites EC-T00, EC-T01.                                                                              |
| EC-T06 | pending     | Prerequisites EC-T02, EC-T03, EC-T04, EC-T05.                                                              |
| EC-T07 | blocked     | Blocked by EC-C02: Platform has no customer/vendor principal type (see CONTRACTS.md).                      |
| EC-T08 | blocked     | Blocked by EC-C03/EC-D03 only: no Billing price/tax/invoice handoff (stock is EC-D02, ours).               |
| EC-T09 | blocked     | Requires EC-T07 and EC-T08 contracts.                                                                      |
| EC-T10 | blocked     | Requires EC-T09 and the Billing handoff contract.                                                          |
| EC-T11 | blocked     | Requires EC-T09 and EC-T10.                                                                                |
| EC-T12 | blocked     | Requires EC-T10 and EC-T11.                                                                                |
| EC-T13 | blocked     | Requires EC-T07–EC-T12 and EC-C10.                                                                         |
| EC-T14 | blocked     | Requires EC-T09-T12 accepted plus Platform queue/outbox injection (EC-C06).                                |
| EC-T15 | blocked     | Requires EC-T03, EC-T08, EC-T09, EC-T11, EC-T12, EC-T13.                                                   |
| EC-T16 | pending     | Requires EC-T01–EC-T15 accepted.                                                                           |
| EC-T17 | deferred    | Local acceptance gate not reached; no remote write is enabled.                                             |

### Write leases (generation 1)

The supervisor owns shared surfaces: `package.json`/lockfile, exports, router and menu
composition, shared styles, Platform composition and migration registration, and every ledger
document under `apps/ecommerce/agent/`. Workers never write those paths.

| Lease                | Owner         | Paths                                                                                                             |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| L1 tenancy harness   | EC-T01 worker | `tools/e2e/ecommerce-tenancy.e2e.ts`, `apps/ecommerce/api/src/modules/ecommerce-scope/**` (new)                   |
| L2 local catalog     | EC-T02 worker | `apps/ecommerce/api/src/modules/catalog-data-source/**` and its focused tests                                     |
| L3 catalog slice     | EC-T03 worker | `apps/ecommerce/api/src/modules/{product-information,product-variant,product-attribute}/**`, matching web modules |
| L4 media             | EC-T04 worker | `apps/ecommerce/api/src/modules/product-image/**`, `apps/ecommerce/web/src/modules/product-image/**`              |
| L5 staff UI contract | EC-T05 worker | list/pagination additions inside existing Ecommerce web modules and `tools/ecommerce-*test*` fixtures             |

Recorded exception (EC-T00 review finding R2): EC-T01/EC-T02 leases were released after the contract
freeze (v1) and the supervisor self-verification completed, but before the independent EC-T00 review.
The review confirmed the freeze was materially accurate and no contract blocker was wrong, so the
exception stands: dependent work used contract revision v1. EC-T01, EC-T02 and every later task still
require their own review and integrated verification before acceptance, and EC-T02's packet
prerequisite on EC-T01 is recorded above rather than silently dropped.

### Required evidence for every accepted task

Exact commands with exit codes, disposable-database names and row counts, the affected contract
revision, reviewer identity for non-author review, and the unexecuted checks listed as limits.
Mocked, database, browser, provider-sandbox and production evidence are never merged.

## Supervisor implementation task pack — 2026-10-24

The human authorized a local implementation handoff to OpenCode with supervisor/subagents.
Read [SUPERVISOR-PROMPT.md](SUPERVISOR-PROMPT.md) and [EXECUTION.md](EXECUTION.md).
No worker or implementation completion is claimed by this initial task index.

| Task                                        | Deliverable                               | Initial status |
| ------------------------------------------- | ----------------------------------------- | -------------- |
| [EC-T00](tasks/EC-T00-FOUNDATION.md)        | Foundation and contract freeze            | Pending        |
| [EC-T01](tasks/EC-T01-TENANCY.md)           | Tenant and actor foundation               | Pending        |
| [EC-T02](tasks/EC-T02-LOCAL-CATALOG.md)     | Local-authoritative catalog migration     | Pending        |
| [EC-T03](tasks/EC-T03-CATALOG.md)           | Products, variants and attributes         | In progress    |
| [EC-T04](tasks/EC-T04-MEDIA.md)             | Media, gallery and file picker            | Pending        |
| [EC-T05](tasks/EC-T05-STAFF-UI.md)          | Staff workspace pattern and UI gaps       | Pending        |
| [EC-T06](tasks/EC-T06-STOREFRONT.md)        | Storefront sections, discovery and SEO    | Pending        |
| [EC-T07](tasks/EC-T07-CUSTOMER-PORTAL.md)   | Customer identity and portal              | Pending        |
| [EC-T08](tasks/EC-T08-PRICING-STOCK.md)     | Pricing, discounts and stock allocation   | Pending        |
| [EC-T09](tasks/EC-T09-CHECKOUT-ORDERS.md)   | Cart, checkout and orders                 | Pending        |
| [EC-T10](tasks/EC-T10-PAYMENTS-BILLING.md)  | Payments and financial reconciliation     | Pending        |
| [EC-T11](tasks/EC-T11-FULFILLMENT.md)       | Fulfillment and transport movements       | Pending        |
| [EC-T12](tasks/EC-T12-AFTER-SALES.md)       | Returns, rejection, exchanges and refunds | Pending        |
| [EC-T13](tasks/EC-T13-VENDOR-PORTAL.md)     | Marketplace and vendor portal             | Pending        |
| [EC-T14](tasks/EC-T14-SERVICE-REPORTS.md)   | Service integrations, events and reports  | Pending        |
| [EC-T15](tasks/EC-T15-INDUSTRIES.md)        | Industry features and compatibility       | Pending        |
| [EC-T16](tasks/EC-T16-RELEASE-READINESS.md) | Combined E2E and local release readiness  | Pending        |
| [EC-T17](tasks/EC-T17-FRAPPE-DEFERRED.md)   | Deferred Frappe contract and sync plan    | Pending        |

Worker leases and accepted evidence are maintained here by the supervisor. Preserve historical entries below.

## Complete local Ecommerce planning — 2026-10-24

- [x] Review current Ecommerce product extensions, storefront composition, data-source behavior, and CRM reference patterns.
- [x] Record the proposed ownership, reuse, delivery phases, task template, and multi-tenant E2E matrix in [E2E-PLAN.md](E2E-PLAN.md).
- [ ] Complete EC-P0-01 through EC-P0-07 and resolve their provider contracts before implementation.
- [ ] Deliver the local P1–P8 vertical slices with database, UI, security, and recovery evidence.
- [ ] Design and verify P9 Frappe mappings only after local acceptance.

This entry records planning work only. No runtime, migration, external service, or production behavior changed.

## Marketing integration backlog — 2026-10-23

Planning alignment is complete. The following implementation tasks remain open.
See [Marketing contracts and gaps](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), G09.

- [ ] Define optional published promotion/campaign link and consent-aware storefront source events.
- [ ] Keep unsupported checkout, purchase, and abandoned-cart triggers disabled and accurately described.
- [ ] Verify published-only projection, wrong-tenant rejection, and no disclosure of private catalog or customer data.

Acceptance requires the owner contract, denied-access cases, retry behavior, and exact evidence in this task log.
No implementation or live validation is claimed by this planning update.

## Responsibility

Staff catalog management, matching and publishing controls, and the public storefront.

Core owns shared product identity and Frappe owns connection credentials. Public routes return published tenant content only. A browser basket does not prove order, payment, or stock-reservation support.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected Ecommerce source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

### Loading release preparation, 17-10-2026

- Storefront stories check the public Blog availability contract before requesting posts. Optional stories load after primary home content and do not block it.
- Browser verification reached the live mapped shop. The catalog now returns an empty result instead of a domain error. No product records were fabricated or published.
- Version 1.1.7 passed the full repository check, version alignment, 31 focused release tests, and 15 deployment/runtime/persistence contract tests. The local clean-all build is blocked by a Windows dist file lock. Production rollout is pending at commit preparation.

### Storefront section fit review, 17-10-2026

- Reviewed all 11 homepage sections live at desktop and mobile widths, plus narrow phone and tablet fit checks at 320 and 768 pixels.
- Reworked seasonal offers into separate image and text areas. Titles, descriptions, images, and action URLs come from the existing season feed; the company name and assurance proof points come from branding and Storefront Profile.
- Changed catalog images to contain the complete product, reserved space for badges, corrected promotion badge positions, and let promotion grids fill the available columns. Mobile catalog cards use two columns above 359 pixels.
- Removed hero text clamping and reserved space for the sample slide copy to reduce page movement. Reduced the floating assistant size and separated it from Back to top.
- Verified no failed loaded homepage images, cover-cropped images, horizontal page overflow, or clipped headings/paragraphs at the checked widths. A seasonal card opened the matching backend product page.
- Passed Ecommerce web typecheck/lint, storefront production build, and Ecommerce module boundaries. The existing build bundle-size warning remains.

### Populated storefront reference content, 17-10-2026

- Added reference records to the configured local CODEXSUN tenant through authenticated Core, Ecommerce, and Blog APIs. Existing products and branding were preserved.
- Verified public feeds for 10 products/sliders, 3 promotions/campaigns, 4 featured cards, 2 seasonal banners, and 4 brands. Uploaded product images and all 10 product detail feeds returned successfully.
- Enabled Blog at the user's request, ran managed tenant setup, assigned Blog management to the existing tenant admin role, and added 3 reference buying guides. The homepage displays these latest posts from the public Blog API.
- Fixed the product image service to accept the local URLs returned by its upload API. Regression tests cover uploaded URLs, traversal, unrelated paths, and executable protocols.
- Added storefront journal list/article routes using the published Blog package and retained all homepage sections on mobile. Local Blog routing uses the existing configured development storefront tenant fallback without changing production routing or activation checks.
- Passed Ecommerce API/web and Platform API typechecks, Ecommerce lint, storefront build, Ecommerce/Platform boundaries, add-on checks/tests, and dependency layout verification. The build retains its bundle-size warning.
- Browser verification confirmed all 11 sections on mobile, no horizontal page overflow or failed loaded homepage images on desktop/mobile, and a working public journal article with its saved paragraphs. The local API restarted during source changes; the storefront was restarted independently for the final checks.

### Storefront HTTP 431 and readiness, 16-10-2026

- Added the 64 KiB development header limit to both Ecommerce preflight and header-button startup.
- Readiness now checks server identity, shop HTML, branding, and catalog with the requesting browser cookies.
- Regression tests passed for failed shop/branding/catalog requests and HTTP 431 returning unhealthy status.
- Restarted the local Ecommerce server. Verified HTTP 200 for shop, branding, and catalog with a 30 KB Cookie header. The readiness service returned running for the same header.
- Passed runtime tests, development-stack contract tests, Ecommerce API/web type checks, lint, Ecommerce boundaries, and Ecommerce web build.
- Browser interaction was not directly inspected. The green indicator verifies HTTP readiness rather than full browser rendering.

### Grouped navigation and homepage section wiring, 16-10-2026

- Matched the requested reference menu with Catalog, Storefront UX, and Settings accordion groups.
- Kept existing Ecommerce URLs and Organisation settings. Added Ecommerce routes that compose Core categories, products, and brand workspaces.
- Added Campaign Events with its own page title and section visibility control. It edits the shared local promotion records used by the reference implementation.
- Compared the reference homepage section implementation. Its section order and components were already present locally.
- Removed homepage brand/campaign fallbacks that could reshow disabled sections.
- Passed Platform web type checking, Ecommerce and focused Platform frontend lint, both module boundary checks, Ecommerce web/storefront builds, and the Platform web build.
- Passed component documentation checks/tests and dependency layout verification. Builds retain bundle-size and dynamic-import warnings.
- Browser interaction was not verified in this change.

### Storefront organisation and branding, 16-10-2026

- Added `/app/ecommerce/organisation` with tenant-backed company/year selection, display name, and logo upload.
- Settings and activity records belong to Ecommerce. Core supplies active company/year lookups through a public contract.
- Applied the additive organisation and branding migrations to the configured local CODEXSUN tenant.
- Saved and reread the existing `codexsun` / `FY 2026-27` selection. Verified its activity row and rejection of unknown company/year references.
- Verified localhost resolves the configured tenant with demo seeding disabled. The live public API returned `codexsun` before the latest logo change.
- Logo storage test passed: valid image round-trip, expected tenant public path, cross-tenant rejection, invalid/oversized image rejection, and path traversal rejection.
- Latest Ecommerce API/web type checks, lint, and Ecommerce/Platform boundary checks passed.
- Latest Platform API type check is blocked by unrelated optional-field type errors in Billing sales/export-sales compliance workers and routes.
- Full authenticated HTTP and browser verification of the latest upload change remains blocked while the local Platform API is unavailable.

### Storefront header runtime control, 16-10-2026

- Added local storefront status and start controls to the Ecommerce app header.
- Verified two runtime tests: service identity detection and rejection of remote control requests.
- Verified a real development process: stopped, starting, running, and successful `/shop` response. Closed the test process afterward.
- Passed Ecommerce API and web type checks, Platform API and web type checks, and all three Ecommerce builds.
- Passed the Platform web build, Ecommerce lint, focused Platform frontend lint, and Ecommerce and Platform boundary checks.
- Passed component documentation checks and tests, and the root dependency layout check.
- Browser interaction and deployed tenant catalog readiness were not tested. Builds report bundle size warnings.
- No schema changes or database migration required. Start remains local development only and permission checked.

- `node tools/check-module-boundaries.mjs ecommerce`
- `npm run typecheck -w @codexsun/ecommerce-api`
- `npm run lint -w @codexsun/ecommerce-api`
- `npm run build -w @codexsun/ecommerce-api`
- `npm run typecheck -w @codexsun/ecommerce-storefront`
- `npm run lint -w @codexsun/ecommerce-storefront`
- `npm run build -w @codexsun/ecommerce-storefront`
- `npm run typecheck -w @codexsun/ecommerce-web`
- `npm run lint -w @codexsun/ecommerce-web`
- `npm run build -w @codexsun/ecommerce-web`

Use `npm run check:component-docs` for this documentation contract.
Run applicable tests before marking implementation work complete.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.

### Review outcome notes (recorded after the reviews landed)

The task packets and this ledger were drafted while the independent reviews were still running; the
review verdicts and repairs below were recorded afterwards, not predicted. Review reports:
`dist/ecommerce-scratch/reviews/ec-t00-review.md` and `ec-t01-t02-review.md`.

EC-T01/EC-T02 second-round findings and repairs: R1 (major) packets claimed acceptance before the
review report existed - corrected here and in both packets by recording the review outcome after the
fact. R2 base revision - corrected to `61710dd9`. R3 - an explicit generated-name guard now precedes
the single DROP loop. R4 - the harness now also asserts an authorized count, no duplicate rows and a
denied public media/file request (traversal and foreign filename). R5 - runtime note corrected. No
code change was needed for the EC-T02 finding beyond recording the interpretation.

### Acceptance evidence - 2026-10-24

EC-T00 (accepted): inventory, contract freeze v1 (EC-C01..EC-C11) and decisions EC-D01..EC-D10 are
recorded in CONTRACTS.md and DECISIONS.md. Independent review `review-t00` returned ACCEPT WITH
FINDINGS; R1-R8 were repaired (storage-root fact, ledger exception, EC-T08/EC-T14 prerequisite lists,
EC-D10 line range, packet encoding, two over-broad claims). Evidence:
`dist/ecommerce-scratch/inventory/*.md`, `dist/ecommerce-scratch/reviews/ec-t00-review.md`.

EC-T01 (accepted): `tools/e2e/ecommerce-tenancy.e2e.ts` provisions a disposable Platform master plus
two tenant databases through the production pipeline, then proves A1-A9: session 200, unauthenticated
and revoked 401, forged `x-tenant-db`/`x-tenant-id` ignored, tenant-B record substitution 404,
Ecommerce-disabled tenant 403, live permission removal 403 then restore 200, unknown/suspended host
404, request-scope accessors forbidden outside the scope, and two companies/two customers/two vendors
kept tenant-bound, plus an authorized-count assertion and public media/file denial (traversal and a
foreign image name both rejected). Three independent green runs (worker, supervisor, reviewer) and a
final supervisor run with a captured exit code 0; cleanup verified
(`generated databases remaining=0`, real registry unchanged with three tenants).
Runner: `npm run test:e2e:ecommerce-tenancy` (needs CREATE/DROP DATABASE; observed 50-160 seconds for the final tree after the first-run migration caches were warm).

EC-T02 (accepted): the public catalog read path no longer calls `integrationSnapshot`,
`replaceFromFrappe` or `pullFromFrappe`; the automatic 15-minute cache refresh was removed. Explicit
`pullFromFrappe`/`pushToFrappe` remain route-only. Stored provider selections and imported data are
untouched. 13 focused tests pass (new "a public read never performs a remote Frappe pull" plus
disabled/unconfigured/unreachable/empty/provider-preservation/explicit-sync coverage), API typecheck
and lint and module boundaries exit 0.

Combined-tree gates after integration (all exit 0):
`node tools/check-module-boundaries.mjs ecommerce`,
`npm run typecheck -w @codexsun/ecommerce-api`,
`npm run typecheck -w @codexsun/ecommerce-web`,
`npm run typecheck -w @codexsun/ecommerce-storefront`,
`npm run lint -w @codexsun/ecommerce-api`,
`npm run lint -w @codexsun/ecommerce-web`,
`npm run lint -w @codexsun/ecommerce-storefront`,
`npm run build -w @codexsun/ecommerce-api`,
`npm run build -w @codexsun/ecommerce-web`,
`npm run build -w @codexsun/ecommerce-storefront`,
plus the 16 ecommerce unit tests.

Browser evidence (storefront, real Chrome over CDP, dev server on port 7030): `/shop` rendered at
1440/768/390/320 with no horizontal overflow, no broken images and no uncaught exceptions; `/shop/cart`
at 320 had no overflow; screenshots under `dist/ecommerce-scratch/browser/`. RAW HTML is the static
SPA shell (title `CODEXSUN Ecommerce`, no description meta, no heading), which confirms the EC-D05
client-only SEO limit - it is NOT an SEO pass. The product page was not visited because the local
catalog returned no published product slug (recorded limit, not a pass).
Runner: `npm run test:e2e:ecommerce-browser` with the Platform API and storefront dev servers running.

### Final supervisor gate batch (after all repairs, 2026-10-24 14:37 IST)

`npx prettier --check` on every changed file -> 0; `npm run check:component-docs` -> 0;
`node tools/check-module-boundaries.mjs ecommerce` -> 0; `npm run typecheck` for ecommerce-api,
ecommerce-web and ecommerce-storefront -> 0 each; `npm run lint` for the same three workspaces -> 0
each; `npm run build -w @codexsun/ecommerce-api` -> 0; 22 ecommerce unit tests -> 22 pass / 0 fail;
`node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts` -> 9/9 PASS, captured exit 0,
cleanup `generated databases remaining=0`; storefront browser run -> 4 widths + cart PASS, raw HTML
confirmed as the SPA shell.

Environment restored and verified afterwards: no `codexsun_ecommerce%` databases remain, the real
registry still has exactly CODEXSUN/SUKRAA/ALTEX with `tenant_domains` 0, and `codexsun_db` still has
17 `ecommerce_*` tables with 0 `ecommerce_product_information` rows (unchanged). The Ecommerce
storefront dev server started for the browser check was stopped; the Platform API on 7010 that was
already running before this work was left untouched.
