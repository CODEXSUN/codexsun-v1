# Ecommerce supervisor execution

## Current repair execution - 2026-10-24 (N01-N06)

Status: N01-N04 are implemented and verified locally; N05 provider contracts are reconciled without
provider behavior changes; N06 reconciliation is current. Independent review of N01-N06 and the
remaining EC-T03/EC-T05 scope are still pending.

- Current HEAD: `8d67a35115585838c8b8cfaeed7958ecbede32e9`; Ecommerce work remains uncommitted.
- N01-N03: canonical option identity/migration/seed, registered composition migration `1.0.85`, and
  imported/native projection. Focused suite: 32/32 pass.
- N04: backend filters and status counts, shared paging, page reset/clamp, pager hidden at <=100 and
  20/50/100 above 100. Helper tests 4/4 pass.
- Disposable tenancy E2E without browser: exit `0`, 13 assertion groups, A11-A13 pass, cleanup
  `remaining=0` (`dist/ecommerce-scratch/evidence/ec-n04-postfix.log`).
- Disposable tenancy E2E with Chrome: exit `0`, 14 assertion groups, R04 and staff product/variant
  paging at 1440/1024/390 pass. Screenshots under
  `dist/ecommerce-scratch/ecommerce-browser-1792864760930/`; log
  `dist/ecommerce-scratch/evidence/ec-n04-browser.log`.
- Gates: API/web typecheck, API/web lint and module boundaries pass. No real tenant, master database,
  provider or Git remote was modified.
- Remaining: independent N01-N06 review; attributes/specifications/collections; Show/App Header
  actions, activity, invalid-field feedback and 768/320 checks before EC-T03/EC-T05 acceptance.

Historical sections below are retained and are not current status.

## Historical session opening
Status: EC-T00 delivered and under independent review; EC-T01 and EC-T02 dispatched 2026-10-24.
Scope: complete the local P0–P8 plan. Frappe remote behavior remains deferred.

## Initial OpenCode handoff — 2026-10-24

Submitted the supervisor instruction through the existing OpenCode desktop IDE in the codexsun workspace.
The selected model was DeepSeek V4.1 Flash Free, with High effort.
The provider returned `Free usage exceeded, subscribe to Go` before implementation started.
No supervisor reasoning, worker creation, task completion, or model availability is claimed.
Execution needs restored provider capacity or a human-selected available model. The task pack remains pending.

## Execution environment — 2026-10-24 (DeepSeek Harness session)

- Host: DeepSeek Harness, native teammates (Agent Teams) with a shared filesystem.
- Effective model: `deepseek-flash` for the Lead and every teammate. The requested
  `opencode/deepseek-v4.1-flash-free` does not exist in this runtime; no work is claimed under it.
- Base revision: `fec76ade4adb787c8bf3f2bc812d564bd5d7e807` when EC-T00 froze the contracts, advanced to
  `61710dd91c9716b767101e47b0e289b2cc2e8ce0` by an unrelated commit during the session; EC-T01/EC-T02 were
  built and reviewed at `61710dd9`. 62-entry dirty baseline preserved (see TASK.md).
- Database: MariaDB 13.0.2 on 127.0.0.1:3306. Real tenants `codexsun_db`, `sukraa_db`, `altex_db` are
  read-only to this work. Mutation evidence uses disposable databases only.
- Tooling limit: no Playwright/Puppeteer dependency. The repository's own CDP helper
  (`tools/e2e/tconnect-negotiation-browser.mjs`, `BrowserPage` + local Chrome) is the available path
  for real browser evidence.
- File-permission note: the sandbox initially allowed writes only at the repository root; the existing
  workspace grant was applied to the subtree before any source write. No file content, owner or
  unrelated change was affected.

## Dispatch records

| Task   | Worker            | Goal                                            | Base | Prereqs          | Contract                | Lease                                  | Stop conditions                                                                    |
| ------ | ----------------- | ----------------------------------------------- | ---- | ---------------- | ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| EC-T00 | lead + inv-*      | Baseline, freeze EC-C01–C11, resolve EC-D01–D10 | base | none             | v1                      | none                                   | missing authority; unreadable owner contract                                       |
| EC-T01 | t01-tenancy       | Disposable two-tenant harness and denial tests  | base | EC-T00 (review)  | EC-C01/02/06 v1         | L1                                     | needs another owner's source; denial not reproducible; would write a real database |
| EC-T02 | t02-local-catalog | Local-authoritative catalog reads               | base | EC-T00 (review)  | EC-C01/06/09, EC-D01 v1 | L2                                     | needs a file outside lease; test only passes weakened; needs provider change       |
| review | review-t00        | Independent EC-T00 verification                 | base | EC-T00 delivered | v1                      | only `dist/ecommerce-scratch/reviews/` | —                                                                                  |

