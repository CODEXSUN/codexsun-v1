# cxmobile supervisor implementation prompt

## Mission and authorization

Act as the implementation supervisor for CODEXSUN Mobile on branch `codex/cxmobile`.
Use `C:\Users\sunda\.codex\worktrees\cxmobile\codexsun` as the workspace root.
Read [BRANCH-WORKFLOW.md](BRANCH-WORKFLOW.md) before starting or resuming workers.
The user explicitly authorized this isolated worktree for parallel application development.
Do not edit cxmobile in `D:\workspace\codexsun`, which remains on `main` for other work.
Verify every worker's working directory and branch before assigning a file lease.
Create new worker tasks through Antigravity's available worker/subagent mechanism.
Build `apps/cxmobile/client` with React, TypeScript, Vite, and Capacitor for Android and iPhone.
Reuse existing CRM, Billing, Chat, and Ecommerce web code through public contracts and the composed Platform API.
Coordinate implementation, integration, independent review, repairs, verification, and final acceptance in a continuous work loop.

The user now authorizes implementation and supervisor/worker delegation.
Earlier documentation-only instructions describe the completed planning stage and do not prohibit this newly requested implementation.
This authorization does not permit production deployment, store publication, unrelated data changes, or weaker security checks.
Do not stop after another plan, an empty scaffold, a working menu, or a mocked demonstration.

## Read before assigning work

1. Read the repository AGENTS instructions, `assist/AGENT-GUIDE.md`, and `assist/governance/rules.md`.
2. Read `apps/cxmobile/README.md` and `agent/PLAN.md`, `TASK.md`, `SKILLS.md`, and `AUDIT.md`.
3. Read `apps/cxmobile/agent/WORKER-TASKS.md` for the task graph, worker prompt, leases, and evidence requirements.
4. Read affected owner guidance and the closest public contracts before each implementation task.
5. Read applicable code-style, UI, native, and technical-writing skills available in your environment.

The existing documents are the starting contract. Reconcile them against current source rather than treating snapshots as implementation evidence.
Preserve every existing task status and distinguish planning completion from runtime completion.

## Initial supervisor actions

Inventory current git status, active work, package versions, native tooling, devices, API configuration, and test fixtures.
The shared checkout contains unrelated changes. Do not reset, clean, stash, commit, or overwrite them.
Identify which files are actively edited by other tasks before assigning a lease.
Record the current baseline and real task/worker identifiers in TASK before workers mutate shared files.

Create one inventory/contract worker first and one independent read-only audit worker.
Use the inventory to establish exact route/action/API/permission coverage and the native prerequisites.
Then assign dependency-ready implementation work from WORKER-TASKS.
Keep root manifests, lockfile, shared transport interfaces, build configuration, and integration edits under one supervisor-controlled writer.

Default concurrency: at most two implementation workers plus one read-only reviewer, within actual platform capacity.
Reduce concurrency when locks, resource pressure, or overlapping edits occur.
Do not run simultaneous npm installs, root builds, native syncs, or database migrations in the same checkout.
Workers must not edit a leased path until the supervisor assigns it.

If Antigravity cannot create real workers, report the actual limitation.
Use the same bounded task split sequentially while continuing useful work.
Do not fabricate worker identities, completed tasks, approvals, or independent reviews.

## Required architecture

Keep cxmobile a composition client, not another business backend.
Use one React root, router, query client, transport, and session coordinator.
Keep CRM, Billing, Chat, Ecommerce, and Core business behavior in their existing owning modules.
Expose narrow reviewed public contracts. Do not copy private sibling implementations or import the full Platform desk.
Initialize runtime configuration before owner services that read configuration during module import.
Use shared UI controls and preserve the five AppLayout regions through a mobile drawer/shell presentation.
Load owner routes and heavy features lazily. Preserve desktop behavior when adapting shared screens.

Keep one root npm installation and lockfile. Run npm from the repository root.
Place generated web/native build outputs and caches under root dist.
Keep reviewed Android/iOS project source distinct from build output.
Create only real capabilities and scripts. Do not add dummy modules, placeholder adapters, generic CRUD engines, or unimplemented success states.

## Security and data gates

Complete M1 proof on Android and iPhone before claiming production-ready native session integration.
Use the native session decision process in PLAN. Preserve host binding, server session revocation, tenant routing, and live authorization.
Never expose session secrets through JavaScript, response headers, logs, query strings, public files, or plaintext storage.
Do not weaken browser origin checks or cookie attributes to make native requests work.
Validate native bridge destinations, redirect handling, socket authentication, media access, and account-scoped cleanup.
Reject late results after account/company/year changes and close old subscriptions before activating the next scope.

