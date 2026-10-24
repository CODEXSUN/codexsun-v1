# CRM Delivery Tasks

## CRM timestamp correction and TechMedia/Rainbow release — 2026-10-24

- [x] Build signed TechMedia (`techmedia-v1.1.57.apk`) and Rainbow (`rainbow-v1.1.57.apk`) APKs as version 1.1.57, build 157, using their tenant IDs and the live Platform API URL.
- [x] Verify package IDs, version metadata, matching release certificates, and APK Signature Scheme v2 signatures.
- [x] Commit `8f47b54` and push to `origin/main`; leave unrelated worktree changes unstaged.
- [x] Deploy API and Web only from pushed source `1a4816b88f7744934837d6688b3efed3775658ff` as `1.1.57-1a4816b8`; Shop and shared containers were left unchanged.
- [x] Create full MariaDB backup `codexsun-1.1.57-pre-migration-20261024T164530`; checksum verified. The 71 MB dump and checksum are protected in the VPS backup volume.
- [x] Production migration preflight passed for seven tenant targets; `migrations:run` completed successfully. No migration checksum drift was reported.
- [x] API and Web containers report healthy on the expected image tags and source revision. Local API/Web health and public `https://codexsun.com/api/platform/health` returned HTTP 200. Public `api.codexsun.com` DNS is not configured; API health was verified through the public Web proxy.
- [x] Both signed APKs are version 1.1.57/build 157; APK paths and signing evidence are recorded above.

## TechMedia and Rainbow release APKs — 2026-10-24

- [x] Bump the lockstep workspace and Flutter app version to 1.1.56, build 156; `npm run check:versions` passes.
- [x] Build TechMedia (`in.codexsun.techmedia_crm`) and Rainbow (`in.codexsun.rainbow.crm`) signed release APKs with the live Platform API URL and their tenant IDs.
- [x] Verify each APK reports version 1.1.56/build 156 and passes APK Signature Scheme v2 verification with the same release certificate.
- [x] Keep artifacts local. No emulator install, cloud deployment, tag, commit, or push was requested or performed.

## Work timestamp consistency — 2026-10-24

- [x] Preserve UTC instants in generated job-cycle and checkpoint comments; avoid preformatting to timezone-less UTC text.
- [x] Format job start/stop, check-in/check-out, and captured-location times on web and mobile as `DD-MM-YYYY hh:mm:ss am/pm` in the viewer's local timezone.
- [x] Correct older UTC-formatted job/checkpoint comments while preserving legacy pinned-location local time.
- [x] Pass focused API/web timestamp tests, all 78 CRM mobile tests, CRM API/web typechecks, mobile analysis, and format checks.
- [x] Build and install an isolated debug APK (`in.codexsun.crm_timecheck`) on `emulator-5554`; verify it opens the sign-in screen. Cloud health returned HTTP 200 by read-only GET. No authenticated cloud record flow was attempted, and no deploy, commit, or push was performed.

## Frappe sync visibility — 2026-10-24

- [x] Restrict the enquiry Frappe sync column, details, and API fields to `admin@tenant.com` with `crm.enquiry.frappe-sync.view`.
- [x] Keep other users' enquiry responses free of Frappe sync status and error fields.
- [x] Pass focused access tests, Platform API typecheck and lint, and CRM module-boundary checks.
- [ ] Verify the change in the deployed browser. No commit or deployment was requested.

## Frappe delivery feedback — 2026-10-23

- [x] Show persisted export errors on web contact, enquiry, duty, and report records during retry.
- [x] Keep Task records local; show **Not configured** on the list and detail view.
- [x] Refresh supported web delivery states every second.
- [x] Preserve CRM-origin enquiry identity, creator, email, and date precision during reverse updates.
- [x] Pass focused regression and isolated queue tests. See Frappe TASK.md for evidence and deployment limits.

## Marketing ownership and integration planning — 2026-10-23

- [x] Reconcile planning: Marketing Campaign/promotional consent, CRM sales/service restrictions, Core identity, and Mail delivery-safety suppression.
- [x] Replace planned CRM Campaign CRUD and generic Consent work without marking any runtime feature complete.
- [ ] Implement fixed idempotent Marketing submission-to-Lead intake, duplicate review, source references, and permitted assignment.
- [ ] Implement Lead-linked follow-up and scheduler support with stable retry keys and source/record authorization.
- [ ] Publish minimized qualification/outcome projections with durable versions and no broader CRM record access.
- [ ] Implement effective CRM restriction lookup while retaining existing Contact Preferences and no inferred promotional opt-in.
- [ ] Test source-aware Marketing-origin Frappe export blocking and preserve current approved transfers.

