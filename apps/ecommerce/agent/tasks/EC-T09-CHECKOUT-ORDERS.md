# EC-T09: Cart, checkout and orders

Status: pending. Phase: P4. Prerequisites: T07, T08.
Owner: assigned by the supervisor after verifying prerequisites and write leases.

## Required reading

Read ../SUPERVISOR-PROMPT.md, ../EXECUTION.md, ../E2E-PLAN.md, ../CONTRACTS.md and ../DECISIONS.md.
Read the owning component documents and exact current source before writing.
The complete E2E plan remains authoritative for scope, boundaries and acceptance.

## Concrete deliverable

Build durable carts, guest merge, expiring server quotes and idempotent order acceptance with immutable line/policy snapshots.

Deliver backend persistence, validated contracts, permission checks, activity, frontend and tests together where applicable.
Do not replace concrete leaf modules with generic CRUD metadata, arbitrary paths or shared business repositories.

## Allowed scope and leases

Candidate scope: cart, checkout, order and owned child leaves.
The supervisor must replace this scope with exact allowed paths before dispatch. This packet alone is not a write lease.
Reserve shared exports, manifests, lockfile, routes, styles, migration registration and task ledgers for the integrator.
Record cross-owner impact and compatibility before requesting any provider change.
Preserve unrelated work and current records. Use disposable databases/storage for mutation tests.

## Acceptance

Double submit/lost response, stale price, changed stock, forged total/currency, concurrent edit, rejected transition and persisted customer order view.

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

- Base/source revision and dirty baseline:
- Worker, effective model, exact paths and lease generation:
- Accepted contract revisions and prerequisites:
- Changed files and database compatibility:
- Commands, exit codes and exact observed results:
- Database fixture IDs, screenshots and recovery evidence:
- Independent reviewer, findings and repairs:
- Integrated verification and remaining limits:
- Status and supervisor acceptance:

Do not mark accepted until the integrated behavior passes its acceptance tests.
Mocks, database E2E, browser checks, sandbox providers and production verification remain distinct evidence.