Use disposable local/staging tenants and fixture records for mutations and migrations.
Do not modify customer production data, enable external provider messaging, or contact live Frappe/payment services without existing explicit authorization.
CRM Tasks remain local. Preserve CRM own-record scope, Chat membership, and Billing posting/allocation rules.
Core owns shared record identities. Integration credentials remain server-side.

## Delivery sequence

Follow M0 through M8 and the worker dependency graph.
M1 can use a minimal native harness before the full production shell exists.
M2 must demonstrate these persisted journeys on both platforms:

1. Login and restore a permitted tenant/company/year context.
2. Create an enquiry, assign it, add a comment, and reload it.
3. Create a quotation, reload totals, and preview/share its PDF.
4. Send a Chat message and attachment to another user, then verify read state.
5. Save an Ecommerce item draft and image, then reload its unpublished state.
6. Sign out, change account, and prove that private prior-account data is unavailable.

Then expand to every supported staff route/action, including reports, settings, lifecycle, broadcast, and optional Telegram contracts.
Track source-only, API-only, hidden, and unfinished features explicitly.
Do not silently reduce the four-app scope to the first slice.
Keep storefront preview separate from customer purchasing. Existing basket behavior does not establish checkout or paid orders.
Customer checkout/order/payment/stock work remains EC1 under the existing plan and requires explicit owner contracts before implementation.

## Supervisor work loop

1. Select a ready task with its dependencies, bounded file lease, acceptance criteria, and evidence requirements.
2. Start a real worker task using the template in WORKER-TASKS.
3. Review the returned diff and verify that the worker stayed inside the lease and owner boundary.
4. Integrate shared contract changes through the single-writer queue.
5. Run the relevant focused checks and inspect failures rather than trusting the worker's summary.
6. Assign an independent reviewer with no implementation lease for that change.
7. Turn every valid finding into a repair task with a stable ID, owner, and reproduction.
8. Re-run affected checks after repairs and repeat review until that task's acceptance criteria pass.
9. Update TASK and AUDIT with exact evidence, release leases, and select the next dependency-ready task.
10. Continue through final integration and acceptance. Report full completion only when every required gate has evidence.

Do not stop because the first implementation fails or a review finds defects.
Do not loop unchanged failing actions indefinitely.
For missing hardware, credentials, signing access, or macOS, record the precise external dependency and required action once.
Continue independent inventories, owner work, fixtures, tests, packaging preparation, and repairs that do not bypass the blocked gate.
When no independent work remains, give an explicit partial/blocker handoff rather than claiming completion.
Do not convert unavailable iPhone evidence into an Android-only final success.

## Evidence and completion

Map each A01-A15 finding to a task, accepted resolution, source revision, checks, and remaining limits.
Record feature coverage by app, route/action, role, tenant fixture, API revision, platform/device/OS, and persisted or denied result.
Verify two-tenant isolation, company/year changes, revoked permissions, expired sessions, foreign record IDs, and account switching.
Validate save/reload behavior and applicable financial values against authoritative API/database results.
Verify realtime reconnect, files, push, deep links, safe areas, keyboard, back navigation, offline errors, and cleanup on actual target platforms.
Measure performance targets in PLAN. Label deviations and unresolved regressions.

Run appropriate owner boundaries, typechecks, lint, builds, API/database tests, browser checks, native checks, and dependency-layout validation.
Run root release gates when preparing the final candidate. Separate existing unrelated failures from new failures.
Repository Docs synchronization must preserve other active documentation work and must not conceal stale references.
Keep generated test reports, screenshots, logs, and artifacts under root dist, with concise durable evidence links in owner documentation.

Use existing authorized signing configuration when available. Never reveal secrets or create external accounts/keys as a workaround.
Produce Android APK/AAB and iOS candidate evidence where tooling and signing access permit it.
Do not bump the repository version, commit, push, deploy, or publish stores unless the user separately requests those operations.

Final report: implemented features, changed owner areas, passed checks, native build/install/signing status, artifact paths, audit results, and concrete open blockers.
Built, installed, verified, signed, distributed, and published are distinct states.
A prompt, passing typecheck, mocked flow, or running shell is not completion evidence.

Start now: read the required documents, create the inventory and independent audit worker tasks, and execute the dependency-ready loop.
