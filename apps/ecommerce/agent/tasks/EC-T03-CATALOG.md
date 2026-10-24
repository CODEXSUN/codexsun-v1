# EC-T03: Products, variants and attributes

Status: pending. Phase: P2. Prerequisites: T00, T01, T02.
Owner: assigned by the supervisor after verifying prerequisites and write leases.

## Required reading

Read ../SUPERVISOR-PROMPT.md, ../EXECUTION.md, ../E2E-PLAN.md, ../CONTRACTS.md and ../DECISIONS.md.
Read the owning component documents and exact current source before writing.
The complete E2E plan remains authoritative for scope, boundaries and acceptance.

## Concrete deliverable

Extend existing Core-linked records. Implement concrete List/Show/Upsert, option combinations, specifications, collections and publication.

Deliver backend persistence, validated contracts, permission checks, activity, frontend and tests together where applicable.
Do not replace concrete leaf modules with generic CRUD metadata, arbitrary paths or shared business repositories.

## Allowed scope and leases

Candidate scope: product-information, product-variant and approved new attribute leaves.
The supervisor must replace this scope with exact allowed paths before dispatch. This packet alone is not a write lease.
Reserve shared exports, manifests, lockfile, routes, styles, migration registration and task ledgers for the integrator.
Record cross-owner impact and compatibility before requesting any provider change.
Preserve unrelated work and current records. Use disposable databases/storage for mutation tests.

## Acceptance

Core lookup validation, inactive/missing parent, duplicate SKU/options, optimistic edit conflict, DB reload and draft/public separation.

Enforce tenant/company and applicable customer/vendor scope on every returned record, count, export, file and event.
Use the approved Core references, integer internal IDs, eight-hex UUIDs, unique constraints and repeatable migrations.
Money/quantity transitions require concurrency, idempotency and recovery evidence, not just happy-path tests.
For staff screens verify List/Show/Upsert, App Header actions, inline filters, search, columns and the 100-row paging contract.
For public screens verify real backend content, publication, complete images, loading/empty/error/denied states and accessibility.

## Test suite and review

Run focused unit/contract tests and disposable MariaDB integration/E2E for changed behavior.
Run owner formatting, lint, API/web typecheck, boundaries and relevant builds from the repository root.
Run provider/consumer regression tests after public contract or shared UI changes.
Run 1440/768/390/320 browser checks for changed interfaces. Save live screenshots and verify persisted data.
The supervisor assigns a separate reviewer, repairs findings and reruns checks after integration.
Use the complete E2E-PLAN section 11 cases applicable to this task. Record exact case IDs in the dispatch.

## Evidence to fill during execution

- Base/source revision and dirty baseline: `ef5b3b3` plus uncommitted repair/catalog work; dirty baseline in `dist/ecommerce-scratch/baseline/`.
- Worker, effective model, exact paths and lease generation: supervisor, `opencode/deepseek-v4.1-flash-free`; product-information and product-variant API/web modules plus the tenancy harness.
- Accepted contract revisions and prerequisites: EC-T00 contracts; EC-T02 local-only repair pending re-acceptance (EC-T03 does not depend on remote reads).
- Changed files and database compatibility: additive `revision` and `option_signature` columns plus the option unique index; legacy rows are backfilled before the index.
- Commands, exit codes and exact observed results: tenancy A1-A13 exit 0; N04 non-browser log 13 groups (`dist/ecommerce-scratch/evidence/ec-n04-postfix.log`); Chrome log 14 groups including R04 and staff paging (`dist/ecommerce-scratch/evidence/ec-n04-browser.log`); focused 32/32 suite, API/web typecheck, lint and module boundaries pass.
- Database fixture IDs, screenshots and recovery evidence: A11-A13 use disposable Core/product/variant rows and drop all generated databases; staff screenshots at 1440/1024/390 and one-row 1440 are under `dist/ecommerce-scratch/ecommerce-browser-1792864760930/`.
- Independent reviewer, findings and repairs: not yet assigned; N01-N06 review pending.
- Integrated verification and remaining limits: attributes, specifications, collections, Show/App Header actions, activity, invalid-field feedback, 768/320 checks and review remain.
- Status and supervisor acceptance: in progress, not accepted.

Do not mark accepted until the integrated behavior passes its acceptance tests.
Mocks, database E2E, browser checks, sandbox providers and production verification remain distinct evidence.
