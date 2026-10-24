# Ecommerce current review and next-agent prompt

Reviewed: 2026-10-24, current working tree after the EC-R repair work.
This is a source and focused-test review, not database, browser, provider, or deployment acceptance.
It supplements the earlier delivery review. Do not repeat findings already repaired.

## What is done and what remains

| Area                                  | Current evidence                                                                                                        | Status                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Contract inventory and task breakdown | Existing EC-T00 documents and provider proposal packets                                                                 | Present. Several provider decisions remain proposals.                                     |
| Local-only data reads                 | Public `read()` no longer invokes live Frappe operations. Zero-remote-call tests pass.                                  | Previous live-read defect repaired. Mixed imported/local projection defect remains below. |
| Tenant-boundary test harness          | Disposable provisioning, real foreign-image positive/negative controls, exact published-set assertions exist in source. | Useful implementation. Previous execution recorded by producer; not rerun in this review. |
| Browser harness                       | Correct `/cart` route, page identity and disposable product fixture checks exist.                                       | Improved source. No new browser verification in this review.                              |
| Media storage                         | Verified tenant public roots, legacy copy-on-read, two focused migration tests.                                         | Implemented bridge, not complete media/gallery/file-manager acceptance.                   |
| Products and variants                 | Server paging, conditional revision updates, parent checks, option signature and additive migrations.                   | Partial EC-T03. New correctness issues remain.                                            |
| Staff UX                              | Existing forms/lists plus new Previous/Next wrapper.                                                                    | Partial. Shared pagination and complete List/Show/Upsert acceptance remain.               |
| SEO and full home sections            | Existing storefront and client-side metadata.                                                                           | Raw-HTML SEO and populated all-section acceptance still pending.                          |
| Shopping transactions                 | No cart/checkout/order/payment/reservation/shipment/return/refund leaves in the current API module inventory.           | Remaining work. Browser basket is not transactional checkout.                             |
| Customer/vendor portals               | Provider proposals exist. No implemented restricted portal principal in the reviewed Ecommerce changes.                 | Contract and implementation pending.                                                      |
| Service integrations                  | Queue/outbox, Billing, Mail/Chat and marketplace finance packets exist.                                                 | Proposals, not working integrations.                                                      |
| Frappe integration                    | Explicit legacy transfers remain. Local release gate not reached.                                                       | Deferred expansion.                                                                       |

## Verification performed now

- All currently discovered Ecommerce API `*.test.ts` files: 20 tests passed, exit 0.
- Ecommerce API typecheck: passed.
- Ecommerce web typecheck: passed.
- Ecommerce module boundaries: passed.
- In-memory service counterexamples reproduced mixed-source omission and variant signature defects without database writes.

No database E2E, browser, lint, production build, provider sandbox, or deployment was rerun in this review.
The producer's repair report is historical evidence, not an independent rerun by this reviewer.
The working tree includes unrelated active work. Preserve it.

## Remaining findings and improvements

### N01 — Mixed-source published catalog omits local products — P1

Source: `catalog-data-source.service.ts`, `cached()` and the public `read()` path.
`cached()` returns the imported-only repository result whenever nonempty and never queries the local-only repository.
`StorefrontRepository.sourceCondition()` partitions those records by `frappe_modified_at`.
Therefore local-only execution still does not mean a complete local tenant catalog.

Reproduced with an imported row and a separate local row: catalog returned only the imported row, with zero local-repository calls.
Discovery, search, pagination, categories and content feeds need consistent semantics, not an array merge after independent pagination.

Required repair: define one authorized tenant-local published projection that includes both retained imported records and native records.
Use query-level filtering, deduplication, sorting and pagination. Preserve provenance without letting provenance hide products.
Test mixed-source list, product details, exact totals, search/filter, brands/categories and content sections.

### N02 — Variant combination identity is not canonical — P1

Source: `product-variant.service.ts`, `normalizeOptions()`, and the options backfill migration.
Option pairs retain input slot order. `color=red|size=m` differs from `size=m|color=red`.
Both describe the same combination but bypass combination uniqueness.
The delimiter format also permits ambiguous signatures when user input contains `|` or `=`.

