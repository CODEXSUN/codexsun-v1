# EC-T01: Tenant and actor foundation

Repository source: `apps/ecommerce/agent/tasks/EC-T01-TENANCY.md`

Source SHA-256 (LF line endings): `7a390a8d0f791fb3784c1533912f569bd726ea2e06de06995aa76bbe1e84ffbf`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# EC-T01: Tenant and actor foundation

Status: accepted 2026-10-24 (implemented by t01-tenancy, supervisor-verified, independently reviewed). Phase: P1. Prerequisites: T00.
Owner: assigned by the supervisor after verifying prerequisites and write leases.

## Required reading

Read ../SUPERVISOR-PROMPT.md, ../EXECUTION.md, ../E2E-PLAN.md, ../CONTRACTS.md and ../DECISIONS.md.
Read the owning component documents and exact current source before writing.
The complete E2E plan remains authoritative for scope, boundaries and acceptance.

## Concrete deliverable

Build two-tenant, two-company, customer/vendor fixtures and permission scopes. Validate host/session binding and worker context.

Deliver backend persistence, validated contracts, permission checks, activity, frontend and tests together where applicable.
Do not replace concrete leaf modules with generic CRUD metadata, arbitrary paths or shared business repositories.

## Allowed scope and leases

Candidate scope: Ecommerce request scope, permissions, disposable test harness.
The supervisor must replace this scope with exact allowed paths before dispatch. This packet alone is not a write lease.
Reserve shared exports, manifests, lockfile, routes, styles, migration registration and task ledgers for the integrator.
Record cross-owner impact and compatibility before requesting any provider change.
Preserve unrelated work and current records. Use disposable databases/storage for mutation tests.

## Acceptance

Forged tenant/database headers, unknown host, revoked session, cross-company references, disabled app, cross-customer/vendor access and denied files/counts.

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

- Base/source revision and dirty baseline: `61710dd91c9716b767101e47b0e289b2cc2e8ce0` (the tree advanced
  from `fec76ade` by an unrelated Data Migration commit while this session ran). The recorded 62-entry
  dirty baseline is preserved (see EC-T00).
- Worker, effective model, exact paths and lease generation: `t01-tenancy` (`deepseek-flash`), lease L1
  generation 1, allowed paths `tools/e2e/ecommerce-tenancy.e2e.ts` and
  `apps/ecommerce/api/src/modules/ecommerce-scope/**`. The `ecommerce-scope` folder was NOT created:
  the existing `apps/ecommerce/api/src/database/ecommerce-database.ts` request scope is the real
  contract and was imported read-only. No other file was written by the worker.
- Accepted contract revisions and prerequisites: EC-C01, EC-C05, EC-C06 (migration ledger only),
  EC-C09 v1. EC-T00 accepted (review ACCEPT WITH FINDINGS, repaired). Customer/vendor _principal_
  sessions remain blocked by EC-C02; this task proves tenant/company/actor scope and fixture data,
  not portal logins.
- Changed files and database compatibility: `tools/e2e/ecommerce-tenancy.e2e.ts` (new, 1130 lines);
  `package.json` gained `test:e2e:ecommerce-tenancy` (supervisor-owned script registration). No schema
  or migration change; the harness provisions two disposable tenants through the production
  provisioning pipeline.
- Commands, exit codes and exact observed results:
  - `node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts` executed twice
    (worker run and supervisor run) with 9/9 PASS groups each:
    A1 staff read with session -> 200; A2 no session / revoked session / absent slot -> 401;
    A3 forged `x-tenant-db`/`x-tenant-id` ignored (signed claims select the database);
    A4 tenant-B-only record ID -> 404 through tenant A; A5 Ecommerce-disabled tenant B -> 403 with no
    leak; A6 live removal of `ecommerce.catalog.view` -> 403 then restore -> 200;
    A7 unknown + suspended host -> 404 in multi-tenant mode; A8 scope accessors outside
    `runWithEcommerceRequestScope` -> forbidden; A9 two companies, two customer contacts and two
    vendor contacts in A, invisible from B's public scope.
  - `node tools/check-module-boundaries.mjs ecommerce` -> exit 0.
  - `npm run typecheck -w @codexsun/ecommerce-api` -> exit 0.
  - `npx prettier --check tools/e2e/ecommerce-tenancy.e2e.ts` -> exit 0 (worker run).
  - Cleanup verified: `[e2e] cleanup: generated databases remaining=0; close warnings=0; drop
warnings=0`; an independent `information_schema` query found no `codexsun_ecommerce%` databases;
    the real `codexsun_master_db` still has exactly the three original tenants (CODEXSUN, SUKRAA,
    ALTEX) and no new domains.
- Database fixture IDs, screenshots and recovery evidence: each run generated its own
  `codexsun_ecommerce_tenancy_e2e_<timestamp>` master plus `_a`/`_b` tenant databases and dropped all
  three; fixture tenants `E2ETA<ts>` (ecommerce enabled) and `E2ETB<ts>` (ecommerce disabled), two
  companies, two Customer and two Supplier/vendor contacts in A. No screenshots (backend E2E).
- Independent reviewer, findings and repairs: `review-t00` (non-producer) re-ran this harness
  and reviewed the file. Verdict ACCEPT WITH FINDINGS, no blocker; report
  `dist/ecommerce-scratch/reviews/ec-t01-t02-review.md`. Repairs applied after that review:
  (a) an explicit `setTimeout(() => process.exit(0), 250)` after the cleanup block, because the
  Platform API leaves long-lived handle timers that could hang a CI job after the assertions and
  cleanup finished (a failed assertion still exits non-zero); (b) a generated-name guard before
  the single DROP loop so a future edit cannot drop a database this run did not create;
  (c) an authorized-count assertion, a duplicate-row assertion and a denied public media/file
  request (path traversal and a foreign filename both rejected) to cover the "denied
  files/counts" acceptance line. Final supervisor run after these repairs: 9/9 PASS groups,
  cleanup `generated databases remaining=0`, captured exit code 0.
- Integrated verification and remaining limits:
  - LIMIT: no browser evidence here (covered separately by `ecommerce-storefront-browser.e2e.mjs`).
  - LIMIT: no customer/vendor principal sessions (EC-C02 missing) and no queue-job tenant context
    (Ecommerce registers no queue job today, EC-C06).
  - LIMIT: the public-host check marks its own disposable `tenant_domains` rows active/verified, so
    the DNS verification workflow itself is not exercised.
  - LIMIT: multi-tenant mode only; single-tenant mode is not exercised by this harness.
  - Runtime cost: observed 50-160 seconds per run once the migration path is warm; the first run in this
    session took longer. Two full tenant databases are provisioned through the production pipeline.
- Status and supervisor acceptance: accepted after the reviewer confirmed the run and the supervisor
  inspected the assertion bodies. No assertion was weakened to obtain a pass.
```