Worker rules applied: no agent spawning, no shared-file writes, no secret exposure, no writes to a real
tenant or master database, no git operations, and reported exact commands with exit codes. The
supervisor re-runs every gate and inspects the diff before accepting a task.

## Task dependency map

| Task   | Deliverable                                             | Prerequisites                |
| ------ | ------------------------------------------------------- | ---------------------------- |
| EC-T00 | Baseline, decisions, contracts and write leases         | None                         |
| EC-T01 | Tenant/company isolation harness and permissions        | T00                          |
| EC-T02 | Local-authoritative catalog migration                   | T00, T01                     |
| EC-T03 | Complete product/variant/attribute slice                | T00, T01, T02                |
| EC-T04 | Media, gallery and file-picker integration              | T00, T01                     |
| EC-T05 | Staff List/Show/Upsert and reusable UI gaps             | T00, T01                     |
| EC-T06 | Home sections, discovery, SEO and legal policies        | T02, T03, T04, T05           |
| EC-T07 | Customer identity, portal, address links and wishlist   | T00, T01, T05                |
| EC-T08 | Price/tax/discount and stock allocation contracts       | T00, T01, T03                |
| EC-T09 | Cart, checkout and order acceptance                     | T07, T08                     |
| EC-T10 | Payment attempts, Billing handoff and reconciliation    | T00, T09                     |
| EC-T11 | Fulfillment, shipment and movement tracking             | T09, T10                     |
| EC-T12 | Cancellation, rejection, returns, exchanges and refunds | T10, T11                     |
| EC-T13 | Vendor portal, offers, suborders and settlement         | T07, T08, T09, T10, T11, T12 |
| EC-T14 | Durable service integrations and reports                | T09, T10, T11, T12           |
| EC-T15 | Approved industry features and compatibility            | T03, T08, T09, T11, T12, T13 |
| EC-T16 | Combined E2E, performance, recovery and local readiness | T01–T15                      |
| EC-T17 | Deferred Frappe mapping and sync task design            | T16 accepted                 |

The supervisor may split packets into smaller leaf tasks. Preserve parent IDs and acceptance gates.
Independent tasks can run together only with non-overlapping write leases.

## Worker dispatch contract

Each dispatch records task ID, goal, base revision, dirty baseline, contract version, accepted prerequisites, and worker identity/model.
It specifies allowed files, reserved files, dependency requests, tests, E2E cases, time/token budget and stop conditions.
Workers stop before an unapproved cross-owner change, conflicting write, secret exposure, or missing domain contract.
They report changed paths, exact commands/results, migration effects, evidence and concrete remaining issues.
Reviewers do not accept a summary without inspecting code and relevant test results.

## Shared write ownership

The supervisor serializes package manifests, lockfile, exports, router/menu composition, common styles and migration registration.
New table ownership remains inside each leaf. The supervisor integrates migration ordering after reviewing foreign-key prerequisites.
Shared UI or provider changes require an owner-impact entry in DECISIONS.md and consumer regressions.
Maintain leases in TASK.md with owner, paths, state and release timestamp. Do not create fictitious agent records.

## Status and evidence

States: pending, ready, running, review, changes-required, blocked, accepted.
Accepted means implemented, reviewed, integrated and verified against the current combined source.
Any later contract change invalidates dependent evidence until the supervisor reruns affected checks.
Use task packets for detailed evidence and TASK.md for the execution index.
Do not mark the historical plan's unchecked capabilities complete merely because a worker created files.

## Permission limits

Local development and disposable test data are authorized.
Deployment, Git push, destructive live-data operations, external sends and live money movement require separate authority.
Continue independent work when credentials or business decisions block a specific integration.
Use explicit unavailable states instead of fake successful integrations.

## Repair wave EC-R01-EC-R09 (2026-10-24, after DELIVERY-REVIEW-2026-10-24)

The delivery review reopened EC-T02 against the original local-only requirement and qualified EC-T01 as
tenant-boundary evidence only. The prior execution sections above are historical; the reconciled status
is in TASK.md "Current status - authoritative".