Evidence: [CRM ownership decision](PLAN.md#marketing-integration-decision--2026-10-23) and [Marketing Phase 0](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review).
No CRM schema, runtime behavior, or permission change is claimed here.

## Retained inbound enquiry data — 2026-10-23

- [x] Show retained Frappe source fields and paged revisions inside the enquiry Frappe sync tab.
- [x] Preserve CRM-only captured email during source updates.
- [x] Preserve exact source names when imported numeric serials collide.
- [x] Reuse imported comment identities for edits and retain reply parents.
- [x] Keep inbound imports from producing outbound echo events.
- [x] Verify these paths with a disposable database and persisted queue retries.
- [ ] Verify the source field panel in a browser after the additive Frappe migration.

## Approved enquiry comments to Job Comments — 2026-10-23

- [x] Save opening comments, subsequent comments, and replies with durable `comment-add` events; dispatch after commit.
- [x] Preserve comment events when enquiry updates coalesce; forward mobile request IDs for retries.
- [x] Suppress outbound events for imported comments. The Frappe worker owns remote retry identities, parent links, and inbound echo suppression.
- [x] Verify the authenticated owner API and persisted queue live as Vijay: local enquiry `12` → `Q935`, three local/remote comments, repeated web/mobile POST reuse, and recovery after a lost remote comment response. See Frappe TASK for fixture and queue evidence.
- [x] Enforce per-enquiry ordering when claiming an event. Live enquiry `13` → `Q936` verified an early comment delivery waits for its enquiry and succeeds on retry; three comments remain three after retries.

## CRM release 1.1.44 — 2026-10-22

- [x] Bump the workspace to 1.1.44 and CRM Flutter to 1.1.44+144.
- [x] Pass `npm run check`, `npm run check:versions`, `npm run dependencies:check`, Flutter analysis, and all 76 mobile tests.
- [x] Build and verify signed TechMedia and Rainbow APKs for the production API. Both use Android version code 144 and version name 1.1.44.
- [x] Deploy API, Web, and Shop to Hostinger and verify health routes. No migrations or seeds ran.

VPS: source commit `0f71e79455c981619660a15467fada7401f59e7b` is live. API, Web, and Shop images are healthy; local health/ready and public API/Web/Shop routes returned HTTP 200. The release record is `/home/codexsun-releases/1.1.44-0f71e794/deployment.json`. Shared CXApp, MariaDB, Redis, media, and tunnel containers were not recreated. No database migration or seed ran. Browser UX and tenant authorization were not tested.\n\nAPK SHA-256: TechMedia `6C6F4BE0C079D3196F39164DC224F39D1E14AE23192BC703457075BF17A7B170`; Rainbow `3510B28679CE767AFEE41B8952135A4A851BC020A1218039B774BEF6B757E4E4`.

## Frappe sync status and verification — 2026-10-22

- [x] Add a shared green-confirmed, grey-waiting, red-error Frappe indicator and a Verify action to enquiry, contact, and call-log rows. Verify always queues a backend remote check and reports the result; call-log verification uses `crm.call-log.view`.
- [x] Persist the latest tenant-scoped Contact and Call Log verification result so list reloads keep the state.
- [x] Return persistent `crm_frappe_sync_queue` state with SOP items, duty assignments, and duty reports. Their Verify action reloads the owner API state from the backend queue.
- [x] Show CRM Tasks as not linked to Frappe and disable Verify. No supported Task mapping or export permission exists, so the UI does not invent one.
- [x] Confirm published SOP items, assignments, and reports expose pending queue state in the isolated CRM Duties E2E. Draft SOP items remain unqueued until publication.

Verification: `npm run test:crm-frappe` passed 169 unit tests and the Duties, Frappe Mobile Customer, and CRM Contact Upsert database E2Es. CRM API/Web, Frappe API, and Platform API typecheck/build, relevant lint, module boundaries, and component-doc checks passed. A live Hostinger `queue.probe` completed through BullMQ + Redis in about one second. Release 1.1.43 is deployed from `4007dfd66f089157a3c92f6b5cee93b185ad2398`; API, Web, and Shop containers are healthy, and public health/application/shop routes returned HTTP 200. No database migration or live Frappe record verification was run. Browser UX was not tested.

## Immediate verified Frappe enquiry sync — 2026-10-21

- [x] Persist an enquiry upsert in the CRM outbox in the same transaction as local create/edit, then dispatch the committed event to the tenant queue without waiting for Frappe HTTP.
- [x] Run the queued handler through the verified tenant Frappe connection; keep periodic relay recovery for durable pending events and retries.
- [x] Add a Frappe sync status column and enquiry detail history/errors tab. Gate both by `crm.enquiry.frappe-sync.view`; Platform checks the permission for each request without an email-specific override.
- [x] Pass automated regression checks and isolated database E2E verification before release. The queue E2E and all three CRM/Frappe database suites passed. Browser verification was not run. No live tenant records were changed.

## CRM own-record visibility and Team Head — 2026-10-21

- [x] Restrict enquiry/task tenant-wide reads to active Admin/Super Admin roles, including stale broad-grant denial.
- [x] Reconcile non-admin tenant-wide grants in repeatable permission seeds.
- [x] Add editable Team Head role defaults without assigning users or guessing teams.
- [x] Apply parent scope to closure list/review and prevent non-admin task reassignment.
- [x] Hide unfinished Contact 360 permissions and assignments from Access Control lists/pickers.
- [x] Verify Admin, User, Manager, Team Head, counts, search filters, direct/child routes, stale grants, custom labels, and revoked roles in disposable MariaDB.
- [x] Apply the TECHMEDIA live permission repair and verify Manikandan's signed-in browser overview, enquiry list, task list, and activities.

Verification: 159 CRM/Frappe unit tests and five disposable database E2E suites passed, including the new role-scope suite and the existing closure suite. Core/Platform typechecks, affected API lint, module boundaries, dependency layout, and component docs checks passed. API hotfix `1.1.33-crm-record-scope-20261021` is healthy on CODEXSUN and TECHMEDIA. Only TECHMEDIA access seeds were reconciled; no users were reassigned and no business test records were created. Live user scope at verification: 275 enquiries, 0 tasks, and 1,885 enquiry activities. Other tenants, Web/Shop images, and shared infrastructure were not replaced.

The live Manikandan browser also denied direct access to enquiry #2022 (local ID 2013), which belongs outside his assignment/creator scope. Sign-in succeeded after earlier HTTP 429 attempts; no rate-limit protections were disabled.

Managed-team expansion is deferred by the user's narrowed scope. Manager and Team Head use own-record scope until explicit membership support is configured.

## Overview capability loading — 2026-10-21

- [x] Allow own-report users to query duty-report permission flags without requiring team-wide report access.
- [x] Keep team report lists and summaries protected, including manager-only and own-only permission combinations.
      Verification: 155 unit tests and three isolated CRM/Frappe database E2E checks passed. The scoped API hotfix is live; the existing `manikandan@techmedia.in` session on `app.techmedia.in` loads Overview without the warning. Own-report read/create permissions remain unchanged and team report access remains denied.

## Frappe creator attribution — 2026-10-20

- [x] Display mapped app-user names for enquiry and task comments, not fragments derived from email domains.
- [x] Use the same imported-creator attribution in the global Activities list and enquiry activity timeline.
- [x] Preserve the Frappe source creator on initial import events; keep later sync updates attributed to the sync service.
      Verified by focused attribution tests and `npm run test:crm-frappe` (148 unit tests and three isolated E2E tests passed).

## Enquiry identity reconciliation — 2026-10-20

- [x] Resolve the source Employee creator through the verified unique local mapping, and use Frappe's document owner only as fallback.
- [x] Clear saved local assignment when Frappe has no assignee, and flag duplicate Employee mappings in the Frappe identity audit.
- [x] Display the stored assignee's tenant user name on the enquiry detail page when its denormalized name is absent.
      The Actions history also maps imported creation/comment actor rows to the source creator while preserving sync attribution for subsequent updates.
      Verified with TECHMEDIA enquiry ENQ2022 against its Frappe Employee records; the existing creator and assignee already matched, so no live tenant rows required correction. Regression: 151 CRM/Frappe unit tests and three isolated database E2E tests passed.

## Admin CRM overview

- [x] Show permission-scoped totals and status summaries for enquiries, tasks, calls, activities, SOPs, duties, and duty reports.
- [x] Add links from each summary card to its CRM workspace and show the latest enquiry activity.
- [x] Add exact call-log totals and status counts to the call-log list contract.
- [ ] Verify overview loading and navigation in a live browser.

      API and web type checks, lint, and CRM module-boundary checks passed on 18-10-2026.
      Browser verification remains open.

## Scheduling and reminders

- [ ] Add tenant-local schedules linked to permitted enquiries, tasks, call logs, duty assignments, and SOPs.
- [ ] Add user-scoped schedules and due-reminder queries, acknowledgement, and completion routes.
- [ ] Add CRM Scheduling navigation pages and a polling reminder bell in the app header.
- [ ] Add contextual schedule buttons to enquiry/task Actions and Properties and to duties.
- [ ] Verify schedule creation, source permissions, acknowledgement, and tenant isolation with API/database E2E.
- [ ] Verify the reminder bell and schedule pages in an authenticated browser.

## Mobile customer upsert

- [x] Show mobile number and customer name on the left, with code and contact type on the right.
      Keep active status below.
      Move legal name, group, and additional phone controls to Additional details.
      Default new records to Customer, with Mobile and primary phone defaults.
- [x] Validate mobile format, duplicate numbers, and one primary phone in the form and CRM API.
- [x] Verify create, reload, and edit through CRM and Core against a disposable database.
      Evidence: `npm run test:e2e:crm-contact-upsert`, 17-10-2026.
      The test also checks shared numbers across customers, retained email and finance fields,
      rejected saves without data changes, and denied writes.
      Regression: 90 unit tests and three isolated API/database E2E tests passed.
      Browser check: the new form shows Customer by default and rejects a short mobile number.
      This evidence does not certify deployment or browser saves.

## Frappe reference review

- [ ] Implement and verify the explicitly requested enquiry live-sync contract in both directions:
      preserve exact Frappe enquiry/comment source timestamps on import; post local new/changed
      enquiries to their verified linked Frappe record; and poll remote changes incrementally. Do not
      broaden this approval to Contacts, Activities, or Call Logs. Keep live deployment evidence open
      until the production queue and remote readback pass.
- [ ] Resolve the remaining outbound scope conflict for Contacts, Activities, and Call Logs. The
      explicit enquiry authorization does not approve those other outbound transfers.

- [x] Collect the supplied LogicX HR DocType schemas and functions and compare them with CRM.
      Evidence: [comparison](FRAPPE-COMPARISON.md) and [25-DocType catalogue](../../frappe/agent/LOGICX-CRM-REFERENCE.md), reviewed on 17-10-2026.
      Documentation checks passed: `check:component-docs` and `test:component-docs` (2 tests).
      This is source evidence only. Live schema and transfer verification remain open.
- [x] Implement supported frequency conversion, verified Department name resolution,
      remote assignment pair reuse, and report outcome/instruction text preservation.
      Evidence: `crm-duty-sync.mapping.test.ts` and isolated `crm-duties.e2e.ts`, 17-10-2026.
      Report aggregates pass strict SQL mode. Assigned item recurrence edits are blocked.
- [ ] Resolve the remaining structured remote fields and live delivery requirements in
      [the field mapping](../../frappe/agent/CRM-DUTY-FIELD-MAPPING.md) before claiming complete Frappe parity.
- [x] Verify live SOP Item, assignment, and report bindings against logicx.tmnext.in.
      Evidence: `npm run test:e2e:crm-duties-live`, 17-10-2026: Daily/Weekly/Monthly/Yearly,
      all writable/fetched fields, completed/blocked reports, four PUT retries, and cleanup passed.
      Exact-email Employee mapping was saved and audited. No Employee record was changed.
      Regression suite: 90 unit tests and the isolated Duty database E2E passed.
      The live test invokes the worker directly. Queue relay scheduling and UI acceptance remain open.

This file tracks implementation of the product plan in [PLAN.md](./PLAN.md).
The plan defines scope and ownership. This file defines the work order and
completion evidence.

## Progress Rules

- Keep every task unchecked until its completion evidence exists.
- Complete a review task when it has current source evidence and a clear result.
- Complete an implementation task only when its owner contract, implementation,
  permissions, migration, user flow, and required checks are complete.
- Record a short evidence link or test name beside a completed task.
- Do not mark a phase complete while one of its required tasks or exit checks is
  open.
- Keep CRM business data local and authoritative. Existing enquiry and call-log
  flows do not sync outbound. SOP and Duty records use the explicitly approved
  CRM-to-Frappe queue, and CRM screens never read those records from Frappe.
- Keep Core, Billing, Inventory, and Zetro records in their owning modules. Use
  their public contracts.
- Add a real module only when it owns behavior. Do not add placeholder role files.

## Phase 0: Local-only Cutover and Product Contracts

- [x] **0.1** Review current CRM web, mobile, API, database, and queue behavior.
      Evidence: source review recorded in [PLAN.md](./PLAN.md#current-implementation-baseline)
      on 2026-10-14. This review did not verify live database persistence.
      Targeted source recheck on 2026-10-16 confirmed local Enquiry reads and writes,
      local Call Log creation, stopped legacy outbound processors, and remaining
      import paths. CRM API typecheck, CRM module boundaries, and three focused tests
      in `enquiry.read-source.test.ts` and `call-log.service.test.ts` passed.
      CRM web typecheck failed because installed `lucide-react` declarations are
      missing. Live database and mobile checks were not run during this recheck.
- [ ] **0.2** Keep Enquiry and Call Log reads and writes local, and remove their
      legacy provider switching and import paths. Preserve local records and history.
      SOP and Duty outbound sync is an approved exception tracked in
      [DUTIES-SOP-PLAN.md](./DUTIES-SOP-PLAN.md); it does not make Frappe a CRM read
      source.
- [ ] **0.3** Run a local-only smoke flow for web and mobile enquiry, call-log,
      and comment actions with Frappe disabled. Confirm writes reach the tenant CRM
      database. Web live smoke on 2026-10-14 created enquiry #11, added a comment,
      and created call log CL-19. Direct reads from the local tenant CRM database
      confirmed all three records; both CRM enquiry and call-log sync event counts
      were zero. This check predates SOP/Duty sync and did not verify its relay.
      Automated checks pass: local
      Enquiry/List In database E2E (5/5),
      mobile Flutter tests (19/19), and mobile analysis. Mobile live write
      confirmation remains open because no Android device is connected.
- [ ] **0.4** Approve Sales Enquiry stages, close outcomes, required fields, and
      permitted transitions.
- [ ] **0.5** Approve Service Request outcomes, closure reasons, rework rules, and
      permitted transitions.
- [ ] **0.6** Confirm the Billing quote-to-order contract, order identity, accepted
      quote behavior, and split-order rules.
- [ ] **0.7** Confirm Core public contracts for Contacts, products, units, taxes,
      and work-order type masters.
- [ ] **0.8** Confirm the Inventory contract for availability, reservation,
      purchase, issue, and fulfillment status.
- [ ] **0.9** Confirm CRM ownership of Sales Delivery Work, Service Work Orders,
      Resource, Booking, Material Request, and Verification until another owner takes
      those records.
- [ ] **0.10** Define tenant settings for stage templates, currency, date and time
      zone, working calendars, consent, retention, and approval thresholds.
- [ ] **0.11** Define roles, record-level access, protected actions, audit events,
      stable public IDs, and deletion or archive rules.
- [ ] **0.12** Define lead-to-contact match, duplicate review, merge, and conversion
      rules without moving Contact ownership from Core.
- [ ] **0.13** Approve the module dependency graph, migration order, seed order,
      route names, navigation groups, and public exports.
- [x] **0.14** Review `DUTIES-SOP-PLAN.md` and approve the V1 contracts: individual
      user assignments, frequency-based recurrence, immutable idempotent reports,
      completed/blocked outcomes, and CRM-to-Frappe outbound sync. Team assignments,
      evidence attachments, and report corrections remain deferred.
      Evidence: [DUTIES-SOP-PLAN.md](./DUTIES-SOP-PLAN.md#delivery-phases).

**Exit check:** CRM uses only local tenant data. Every planned entity has one
owner, public contract, permission boundary, tenant scope, and migration path.

## Phase 1: Local CRM Foundation

### Persistence and Existing Modules

- [ ] **1.1** Record per-tenant counts, IDs, links, comments, and activity order
      before changing existing CRM schemas or behavior.
- [ ] **1.2** Prove local records survive API restart and remain isolated between
      two tenant databases.
- [ ] **1.3** Trace each web and mobile operation to its typed local API and tenant
      database write. Record any flow that only reads or stores data on the device.
- [ ] **1.4** Make mobile enquiry, call-log, and comment retries idempotent. Test
      repeated requests and concurrent duplicate submissions.
- [ ] **1.5** Preserve current record IDs, links, comments, creators, timestamps,
      and activity order during upgrades.
- [ ] **1.6** Keep CRM Contact screens on Core Contact public contracts. Do not add a
      second CRM-owned Contact identity table.

### Shared CRM Modules

- [ ] **1.7** Build Assignment with owner, team, queue, reassignment history,
      access checks, and audit events.
- [ ] **1.8** Extend Activity from enquiry-only rows to an append-only event stream
      for supported CRM records, with actor, action, timestamp, and safe summary.
- [ ] **1.9** Build Task with owner, due date, priority, recurrence, completion,
      record links, and reminder rules.
- [ ] **1.10** Complete Call Log with selected mobile calls, local comments,
      supported record links, atomic deduplication, and retry behavior. Do not create
      an external sync event.
- [ ] **1.11** Complete CRM sales/service contact restrictions and preferences with purpose,
      channel, source, capture time, expiry, and withdrawal history. Marketing owns promotional consent.
      Preserve existing Contact Preferences and add public effective-policy checks without duplicating Marketing grant history.
- [ ] **1.12** Complete Attachment metadata, access checks, retention policy, and
      authorized download behavior.
- [ ] **1.13** Complete Saved View with tenant-scoped filters, columns, sort order,
      ownership, and sharing permissions.
- [ ] **1.14** Complete Notification from persisted events with recipient access
      checks, read state, and retry-safe delivery.
- [ ] **1.15** Complete Customer 360 as a permission-aware composition of Core
      Contacts and CRM-owned records. Do not copy sibling data into a shadow table.
- [ ] **1.16** Complete existing operational reports using owner-module queries and
      permission-scoped filters.

### Duties, SOP, and Reporting Modules

- [x] **1.17** Build SOP identity, ownership, lifecycle, permission-checked
      create, update, activate, and deactivate routes, with web create/edit/lifecycle
      controls. Evidence: `crm-duties.e2e.ts` and SOP workspace flows.
- [x] **1.18** Build SOP Items with department, frequency, ordered instructions,
      draft revisions, immutable published revisions, web editing, and revision
      history. Evidence: `crm-duties.e2e.ts` and SOP workspace flows.
- [x] **1.19** Build individual-user Duty Assignments with active dates, order,
      published-revision validation, active-user lookup, and deactivation. Team
      allocation and reassignment history remain deferred. Evidence: assignment E2E.
      Remote deactivation remains open because Frappe's current `SOP Assigned`
      contract has no inactive field, and CRM preserves remote assignment history.
- [x] **1.20** Build web SOP authoring and My Duties, plus the signed-in mobile
      Duties list, on shared local CRM API contracts. Evidence: CRM web/API/mobile
      typechecks, mobile widget tests, and `crm-duties.e2e.ts`.
- [x] **1.21** Build immutable, recurrence-idempotent Duty Reports tied to an
      active assignment and its published revision, including completed/blocked
      results and required blocked issue details. Evidence: duty-report unit tests
      and `crm-duties.e2e.ts`.
- [x] **1.22** Build own/all permission-scoped Duty Report history through the
      Duty Report API and web reporting workspace, with search/date/result filters,
      summary totals, and pagination. Export remains follow-up work. Evidence:
      `crm-duties.e2e.ts` and CRM web/API checks.
- [ ] **1.23** Verify permission denial and tenant isolation, recurrence edge
      cases, mobile offline reconnect, and correction workflows. Corrections remain
      deferred from V1; current tests cover recurrence keys and duplicate retries.
- [ ] **1.28** Persist outbound Frappe queue events atomically with SOP Item
      publication/updates, assignments, and reports. SOP title changes now requeue
      all published child items. Assignment deactivation remains local until the
      Frappe contract supports an inactive state; no remote deletion is performed.
- [x] **1.29** Verify the worker's DocType field mapping, Employee mapping,
      dependency order, canonical queue key, atomic event claim, and successful queue
      state changes against a mocked Frappe endpoint. Evidence: `crm-duties.e2e.ts`;
      the relay and live Frappe endpoint remain unverified.
- [ ] **1.30** Verify failure retry/recovery and delivery against a test Frappe
      site. Live Frappe credentials and remote delivery have not been exercised in
      this environment.

### Foundation Verification

- [ ] **1.24** Test fresh tenant migrations, existing tenant upgrades, and repeatable
      seeds for affected modules.
- [ ] **1.25** Verify mobile reconnect reads server-saved records and retries
      supported pending writes without creating duplicates.
- [ ] **1.26** Test role access, record access, tenant isolation, duplicate retries,
      and deletion blockers.
- [ ] **1.27** Compare upgraded tenant data with the 1.1 baseline. Reconcile counts,
      IDs, links, comments, and activity order.

**Exit check:** Existing CRM work is local-first and persistent. Web and mobile
share the local contracts, and migration reconciliation passes.

## Phase 2: Sales Intake

- [ ] **2.1** Consume Marketing-owned Campaign through a permitted lookup and stable source reference.
      Preserve campaign UUID and source label on CRM Leads. Campaign CRUD, audiences, and measured spend remain in Marketing.
- [ ] **2.2** Build Lead for prospect identity, campaign source, consent, import
      key, qualification facts, duplicate review, and disqualification reason.
- [ ] **2.3** Add explicit Lead qualification, disqualification, match, and
      conversion actions with audit history.
- [ ] **2.4** Migrate the current generic Enquiry into Sales Enquiry without losing
      IDs, URLs, comments, activities, assignments, or timestamps.
- [ ] **2.5** Build Sales Enquiry stages, expected value, probability, close date,
      competitor, owner, next action, and outcome reason.
- [ ] **2.6** Add Sales Enquiry list, board, search, filters, saved views, and
      follow-up queue.
- [ ] **2.7** Add campaign and source conversion reports from the owning records.
- [ ] **2.8** Test Lead conversion, duplicate handling, rejected transitions,
      permission scope, and migrated history.

**Exit check:** Users can track a sourced prospect through qualification and a
reasoned Sales Enquiry outcome without duplicate customer identities.

## Phase 3: Service Intake and Coverage

- [ ] **3.1** Build Customer Asset linked to Core Contact and service location, with
      serial, model, warranty, and history fields.
- [ ] **3.2** Build Service Request with customer, reported issue, channel, priority,
      location, asset, owner, and outcome.
- [ ] **3.3** Build Service Timeline for diagnosis, decisions, customer updates, and
      ordered immutable events.
- [ ] **3.4** Build Service Agreement with versioned coverage, active dates,
      renewal, suspension, cancellation, and recurring schedule rules.
- [ ] **3.5** Build Entitlement for covered parties, assets, products, locations,
      usage limits, and eligibility decisions.
- [ ] **3.6** Build SLA Policy with response and resolution targets, calendars,
      time zones, holidays, pause rules, warnings, breach tracking, and escalation.
- [ ] **3.7** Snapshot the applied agreement, entitlement, and SLA terms on each
      Service Request.
- [ ] **3.8** Build versioned Incident Templates for diagnostic steps, safety
      checks, tasks, skills, materials, and expected duration.
- [ ] **3.9** Build Service Outcome for resolved, cancelled, no-work, and rework
      decisions with required reasons.
- [ ] **3.10** Add service queues and reports for response time, SLA risk, asset
      history, repeat visits, and resolution outcomes.
- [ ] **3.11** Test covered and uncovered requests, SLA pause and breach, template
      version snapshots, and closed-request history.

**Exit check:** A team can receive, assign, diagnose, and close a covered or
uncovered service request with complete history and correct SLA evidence.

## Phase 4: Estimates and Billing Handoff

- [ ] **4.1** Build Sales Estimate with typed Sales Enquiry source, scope, items,
      quantities, assumptions, price basis, validity, revisions, and approvals.
- [ ] **4.2** Build Service Estimate with typed Service Request source, labor,
      materials, coverage, payable amount, assumptions, revisions, and approvals.
- [ ] **4.3** Keep current vendor or purchase estimates separate from customer
      estimates and preserve their existing supplier meaning.
- [ ] **4.4** Read products, units, tax, currency, and prices through owner APIs.
- [ ] **4.5** Connect approved CRM estimates and eligible source records to Billing
      Quotes through a fixed, typed public contract.
- [ ] **4.6** Preserve sent quote revisions and snapshot approved commercial terms.
- [ ] **4.7** Support quote accept, reject, expire, and change decisions with
      authorized actors, reasons, and audit events.
- [ ] **4.8** Link an accepted Billing Quote to its Billing-owned order. Prevent
      duplicate orders on retries.
- [ ] **4.9** Test price, tax, currency, revision immutability, approval, and quote
      to order reconciliation.

**Exit check:** Customer offers have approved sources, immutable sent revisions,
and traceable Billing-owned orders after acceptance.

## Phase 5: Delivery, Service Work, and Materials

- [ ] **5.1** Build Sales Delivery Work for accepted sales scope, milestones,
      partial completion, delivery evidence, and customer acceptance.
- [ ] **5.2** Build Service Work Order for authorized service execution, labor,
      visits, materials, checklists, and completion evidence.
- [ ] **5.3** Build Resource for skills, working hours, territory, leave, and
      capacity.
- [ ] **5.4** Build Booking for resource, customer window, service location, travel
      buffer, schedule changes, no-show, and cancellation.
- [ ] **5.5** Keep booking state separate from Sales Delivery Work and Service Work
      Order states.
- [ ] **5.6** Build Material Request for demand and fulfillment references. Read
      reservation, availability, and issue state from Inventory or its approved owner.
- [ ] **5.7** Build Verification with checklist version, evidence, result, verifier,
      customer acceptance, and rework link.
- [ ] **5.8** Require verified completion before closing operational work. Create
      linked rework when verification fails.
- [ ] **5.9** Support multiple visits, multiple assets, partial delivery, split
      work, and retry-safe updates.
- [ ] **5.10** Test capacity, schedule changes, material state, work transitions,
      verification, rework, and duplicate mobile submissions.

**Exit check:** Accepted sales scope and authorized service scope can be scheduled,
executed, and verified with separate work lifecycles.

## Phase 6: Collection Follow-up, Renewals, and Reporting

- [ ] **6.1** Build Collection Follow-up with Billing balance reads, promise,
      owner, next action, reminders, and history.
- [ ] **6.2** Keep invoices, receipts, payment allocations, and balances in Billing.
- [ ] **6.3** Generate recurring Service Requests from active agreement versions
      with idempotency keys and approval controls.
- [ ] **6.4** Add renewal work for Sales Enquiries and Service Agreements with
      owner, due date, and next action.
- [ ] **6.5** Build Sales and Service reports from owner-module queries with
      consistent permission scope and defined metric formulas.
- [ ] **6.6** Reconcile report totals with source records and Billing summaries.
- [ ] **6.7** Test overdue collection follow-up without changing Billing financial
      state.

**Exit check:** Teams can manage renewals and collection follow-up while financial
records remain owned by Billing.

## Phase 7: Zetro CRM Agent

- [ ] **7.1** Add read-only Customer 360, Sales Enquiry, Service Request, assigned
      work, and next-action skills through fixed CRM contracts.
- [ ] **7.2** Add source-linked summaries for overdue work, SLA risks, verification,
      and collection follow-up.
- [ ] **7.3** Add draft-only qualification questions, diagnosis summaries, quote
      messages, and follow-up notes.
- [ ] **7.4** Require explicit user confirmation for supported writes and keep
      prohibited payment, pricing, approval, messaging, and verification actions
      unavailable to the agent.
- [ ] **7.5** Enforce tenant, actor, role, module, and record checks in every tool
      call. Treat prompts and record content as untrusted data.
- [ ] **7.6** Audit model and rule versions, skill, source IDs, response,
      confirmation, and result.
- [ ] **7.7** Test authorization, source accuracy, prompt injection, denial, audit
      failure, confirmation, and user correction for each skill.

**Exit check:** Every answer links to permitted source records. Every supported
write requires confirmation and leaves an audit record.

## Phase 8: Release and Operational Readiness

- [ ] **8.1** Test fresh migrations and upgrades for every affected tenant database.
- [ ] **8.2** Test role permissions, record ownership, tenant isolation, and public
      IDs across all CRM modules.
- [ ] **8.3** Test valid and rejected transitions for Sales, Service, documents,
      delivery, work, and verification.
- [ ] **8.4** Test mobile retries, duplicate submissions, and persistence after
      restart.
- [ ] **8.5** Reconcile migrations, imports, reports, and financial summaries with
      their owning databases.
- [ ] **8.6** Run formatting, lint, TypeScript, focused tests, module boundaries,
      production builds, and composed web and mobile flows.
- [ ] **8.7** Document recovery, backup, rollback, retention, and support
      procedures before production rollout.

**Exit check:** All release gates in PLAN.md pass with evidence. Report database,
browser, mobile, and end-to-end results separately.

## Enquiry contact and closure tab, 17-10-2026

- [x] Refresh enquiry contact lookups after CRM contact changes and link the saved customer from enquiry details.
- [x] Add Verify and close and Reject to Closure approvals using server-provided reviewer capability.
- [x] Refresh enquiry status, comments, and activity after review.
- [x] Verify approval, rejection, denied review, and linked contact in a disposable database.
      Evidence: `npm run test:e2e:crm-closure`. Browser check showed both review actions on a pending enquiry.
      No existing closure decision was changed during the browser check.

## Closure navigation and badge, 17-10-2026

- [x] Remove the separate Closure Approvals navigation entries.
- [x] Show orange pending closure badges in enquiry list, details, and closure card.
- [x] Refresh pending status every 15 seconds for requests sent from mobile or web.
- [x] Verify pending flags appear for both request origins and clear after approve or reject.
      Evidence: `test:e2e:crm-closure` uses a disposable database and server-authoritative request status.

## Android-to-web closure verification, 17-10-2026

- [x] Build and install CRM 1.1.3 on Android emulator TechMedia_API_36.
- [x] On test enquiry #3, tap Android Add action > Mark completed, then verify the orange badge on web.
- [x] Click web Verify and close and verify Closed on both web and Android without reopening the detail screen.
- [x] On test enquiry #4, submit from Android and verify the orange badge on web.
- [x] Reject on web with a note and verify the badge clears, Android shows the note, and both screens retain New.
- [x] Verify Android offers Mark completed again after rejection.
- [x] Fix mobile detail refresh while a closure is pending and when the app resumes.
      Evidence: 24 Flutter widget tests passed, including both automatic refresh outcomes. Flutter analysis reported no issues.
      The closure API/database E2E passed. Final live reads returned #3 closed/approved and #4 new/rejected.
      Test records have CODEXSUN E2E titles and remain available for review. Existing enquiries #1 and #2 were not changed.
      Local screenshots: `dist/.tmp/codexsun-approval-pending.png`, `codexsun-mobile-approved.png`, and `codexsun-mobile-rejected.png`.
      Verification used the local Platform API and Android emulator, not a physical device or production deployment.

## Optional task contact, 17-10-2026

- [x] Add optional mobile and customer fields below Task details, using the enquiry contact lookup.
- [x] Persist the Core contact ID and resolve new customers within the task save transaction.
- [x] Preserve omitted contact fields for older clients and support explicit clearing.
- [x] Add a versioned nullable foreign key without changing applied migrations or existing task data.
- [x] Verify API/database create, reload, update, clear, invalid and inactive references, and denied writes.
      Evidence: `test:e2e:crm-task-contact` and 90 CRM/Frappe unit tests passed.
      Local migration applied and rerun on the configured tenant. Browser task #1 verified selection, save/reload, clearing, and inline creation.
      The task links to the newly created test contact #121. No existing tasks were changed.

## Existing record panel verification - 17-10-2026

- [x] Give task creation its own recent-record query, independent of list filters and pagination.
- [x] Refresh both panels every 15 seconds and allow manual retry.
- [x] Hide enquiry matches immediately when the mobile changes; include closed matches in See more.
- [x] Check local API and browser counts against four saved enquiries and the one saved task.
      Empty mobile history, exact task navigation, and matching all-status enquiry list were checked.
      CRM web typecheck, lint, two web unit tests, and CRM module boundaries passed.
      Task record navigation also preserves the draft when Keep editing is selected.
      Platform web typecheck, lint, and boundaries passed.
      These checks apply to local development, not deployment.

## SOP workspace refinement - 17-10-2026

- [x] Replace the combined creation page with a shared list, search, status filters,
      inline column search, column visibility, pagination, and row actions.
- [x] Add a minimal name/code/purpose upsert with unsaved-change confirmation.
- [x] Scope item and assignment management to the selected SOP and show lifecycle badges.
- [x] Fix item editor field names and capture the form before awaiting a save.
- [x] Local browser: create and edit E2E-SOP-UI-1710, preserve draft on Cancel,
      create and edit BILL-DELIVERY, verify search empty state and Inactive filter.
      CRM web typecheck, lint, module boundaries, component docs, and seven Frappe mapping tests passed.
      Browser publication/assignment and a fresh live Frappe transfer were not tested in this UI pass.

## SOP simplification - supersedes the tabbed workspace

- [x] Show only SOP name, Department, Frequency, and Steps in a flat list and form.
- [x] Remove SOP grouping, code/purpose, item/revision tabs, assignment controls, and lifecycle badges from this screen.
- [x] Preserve existing identities, instruction history, and evidence guidance internally.
- [x] Save publishes instructions using the existing APIs; flat SOP titles are sent once to Frappe.
- [x] Browser: create CODEXSUN E2E simple office SOP and verify all four saved fields in the list.
      CRM web and Frappe API typecheck/lint, boundaries, eight mapping tests, and isolated Duty E2E passed.
      This is local verification; remote delivery was not verified in this pass.

## Duties and Duty Reporting lists and upserts - 17-10-2026

- [x] Separate frontend assignment and report modules; preserve public duties entry point.
- [x] Use SOP-style lists and minimal new/edit forms matching LogicX fields.
- [x] Add permission-protected updates, duplicate assignment checks, report ownership/recurrence checks,
      revision/history protection, transactional edit snapshots, and outbound invalidation.
- [x] Apply additive edit-history migrations locally and verify repeat execution.
- [x] Browser: create a duty for the test SOP and tenant user, edit Index from 1 to 2,
      create today's report, edit Actions, and confirm saved list data.
- [x] CRM API/web and Platform web typecheck/lint, CRM boundaries, and expanded isolated Duty E2E passed.
      Root dependencies check remains blocked by existing apps/tconnect/web/dist.
      Fresh live Frappe delivery and native mobile acceptance were not part of this UI pass.

## Live SOP, duty, and report edits - 17-10-2026

- [x] Extend the live test to update assignment Index and report Date/Actions for every supported frequency.
- [x] Verify simplified SOP names, fetched fields, retained outcomes/issues, instruction snapshots, and edit history.
- [x] Verify stable remote identities and one report per SOP after edit and retry.
- [x] Live logicx.tmnext.in test passed for Daily, Weekly, Monthly, and Yearly.
      Twelve created remote records were deleted. Cleanup readback found zero labelled records and disposable databases.
      Eight mapping tests and the isolated Duty E2E passed.
      This verifies module API/outbox/worker/Frappe readback, not the background scheduler or a fresh browser/mobile run.

## Task filter and badge parity - 17-10-2026

- [x] Default Tasks to Active and exclude won/lost/closed in the server query.
- [x] Match enquiry Hold, Pending, Other filters and display server status counts.
- [x] Use enquiry status colors in task list and detail. Refresh task lists every 15 seconds.
- [x] Extend the disposable task E2E with terminal and grouped status fixtures.
      Active excludes terminal tasks; All and individual/group filters return the expected rows.
      Browser default Active and blue New badges were checked locally.

## Administrative Duty Reporting summaries - 17-10-2026

- [x] Match List in views, Apply/Clear date and search filters, grouped totals, and drill-through.
- [x] Require all-report permission on web options and summaries; remove web own-scope fallback.
- [x] Add Manager to default all-report grants alongside Admin and Super Admin.
      Applied the local seed and verified exactly those three active role grants.
- [x] Test reports from multiple users, all four grouped totals, date/search/result drilldowns,
      own-scope preservation, forbidden web access, manager-style access, and tenant isolation.
- [x] Browser: switch to User wise, open matching reports, return with the selected view preserved.
      CRM API/web typecheck, lint, boundaries, and expanded Duty E2E passed locally.
      Deployment and global web-login restrictions are outside this report-page change.

## 2026-10-17: Shared mobile action drawer

- Enquiries, Tasks, and Duties use one drawer layout: Action dropdown, input form, Cancel, and Confirm & sync. Separate enquiry/task Actions navigation was removed.
- Failed submissions preserve input. Duty edits preserve the original report date and outcome. Record history refreshes after submission.
- Flutter analysis and 26 tests passed. Android emulator enquiry checkout through the new drawer appeared in the open web Actions tab without reload, with GPS and accuracy. The saved emulator session is an administrator; normal-user ownership is covered by API integration tests.
- Earlier local checks passed work-report, duty, task-contact, and closure integration flows. Production deployment and live Frappe verification were not repeated for this change.

## 2026-10-17: Home card and badge acceptance

- Verified all six Home destinations on the Android emulator: Enquiries, Tasks, Duty, Activities, Chat, and administrator Call Logs.
- A labeled local assignment increased active Tasks from 1 to 2 and Chat conversations from 2 to 3. Reading its conversation cleared the bell, Chat, and Task badges. A subsequent message raised the badges again; reading cleared them. Closing the labeled task through request/approval returned the active count to 1.
- Fixed Future-returning refresh callbacks in Chat, Duty, Actions, and Call Logs. Open Chat threads mark newly polled messages read and immediately refresh Home badges. The bell opens the selected conversation directly.
- Activities now shares the page data source and three-day window with its Home count. Work badges derive from unread Enquiry, Task, and Duty conversations rather than the unavailable legacy notification endpoint.
- Added Home navigation/count-refresh, unread-snapshot, and visible-thread read tests. All 29 mobile tests pass. The work-report database E2E also checks assignment unread counts, same-second messages, read clearing, and stale cursor protection.
- Emulator testing uses the saved administrator session and labeled local fixtures. User assignment isolation is covered by the isolated API E2E. No production or live Frappe change is claimed.

## 2026-10-17: Live Techmedia and Rainbow acceptance

- Connected TECHMEDIA to `techmedia_db` and RAINBOW to `rainbow_db`. Verified backups and preserved existing users.
- Deployed the checked API and web. Both tenants passed the five CRM page checks without browser warnings or errors.
- Verified normal-user Android enquiry GPS reports and duty report creation/editing against the live VPS.
- Fixed repeatable role grants, authoritative mobile role display, request timeouts, and Task completion permission mapping.
- Reconciled workspace read permissions and verified both live Application overview pages.
- Evidence and verification limits: [LIVE-VERIFICATION-2026-10-17.md](LIVE-VERIFICATION-2026-10-17.md).

## 2026-10-17: Admin and Manager role acceptance and client APKs

- Verified exact Admin and Manager sessions in both live tenants. All 88 API reads and 60 browser page checks passed.
- Fixed missing Manager read grants in Contact, Call Log, SOP, Duty, and Contact 360 owners. Duty filter lookups accept all-duty read access.
- Deployed `codexsun/api:1.1.6-crm-roles-20261017`. Preserved database records and prior runtime artifacts.
- Regression checks preserve denied Contact/SOP/Duty/Core writes for Manager. The database E2E passed.
- Built separate Techmedia and Rainbow APKs, version 1.1.6, with distinct app IDs and tenant defaults.
- Evidence: [LIVE-VERIFICATION-2026-10-17.md](LIVE-VERIFICATION-2026-10-17.md).

## 2026-10-18: Combined Actions window

- Actions is the initial Enquiry and Task detail tab. Existing Comments, Jobs, Estimate, and other detail tabs remain available.
- Removed Send report from the web action form. Add comment submits through the owning comment operation. Enquiry replies can be composed from Actions.
- The work history API combines workflow reports and audit activity, including estimate changes and task creation. Matching mirrored events appear once.
- Older report-prefixed workflow events retain their true action on read. Existing report text remains available as comments in the web view.
- Job operations immediately refresh the combined history.
- CRM API build, API/web lint, web typecheck, boundaries, and the isolated work-report database E2E passed locally. No deployment or mobile rebuild was performed.
- Task comments support threaded replies. Tasks remain independent of Enquiries, so task creation appears in that task's own history.

## 2026-10-18: Persisted enquiry WhatsApp history

- Added the Enquiry WhatsApp leaf with tracked migration `crm.enquiry-whatsapp.messages-v1`. Applied and verified `crm_enquiry_whatsapp_messages` in local `codexsun_db`.
- Stores enquiry ID, server-resolved recipient, message, request ID, signed-in author, and UTC creation time. A unique author/request key prevents duplicate retries.
- GET and POST `/crm/enquiries/:id/whatsapp-messages` use existing Enquiry permissions and record visibility. Names resolve from tenant users.
- The WhatsApp tab saves the handoff before opening WhatsApp and refreshes its history table. History records message handoff, not confirmed transmission or delivery.
- A database E2E verifies repeated migration, persistence, names, encoded message, retry reuse/conflict, missing recipient, and denied reads/writes.
- CRM API build, API/web lint, web typecheck, and CRM boundary checks passed. Live databases and APKs were not changed.

## 2026-10-19: Responsive Enquiry and Task web views

- Enquiry and Task lists use compact cards below the medium breakpoint and keep the sortable table on wider screens. Mobile cards retain status, priority, primary details, customer/contact, due date, assignee, closure state, and available actions.
- Enquiry and Task show summaries remove desktop column widths on small screens and allow long values to wrap within readable columns.
- UI and CRM web typecheck, lint, and build passed. The live site was not published; browser visual verification of the local source remains open.

## 2026-10-18: Actions and focused-tab refresh wiring

- Comments, job edits, estimates, properties, WhatsApp handoffs, and closure request/review now invalidate the combined Actions history immediately. Actions uses the same owning comment/job/checkpoint operations as focused tabs.
- Check in / out includes a top toggle and refresh control. Both views read the signed-in user's persisted checkpoint state and invalidate the same cache after writes.
- WhatsApp handoff creation emits a transactional `whatsapp-handoff` work event. Ignored duplicate inserts do not repeat the event. Event failure rolls back the handoff.
- WhatsApp database E2E passed for one matching action per retry and rollback on event failure. Work-report database E2E passed for saved checkpoint state and action permissions.
- CRM API build, API/web lint, web typecheck, and module boundaries passed locally. No live deployment or mobile rebuild is claimed.

## Marketing Lead intake local continuation, 23-10-2026

CRM now owns a canonical Marketing Lead intake contract and a review-only Lead list/Show surface.
Intake uses company and submission identity, preserves the original campaign snapshot, and creates one assigned Task in the same transaction.
Leads remain under review. No email/phone match automatically merges a Core identity.
Marketing handoff creates no Enquiry and does not enter the Enquiry/Frappe export queue.
Disposable two-database tests verified one Lead/Task result, denied scope, and no Enquiry/Frappe queue row.
CRM API/web typecheck, lint, and API build passed locally. The full authenticated Lead browser journey remains open.
Qualification, contact matching, conversion, outcome projection, and structured communication restrictions remain open.
No existing customer database migration or cloud deployment was performed.

## Local email policy evidence, 23-10-2026

CRM now owns append-only company-scoped email contact restrictions and a public policy check.
The check also reads Contact Preferences for every matching Core identity. Unknown legacy preferences require review.
Explicit operational allowance never grants promotional consent. Restriction changes require `crm.contact-restrictions.manage`.
Policy reads require `crm.contact-restrictions.check`. Only Admin receives these new grants by default.

The two-disposable-database Marketing suite verifies denied grants, tenant/company isolation, legacy CRM restrictions, Mail complaint/bounce blocking, and owner outages.
Existing local business row counts were preserved. No commit, push, or deployment was performed for this work.

Focused owner typecheck, lint, build, and module boundaries passed for the email policy continuation.
Marketing database tests verify exact UTC timestamps and near-expiry rejection alongside tenant and owner policy checks.

## Test cleanup and TechMedia 1.1.50 emulator verification — 2026-10-23

- [x] Close eight confirmed test enquiries and Tasks 1-3 through approval, with one test-completion comment each.
- [x] Verify all eight enquiry closures and Job Comments in Frappe, with zero unsent enquiry events.
- [x] Retire the test SOP, SOP Item, and Duty Assignment. Preserve the completed report and add closure notes locally and remotely.
- [x] Install signed TechMedia 1.1.50, build 150, on emulator-5554 without clearing app data. Confirm package metadata and preserved Vijay session.
- [x] Verify active enquiries exclude all eight closed fixtures across 668 records. Verify zero active tasks and duties in the installed app.
- [x] Verify Show all retains three Closed tasks. Restore the active view and normal search.

See [the cleanup and emulator verification report](RELEASE-1.1.50-VERIFICATION.md) for identities, scope protection, evidence, and limits.

## Standard User draft access — local, 2026-10-24

- [x] Seed available User read/create grants and remove stale administrative edit/delete grants.
- [x] Enforce administrator role ceilings through the public CRM permission policy used by Platform authorization.
- [x] Add a separate SOP revision draft-edit permission. Preserve published revision data and publication controls.
- [x] Verify persisted grants and actual draft/published revision update behavior in disposable local MariaDB databases.

Existing tenant-wide visibility and operational work scopes remain in force. No cloud deployment ran.