Required repair: define a stable, unambiguous canonical representation with a documented normalization policy.
Use the same algorithm for new writes and existing-record migration. Detect collisions before adding constraints.
Test reordered pairs, delimiter-bearing values, case/whitespace, duplicate names and concurrent equivalent creates.
Never silently delete or merge existing variants to make migration pass.

### N03 — Valid variant input exceeds signature storage — P1

The route permits three option names up to 80 characters and values up to 120 characters.
The resulting signature column is only `VARCHAR(191)`.
A service payload within those limits produced a 208-character signature with two options.
The API can accept input that cannot fit the database representation.

Required repair: select bounded canonical storage or a digest with collision-safe source comparison.
Align migration, route schemas, service validation, indexes and error handling.
Test maximum legal payloads, Unicode byte limits and existing-schema upgrades without truncation.

### N04 — Staff pagination and filtering do not meet the UI contract — P2

Source: `web/src/shared/catalog-paging.tsx` and product/variant workspaces.
The custom pager is unconditionally rendered, including totals at or below 100.
It lacks the shared `WorkspacePagination` behavior and 20/50/100 selector for larger datasets.
Search/filter changes do not reset the URL page. A filtered result can therefore appear empty on an old page.
`listTools.matches()` filters only the returned server page, while status counts are computed from that page.
This does not provide complete server-backed filters/counts for larger datasets.

Required repair: reuse shared UI, reset or clamp pages, implement authorized backend filters and counts, and remove the duplicate pager.
At totals <=100 return all matches and hide paging. Above 100 support 20/50/100 choices.
Test totals 0/20/99/100/101/250, filter changes from later pages, exact totals and rows outside the first page.
Finish concrete Show, App Header actions, activity, validation and mobile checks before accepting EC-T03/EC-T05.

### N05 — Provider schema proposals conflict with repository identity rules — P2

Source: `agent/contracts/C02-PORTAL-PRINCIPALS.md` proposes `BIGINT`, `CHAR(36)` UUID and ENUM statuses.
`C03-BILLING-HANDOFF.md` also proposes a `CHAR(36)` commerce source UUID.
These examples are not implementation-ready under the current integer-ID, eight-hex UUID and VARCHAR status conventions.
The portal proposal must also clarify master identity versus tenant-local Core contact/company references.

Required repair: reconcile proposals with current owner schemas and tenancy rules before freezing contracts.
Document any necessary exception explicitly. Do not copy proposal SQL into migrations or duplicate tenant data globally.
Preserve existing staff authentication behavior and prove restricted portal scope through provider/consumer tests.

### N06 — Repair acceptance and documentation still need reconciliation — P2

TASK accurately keeps several repairs pending independent review, but EXECUTION still opens with old dispatch/review status.
EC-R04 evidence covers a basic product fixture at 1440/390/320, not the complete all-section, staff and 768-pixel acceptance target.
Do not convert a few repaired smoke checks into full EC-R04 or EC-T16 acceptance.

Required repair: independently re-review changes, record exact evidence, update current document entry points, and keep future checks pending.
Use historical headings for old host/model/dispatch records. Do not overwrite their history.
Test every required section and staff workflow with representative product images and variants at all required widths.

## Next delivery order

1. Independently review the EC-R repair implementation. Close N01–N03 before accepting catalog correctness.
2. Repair N04 in the existing staff tasks. Complete N05 provider contract review without changing provider behavior silently.
3. Finish EC-T03 catalog attributes/specifications/collections, EC-T04 media/gallery and EC-T05 staff UX.
4. Complete EC-T06 home sections, discovery and server-delivered SEO with fixture-backed visual acceptance.
5. Resolve portal, Billing and event delivery contracts, then implement stock allocation, cart, checkout and orders.
6. Continue payments/reconciliation, fulfillment/tracking, returns/refunds and vendor workflows in dependency order.
7. Complete service integrations, approved industry behavior, full local E2E and recovery. Expand Frappe sync only after local acceptance.

## Copyable supervisor prompt

