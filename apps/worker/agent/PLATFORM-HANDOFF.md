# Platform background execution handoff

Date: 2026-10-26. Local implementation and audit evidence only.

## Checkout and authorization

- Root: `D:\workspace\codexsun-worktrees\platform`.
- Branch: `codex/platform`.
- Baseline: `44f2e542d0ce8efb8b3ff090e648d32705522901`, version `1.1.69`, initially clean.
- No staging, commit, push, pull, merge, version change, candidate, or deployment occurred.
- Githubs supervisor retains integration ownership. No other chat received a message.

## Source-grounded plan

The original Worker consumed only its probe queue. Platform composed and executed business queues.
Chatb proxied WebSockets. Chat owned authentication context, membership, messages, and local event delivery.

Historical Platform turns confirm module-owned handlers, additive Worker/Chatb adoption, and one active execution host.
Relevant turn IDs: `01a16f11-78bd-78a2-b77c-a389fa31bccf`, `01a16f18-9d62-77e3-b512-0b5223563995`,
`01a16f22-7e02-7413-86b1-cf433dc07fcb`, and `01a17115-cdac-7063-8654-af44846ec531`.
The [Worker architecture](../README.md) records the producer inventory and compatibility gates.

1. Completed: inventory producers, persisted delivery, schedulers, handlers, holds, retries, transport, and startup ownership.
2. Completed in source: add opt-in Worker execution through a public headless composition contract.
3. Completed in source: protect producer-only Platform and split background registration from HTTP route registration.
4. Completed locally: focused checks, real database fixtures, compiled artifact smoke checks, and independent review.
5. Blocked: real Redis delivery, full business-runtime acceptance, authenticated reconnect, and controlled cutover evidence.

## Implementation

- `@codexsun/platform-api/background` exposes a narrow declaration contract and compiled runtime alias.
- Worker owns dispatch and background scheduling when both services select `CODEXSUN_QUEUE_EXECUTION_HOST=worker`.
- The default remains `platform`. Platform retains API, identity, producers, queue administration, and observability.
- CRM/Frappe composition moved out of `app.ts`. Business processing remains in owner packages.
- Billing, Marketing, Data Bridge, Sites, and Telegram expose headless processor composition.
- Every execution entry point checks ownership. Manual failed jobs requeue for the selected executor.
- Immediate hints cannot start untracked work. Consumer and scheduler shutdown await active work before pools close.
- Pending Redis reconciliation scans all pages. Mail validates the registered active tenant and exact database.
- Worker prepares authoritative Core and Billing tenant connections before dispatch.
- Chat events require matching tenant, database, and company, plus current grants and channel membership.
- Existing sockets recheck Platform session validity and tenant authority when Chat authorizes an action or delivery.
- Telegram notifications use signed identity-only Redis events. Platform reloads persisted messages before authorized delivery.
- Chatb remains a proxy. Existing HTTP history and browser refresh remain reconnect compatibility behavior.
- The Worker image includes its business dependency closure. Deployment selection starts Worker independently of Chatb selection.
- No business schema migration was added. Existing databases were not migrated or reset.

## Subagents and independent findings

`queue_inventory` owned queue safeguards, recovery paging, relay drain, and focused regressions.
`chat_inventory` recovered historical decisions and owned scoped Chat events and Telegram lifecycle.
`background_hosts` split mixed route/background registration, then reviewed code written by other owners.
The primary agent owned composition, Worker startup, configuration, builds, and integration evidence.

Resolved review findings:

- Immediate execution escaped shutdown draining.
- A subscriber could unsubscribe while another subscriber awaited authorization and still receive a frame.
- Headless CRM processing lacked authoritative Core connection registration.
- Worker selection could disable Platform without starting Worker in deployment scripts.
- A notification unnecessarily queried unrelated tenants.
- Worker startup and partial relay initialization could leak resources after failure.
- The fixture could leak a child process after startup failure.
- Worker compilation imported private Platform request types instead of a narrow public declaration.

## Actual verification

All commands ran from the assigned root.

| Command or check                                                                      | Result and evidence limit                                                                |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`                                                         | Passed. Installed 858 packages in this worktree only.                                    |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`               | Passed. Recorded the Worker dependency on Platform.                                      |
| Focused queue and Chat test suite                                                     | 53 passed, one real-Redis test skipped.                                                  |
| Queue service regression rerun                                                        | Eight passed, including the added external failed-job manual-run case.                   |
| `node --import tsx --test apps/chatb/api/src/app.test.ts`                             | Three passed. Real local sockets with an upstream fixture.                               |
| `node --env-file=.env.fixture --import tsx tools/e2e/platform-worker-isolated.e2e.ts` | Passed, including a rerun after fixture cleanup changes.                                 |
| Platform, Worker, Chat, and Chatb workspace builds                                    | Passed.                                                                                  |
| Worker dependency closure build                                                       | 26 dependencies passed. Worker initially failed on private request augmentation types.   |
| Platform and Worker rebuild after public declaration fix                              | Passed. Compiled public background import passed.                                        |
| Platform, Worker, and Chat lint                                                       | Passed. Fixture and deployment regression lint passed.                                   |
| Deployment environment suite                                                          | Twelve passed. The added Worker-without-Chatb control-token regression also passed.      |
| Owner boundary checks for Chat and Platform                                           | Passed.                                                                                  |
| Repository-wide boundary check                                                        | Failed on eight missing `legacy-cxapp` Data Bridge role files, untouched by this change. |
| Component documentation checks and tests                                              | Passed, two tests.                                                                       |
| `npm run docs:sync` and `npm run docs:check`                                          | Passed. Generated references cover the changed owner documents.                          |
| `npm run dependencies:check`                                                          | Passed. Dependencies and generated output remain at the worktree root.                   |
| `git diff --check`                                                                    | Passed.                                                                                  |