| Repair | Classification                   | Owner                         | Lease                                          | Delivered outcome                                   |
| ------ | -------------------------------- | ----------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| EC-R01 | Immediate P1                     | supervisor                    | catalog-data-source service + tests            | Done: local-only public reads.                      |
| EC-R02 | Immediate P1                     | supervisor                    | catalog-data-source tests                      | Done: pre-fix 5 failures, repair 9/9 pass.          |
| EC-R03 | Immediate P2                     | supervisor                    | tools/e2e/ecommerce-storefront-browser.e2e.mjs | Done: `/cart`, exact identity, image checks.        |
| EC-R04 | Linked to EC-T03/T04/T05/T06/T16 | supervisor                    | fixtures + browser suite                       | Done: disposable published fixture at 1440/390/320. |
| EC-R05 | Immediate P2                     | supervisor                    | tools/e2e/ecommerce-tenancy.e2e.ts             | Done: positive B image, A denial, exact catalog.    |
| EC-R06 | Immediate P2                     | supervisor                    | agent ledgers + README                         | Done: current status and evidence reconciled.       |
| EC-R07 | Parallel design                  | supervisor                    | apps/ecommerce/agent/contracts/                | Done: five review packets, no provider code.        |
| EC-R08 | Immediate P2                     | supervisor                    | tools/e2e/ecommerce-{access,modules}.e2e.ts    | Done: retired shims, safe cleanup, failure drill.   |
| EC-R09 | Linked to EC-T04                 | supervisor (packet amendment) | media storage + tasks/EC-T04-MEDIA.md          | Done: verified tenant root, idempotent legacy copy. |

Detailed commands, exits, raw log paths and exact limits: `REPAIR-EVIDENCE-2026-10-24.md`.

Repairs that depend on a later original task are recorded as linked deferred acceptance checks in the
task packets; they are not marked accepted until that check runs.

## Dispatch records - repair wave

| Repair             | Worker     | Base     | Lease (generation 2)              | Write scope                                                                                                                                   | Stop conditions                                                                      |
| ------------------ | ---------- | -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| EC-R05/R08         | w-r0508    | 61710dd9 | ecommerce E2E harnesses           | tools/e2e/ecommerce-tenancy.e2e.ts, tools/e2e/ecommerce-access.e2e.ts, tools/e2e/ecommerce-modules.e2e.ts, tools/e2e/ecommerce-e2e-support.ts | would need product source or ledger edits; assertion weakening; real database writes |
| EC-R07             | w-r07      | 61710dd9 | provider contract packets         | apps/ecommerce/agent/contracts/**                                                                                                             | needs owner source change; unresolved business decision presented as technical       |
| EC-R01/R02/R03/R06 | supervisor | 61710dd9 | catalog + browser tests + ledgers | catalog-data-source service/tests, storefront browser script, agent ledgers, README                                                           | contract change outside Ecommerce; check that cannot be run                          |

Each worker reports changed paths, exact commands and exits, generated disposable databases and cleanup
evidence. The supervisor reruns affected gates on the combined tree before accepting.

## EC-T03 catalog slice (2026-10-24, in progress)

Source: `ef5b3b3` plus the uncommitted repair and catalog work. Effective model: `opencode/deepseek-v4.1-flash-free`.

Implemented in this slice:

- Product information List/Show/Upsert/Archive keeps the Core product and brand lookups, rejects missing/inactive Core products, duplicate Core links and duplicate slugs, and separates draft from published public reads.
- Every update requires `expectedRevision`; the repository increments `revision` in the same conditional UPDATE, so a stale edit returns 409 instead of overwriting.
- List endpoints return `{ items, page, pageSize, total }` with a hard maximum of 100 rows. Staff workspaces have Previous/Next controls.
- Variants validate archived/missing parents and inactive Core products, unique SKUs, and unique normalized option combinations per product (`option_signature`). Updates use the same revision guard.
- Additive migrations: `ecommerce.modules.product-information-revision` and `ecommerce.modules.product-variant-options` (backfills signatures, detects existing duplicate combinations before adding the unique index).

Verification:

- `node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts` exit 0; 11 assertion groups including A11. Log: `dist/ecommerce-scratch/evidence/ec-t03-tenancy-final.log`.
- `ECOM_TENANCY_BROWSER=1` same command exit 0; 12 groups including A11 and R04. Log: `dist/ecommerce-scratch/evidence/ec-t03-tenancy-browser.log`.
- `npm run typecheck -w @codexsun/ecommerce-api`, `npm run typecheck -w @codexsun/ecommerce-web`, both lint commands, API build and `node tools/check-module-boundaries.mjs ecommerce` passed.

A11 covers inactive/missing Core parent, duplicate Core link and slug, stale and successful product edits, draft 404 vs published 200, page-size cap, duplicate SKU, canonical duplicate option pair, partial option rejection, stale/successful variant edit, archived parent rejection, and raw SQL reload of revision and `option_signature`.

Not yet delivered for EC-T03: attribute leaves, product specifications, collections, staff-screen browser checks at 1440/768/390/320, and an independent review. Status stays in progress.