```text
You are the single Ecommerce supervisor and integration owner in D:\workspace\codexsun.
The human authorizes local implementation using supervisor and native subagents, independent review and meaningful tests.

Read AGENTS.md, assist/AGENT-GUIDE.md, assist/governance/rules.md, module-boundaries, tenant-isolation, API guidelines and design-system-helper.
Read apps/ecommerce/README.md and agent/{TASK,PLAN,SKILLS,E2E-PLAN,CONTRACTS,DECISIONS,EXECUTION}.md.
Read agent/CURRENT-REVIEW-AND-NEXT-PROMPT.md in full, the earlier DELIVERY-REVIEW, REPAIR-EVIDENCE, REVIEW-CONTINUATION-PROMPT, contracts/ and tasks/ packets.
Current source and this latest review take precedence over stale status summaries. Recheck every finding before changing code.

Preserve the repaired zero-remote public read path, tenant test harness and media bridge. Do not redo completed groundwork or create duplicate services.
First independently review EC-R01–EC-R09 and repair N01–N06 from the latest review:
- Unify native and imported records into a complete tenant-local published projection with correct filtering, counts, sorting and pagination.
- Canonicalize variant combinations independent of option order with unambiguous encoding and storage that fits every legal payload. Use a compatible collision-reviewed migration.
- Replace the custom pager with shared WorkspacePagination, hide it at <=100, reset/clamp pages and implement backend filters/counts with 20/50/100 choices above 100.
- Reconcile portal/Billing schema proposals with current integer IDs, eight-hex UUIDs, status and tenancy rules.
- Keep repair and visual acceptance pending until exact independent evidence exists. Fix stale document entry points.

Use one supervisor, disjoint worker file leases and an independent reviewer. Reserve manifests, lockfile, exports, shared routes/styles, migration registration and ledgers for the integrator.
Capture revision and dirty baseline. Do not overwrite unrelated changes or run overlapping edits/builds. Verify actual tools/models and never invent worker evidence.
Apply the code-style skill and concrete module-owned backend/frontend patterns. No generic CRUD registries, arbitrary-path clients, private sibling imports or dummy implementations.
Reuse @codexsun/ui, Platform/Framework infrastructure, Core product/contact identity, Billing financial ownership, and CRM/Mail/Chat contracts.
Inspect each provider's documents, existing behavior and consumers before recording and implementing a compatible cross-owner change. Do not silently alter other apps or duplicate identity, stock authority, accounting, storage or messaging services.

Prove each defect with a failing regression, implement the repair, run focused tests, obtain independent review, integrate and rerun affected checks.
Use disposable MariaDB and storage fixtures for persistence, migration and two-tenant/company/customer/vendor denial tests. Verify real foreign assets, exact counts, concurrency, duplicate requests and restart recovery.
Verify product/gallery/staff/home flows with published fixture content at 1440/768/390/320. No crop, hidden rows or silent skipped product checks. Verify raw HTML SEO separately.
Run root npm formatting, lint, API/web/storefront typechecks, boundaries, relevant builds, dependencies, component docs and applicable Docs checks.
Record exact commands, results, source revisions and limits. Distinguish unit, disposable DB, browser, sandbox and production evidence.

Then complete EC-T03/T04/T05, EC-T06 and all remaining dependency-ready local tasks through EC-T16 according to E2E-PLAN.
Implement full orders, stock reservations, payments/Billing reconciliation, shipping/tracking, returns/refunds, customer/vendor portals and approved industry behavior only through accepted contracts.
Resolve routine technical gaps through concrete owner-impact proposals. Escalate genuine business/security decisions with specific options and continue independent work.
Keep EC-T17 Frappe expansion deferred until local acceptance. Local commerce must work with Frappe disabled or offline.

No deployment, Git push, destructive live-data changes, real money movement or external customer messages are authorized.
Do not expose secrets. Never weaken authorization, safety guards or tests to obtain a pass.
Continue implementation rather than stopping at plans. Finish with accepted task IDs, exact evidence, migration requirements, remaining blockers and unrun checks. Do not claim complete Ecommerce until its local E2E journeys pass.
Begin with current-source verification, independent repair review and N01–N03 regression tests.
```