The database fixture uses real MariaDB and a separate child consumer with an explicit fixture handler.
It proved producer deferral, tenant fixture separation, terminal delivery deduplication, holds, retries, cancellation, and pending-job restart.
It rejected a mismatched fixture tenant. It did not exercise real business handlers or active-job crash recovery.

Compiled Platform API and Chatb returned health and readiness 200 on ports 17810 and 17831.
An unauthenticated Chat request with tenant headers returned 401.
Queue execution was disabled only in those disposable smoke processes. Both processes were stopped.
Compiled Worker startup failed closed without Redis and exited with code 1 without a cleanup timeout.
No authenticated browser or mobile session was tested.

## Isolated local setup

Ignored `.env` and `.env.fixture` contain independent development secrets. Do not publish them.
The dedicated user is `cx_platform_56151a`. Its grants cover only this task's four schemas:

- `codexsun_platform_56151a_runtime`: fresh runtime master, 24 migrations and normal master seeds applied.
- `codexsun_platform_56151a_master`: queue fixture master.
- `codexsun_platform_56151a_tenant_a` and `codexsun_platform_56151a_tenant_b`: tenant fixture tables.

The fixture master was initially used for a full bootstrap attempt after direct fixture table creation.
That attempt rejected duplicate prefixed/unprefixed queue tables. Those tables were preserved.
The separate empty runtime master then initialized successfully. Existing tenant databases were never touched.

Ports are API 17810, Web 17820, Chatb 17831, Worker 17840, and reserved Redis 17860.
The Redis endpoint is unavailable. The human explicitly chose to report Redis checks as blocked.
Mail and Frappe outbound flags are disabled. No customer message or live integration call was requested.
Private setup scripts, resource inventory, and startup logs remain under ignored `dist/platform-work`.
No task runtime listener remained after smoke checks.

## Remaining prerequisites and supervisor handoff

- Supply reachable isolated Redis before full Worker startup and database/BullMQ compatibility acceptance.
- Verify real owner handlers and authenticated Chatb reconnect, including session and membership revocation.
- Add durable cross-version ownership fencing before permitting rolling overlap.
- Resolve generic running-job recovery and concurrent enqueue uniqueness before claiming general crash recovery or exactly-once effects.
- Reconcile interrupted owner operations before any production consumer cutover.
- Preserve the default Platform host until a reviewed drain-and-stop cutover is authorized.
- Review the complete dirty diff, generated Docs references, lockfile, and evidence limits before integration.

The local source phase is reviewable. Full business migration and production acceptance remain incomplete.

## Docker audit and Git sync update: 2026-10-26

The isolated Docker fixture supersedes the earlier Redis block above. Shared Redis and MariaDB containers remain in place.
The fixture uses project `codexsun-platform-audit-f880e056`, its own Redis, three databases, storage, credentials, and ports.
The deployed image snapshot is `a66adefc02b511cf750f73c8f9a525d104157b6aea300b3ba01565e0ecbcc95c`, based on 1.1.69.
Executed checks include producer-only enforcement, duplicate publication, concurrent keyed enqueue, holds, scheduling, retries, and cancellation.
All 251 unpublished records completed after the isolated Redis outage and restart. Tenant artifact and Mail binding checks passed.
Authenticated Chatb checks passed for tenant isolation, Worker-process Redis publication, reconnect history, and logout revocation.
The Worker-process publisher check does not prove a queued Telegram owner operation or a live provider call.
Generic active-job crash recovery, durable ownership fencing, and exactly-once effects remain unproved.

The human authorized a Git pull. Branch `codex/platform` fast-forwarded to `bc0670e3f320f3a71f35f2dcae2a170c2a695950` from `origin/main`.
The source version is now 1.1.72. All 71 local files were backed up and restored. Generated documentation conflicts were regenerated.
The preservation stash remains `92ae363f1a285d1a5a3427a239e37c7794a4b9c7`. No commit or push occurred.
After sync, all 29 queue tests passed with real Redis and no skips. Platform, Worker, and Chat lint checks passed.
Docs and dependency checks passed. The synced source has not replaced the earlier Docker snapshot.
Safe audit receipts remain under ignored `dist/platform-docker-audit/1793002215539-f880e056`.
Sync backup and receipt remain under ignored `dist/platform-sync-20261026-153641`.

## Publication sync: 2026-10-27

The Platform worktree fast-forwarded from `bc0670e3` to main commit `f4b6525ddff2a5324a00c36a49b3cf64cf493d77`.
The upstream version is 1.1.76. This task does not add a version bump.
The verified 71-file backup is `dist/platform-sync-1793071153496`. Preservation stash `6476edde994b76a887f5a9100724f38f3c0b2728` remains available.
The merge retains CRM's tenant-scoped contact lookup cache and outbound-only enqueue gate in the extracted hosts.
The Worker dependency and lockfile use the upstream Platform version.
The earlier Docker evidence remains 22 passed checks on snapshot `a66adefc02b511cf750f73c8f9a525d104157b6aea300b3ba01565e0ecbcc95c`.
The sync does not deploy new images. Runtime acceptance limits above remain applicable.

Post-sync checks: the CRM enqueue test passed. All 43 focused Chat, Telegram, and deployment-contract checks passed without skips.
Platform, Worker, and Chat lint passed. Documentation and dependency-layout checks passed.
Platform, Worker, and Chat typechecks also passed on the merged 1.1.76 source.
