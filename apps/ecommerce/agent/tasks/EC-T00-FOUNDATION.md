# EC-T00: Foundation and contract freeze

Status: accepted 2026-10-24 (independent review ACCEPT WITH FINDINGS; all findings repaired). Phase: P0. Prerequisites: None.
Owner: supervisor (`lead`, effective model `deepseek-flash`) with read-only inventory workers `inv-core`, `inv-finance`, `inv-platform`.

## Required reading

Read ../SUPERVISOR-PROMPT.md, ../EXECUTION.md, ../E2E-PLAN.md, ../CONTRACTS.md and ../DECISIONS.md.
Read the owning component documents and exact current source before writing.
The complete E2E plan remains authoritative for scope, boundaries and acceptance.

## Concrete deliverable

Inventory source, dirty changes, scripts, schema history, public consumers and existing data. Resolve EC-D01-EC-D10 and freeze EC-C01-EC-C10. Verify native worker capabilities and effective models.

Deliver backend persistence, validated contracts, permission checks, activity, frontend and tests together where applicable.
Do not replace concrete leaf modules with generic CRUD metadata, arbitrary paths or shared business repositories.

## Allowed scope and leases

Candidate scope: agent contract/decision documents only until leases are approved.
The supervisor must replace this scope with exact allowed paths before dispatch. This packet alone is not a write lease.
Reserve shared exports, manifests, lockfile, routes, styles, migration registration and task ledgers for the integrator.
Record cross-owner impact and compatibility before requesting any provider change.
Preserve unrelated work and current records. Use disposable databases/storage for mutation tests.

## Acceptance

Contract review, dirty-baseline preservation, dependency graph and exact path leases. Stock and financial authority must be explicit.

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

## Evidence - executed 2026-10-24

- Base/source revision and dirty baseline: `fec76ade4adb787c8bf3f2bc812d564bd5d7e807` (main). The tree then advanced to `61710dd9` (unrelated Data Migration commit) during the session; the independent reviewer re-verified this packet at `61710dd9`.
  62 dirty entries / 45 modified tracked files at start; captured in
  `dist/ecommerce-scratch/baseline/{git-head.txt,git-status.txt,untracked.txt}`. Untracked work
  belonged to CodeIT, Core favicon, docs content and the pre-existing Ecommerce agent documents; none
  of it was modified by EC-T00.
- Worker, effective model, exact paths and lease generation: Lead `deepseek-flash`; inventory workers
  `inv-core`, `inv-finance`, `inv-platform` (`deepseek-flash`, Team task ids task-1..task-3), each
  writing only one report under `dist/ecommerce-scratch/inventory/`. No source path was written by a
  worker. Lease generation 1 is recorded in TASK.md.
- Accepted contract revisions and prerequisites: EC-C01..EC-C11 frozen/partial/missing/deferred as
  recorded in CONTRACTS.md (revision v1). EC-D01-EC-D10 resolved or explicitly blocked in
  DECISIONS.md. Stock authority is explicitly "none exists" (EC-D02/EC-C04). Financial authority is
  Billing's and its handoff contract is explicitly partial (EC-C03/EC-D03).
- Changed files and database compatibility: `apps/ecommerce/agent/{TASK,DECISIONS,CONTRACTS}.md` and
  this packet. No schema, migration, seed, source or configuration change; no database was mutated.
  Existing-schema compatibility requirement recorded under EC-D01 (31 applied `ecommerce.modules.*`
  steps, batch 1).
- Commands, exit codes and exact observed results:
  - `node tools/check-module-boundaries.mjs ecommerce` -> exit 0.
  - `npm run typecheck -w @codexsun/ecommerce-api` -> exit 0.
  - `npm run lint -w @codexsun/ecommerce-api` -> exit 0.
  - `npm run typecheck -w @codexsun/ecommerce-web` -> exit 0.
  - `npm run typecheck -w @codexsun/ecommerce-storefront` -> exit 0.
  - `node --import tsx --test <7 ecommerce test files>` -> exit 0, 16 tests pass, 0 fail.
  - Read-only MariaDB inventory (`dist/ecommerce-scratch/baseline/db-inventory*.mjs`): server
    MariaDB 13.0.2; tenant registry has CODEXSUN/SUKRAA/ALTEX; `codexsun_db` 301 tables with 17
    `ecommerce_*` tables and 31 applied ecommerce migrations; row counts recorded in EC-D01.
- Database fixture IDs, screenshots and recovery evidence: none created or required - this task is a
  read-only inventory plus documentation. No screenshots; no browser verification was possible in
  this task (no browser-triggering surface changed).
- Independent reviewer, findings and repairs: `review-t00` (non-producer, fresh context, effective
  model `deepseek-flash`). Verdict ACCEPT WITH FINDINGS, report at
  `dist/ecommerce-scratch/reviews/ec-t00-review.md`. Findings and their repairs:
  - R1 (major) EC-C05/EC-D06 claimed all media write under the Platform tenant root. Wrong: only the
    organisation logo does; product and slider media use `STORAGE_ROOT/ecommerce/<tenantKey>/...`.
    REPAIRED in CONTRACTS.md and DECISIONS.md, and recorded as EC-D10/EC-T04 debt.
  - R2 (major) dependent leases were released before EC-T00 acceptance while the ledger said
    "blocked only by EC-T00". REPAIRED: TASK.md now records the exception and the real statuses.
  - R3 (minor) EC-T08 blocked reason wrongly cited the stock contract. REPAIRED (EC-C03/EC-D03 only).
  - R4 (minor) prerequisite lists drifted from the packets. REPAIRED for EC-T03 and EC-T14.
  - R5 (minor) EC-D10 line range. REPAIRED to `catalog-data-source.repository.ts:278-316`.
  - R6 (minor) this packet was not valid UTF-8 and used "?" instead of arrows. REPAIRED: re-saved as
    UTF-8 and arrows restored; the reviewer can now read it.
  - R7 (minor) EC-C03 "no order->invoice link" was too broad. REPAIRED: Billing does carry
    `billing_sales.work_order_id` (a Core work order); the missing link is a commerce order link.
  - R8 (minor) EC-C02 "no CSRF token anywhere" was too broad. REPAIRED: scoped to the Platform
    contract; an unrelated devkit implements its own CSRF.
- Status and supervisor acceptance: ACCEPTED 2026-10-24 by the supervisor after the review and the
  repairs above. No finding was a contract blocker or a wrong MISSING claim.
- Integrated verification and remaining limits:
  - LIMIT: no browser automation package is installed (no Playwright/Puppeteer); the repository's
    existing browser E2E helpers drive a locally installed Chrome over CDP. Browser evidence in later
    tasks must use that path or be reported as not run.
  - LIMIT: `.env` `DEFAULT_TENANT_DB_NAME` is stale (recorded EC-D01); scripts that read it directly
    fail, while Platform uses the registry. Not changed by this delivery.
  - CONTRACT BLOCKERS recorded, not worked around: EC-C02 (no portal principal), EC-C03/EC-D03
    (Billing order/refund handoff), EC-C08 (no Mail/Chat injection), EC-C10/EC-D07 (marketplace money).

Do not mark accepted until the integrated behavior passes its acceptance tests.
Mocks, database E2E, browser checks, sandbox providers and production verification remain distinct evidence.
