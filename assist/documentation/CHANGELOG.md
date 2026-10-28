# Changelog

## Version State

Current version: 1.1.87

Release tag: v-1.1.87

Changelog label: v 1.1.87

This changelog starts fresh from the cleaned CODEXSUN foundation. Earlier copied application history was intentionally removed because it did not represent the current workspace.

New entries should keep database-facing work and application code work separate.

#### Database Changes

Records schema, migration, seed, tenant provisioning, and data compatibility changes.

#### App Codebase Changes

Records UI, API, service logic, tooling, packaging, and documentation changes.

## Unreleased operation records

### 2026-10-27 - Record the Thirumurugan Data Bridge VPS transfer

#### Database Changes

- Record the completed transfer from local `thirumurugan_v2_local` to VPS `thirumurugan_v2_db`.
- Record activation of the existing SRI THIRUMURUGAN PRINTERS tenant and persistent storage provisioning.
- Record verification of 1,660 confirmed invoices, 5,301 items, login, isolation, and unchanged source fingerprints.
- Keep 223 held invoices and all 683 legacy receipts pending. Customer outstanding balances remain incomplete.
- This documentation update performs no additional database change or transfer.

#### App Codebase Changes

- Update the [Thirumurugan migration guide](../../devkits/data-bridge/agent/thirumurugan-migration.md) with the completed VPS phase.
- Add the [dated operation log](../../devkits/data-bridge/agent/THIRUMURUGAN-VPS-TRANSFER-2026-10-27.md) with verification and recovery evidence.
- No application logic, package version, image deployment, or credential change in this documentation task.

## v-1.1.87

### [v 1.1.87] 2026-10-28 8:10 pm - Reuse verified backups for local updates

#### Database Changes

- Database update: No (manual).
- Verify a reused backup in an isolated database before local migrations. Later changes are not included in that backup.

#### App Codebase Changes

- Bumped workspace version to 1.1.87.
- Allow two local updates to reuse a verified backup made on the same day with `--nobackup`.
- Reject VPS `--nobackup` until its backup and restore verification covers the required data.
- Keep VPS application writers stopped for review if a deployment fails after migrations may have changed data.

## v-1.1.86

### [v 1.1.86] 2026-10-28 7:00 pm - Protect Data Bridge sources and local upgrades

#### Database Changes

- Database update: Yes (manual).
- Require read-only source grants and sessions for Data Bridge imports and tenant user copies.
- Reject source and target aliases that resolve to the same MariaDB server and schema.
- Recover the interrupted local ALTEX migration after a backup and checksum and schema verification.
- Apply the remaining ALTEX migrations through the local updater. Keep all imported tenant records inactive.

#### App Codebase Changes

- Bumped workspace version to 1.1.86.
- Use npm 12.2.1 in Docker builds and GitHub workflows.
- Stop local updates early when an existing database has an unfinished migration ledger entry.
- Retry transient proxy readiness errors during container startup.
- Preserve the MariaDB entrypoint shell options during fresh database initialization.
- Verify Data Bridge imports with read-only accounts on a disposable MariaDB server.

## v-1.1.85

### [v 1.1.85] 2026-10-28 4:37 pm - Harden local upgrades and dependency installation

#### Database Changes

- Database update: Yes (manual).
- Verify a master backup and restore before startup, and validate isolated backups before migration and seed.
- Skip missing inactive tenant databases during local updates. Fail if an active tenant database is missing.
- Improve tenant seed handling and migration performance for standard columns.

#### App Codebase Changes

- Bumped workspace version to 1.1.85.
- Add guarded local backups, database relay isolation, recovery checks, and migration sequencing.
- Reject stale mounted proxy templates before local updates. Recover the local stack after a shop startup race.
- Show tenant database setup progress and refresh proxy DNS after API replacement.
- Pin npm 12.2.1 and record the install script policy for core-js and msgpackr-extract.
- Test three isolated migration and seed cycles and one local deployment on version 1.1.84.

## v-1.1.84

### [v 1.1.84] 2026-10-28 9:08 am - Update workspace version and preserve Platform work

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.84.
- Preserve the unfinished Platform startup commit f57b4d3d in the backup-platform-2026-10-28 tag; it is not included in main.
- Keep the existing Platform stash intact. No application or database changes are included in this version update.

## v-1.1.83

### [v 1.1.83] 2026-10-28 8:22 am - Harden migrations and Frappe integration

#### Database Changes

- Database update: Yes (manual).
- Add Frappe enquiry source identity columns and backfill unambiguous links.
- Add migration coordination, backup evidence, rollback guards, and recovery checks for platform and tenant databases.
- Update Sites and Sportsclub migration handling and add migration lifecycle coverage.
- No database migration or deployment was run for this version update.

#### App Codebase Changes

- Bump workspace version to 1.1.83.
- Preserve CRM enquiry numbering and improve Frappe contact import and outbound comment matching.
- Update deployment promotion and recovery checks for the retained Data Bridge volume.
- Update database migration operations guidance and repository documentation.
- Record the local Docker audit: pending tenant migrations blocked application replacement. Redis and MariaDB were retained.

## v-1.1.82

### [v 1.1.82] 2026-10-27 2:20 pm - Improve test tooling and Ecommerce tenancy coverage

#### Database Changes

- Database update: No (manual).
- The database-user helper now sends escaped SQL through standard input without a credential file. No live database operation was run.

#### App Codebase Changes

- Bumped workspace version to 1.1.82.
- Remove duplicate Ecommerce development and tenancy test aliases and document the retained commands.
- Scope Platform verification and reuse verified Framework builds in focused tests.
- Split Ecommerce tenancy access, browser, and query helpers while retaining the shared fixture lifecycle.
- Update the legacy variant migration expectation to include the current final migration.

## v-1.1.81

### [v 1.1.81] 2026-10-27 11:58 am - Update development policies and repository cleanup

#### Database Changes

- Database update: Yes (manual).
- Remove retired LogicX ERP tenant provisioning and seed calls. Preserve existing scheme tables and block unsafe tenant rollback.

#### App Codebase Changes

- Bumped workspace version to 1.1.81.
- Apply fast-work verification guidance across repository, app, devkit, and shared package agent policies.
- Remove retired CXMobile, LogicX ERP, and CodeIT integration references and update Frappe installation to use LogicX Biz.
- Include the current local deployment, application, and tooling changes in this source baseline.

## v-1.1.80

### [v 1.1.80] 2026-10-27 10:57 am - Update local deployment and Frappe tooling

#### Database Changes

- Database update: Yes (manual).
- Add a CRM permission sync command for active CRM tenants with configured databases.
- Parse tenant module keys before selecting permission sync targets. No database operation was run for this commit.

#### App Codebase Changes

- Add local update planning, configuration checks, and CRM permission sync.
- Remove automatic local backups before application replacement. Recovery restores application configuration without restoring database data.
- Add Frappe suite and app image setup, compatibility helpers, record verification, and tests.
- Synchronize workspace versions and internal dependencies to 1.1.80.

## v-1.1.79

### [v 1.1.79] 2026-10-27 10:12 am - Complete Platform queue Worker sync and resilience audit

#### Database Changes

- Database update: No. Use the existing queue schema. No migration, seed, reset, or data restore is required by this batch.
- Guard queue completion, failure, progress, refunded holds, and automatic retry with the claimed attempt and current status.

#### App Codebase Changes

- Complete opt-in headless Worker composition for existing Platform queues. Keep Platform execution as the compatibility default.
- Preserve tenant restoration, module-owned handlers, producer-only APIs, signed Chat notifications, and graceful consumer shutdown.
- Bound Redis producer waits and retain successful SQL enqueue acknowledgements during transport outages. Reconcile pending jobs after recovery.
- Repair cancelled and delayed delivery reuse, apply Redis retention ages, preserve TLS and IPv6 connection settings, and check readiness with an empty backlog.
- Recheck tenant Mail activation and prevent activity-log failures from invalidating saved queue operations. Load Mail dependencies only when needed.
- Record 36 native regression passes, Platform and Worker typechecks/lint, Docs validation, and module-boundary checks in the queue audit.
- Keep Docker acceptance with the deployment owner. Generic hard-crash replay, cross-version fencing, exactly-once effects, and live-provider acceptance remain outside the executed proof.
- Synchronize all workspace, internal dependency, lockfile, Windows manifest, and deployment-sample versions to 1.1.79.

## v-1.1.78

### [v 1.1.78] 2026-10-27 10:04 am - Streamline development checks

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Let app chats manage Git and locked dependencies in their assigned worktrees. Keep main integration and release ownership with the supervisor.
- Remove automatic recursive workspace cleanup from routine checks and builds. Add scoped development builds.
- Limit mandatory component documentation to a README. Retain Zetro runtime rules and full release gates.
- Add a documentation-only CI path and a verified framework startup cache.
- Verify the pre-merge 1.1.76 worktree with a clean 63-task build, 62 lint tasks, 116 typecheck tasks at concurrency two, 28 authentication and tenancy tests, and 17 release contract tests.
- The default-concurrency typecheck crashed in the compiler runtime. Multi-tenant live isolation and the post-merge release build remain unverified.
- Bump workspace version to 1.1.78. Do not deploy.

## v-1.1.77

### [v 1.1.77] 2026-10-27 8:52 am - Compact CRM enquiry table

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Show compact relative ages in the Created column with the full date and time on hover.
- Keep table headers on one line, shorten Assigned, and reduce ID, Action, and Details widths.
- Keep long names and details accessible on hover and retain horizontal scrolling on narrow screens.
- Exclude the local npm cache from documentation scans to avoid long filesystem walks.
- Bump workspace version to 1.1.77.

## v-1.1.76

### [v 1.1.76] 2026-10-26 10:08 pm - Complete CRM Leads and Reminder workflows

#### Database Changes

- Database update: Yes. Apply `crm.lead.workspace.v2` and Lead permission seeds for existing tenants.
- Add Lead contact/conversion links, revisions, scoped list index, and activity history. Preserve existing intake records.

#### App Codebase Changes

- Complete Lead list, show, create, update, campaign lookup/defaults, filters, and atomic Enquiry conversion.
- Add app-header Lead actions and Ctrl+S. Allow blank contact names and enquiry details.
- Flatten Reminder navigation, count open work, distinguish sidebar icons, and add reminder popup creation and rescheduling.
- Keep rescheduling limited to assigned users or schedule managers. Exclude dismissed and completed reminders from counts.
- Format Enquiry age for humans, keep due dates on one line, and center priority and Created cells.
- Validate five-tenant Lead isolation, conversion rollback, optional fields, and lookup scope through 16 integration tests.
- Bump all workspace versions to 1.1.76. Production deployment remains separate.

## v-1.1.75

### [v 1.1.75] 2026-10-26 - Complete the local CRM Leads workspace

#### Database Changes

- Add Lead contact and Enquiry links, optimistic revisions, a list index, and an owned activity table through migration `crm.lead.workspace.v2`.
- Add Lead create/update/conversion grants. Keep ordinary-user writes assigned to their own leads and administrator-only tenant-wide reads.

#### App Codebase Changes

- Register the missing Leads routes in the Platform API and match the Enquiry list, details, upsert, filters, pagination, and responsive layout.
- Convert a Lead to one Enquiry transactionally, preserving its assignee and Marketing receipt. Prevent duplicate conversion and stale edits.
- Send the selected company with CRM requests and scope Lead caches and delayed requests by tenant/company.
- Verify the disposable-database Leads suite and the full 17-stage CRM suite locally. Production migration and rollout remain pending.

### [v 1.1.75] 2026-10-26 6:22 pm - Finalize CRM pin comments and web creation age

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.75.
- Release the CRM pin comment and action contract from main commit `0df24fc9`.
- Save each pin with one linked comment and one Pin Location action. Display seven coordinate decimals, two accuracy decimals, and local capture time.
- Show Created immediately after Priority on the web enquiry list. Display the date and elapsed hours and minutes without network polling.
- Include the Android plugin registration guard and clear location capture error messages.
- Prior functional validation passed: 46 mobile widget tests, 26 staged action checks, pin formatting tests, and the database record-scope and rollback suite.
- The prior 1.1.74 rollout passed public health checks and live web column verification. Verify the 1.1.75 images on staging before promotion.
- Scope cloud promotion to API/Web. No database migration, permission reseed, or further database backup is required for this release.

## v-1.1.74

### [v 1.1.74] 2026-10-26 - Save linked pin comments and show enquiry creation age

#### Database Changes

- No schema migration or permission seed is required. Save each new location, comment, and action in one transaction.

#### App Codebase Changes

- Show Created after Priority in the web enquiry list, with the date and elapsed hours and minutes. Refresh the age once a minute without network polling.
- Save Pin Location comments and action details with linked coordinates, two-decimal accuracy, and the local capture time.
- Restore Android plugin registration and show actionable location errors instead of leaving a failed capture unexplained.

### [v 1.1.74] 2026-10-26 4:20 pm - Honor granted CRM mobile action permissions and scope cloud rollout

#### Database Changes

- Database update: Yes (manual).
- Seed `crm.enquiry.work` for standard CRM roles in existing active CRM tenants. No schema change is required.

#### App Codebase Changes

- Bumped workspace version to 1.1.74.
- Honor granted enquiry Edit permissions for assigned mobile users instead of applying an additional administrator-only rule.
- Allow assigned users to pin locations, check in/out, comment, and open a new call with the dedicated work permission.
- Keep creator-only writes, cross-assignee writes, assignment changes, and tenant-wide reads restricted.
- Apply the owner assignment guard to every composed enquiry write route, including job start/stop and child records.
- Support API/Web-only immutable promotion with excluded service identity checks and scoped rollback.
- Do not create further database backups for this rollout, as instructed by the user.

## v-1.1.73

### [v 1.1.73] 2026-10-26 - Allow assigned mobile users to post field actions

#### Database Changes

- Seed the new `crm.enquiry.work` permission for the five standard roles in existing active CRM tenants. No schema migration is required.
- Apply the permission seed only after a verified backup and staged acceptance. Production application remains pending.

#### App Codebase Changes

- Allow assigned users to post enquiry location pins and check-in/check-out with the dedicated work permission.
- Keep record editing, charges, collections, creator-only writes, and unassigned writes restricted by existing checks.
- Verify positive and negative actions with the real database record-scope suite. CRM and Platform API type checks pass.

### [v 1.1.73] 2026-10-26 3:02 pm - Make CRM independent and verify mobile tenant isolation

#### Database Changes

- Database update: No (manual).
- Add a guarded local test fixture command for five isolated tenant databases. No production migration, seed, or schema change is required.

#### App Codebase Changes

- Bumped workspace version to 1.1.73.
- Remove Frappe sync columns, source panels, verification actions, and integration polling from CRM. Keep durable enquiry events for the separate Frappe app.
- Commit CRM saves without waiting for remote readiness or delivery. Resolve work-report context before write transactions to avoid pool starvation.
- Bound concurrent contact reads per tenant, coalesce active lookups, reuse scoped list counts, and return running-job summaries with enquiry pages.
- Refresh mobile timers and assignments from list summaries. Search all enquiry pages after a 300 ms typing delay without requiring Enter.
- Add repeatable local fixtures and a CRM test runner. Local acceptance passed 268 tests, all 20 ordered tenant pairs, five tenants with 3,000 enquiries each, and visible Android/web flows.
- Record 2,000 successful sustained reads with 20 concurrent readers: p95 129 ms across five tenants and 270 ms on the 20,001-record dataset.
- Keep provider workers disabled during local acceptance. Local fixtures and ignored evidence do not migrate or modify production data.
- Preserve the explicit external Frappe and Platform fixture exclusions in the CRM suite. Local acceptance does not certify a production deployment.
- Update compatible locked dependency versions for DOMPurify, Zod, Nodemailer, Mailparser, and ip-address. The installed dependency audit reports zero vulnerabilities.
- Make POP3 text retrieval explicit and use the parser's exported message type for compatibility with its current declarations.
- Generate a marked synthetic Sites publication only for repository CI build verification. Production snapshot identity and checksum checks remain required.

## v-1.1.72

### [v 1.1.72] 2026-10-26 12:43 pm - Enforce trusted global Platform administration

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.72.
- Require a verified, active server-backed Super Admin session for every global Platform admin read and write. Deny tenant administrator, tenant user, staff, and anonymous authority at the backend.
- Reject unknown session identity/access-mode metadata rather than defaulting to privileged authority. Preserve public and tenant owner checks.
- Add actual route-registration, encrypted-cookie, bearer/session mismatch, forged-authority, adjacent-route, and positive operator regressions.
- Record staging and recovery limits in `.container/docs/RELEASE-1.1.72.md`. No production, SQL, backup, restore, install, tag, or deployment operation.

## v-1.1.71

### [v 1.1.71] 2026-10-26 11:20 am - Preserve legacy variant writes and Data Bridge ownership

#### Database Changes

- Database update: Yes (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.71.
- Remove the unused Marketing conversation-list binding that blocked repository lint. Keep its unfinished app worktree unchanged.
- Append Ecommerce migration 41 for old/new writer canonical signatures, guarded SQL parity, collision refusal, and revision updates. Preserve all historical migration identities.
- Restore Data Bridge preparation ownership with real lifecycle roles, ordered service, snapshot hydration, transaction worker, authenticated capabilities, and execution denial.
- Add focused compatibility tests, Unicode/escape parity vectors, and a staging-only SQL verification helper.
- Record unchanged recovery requirements and remaining staging/production gates in `.container/docs/RELEASE-1.1.71.md`. No new backups, restores, server changes, or deployment.

## v-1.1.70

### [v 1.1.70] 2026-10-26 10:29 am - Preserve historical Ecommerce migration lineages

#### Database Changes

- Database update: Yes (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.70.
- Preserve exact Ecommerce migration identities for the proven 31-step `8433a8ff` and 34-step `27135c9a` lineages. Append missing upgrades without rewriting applied records.
- Resolve owner steps from immutable scope metadata inside the framework migration lock. Keep version and checksum validation unchanged.
- Add historical fixtures, real-callback in-memory migration tests, repeated-run checks, invalid-history rejection, and populated-variant collision coverage.
- Expose a lineage-aware metadata planner. Offline supplied ledgers for 13 reachable active tenants select the older lineage without applied-record mismatches.
- Exclude ignored local runtime handoffs from generated Docs. Preserve unrelated runtime files and media.
- Record source validation and migration/recovery limits in `.container/docs/RELEASE-1.1.70.md`. No live database operation, restore, new backup, image build, tag, or deployment.

## v-1.1.69

### [v 1.1.69] 2026-10-25 11:49 pm - Define Prompt Manager drafting and dispatch boundaries

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.69.
- Define Prompt Manager analysis, drafting, explicit dispatch, and recipient-template boundaries without granting execution permissions.
- Route app implementation to owner chats and preserve supervisor ownership of Git integration, version updates, and publication.
- Link the shared Prompt Manager role from repository entry points, governance, versioning, worktree workflow, and deployment rules.
- Consolidate identical app and deploy entry-point edits on main, and synchronize available registered worktrees after publication.
- Record checks, preservation evidence, and the unavailable retained Platform checkout in `.container/docs/RELEASE-1.1.69.md`.
- Update lockstep package versions, internal ranges, lockfile metadata, Windows manifests, and deployment sample without installation. No tag or deployment.
- Candidate preparation, 26-10-2026: require the exact reviewed SHA for VPS updates and add read-only source, image, isolation, and evidence checks.
- Add staging-only input templates and synthetic deployment tests. Candidate images, staging acceptance, recovery, migration review, and production promotion remain unexecuted.
- Five-service review, 26-10-2026: extend staging input checks to API, Web, Shop, Worker, and Chatb, with complete realtime selection, isolated configuration, and queue/WebSocket evidence.
- Keep new tenant backups limited to Techmedia and Rainbow. Wider migration recovery coverage and immutable-image promotion remain blocking gates.

## v-1.1.68

### [v 1.1.68] 2026-10-25 11:30 pm - Centralize release supervision and synchronize app baselines

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.68.
- Assign shared Git integration, publication, versioning, and worktree synchronization to the release supervisor.
- Keep app chats responsible for scoped implementation, focused checks, and review handoffs in their assigned worktrees.
- Consolidate identical app entry-point edits on main. Preserve the retained coordinating worktree and existing stashes.
- Remove deleted 1.1.69 and 1.1.73 reservations from the active workflow. Keep the empty 1.1.67 reservation.
- Synchronize registered package versions, internal dependency ranges, lockfile metadata, Windows manifests, and the deployment sample without installation.
- Record source checks, synchronization results, and acceptance limits in `.container/docs/RELEASE-1.1.68.md`. No tag or deployment.

## v-1.1.67

### [v 1.1.67] 2026-10-25 10:58 pm - Integrate Marketing and CXMobile and reset app worktrees

#### Database Changes

- Database update: Yes (manual). Integrated Marketing module migrations require staging review. No database operation ran.

#### App Codebase Changes

- Integrate the scoped uncommitted Marketing and CXMobile changes into main with recoverable worktree snapshots.
- Add Marketing Content, Email Campaign, Conversation, social webhook handling, and navigation wiring.
- Integrate CXMobile native session, HTTP, Android transfer, lazy workspace, and fixture changes. Repair compile blockers without claiming device acceptance.
- Remove the incomplete Project Manager DevKit and its Platform, startup, build, catalog, and documentation wiring. Preserve existing data.
- Record app selection and the app worktree -> main -> candidate -> staging -> approved cloud workflow.
- Archive old CODEXSUN chats and prepare fresh CXMobile, Marketing, CRM, and Billing checkouts without npm installation.
- Add missing Marketing and existing Ecommerce developer references, and align all registered package and lockfile versions to 1.1.67.
- Record verification boundaries and the fresh checkout plan in `.container/docs/RELEASE-1.1.67.md`. No deployment.

## v-1.1.66

### [v 1.1.66] 2026-10-25 10:09 pm - Harden versioned deployment backup and realtime routing

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace manifests, internal dependency ranges, lockfile, and desktop manifests to 1.1.66.
- Use native graceful Docker stop before VPS backups. Bound the client wait without escalating to SIGKILL.
- Preserve API WebSocket upgrades and add optional same-origin Chatb routing to the Web and Shop proxies. Worker control remains private.
- Retain an explicitly configured existing Media volume with strict adoption checks, a checksum-verified archive, and exclusion from cleanup deletion.
- Include local updater snapshot reuse, unchanged-release health checks, and guarded backup reuse. Keep a fresh quiesced backup before replacement.
- Record source-only release verification in `.container/docs/RELEASE-1.1.66.md`. No deployment was performed.

## v-1.1.65

### [v 1.1.65] 2026-10-25 6:58 pm - woking on cxmobile

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.1.65.

## v-1.1.64

### [v 1.1.64] 2026-10-25 3:00 pm - working on new work

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.1.64.

## v-1.1.62

### [v 1.1.62] 2026-10-25 11:28 am - Verify four-client Data Bridge migrations and approved corrections

#### Database Changes

- Database update: Yes. Import business rows into ASKNITS, SUNLIGHT, MATHAN and AARAN targets through Common → Masters → Billing. Preserve every source database.
- Verify 132 invoices and 232 invoice items with target foreign IDs. Repeat all four imports with zero business inserts, updates or new users.
- Apply approved target-only Nos placeholder-product mappings for ASKNITS, SUNLIGHT and MATHAN. Keep hyphen unit ID 1 and existing references.
- Match MATHAN current-year flags to its source while preserving year identities, dates and the default-company FY 2026–27 pointer.
- Reuse existing company identities. Retain Billing settings warnings and SUNLIGHT/AARAN navigation preferences. No schema migration is required.

#### App Codebase Changes

- Update lockstep release metadata to 1.1.62. This source release does not deploy new cloud images.
- Copy company logos and favicons through source-bound read-only media mappings and the Core branding contract. Preserve conflicting target files and report missing assets.
- Permit user transfer when only the landing-app preference differs after strict source/target, company, year and singleton verification. Keep all other identity conflicts blocked.
- Record queue jobs, approved corrections, source fingerprints, repeat-import proof and dashboard SQL comparisons in the Data Bridge cloud log.
- Verify focused branding/user-context tests, Data Bridge API build and lockstep version checks. Keep unrelated CRM, deployment, ecommerce and Codeit work outside this commit.

## v-1.1.61

### [v 1.1.61] 2026-10-25 8:34 am - Gate CRM Frappe sync by tenant switch

#### Database Changes

- Database update: Yes. Frappe migration `frappe.connection.availability-v11` adds tenant server hours and persisted connection availability. Business records and source links are preserved.

#### App Codebase Changes

- Bump lockstep workspace, lockfile, Windows, deployment sample, and CRM mobile metadata to 1.1.61. CRM mobile build number is 161. No APK was built.
- Require the tenant's enabled CRM/Frappe apps, saved enabled connection, and Live sync switch before showing CRM Frappe controls or allowing transfers.
- Hide sync columns, detail tabs, errors, and verification controls across contacts, enquiries, call logs, SOPs, duties, reporting, and the local-only Task notice when sync is off.
- Gate immediate dispatch, scheduled relays, manual transfer requests, and queued worker execution. Preserve direction, module settings, and record permissions.
- Preserve local records, source links, checkpoints, and pending events while sync is off. Refresh deferred delivery generations without changing stable record or comment identities.
- Scope capability caching by tenant and database. Hide sync controls when settings are missing or capability reads fail.
- Move the stale Codeit npm cache from nested workspace dist into root dist. Restore three missing root npm workspace links with an offline install.
- Verify tenant switch states, safe queue resume, record scope, contact persistence, duty retries, table rendering, owner boundaries, builds, dependency layout, and version alignment locally.
- Leave cloud deployment, remote Frappe verification, Git commit/push, and mobile builds outside this update.

- Add Frappe Server availability settings with daily 08:00-21:00 defaults, timezone validation, and a live read-only connection probe.
- Hold Frappe jobs outside server hours or during outages without consuming queue retries. Reuse the same delayed BullMQ delivery and successful import checkpoint.
- Verify local-clone migration replay, browser persistence, waiting status, and real Redis hold/recovery. Keep external integrations isolated and the VPS unchanged.

## v-1.1.60

### [v 1.1.60] 2026-10-25 8:13 am - Refresh Billing dashboards after Data Bridge imports

#### Database Changes

- Rebuild target Billing dashboard snapshots after successful Data Bridge queue imports. No schema or source database changes.
- Reconcile SUKRAA and ALTEX dashboard metrics with confirmed invoices and posted vouchers. Preserve existing settings differences.

#### App Codebase Changes

- Export the Billing projection service and compose it through the registered target database connection in Platform.
- Refresh all target company/year contexts before business, mapped, and common import jobs complete. Projection failures remain retryable.
- Deploy the latest Billing reporting-currency controls with the dashboard fix while preserving existing CRM patches and shared services.
- Record live queue, invoice, source fingerprint, and dashboard verification in the Data Bridge cloud log.

### [v 1.1.60] 2026-10-24 11:50 pm - CRM mobile performance audit and refactor

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Reduced the Jobs feed from per-enquiry detail fan-out to summary loading, with timer sessions fetched and cached as cards are needed.
- Reused the mobile API HTTP client, parallelized independent pending-state lookups, avoided unchanged feed notifications, and indexed feed jobs by source ID.
- Replaced the eager Jobs card list with a lazy list and reduced dashboard duty-count loading to one API request.
- Removed unused CRM mobile API helpers and retained the pending mobile UX updates for call logs, call notes, job/task actions, and navigation.
- Verified with Flutter analysis and all 78 CRM mobile tests.
- Bumped workspace version to 1.1.60.

## v-1.1.59

### [v 1.1.59] 2026-10-24 11:08 pm - Deploy Data Bridge and audit cloud SUKRAA and ALTEX

#### Database Changes

- Database update: Yes (manual).

#### App Codebase Changes

- Prepare the scoped cloud rollout of the tested Data Bridge repair, preserving live CRM patches and shared services.
- Record source/target identities, backup requirements, queue verification, invoice checks, and repeat-import proof in [the cloud release log](../../devkits/data-bridge/agent/CLOUD-1.1.59.md).
- Deploy 1.1.59 API/Web/Shop and preserve live CRM patches and shared infrastructure identities.
- Import 1,595 SUKRAA and 5,094 ALTEX business rows through four real Redis-backed first/repeat jobs, all completed in one attempt.
- Verify 137/137 and 184/184 invoices, 521/521 and 690/690 item rows, all other children, 354 relationships, and zero orphans.
- Preserve source fingerprints, reuse one company per target, copy five missing User accounts with exact hashes, and retain two existing administrators.
- Repeat both imports with zero business writes or new users and identical saved row fingerprints.
- Verify 140 public report drilldowns and invoice pagination. Preserve one Billing settings warning per target.
- Retain checksum-verified before/after backups. Record seven dependency advisories, including one high and one critical, without claiming a clean security audit.

## v-1.1.58

### [v 1.1.58] 2026-10-24 10:47 pm - Verify fresh Data Bridge client imports and safe User access

#### Database Changes

- Database update: Yes. Add safe unit defaults and company/default-setting provenance upgrades.
- Reuse seed companies in place, preserve references, and copy only missing users with exact supported hashes and target User roles.
- Initialize fresh local sukraa_db and altex_db targets from their cloud-named local sources. Both source row fingerprints remain unchanged.
- Verify 137/137 SUKRAA and 184/184 ALTEX invoices, 521/521 and 690/690 item rows, and all other invoice descendants.
- Retain five deleted ALTEX invoices. Preserve one target Billing settings conflict per tenant as a warning.
- Repeat both imports with zero business inserts/updates or account inserts and identical saved row fingerprints.

#### App Codebase Changes

- Separate company updates from inserts and show sanitized Users results and warnings.
- Permit User draft editing while enforcing administrator-only finalized edits, deletion, settings, and lifecycle changes.
- Verify all seven copied users against actual target permission checks without elevating their roles.
- Add an explicit local-only fresh-client harness. It uses repository owner services and refuses existing targets.
- Pass owner lint, selected typechecks, access regressions, boundaries, dependencies, and version alignment. Shared root checks retain unrelated Docs/Ecommerce blockers.
- Record exact totals, source fingerprints, warning treatment, and transport limits in the [local release proof](../../devkits/data-bridge/agent/RELEASE-1.1.58.md).
- Bump lockstep metadata to 1.1.58. Leave unrelated implementation changes and cloud deployment outside this release.

## v-1.1.57

### [v 1.1.57] 2026-10-24 - Local company mapping and User access repair

#### Database Changes

- Add tracked company and default-setting seed provenance upgrades with conservative legacy adoption.
- Reuse one verified seed for a single-company source. Preserve target identity and dependent references.
- Preserve existing companies and accounts. Copy supported hashes only for missing users through the privileged Platform owner contract.
- Resolve units by normalized name while preserving target display order and reference IDs.

#### App Codebase Changes

- Hold account transfer until company/default mapping and active target business context pass verification.
- Grant supported Core, Billing, and CRM User access. Restrict edits to actual drafts and retain administrator mutation controls.
- Report company updates separately from inserts and show sanitized account results in a separate Users tab.
- Verify the local flow with disposable MariaDB integration tests. No cloud deployment, client import, version bump, commit, or push.
- Details and validation limits: [local repair log](../../devkits/data-bridge/agent/COMPANY-USER-LOCAL-2026-10-24.md).

### [v 1.1.57] 2026-10-24 6:26 pm - Repair unit defaults and safe local upgrades

#### Database Changes

- Database update: Yes. Append core.common.products.units.defaults-v2 after standard Core column upgrades without changing applied checksums.
- Reserve hyphen ID 1 only on empty unit tables. Add missing pcs/nos and measurement defaults without renaming existing Nos, moving occupied IDs, or replacing existing references.
- Preserve existing non-null product and document units. Conflicting legacy placeholders require a separate reviewed correction.
- Verify the real migration ledger, repeat seeds, existing unit snapshots, and product/document references in disposable local MariaDB databases only.

#### App Codebase Changes

- Resolve product creation and null-unit backfills through active hyphen identity, removing the previous Nos preference.
- Display hyphen first without renumbering and reject protected hyphen edits, deactivation, and deletion explicitly.
- Pass 10 local database tests covering fresh initialization, upgrades, reference translation, import/repeat, bulk order, and full invoice descendants.
- Pass Core API build/typecheck/lint, Core web typecheck/lint, Data Bridge API typecheck/lint, owner boundaries, and dependency-layout checks.
- Root checks pass documentation structure, cleanup, boundaries, and add-on checks, then stop on stale generated repository Docs references. Full root validation is not green.
- Do not deploy cloud, migrate client databases, bump versions, commit, or push as part of this local repair.

### [v 1.1.57] 2026-10-24 4:21 pm - Finalize Data Bridge cloud migration verification

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bump the lockstep source baseline to 1.1.57. Include version metadata only for unrelated workspaces.
- Finalize Data Bridge proof: SUKRAA 137 invoices and 521 items with zero duplicate inserts.
- Verify ALTEX: 5,090 new business rows, 184 invoices, 690 items, zero final warnings and orphan references.
- Preserve five deleted ALTEX invoices and seven child rows. Keep both source database hashes unchanged.
- Apply only approved target corrections. Preserve other existing target business values.
- Record four passed real Redis tests, isolated namespaces, UUID checks, pending recovery, and scheduled delivery.
- Link the final owner log and existing live verification reports. This source release does not deploy new containers.
- Exclude ecommerce, Codeit, CRM, generated Docs, and unrelated implementation changes.

### [v 1.1.57] 2026-10-24 4:30 pm - CRM timestamp correction and mobile releases

#### Database Changes

- Database update: No. Existing timestamps remain unchanged.

#### App Codebase Changes

- Keep generated job and checkpoint timestamps as UTC ISO values and format them consistently in the web and mobile clients.
- Build signed TechMedia and Rainbow CRM APKs as version 1.1.57, build 157.

## v-1.1.56

### [v 1.1.56] 2026-10-24 3:38 pm - CRM work timestamp fix and TechMedia/Rainbow mobile releases

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.56.
- Preserve UTC ISO timestamps for generated job and checkpoint comments; format work timestamps consistently in web and mobile local time.
- Build signed TechMedia and Rainbow CRM Android APKs as version 1.1.56, build 156.

## v-1.1.55

### [v 1.1.55] 2026-10-24 4:05 pm - Verify Redis delivery and cloud ALTEX import

#### Database Changes

- Import 5,090 missing ALTEX business rows from altex_db to registered target altexlabs_v2_db in Common, Masters, then Billing order.
- Commit only the approved product-unit and default-company corrections through fingerprinted authenticated plans. Preserve existing target records and deleted history.
- Verify all 5,472 prepared records, 184 invoice headers, 690 invoice lines, five deleted invoices with seven lines, and 156 relationships without warnings or orphan references.
- Preserve exact full-source hashes for SUKRAA and ALTEX. Verify unchanged SUKRAA business row data after zero-insert Redis repeats.
- Retain checksum-verified private backups and remove only owned disposable rehearsal databases. No schema migration is added.

#### App Codebase Changes

- Deploy database-specific Redis namespaces, persisted delivery UUID checks, pending reconciliation, and preserved availability times.
- Pass all four actual Redis tests, including legacy-worker isolation, duplicate publication, protected identities, and delayed delivery.
- Verify live Redis jobs 2584 and 2612 without duplicate business rows or a database-backend fallback. Verify ALTEX final job 2602 in the same isolated namespace.
- Preserve the SUKRAA source connection while saving a separate ALTEX source through the authenticated Copy action.
- Record final split report-tab checks, invoice pagination, deployed revision, source hashes, and audit evidence in owner logs and handoff files.
- Leave ecommerce, Codeit, and their pending package-version work outside this release.

### [v 1.1.55] 2026-10-24 3:32 pm - Isolate Redis delivery by master database

#### Database Changes

- Add no schema migration. Preserve saved business records and both approved migration sources.
- Allow an authenticated source connection copy with server-side password reuse, a separate encrypted record, and unchanged original routing.

#### App Codebase Changes

- Fix shared Redis queue consumption across CODEXSUN and legacy CXApp master databases with a database-specific namespace.
- Require persisted job UUIDs, protect delivery identifiers from module payloads, and reject missing or mismatched worker records before dispatch.
- Reconcile pending database jobs into Redis after startup while retaining idempotent delivery IDs.
- Pass real Redis legacy-isolation and duplicate-publication tests on temporary VPS queues. Pass source-copy and migration authorization E2E tests.
- Record live deployment, fresh SUKRAA Redis verification, and ALTEX acceptance as pending until verified.

### [v 1.1.55] 2026-10-24 3:18 pm - Cloud SUKRAA business migration verified

#### Database Changes

- Complete the approved missing-only import from cloud sukraa_db to registered SUKRAA target sukraa_v2_db. Keep source data unchanged.
- Commit only the approved placeholder-product unit and default-company corrections through fingerprinted authenticated plans.
- Import 1,598 missing rows across both live runs. Final audit verifies 1,980 records, 137 invoices, 521 item rows, 10 e-invoices, and 9 e-way bills.
- Verify 156 relationships, zero orphan references, zero migration warnings, preserved original target records, and identical source dump hashes.

#### App Codebase Changes

- Verify the live 1.1.55 proxy fix, exact connection pair, master correction action, and all six report tabs.
- Complete the held import through the database queue after a Redis delivery stall. Restore BullMQ + Redis and preserve unrelated failed jobs.
- Record private recovery artifact locations and sanitized proof in devkits/data-bridge/agent/CLOUD-SUKRAA-2026-10-24.md. Remove only disposable rehearsal databases.
- Retain the Redis delivery issue as an operational follow-up. This report does not claim fresh Redis job delivery passed.

### [v 1.1.55] 2026-10-24 2:21 pm - Data Migration production API proxy repair

#### Database Changes

- Database update: No (manual).
- Add no schema, credential, or business-data change for this proxy repair.

#### App Codebase Changes

- Bumped workspace version to 1.1.55.
- Route Data Migration and Data Bridge API prefixes to Platform in CODEXSUN, Billing, and demo Nginx templates instead of returning the HTML app page.
- Preserve API paths, query strings, POST bodies, authentication cookies, and tab-slot headers without changing existing API alias rewrites.
- Validate Data Migration response content type, JSON, and envelopes. Retain request IDs and report safe routing or gateway diagnostics.
- Pass seven frontend regressions and real local Nginx coverage of all three templates. Reproduce the old HTML fallback and verify protected JSON responses from the actual local API.
- Add the scoped proxy repair release log. Leave cloud deployment and web-image rollout to the operator.

## v-1.1.54

### [v 1.1.54] 2026-10-24 11:10 am - Data Bridge cloud staging handoff

#### Database Changes

- Repair Rainbow company saves with tracked `core.organisation.company-favicon-v2`: add the missing nullable favicon_path column. Verify a fresh backup and production preflight before applying the scoped step. Migration replay skips safely.

- Database update: No (manual).
- Add no new schema or data change. Cloud deployments still require the existing Data Bridge v6 migration and target owner schemas.
- Preserve the verified local SUKRAA and ALTEX results. Do not run or imply a remote migration in this release.

#### App Codebase Changes

- Add an older-schema database regression test for the company favicon upgrade. Live Company 1 update now returns HTTP 200 while preserving its name and ID.

- Bumped workspace version to 1.1.54.
- Repair Data sync and Data Bridge production proxy paths locally so API requests cannot fall through to the HTML app page.
- Add Data Migration response validation with safe non-JSON/gateway diagnostics and preserved request IDs.
- Verify seven transport regressions and real local Nginx routing across CODEXSUN, Billing, and demo templates. Do not deploy this repair to the VPS yet.
- Add the Data Bridge cloud staging handoff with deployment ownership, backup, connectivity, queue, and invoice verification gates.
- Record cloud production import acceptance as pending until the operator deploys and configures the exact remote pair.
- Keep per-table commits, missing-only writes, target preservation, and explicit review of new remote warnings.

## v-1.1.53

### [v 1.1.53] 2026-10-24 10:37 am - Data Bridge ordered business imports verified live

#### Database Changes

- Database update: Yes (manual).
- Add Data Bridge v6 run and invoice verification tables without changing earlier migration checksums.
- Verify fresh backups and restored copies of four local databases across 545 tables.
- Run the live missing-only button for SUKRAA and ALTEX in Common → Masters → Billing order.
- SUKRAA: preserve 1,978 existing rows and the two approved differences. ALTEX: preserve 5,471 existing rows without warnings.
- Insert zero rows because both targets already contain all source business records. Independent checks found zero missing rows.
- Verify all 321 invoices, 1,211 item rows, ten e-invoices, and nine e-way bills after target ID translation.
- Retain five deleted ALTEX invoices and their children. Verify zero broken references across 354 Core/Billing relationships.
- Confirm all source data and pre-existing target business rows remain unchanged against fresh backup hashes.

#### App Codebase Changes

- Bumped workspace version to 1.1.53.
- Add one queued business import action and separate Summary, Common, Masters, Billing, Invoices, and Warnings tabs.
- Support saved renamed table/field mappings, recursive target parent resolution, checkpointed chunks, and final source-drift checks.
- Verify both actual external Chrome button runs, all report tabs, invoice pagination, deleted history, and foreign ID drill-down.
- Complete both target-scoped jobs on their first attempt. Preserve per-table transaction boundaries and exclude system/runtime data.
- Pass 14 focused Data Bridge tests, including disposable inserts, nested invoice assets, repeat imports, conflicts, and source drift.
- Update module skills, operating documentation, and sanitized live verification evidence.

## v-1.1.52

### Ordered Data Bridge business import addition

#### Database Changes

- Add v6 run and invoice verification tables. Preserve earlier migration keys and checksums.
- Store chunk checkpoints and invoice-specific child IDs for exact report drill-down.

#### App Codebase Changes

- Add one verified-pair action for Common → Masters → Billing in parent order.
- Reuse saved renamed-field mappings and resolve target foreign IDs through business identity.
- Preserve target conflicts and deleted business history. Exclude runtime jobs and system access data.
- Verify saved data, source drift, invoice descendants, and target relationships.
- Split one report into Summary, Common, Masters, Billing, Invoices, and Warnings tabs.
- Add disposable database tests for 103 invoices, nested assets, pagination, preservation, and repeat imports.
- Keep per-table commits. This addition does not claim a new live client migration or release.

### [v 1.1.52] 2026-10-24 9:32 am - Data Bridge grouped migration and verified Billing handoff

#### Database Changes

- Database update: Yes. Applied repository Billing schema to approved local SUKRAA and ALTEX targets while preserving Core and existing business rows.
- Import 1,253 missing SUKRAA Billing records and 4,812 missing ALTEX Billing records in parent order. Preserve source databases and existing targets.
- Verify 140 business tables, 354 relationships, 321 complete invoices, and 1,211 invoice items. Find zero missing source records or orphan references.
- Retain five ALTEX deleted invoices with their children. Preserve the two approved SUKRAA warnings: product deletion state and existing Billing numbering/layout settings.
- Preserve Data Bridge migration checksums and saved records. Group scopes and summaries use existing JSON without a new Data Bridge schema step.

#### App Codebase Changes

- Bump all workspace manifests, internal dependency ranges, lockfile, and desktop/deployment samples to 1.1.52.
- Consolidate Data Bridge into five sidebar pages and five persisted workflow tabs per business group. Separate Common, Master, Billing, and technical record ownership.
- Discover parent-first catalog order, exclude Billing runtime history, use destination identity defaults, and keep completed row warnings visible in Report.
- Record all 106 completed target-scoped import jobs, live browser stage checks, sanitized invoice proof, and recovery checks.
- Finish the ownership audit by moving report/correction frontend types into Report, removing unused legacy clients and polling, and standardizing internal module symbols.
- Add reusable owner and module-local SKILLS guidance, a detailed handoff, current limits, and the 1.1.52 release log. Keep private dumps and one-off client scripts outside Git.
- Retain the separately authored Codeit launcher integration and existing formatting changes under the user's commit-all request. Data Bridge live proof does not certify Codeit live behavior.
- Current imports commit per table. Invoice aggregate verification does not claim a single cross-table transaction.
- Pass 13 Data Bridge regressions, the included Codeit contract, full workspace checks, API/web builds, version alignment, module boundaries, Docs coverage, and dependency checks.

## v-1.1.51

### [v 1.1.51] 2026-10-24 - Data Bridge grouped workspaces

#### Database Changes

- Preserve existing migration checksums, saved reviews, transfer sessions, and combined reports.
- Store new server-created group scopes in existing transfer JSON. No schema migration is required.

#### App Codebase Changes

- Consolidate the sidebar into Database Connection, Common Tables, Master Tables, Billing Tables, and Report.
- Add five tabs to each table group. Keep group policies, fixed API clients, and workspaces in separate folders.
- Keep shared transfer mechanics behind public technical contracts. Retain hidden legacy routes for saved links.
- Verify all 13 focused tests and repository checks. Test renamed Billing fields and parent ID translation in disposable databases.
- Verify live SUKRAA connection, group catalogs, preparation, saved report history, and browser tab persistence without a tenant import.

### [v 1.1.51] 2026-10-24 8:09 am - Data Bridge source collections and verified SUKRAA target mapping

#### Database Changes

- Complete the explicitly approved local SUKRAA corrections: placeholder product unit ID 2 to 1, default company resolved from source ID 1 to target ID 2, and landing app application to billing.
- Verify all 47 Core tables with 726 exact business matches, zero warnings/inserts, and zero orphan references across 31 foreign-key relationships. Preserve source checksums, target identities, unrelated fields, and row counts. No new schema migration is required.

- Database update: Yes (manual).

#### App Codebase Changes

- Add readable source parent-value collections, business-key target ID resolution, and prepared destination data. Keep Core Masters and Common Tables as separate scoped pages with saved row reports.
- Add explicit correction preview and commit routes with saved before-data, confirmation, fingerprints, stale source/parent/schema/target checks, destination locks, rollback, and idempotent recovery. Normal imports continue to preserve conflicting records.
- Verify both corrections through authenticated Chrome and independent database reads. Pass 12 focused regressions, including authorization denial and failed-update rollback. Record release details and all-green proof in devkits/data-bridge/agent/RELEASE-1.1.51.md.

- Bumped workspace version to 1.1.51.

## v-1.1.50

### [v 1.1.50] 2026-10-23 9:12 pm - Preserve enquiry assignments and align Frappe identities

#### Database Changes

- On 2026-10-24, commit the two explicitly approved SUKRAA corrections: placeholder product unit ID 2 to 1, default company ID 1 to resolved target ID 2, and landing app application to billing.
- Fresh verification passes all 47 Core tables with 726 exact business matches, zero warnings/inserts, and no orphan references across 31 foreign keys. Only the two intended records changed. Source checksums, target identities, unrelated fields, and row counts remain unchanged. No schema migration is added.

- Data Bridge Core Masters imported 200 missing local SUKRAA rows. Repeat verified 724 exact business matches and preserved two target conflicts: product unit and default company/landing-app settings.
- ALTEX verified 659 existing business matches with zero warnings or inserts. Both sources remained unchanged. Both targets passed 31 foreign-key checks without orphan references.

- Database update: No (manual). No schema migration is required.
- Completed the approved TECHMEDIA data repair for nine enquiries. Reused existing Customers C2083, C3663, and C9325. Added eight Mobile Contacts and eight Customer associations.
- Matched CRM numbers 2065-2073 to Q2065-Q2073 while preserving stable record IDs, messages, dates, and assignees.

- Follow-up test cleanup: closed eight labeled test enquiries and Tasks 1-3 through approval with one test-completion comment each. Deactivated the test SOP, item, and duty assignment. Preserved business records and collection history.
- Confirmed all eight Frappe enquiries are Closed with one matching Job Comments note each and zero unsent enquiry events. Retained test SOP/report records with completion notes.

#### App Codebase Changes

- Data Bridge now collects readable source parent values and prepares resolved target IDs before import. Add a separate Super Admin correction preview/commit contract with saved before-data, explicit confirmation, stale source/parent/schema/target checks, destination locks, rollback, and idempotent recovery.
- Verify the approved corrections through authenticated external Chrome and independent saved-data reads. Record proof in devkits/data-bridge/agent/SUKRAA-CORRECTIONS-2026-10-24.md.

- Add a separate Core Masters page for contacts, companies, products, work orders, and children. Its scoped queue imports 47 Core tables in parent order while Common Tables retains its 31-table scope.
- Reuse live table previews, selected rows/columns, report drill-down, and parent resolution. Support business-row duplicate checks without natural unique indexes and shared destination-table locks.
- Keep conflicting records visible as warnings instead of counting them as existing exact matches. See devkits/data-bridge/agent/CORE-MASTERS-VERIFICATION.md for proof.

- Bumped workspace version to 1.1.50.

- Export enquiry assignees through verified site-scoped Employee mappings. Reject missing and ambiguous mappings instead of clearing assignments.
- Resolve the installed Frappe Enquiry Status before export. Preserve CRM-only lists when remote groups are empty.
- Reconcile linked enquiry numbers transactionally with collision checks and activity history. Support exact Q and ENQ identities.
- Authorize failed enquiry retries with the CRM update permission and verified bidirectional settings.
- Live repair verification passed twelve Redis export replays and two imports with zero creations or failures. The enquiry outbox had zero unsent events.
- Web showed green sync indicators for all nine records. TechMedia mobile verified Vijay's assigned enquiry 2071. Frappe Desk verified Q2066 and its Customer link.
- Build TechMedia Android 1.1.50, build 150, with the existing release signing identity and live cloud API.
- Correct the Duty concurrency test to accept an already-synced worker response while asserting exactly one remote report request.
- Verification passed the full workspace check, 200 CRM/Frappe unit tests, three integration tests, the inbound checkpoint/retry integration test, and CRM/Frappe/Platform API builds.
- Flutter analysis and all 77 mobile tests passed. APK Signature Scheme v2 verification passed for package `in.codexsun.techmedia_crm`, version 1.1.50, build 150.
- TechMedia APK SHA-256: `926ce43fc83122f1183c83c46e49506139a93c883ad0613fd37efa12c2d099df`.
- Deployed API, Web, and Shop 1.1.50 from commit `33905fa1773ca3d029d916bd29344f5795cccd42`. All three containers passed health checks. Public API, Application Overview, and Shop returned HTTP 200. Authenticated web displayed version 1.1.50.
- Verified the full database backup checksum before rollout. No migration ran. Shared infrastructure and CXApp container identities remained unchanged.
- Post-deployment Redis replay jobs 1329-1340 completed without new remote enquiries. Imports 1341 and 1342 each scanned nine, created zero, skipped nine, and failed zero. All nine linked records remained synced with zero unsent enquiry events.
- Signed TechMedia 1.1.50 APK is built and verified. This release does not claim emulator installation or new mobile UI acceptance.
- Follow-up emulator verification: installed signed TechMedia 1.1.50, build 150, over 1.1.48 without clearing app data. Confirmed installed package metadata and the preserved Vijay session.
- Verified all eight closed test enquiries are absent across 668 active cloud records. The installed app showed zero active tasks and duties, while Show all retained the three Closed tasks.
- Recorded test identities, retirement limits, evidence locations, and scope protection in `apps/crm/agent/RELEASE-1.1.50-VERIFICATION.md`. No new version, schema migration, runtime code, or deployment is required by this documentation update.

## v-1.1.49

### [v 1.1.49] 2026-10-23 7:19 pm - Data Bridge all-table imports and verified live Altex transfer

#### Database Changes

- Database update: Yes (manual).

- Data Bridge uses the additive v5 master transfer table for saved stages, selected data, and row outcomes. No new tenant schema migration is required by this version bump.
- Completed the authorized local `altex_cloud_db` to `altex_db` import in parent order: 47 Core tables, 659 inserted records, zero existing records, zero warnings, and zero failed tables.
- Verified saved business values and row counts for every table. All 31 foreign-key relationships have zero orphan references. Source checksums remain unchanged.

#### App Codebase Changes

- Bumped workspace version to 1.1.49.
- Guided Data Bridge imports discover all destination tables and support different table and field names. The Common Tables shortcut retains its 31-table list.
- Resolve declared parents by business identity, preserve existing records, handle generated columns, and serialize destination imports to prevent duplicate races.
- Verified 39 completed live Queue Manager jobs and authenticated Chrome import results. Eight source tables were empty.
- Retain the per-table report, parent order, source hashes, queue results, and browser proof in `devkits/data-bridge/agent/verification/`. See `devkits/data-bridge/agent/RELEASE-1.1.49.md`.
- Earlier verification passed 12 focused tests, Platform API/web builds, and the full workspace check. Disposable repeat import found 659 existing records without duplicate inserts.

## v-1.1.48

### [v 1.1.48] 2026-10-23 7:16 pm - Align mobile tasks with enquiries

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.48.
- Match mobile task cards and task details to the enquiry status colors, blue New background, and purple action button.
- Match New task to New enquiry: mobile number, optional customer, List, Allocated, and one message field.
- Hide priority, status, and due date on task creation. Use saved defaults and retain the full message in task details.
- Add a form regression test for message storage, optional contact, and hidden defaults.
- Release TechMedia Android 1.1.48, build 148, with the existing package ID, signing identity, and live cloud API.
- No VPS deployment is required. These changes affect the mobile client only.
- Verification passed: Flutter analysis, 77 mobile tests, version consistency, dependency layout, and CRM module boundaries.
- Verify the signed TechMedia APK metadata as `in.codexsun.techmedia_crm`, version `1.1.48`, build `148`. Install it on the emulator without clearing app data.
- APK SHA-256: `898beb41483c17cb343fa7c20a5471bb57e13a60e207fe526a4e6652e71707c7`.

## v-1.1.47

### [v 1.1.47] 2026-10-23 5:55 pm - Bidirectional CRM Frappe sync and mobile release

#### Database Changes

- Provision local ALTEX with the current 47-table Core schema and an encrypted Altex source registration. Keep real target business data empty pending import confirmation.
- Verify all 659 Altex Core records in parent order in a disposable destination: 659 inserted, zero warnings; repeat finds 659 existing with no duplicate inserts. Source checksums remain unchanged.

- Data Bridge adds the tracked v5 `data_bridge_transfers` master table for saved stage state, field rules, prepared row data, and import outcomes. No tenant schema changes are required.

- Database update: Yes. This release includes the existing inbound checkpoint/source-history and delivery-revision migrations introduced after the deployed 1.1.44 baseline.
- CRM queue revision fencing preserves edits received during an export. The contact activation timestamp limits automatic recovery to recent changes.
- Local migration verification preserved all 56 enquiries. Production changes require a checksum-verified backup and migration preflight.

#### App Codebase Changes

- Discover all destination tables in guided Data Bridge transfers. Support renamed tables and fields, declared parent resolution, business-record duplicate fallback, generated columns, and serialized destination imports.
- Verify the Altex renamed-field preview live before commit. Pass 12 focused tests, Platform builds, and the full workspace check.

- Data Bridge now has six individual pages and sidebar links: Database Connections, Table Mapping, Field Mapping, Import Preparation, Confirm Import, and Import Results.
- Guided transfers support differently named source tables and fields, validated Core destinations, optional metadata, destination defaults, custom values, generated UUID/time values, and explicit destination parent selection. Earlier edits clear later prepared data.
- Add versioned saved progress, schema/required-field checks, selected-row audit, explicit confirmation, tenant-bound Queue Manager import, transactional rollback, duplicate/conflict preservation, and persisted source/target row results.
- Verification: nine focused Data Bridge tests, full root check, Data Bridge and Platform API/web typechecks/builds, lint, boundaries, and docs checks passed. Disposable tests cover renamed mappings, existing/missing/conflicting rows, invalid stages, stale edits, target parents, rollback, and idempotency. External Chrome completed all six stages for SUKRAA with two existing records, zero inserts, zero warnings, and a persisted completed queue job; real client data was not imported.

- Updated lockstep packages to 1.1.47 and CRM Android to 1.1.47+147.
- Added a one-minute inbound interval, immediate outbound queue dispatch, and ordered enquiry/opening-comment delivery.
- Bidirectional enquiry reads retain CRM source identity, creator, email, and date precision; unsent local changes block reverse updates.
- Contact-mobile export requires an exact existing Customer/Supplier identity. Retries recover a lost create response without duplicate Mobile Contacts.
- Live ERP1 history exposed legacy comment retry-key collisions. Scope imported keys by enquiry, preserve existing rows and legacy duplicates, and resolve reply parents through the scoped identity. Database regression tests cover author changes and repeated imports.
- Web contacts, enquiries, duties, and reports show persisted export errors during retries. Tasks stay local with a Not configured badge.
- Added missing Data Bridge and Marketing API build/resolver entries required by the already committed Platform baseline.
- Final focused verification: 194 CRM/Frappe checks, the updated inbound database regression suite, affected types/lint/builds, owner boundaries, and 76 Flutter tests passed. Full root check passed before the live correction; a later working-tree rerun was blocked by an unrelated uncommitted Contact Restrictions documentation gap.
- Deployed API, Web, and Shop 1.1.47 from source `6fe54220` with healthy containers and public HTTP 200 checks. A SHA-256-verified full MariaDB backup and production preflight preceded the additive owner migrations. Existing tenant enquiry counts were preserved during migration. Shared infrastructure was not recreated.
- Verified real BullMQ/Redis delivery against the existing TECHMEDIA ERP1 connection as Sundar: CRM 2616 exported to Q2057; Q2058 imported to CRM 2644 with Job Comments. A simulated lost response, retry, and replay left one remote comment. Repeated ENQ1994/ENQ1995 pulls preserved legacy rows and added no duplicate comments.
- Built and verified signed TechMedia and Rainbow APKs at 1.1.47+147 using their existing app IDs, production API URL, and signing certificate. See `apps/frappe/agent/RELEASE-1.1.47.md` for job IDs, hashes, exact evidence, and scope.

- Corrected full historical Redis job 1070 completed with 2,049 scanned and zero failures. Incremental job 1071 completed with 27 scanned and zero failures; the successful checkpoint advanced to 2026-10-23T13:12:28Z.

## v-1.1.46

### [v 1.1.46] 2026-10-23 4:32 pm - Data Bridge common-table import and row verification reports

#### Database Changes

- Database update: Yes (manual).
- Data Bridge owns persisted selected-row snapshots, per-row audits, and the additive v4 combined-import run table in the Platform master database.
- New combined runs store source and matched target business values in report JSON. Existing reports remain readable; no extra schema change is needed for row details.
- Bulk imports preserve existing records, translate foreign references by business keys, and process parents before children.

#### App Codebase Changes

- Bumped workspace version to 1.1.46.
- Add Common Tables and Table Import Review for 31 Core tables with selected source rows and columns, saved-data review, comparison controls, audit, and import results.
- Add Audit & import all missing rows through the tenant-scoped Queue Manager worker, with one persisted combined report and attention-only filtering.
- Add View row results for each table with Imported, Existing, and Warning filters, pagination, source data, matched target data, and record-specific messages. Highlight only warnings.
- Record unavailable historical row details explicitly and flag incomplete worker-recovery snapshots for verification.
- Verification: Data Bridge API/web typechecks, lint, builds, owner boundaries, component documentation checks, dependency layout, and disposable bulk database tests passed. Tests cover changed parent IDs, missing rows, existing rows, conflicts, persisted values, and duplicate-free repeats.
- Live verification: Common Tables shows the drill-down buttons in authenticated Chrome. The earlier combined run checked 31 tables and 520 existing records with zero warnings; row snapshots require a new run.
- Version update verification: `check:versions`, component documentation checks, two documentation tests, and four cleanup tests passed. Full `npm run check` stopped at missing required role files in the concurrently developed Frappe `contact-export` module; subsequent gates did not run.
- Full Platform production builds were blocked by unrelated concurrent CRM type errors. No commit, tag, push, or deployment is part of this version update.

## v-1.1.45

### [v 1.1.45] 2026-10-23 4:23 pm - Marketing Phase 0 ownership and integration plan

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.45.
- Add the Marketing application plan, phased delivery tasks, tenant isolation requirements, and CRM-style list, Show, and upsert contracts.
- Reconcile Marketing Campaign/promotional consent ownership with CRM sales/service contact policy, Core identity, and Mail delivery-safety suppression.
- Record 14 integration gaps, fixed contract proposals, owner backlogs, provider readiness gates, and two-tenant acceptance scenarios.
- Preserve existing Sites SQLite/D1 enquiries, Chat Telegram account-session transport, Ecommerce promotions, domain-app records, and approved Frappe transfer scope.
- Planning verification: component documentation checks and two tests, formatting across 30 documents, local file links, and diff whitespace checks passed. No runtime capability or live provider validation is claimed.

## v-1.1.44

### [v 1.1.44] 2026-10-22 11:00 pm - CRM sync verification and mobile release

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.44.
- Set the CRM Flutter package to version 1.1.44 with Android build number 144.
- Build signed TechMedia and Rainbow APKs for the production CODEXSUN API with their existing app IDs and Corporate IDs. Both APKs use Android version code 144 and version name 1.1.44. Signature verification passed.
- Deploy API, Web, and Shop images from source commit `0f71e79455c981619660a15467fada7401f59e7b` to Hostinger. All three containers are healthy; local health/ready and public API/Web/Shop routes returned HTTP 200. No migrations or seeds ran. Shared services were not recreated. Browser UX was not tested.

## v-1.1.43

### [v 1.1.43] 2026-10-22 10:44 pm - CRM Frappe sync status and verification

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.43.
- Added Frappe status indicators and Verify actions to Enquiries, Contacts, and Call Logs.
- Added persisted, tenant-scoped lookup of the latest remote verification result for Contacts and Call Logs.
- Showed saved Frappe queue status on SOPs, Duties, and Duty Reports. Verify reloads the queue state from the CRM API.
- Marked CRM Tasks as not linked because no approved Frappe task mapping exists.
- Kept Contact, Call Log, Activity, and Task exports blocked. Call Log verification now uses the CRM call-log read permission.
- Added database E2E checks for pending sync status after SOP publication, duty assignment, and report creation.
- Updated CRM, Frappe, and Platform task records with supported scopes and verification results.

#### Verification Notes

- The CRM/Frappe suite passed 169 unit tests and three database E2E tests. CRM API/Web, Frappe API, and Platform API typechecks and builds passed. CRM API/Web and Frappe API and Platform API lint, module boundaries, and component-doc checks passed.
- The live VPS queue probe completed through BullMQ and Redis in about one second. It did not create or verify a Frappe document.
- CRM Tasks show a disabled Verify action because Frappe does not have an approved Task mapping.
- Deployed source commit `4007dfd66f089157a3c92f6b5cee93b185ad2398` as API, Web, and Shop images tagged 1.1.43. All three containers are healthy.
- Public API health, Application Overview, and Shop routes returned HTTP 200. These route checks do not verify authenticated browser UX.
- No database migration or seed ran. Shared MariaDB, Redis, media, Cloudflared, and CXApp services remained healthy.

## v-1.1.42

### [v 1.1.42] 2026-10-22 10:16 pm - Data Migration query plan safeguards and cross-app updates

#### Database Changes

- Database update: Yes (manual).
- Added the master-schema `data_migration_job_query_plans` table for one persisted generated/finalized plan per migration job, with an actor, status, and timestamps. Existing tables and tenant schemas are unchanged.

#### App Codebase Changes

- Bumped workspace version to 1.1.42.
- Added independently paginated source and destination samples, a shared Columns menu, loaded-row comparison, and sample-only row selection to Migration Mapper.
- Added source-field exclusions and included the selected fields, exclusions, schema fingerprints, and keyed source-data fingerprints in the review plan. Migration execution now requires explicit finalization and rejects stale plans or mapping changes; SQL templates remain informational while inserts are built and parameterized by the server.
- Added read-only sample-data and query-plan API routes with Super Admin authorization and database-backed MariaDB E2E coverage for review, finalization, stale-source rejection, exclusions, rollback, and access denial.
- Grouped Database Settings, Migration Mapper, and Migration Analysis under the Super Admin Data sync menu and opened Migration Mapper from the Super Admin Apps shortcut.
- Exported the shared `WorkspaceColumnMenu` for read-only previews and included Data Migration web sources in UI utility scanning.
- Updated Platform CRM reminder notifications to use the first line of schedule notes and the scheduled time while retaining the linked enquiry or task.
- Updated Data Migration, Platform, and UI documentation and generated Docs references for the changed contracts and navigation.

#### Production Deployment

- Deployed version 1.1.42 to the production Hostinger VPS from source commit `181dad4cc82a7166fbc565cec74ec59e0d3c67dc`.
- Created and checksum-verified the pre-migration MariaDB backup at `/home/codexsun/.container/backups/codexsun-all-databases-20261022T165207Z.sql` (SHA-256 `0dd3ef28bf6307ea21271a04d3e6c5574a09ec136c6e340af6143414c34059a1`).
- Production migration preflight passed for five tenant databases. Migrations and seeds completed; the Data Migration query-plan v6 migration and CRM schedule notes column were verified in the master database and all five tenant databases respectively.
- CODEXSUN API, Web, and Shop containers run image tag 1.1.42 and report healthy. Public API health returned `ok`; the Application Overview route and Shop returned HTTP 200. The Application Overview check verified the route only, without an authenticated browser session.
- The shared MariaDB, Redis, media, and Cloudflared containers were left in place; MariaDB, Redis, and media remained healthy and Cloudflared remained running.

#### Verification Notes

- The required `npm run check` passed. The optional `npm run test:migration-contract` still fails its workspace-wide legacy schema assertions across multiple applications; it also applies tenant owner-prefix assertions to the master-schema Data Migration tables. Production migration preflight, migrations, tenant-schema checks, and service health checks passed. The broader legacy migration-contract cleanup remains open.

## v-1.1.41

### [v 1.1.41] 2026-10-22 10:04 pm - CRM web review and charge retry safety

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.41.
- Format CRM web source with the repository Prettier rules.
- Keep the same work-report request ID when the web Charges form retries unchanged charge or collection details. Prevent action changes during a pending save.
- Verify CRM web typecheck, lint, build, module boundaries, web unit tests, and the disposable work-report database test.

## v-1.1.40

### [v 1.1.40] 2026-10-22 9:51 pm - TechMedia and Rainbow mobile APKs

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.40.
- Hide the Corporate ID field in client-branded builds and submit the configured tenant ID at sign-in.
- Add a login widget test for embedded tenant IDs and email/password-only sign-in.
- Build separate TechMedia and Rainbow debug APKs with tenant IDs `techmedia` and `RAINBOW`, connected to the CODEXSUN API.
- Create a Windows-user-protected Android release keystore outside the repository and sign both client APKs with it.
- Verify both v1.1.40 release APK signatures and Android package metadata.

## v-1.1.39

### [v 1.1.39] 2026-10-22 7:26 pm - CRM mobile task cards and work actions

#### Database Changes

- Database update: Yes (additive scheduler notes migration).

#### App Codebase Changes

- Replace the mobile task list with enquiry-style cards and add task detail and action screens.
- Hide system-generated conversations in chat, duty, and task views; refine call-note comments and work action sheets.
- Show completion-pending state on mobile enquiry cards and format completed job/check-in cycle timestamps consistently.
- Bump the Flutter mobile package to 1.1.39 (Android build 139) for the cloud-connected emulator build.
- Verify `https://codexsun.com/api/app/health` and install and launch the 1.1.39 release APK on Android emulator `emulator-5554`.
- Include active task job start timestamps in task list records and show live timers on task cards and detail headers; add a divider beneath the task title.
- Add Schedule forms and searchable Change Stage actions for mobile enquiries and tasks.
- Split CRM mobile API models from transport code and normalize connection and malformed-response failures into typed mobile API errors.
- Keep enquiry and task detail records usable when secondary detail requests fail, while retaining successfully loaded sections and showing a retry hint.
- Add an idle timeout and partial-file cleanup to mobile APK downloads; require a configured keystore for Android release signing.
- Align generated-workspace cleanup with the artifact verifier, including Flutter and Gradle build directories.
- Verify the mobile code with clean analysis, 75 passing Flutter tests, and a successful Android debug APK build. No cloud deployment was performed for this update.

## v-1.1.38

### [v 1.1.38] 2026-10-22 2:24 pm - CRM mobile work actions and cycle timestamps

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Add mobile job timer actions to enquiry cards and the dashboard; completed enquiry and task timers post one comment with start time, completion time, and duration.
- Format completed job and check-in/check-out cycle timestamps as `DD-MM-YY hh:mm:ss AM/PM`.
- Add mobile check-in/check-out comments after a full cycle, including both submitted notes and captured GPS details.
- Refine mobile enquiry cards, dashboard navigation, and show-page comment/action views.

## v-1.1.37

### [v 1.1.37] 2026-10-22 7:39 am - TECHMEDIA Frappe sync verification

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Verify the TECHMEDIA enquiry as `admin@tenant.com`. The list shows no Frappe sync indicator, and the detail page shows no Frappe sync tab.
- Confirm the sync queue contains enquiry #2032 in Retry after four attempts. Frappe returned HTTP 417, and the queue reports that sending is stopped. The live post did not succeed.
- Record live verification only. No tenant records, sync settings, or application code changed in this version.
- Bumped workspace version to 1.1.37.

## v-1.1.36

### [v 1.1.36] 2026-10-21 9:27 pm - Immediate CRM enquiry sync to Frappe

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Write enquiry create and edit events to the durable outbox with the local transaction, then dispatch committed events to the verified tenant Frappe queue. Keep relay recovery and ordered retry handling.
- Add an admin-only enquiry list sync indicator and a detail tab with sync history, state, and error information. Require both `crm.enquiry.frappe-sync.view` and the exact `admin@tenant.com` actor.
- Verify 162 CRM/Frappe unit tests, three isolated CRM database E2E suites, the dedicated queue E2E, and the full repository `npm run check` gate. No live tenant records were changed. Browser verification was not run.
- Bumped workspace version to 1.1.36.

## v-1.1.35

### [v 1.1.35] 2026-10-21 8:34 pm - Normalize Frappe titles and tenant branding

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Normalize Quill markup and entities in CRM enquiry titles before Frappe export and duplicate matching. Keep rich enquiry details and embedded image content intact.
- Normalize Quill/HTML titles from Frappe before import previews and before saving or updating the local CRM enquiry. Preserve the original rich details and embedded image references.
- Show tenant Company branding on verified custom-domain login pages and support validated SVG, PNG, JPEG, WebP, AVIF, GIF, ICO, and BMP branding files.
- Resolve public tenant pages from the request host, ignore forwarded-host tenant overrides, and isolate host parsing to prevent an authentication import cycle.
- Add inbound/outbound title-normalization, public-host, and branding regression tests. Pass 162 CRM/Frappe unit tests, three isolated CRM integration E2E tests, and all 47 Platform API tests.
- Bump workspace version to 1.1.35.

## v-1.1.34

### [v 1.1.34] 2026-10-21 11:59 am - Tenant access and operational workflows

#### Database Changes

- Database update: Yes (manual).
- Add an optional tenant-unique username to `app_users` with an idempotent tenant runtime migration.
- Add persisted mapping plans and named migration job, table, and field records in the Data Migration master database.
- Add student photo storage in the Sportsclub tenant database with a member-keyed photo table.

#### App Codebase Changes

- Allow tenant users to sign in by email or username. Resolve tenants from verified custom domains, and require Corporate ID on shared hosts, including `codexsun.com`.
- Scope CRM task, enquiry, duty-report, and closure-review actions to the actor's permitted records. Keep assignee changes within admin rights.
- Add persistent named migration sessions, explicit source-to-target table and field mapping, preflight checks, and transactional batch execution.
- Add per-table compatibility analysis and selectable field mapping controls, and surface API request IDs in migration errors.
- Add private Sportsclub student photo upload and access checks for students, assigned masters, and administrators.
- Apply consistent content padding to shared tabs and affected Site Studio, Mail, and Ecommerce forms.
- Include Platform, CRM, Core, Sportsclub, Data Migration, shared UI, and generated Docs updates.

## v-1.1.33

### [v 1.1.33] 2026-10-20 7:15 pm - Show source creator in imported enquiry history

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.33.

## v-1.1.32

### [v 1.1.32] 2026-10-20 7:07 pm - Correct Frappe enquiry actor and assignee mapping

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Resolve imported enquiry creators through the unique Employee-to-local-user mapping, using the Frappe owner as a fallback.
- Treat Frappe's assigned Employee as authoritative, clear stale local assignments when the source is unassigned, and flag duplicate Employee mappings in the identity audit.
- Show saved enquiry assignees by their tenant user name on the detail page.
- Verified the CRM/Frappe regression suite (149 unit tests and three isolated database E2E tests), affected package typechecks, and module boundaries. Production rollout verification is pending.

## v-1.1.31

### [v 1.1.31] 2026-10-20 6:46 pm - Frappe identity audit and CRM actor attribution

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.31.
- Added the tenant Frappe Identity audit page. Opening the page runs deterministic read-only checks against mapped Frappe Users and Employees and reports mismatched, duplicate, stale-site, inactive, and unmapped identities.
- Mapped Frappe activity and call-log owners back to local CRM users during import, retaining the original Frappe owner when no local mapping exists.
- Corrected CRM enquiry and task comment bylines to use mapped display names. Corrected initial imported enquiry activity attribution while keeping later sync updates identified as system events.
- Verified 148 CRM/Frappe unit tests, three isolated database E2E tests, affected package typechecks and lint, CRM/Frappe boundaries, component docs, and production builds. No database migration or cloud deployment was performed.

## v-1.1.30

### [v 1.1.30] 2026-10-20 9:01 am - Fix CRM scheduler imports

#### Database Changes

- Database update: Yes (manual, CODEXSUN-only rollout of the existing v1.1.29 CRM scheduler migration).
- Verified the CODEXSUN tenant backup by restoring it to a temporary database and comparing all 273 tables before migration; backup checksum passed after rollout.
- Applied the scheduler schema migration and permission seed to CODEXSUN only. TECHMEDIA and RAINBOW tenant databases were not modified.

#### App Codebase Changes

- Bumped workspace version to 1.1.30.
- Added explicit Platform Vite aliases for the CRM scheduler module and service entry points, fixing unresolved imports in `npm run dev:web` and the production web bundle.
- Deployed API, web, and shop images from commit `3d24d3ea` (`1.1.30`) to CODEXSUN; all three containers report healthy.
- Verified live API health, Application Overview, and Shop routes return HTTP 200. Shared MariaDB, Redis, media, and Cloudflared services remained healthy and untouched.

## v-1.1.29

### [v 1.1.29] 2026-10-20 8:42 am - Add CRM schedules and responsive details

#### Database Changes

- Database update: Yes (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.29.
- Added CRM schedules with reminder acknowledgement, linked record actions, and contextual Enquiry, Task, Duty, and SOP entry points.
- Routed due CRM reminders through the Platform notification menu while keeping schedule data and permissions in CRM.
- Added Enquiry and Task date-range filters with manual `DD-MM-YYYY` input and server-side date filtering.
- Made Enquiry and Task detail tabs fit narrow screens with icon-only controls and accessible labels.
- Aligned optional charge details with the amount field and documented the CRM and Platform contracts.
- Published the Tenkasi static frontend accessibility update from commit `b399848e` to Cloudflare Worker version `82c918ff-4eb5-4ff2-88f4-4eca4302af95`.
- Verified live Tamil and English Home and Join routes, sitemap, robots file, and the updated CSS asset. Mobile Lighthouse scored 100 for accessibility and SEO on Home and Join.

## v-1.1.28

### [v 1.1.28] 2026-10-20 8:41 am - Improve Tenkasi frontend accessibility

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.28.
- Kept the Tenkasi site release focused on static frontend content. No Sportsclub API or database behavior changed.
- Gave the animated home page statistics stable screen reader text without invalid ARIA attributes.
- Darkened gold text, badges, and buttons to improve contrast on light surfaces.
- Passed Tenkasi client typecheck, lint, and production build. Mobile Lighthouse accessibility scored 100 on Home and Join in the local preview.

## v-1.1.27

### [v 1.1.27] 2026-10-20 6:49 am - Make CRM overview cards clickable

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.27.
- Made CRM overview summary cards keyboard-accessible links to their matching lists and available filters, with reduced-motion-aware hover feedback.
- Deployed API, web, and shop as 1.1.27 from commit `e7798e39`; all containers passed health checks and the API, CRM overview, and shop routes returned HTTP 200. No migrations or seeders were required.

## v-1.1.26

### [v 1.1.26] 2026-10-20 6:42 am - Improve Tenkasi search visibility

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.26.
- Prerendered full Tamil and English HTML for all 19 Tenkasi Sports routes so headings, page copy, and internal links are present before JavaScript runs.
- Added distinct `/en` URLs, localized navigation, legacy `?lang=` redirects, canonical and alternate language metadata, and 38 localized sitemap entries.
- Added English page titles and descriptions, short HSTS and a restrictive HTML Content Security Policy to the Tenkasi Worker.
- Verified the static build in a browser, language switching, client type checking and linting, and Worker route and security header tests.
- Allowed the Cloudflare analytics beacon through the site CSP and declared the existing SVG favicon after live browser verification.

## v-1.1.25

### [v 1.1.25] 2026-10-20 12:00 am - CRM mobile and platform module release

#### Database Changes

- Database update: Yes (manual).
- Added an additive `amount` column migration for CRM work reports so charge and collection values persist as structured amounts.
- Added tenant-scoped Sportsclub migrations and repeatable seed registration, plus Platform storage for Data Migration source connections and run history.
- Granted the tenant `user` role read access to Core application records for the Application Overview and CRM workspaces.
- Applied the forward migrations and repeatable seeders across all five active tenants without a database backup, as requested.

#### App Codebase Changes

- Refined CRM mobile navigation, role-scoped workspaces, activity date limits, enquiry/task forms, comments, job timers, check-in/out, charge flows, and call-log layouts; removed rich-text markup from mobile cards and activity details.
- Improved responsive CRM enquiry/task lists and show pages, work-report charge fields, activity visibility, task date handling, and API read paths.
- Registered the Sportsclub app in Platform and added the Super Admin Data Migration DevKit integration.
- Added production package resolution for the Data Migration runtime and Sportsclub migration/seed exports in the composed API image.
- Updated shared tab and table styling and added developer references for Sportsclub and Data Migration modules.
- Updated the CODEXSUN mobile build version to 1.1.25 (build 125).
- Deployed API, web, and shop images on Hostinger from code commit `7f534691`; all containers are healthy and the public API, Application Overview route, and shop host returned HTTP 200.
- Verified the User read grant and CRM work-report amount column in all five active tenant databases: CODEXSUN, RAINBOW, TECHMEDIA, TENKASISPORTS, and TIRUPURCONNECT.

### [v 1.1.25] 2026-10-19 11:41 pm - Release Tenkasi mobile layout

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.25.
- Released the Tenkasi mobile layout from commit `edefce4e`: one-row phone and icon controls below 480px, narrower card spacing, wrapped headings, and language persistence across pages.
- Rebuilt the Tenkasi client, passed its typecheck, lint, and 10 Worker tests, and deployed Worker version `dca90858-da7e-406d-9ae4-e4d3d5154837` to `tenkasisports.com`.
- Verified live Home, About, Classes, Students, Alumni, and sports club health responses. Cloudflare reused the unchanged static assets.
- Added a canonical 19-route XML sitemap, crawler rules, one canonical link per page, social preview metadata, and home page organization data. The requested `/site.xml` address redirects to `/sitemap.xml`; unknown pages are marked noindex.
- Updated the desktop Tenkasi top bar to show `Call us` with the phone number while keeping only the number on narrow mobile screens. Deployed Worker version `dd4b96f6-d22d-49c7-9619-0a5b0c2dca0d` and verified the sitemap, robots file, alias redirect, page canonical, and home page organization data on the live domain.

## v-1.1.24

### [v 1.1.24] 2026-10-19 11:10 pm - Publish Tenkasi student and alumni showcase

#### Database Changes

- Database update: No (manual).
- The public showcase table and six fictional profiles were added in the preceding site commit. No new database change is needed for this version update.

#### App Codebase Changes

- Bumped workspace version to 1.1.24.
- Release the Students and Alumni photo grids with three illustrative child learners and three illustrative adult alumni. Both languages identify every profile as a sample.
- Serve the profiles from the public Tenkasi Worker D1 showcase API without exposing private member records.
- Deploy Worker version `f56a1289-844e-4c9c-acb8-112545a084f0`. Verify both language modes on Students and Alumni, the six public sample records, and the WebP image on the live domain.
- Replace the old Jawaharlal Siruvar Mandram instructor label on Masters with Sivakalai Gurukulam in Tamil and English. Emphasize the association name and deploy Worker version `4bc19ec2-ceb4-49a9-a68d-970a76c8dd1e`.
- Center the shared page-loading overlay in the viewport and enlarge the revolving staff area to 300px. Keep inline form loaders small and respect reduced-motion settings. Deploy Worker version `13868a18-b67c-4381-818e-6f137a1a6bcb`.
- Refine Tenkasi mobile spacing and wrapping across public pages. Keep the phone number, icon-only language switch, and icon-only member portal on one row below 480px, and retain the selected language during page navigation. Verify both languages at 320px, 390px, and 430px, then deploy Worker version `2daabd91-9ffd-42ad-804e-54b1f6058468`.

## v-1.1.23

### [v 1.1.23] 2026-10-19 9:46 pm - Improve Tenkasi Sports mobile performance

#### Database Changes

- Database update: No (manual).
- Add an isolated public Tenkasi community showcase table in Worker D1 with six fictional sample profiles; keep member records private.

#### App Codebase Changes

- Bumped workspace version to 1.1.23.
- Add responsive Students and Alumni photo grids backed by the public showcase API, with illustrative child learners and adult alumni clearly labeled as samples in Tamil and English.
- Add five Tenkasi training articles with a blog index and article routes. Add a linked home gallery and syllabus training cards.
- Add mobile hero swipes and a scrollable gallery. Improve small-screen menus, layouts, and touch targets across public pages.
- Serve smaller WebP images, split inner-page JavaScript, preload route assets, and cache versioned Worker assets.
- Verify the Tenkasi build, mobile layouts, page navigation, and Worker cache behavior.
- Deploy Cloudflare Worker version `fbb52e2f-cfd7-48ff-92a3-6306dc8183e3`. Confirm 16 public routes, canonical URLs, the live article, asset cache headers, and the TENKASISPORTS health response.
- Update Tenkasi Sports facts to 12,000 students, training since 2000, 64+ syllabus topics, and 132 techniques across the site and page metadata.
- Replace training-level card figures with rotating Silambam staff watermarks. Stop the rotation when reduced motion is selected.
- Show the Shengottai headquarters and Tirupur office addresses in the shared footer and Contact page in both language modes.
- Deploy Cloudflare Worker version `6c93dfac-7f6e-4811-978f-c39f4cbadfc9`. Verify the live Contact page, both addresses, mobile width, new staff asset, tenant health, and `www` redirect.
- Show 132+ for Unique techniques in the Tenkasi home stats and accessible label.
- Set the three Silambam staff watermarks at different fixed angles and positions; remove their rotation animation.
- Remove the two center marks from the shared Silambam staff watermark and give the cleaned asset a new URL.
- Keep the chief master's initial and surname together when headings and copy wrap across Tenkasi pages in English and Tamil.
- Set the Tenkasi student application to one full-width field per row, with bilingual section headings and clearer field spacing.
- Add a shared Tenkasi staff loader with gold end rings to page loading and form submission states. Keep it still when reduced motion is selected.
- Show the complete original-logo handbook cover on the Tenkasi About page and use the tiger-stripes master stance on the Masters page.
- Revolve the Tenkasi staff loader and use clear English-only loading messages on pages and form submissions, including Tamil pages.

## v-1.1.22

### [v 1.1.22] 2026-10-19 8:54 pm - Publish Tenkasi District Sports Club site

#### Database Changes

- Database update: Yes (manual). Add the Tenkasi Sites D1 publication tables; they already exist in the live D1 database.

#### App Codebase Changes

- Bumped workspace version to 1.1.22.
- Add the Tenkasi District Sports Club public client, its Cloudflare Worker, published-content reader, and separate Home, About, Syllabus, Classes, Masters, Gallery, Contact, Students, and Alumni routes.
- Use the supplied club logo and phone number. Add a bilingual rotating hero, scroll-triggered club facts, and syllabus links on the home cards.
- Register the named client with Sites Studio and add its public page paths. Keep the member portal and language controls in the sticky header.
- Deploy Worker version `50735ab2-d02c-448b-a244-7e1991916307` and its 44 static assets to `tenkasisports.com`. Verify the live club title, Home, Syllabus, Students, Alumni, asset delivery, and backend health.
- Keep the Sites Studio D1 publication at version 1. Serve code-owned club metadata so its older publication title does not override the new public brand.

## v-1.1.21

### [v 1.1.21] 2026-10-18 8:58 pm - Enforce Frappe outbound export scope

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Release the Frappe export policy from 1.1.20: only Enquiries may be exported, while verification remains available for every export kind.
- Grant the tenant User role Core read access required by Application Overview and CRM Core-backed reads; keep all Core write and lifecycle permissions restricted.
- No schema migration is required. The Core tenant permission seeder reconciles the new read grant on Core database bootstrap.

## v-1.1.20

### [v 1.1.20] 2026-10-18 - Enforce Frappe outbound scope

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Restrict Frappe outbound export to enquiries at the shared service boundary, covering manual and queued requests.
- Keep verification for all export kinds and leave Frappe imports, CRM data, and database schema unchanged.
- Verify with the focused policy regression plus Frappe API typecheck, lint, build, and component-doc checks.

## v-1.1.19

### [v 1.1.19] 2026-10-18 8:38 pm - Restrict automatic Frappe exports to enquiries

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.19.
- Restrict scheduled Frappe exports to Enquiries; Contacts, Activities, and Call Logs are excluded until their outbound scope is approved.
- Add regression coverage for the automatic-export allowlist and document its policy in the Frappe component guide.
- Production rollout remains pending: the guarded updater expects Docker project `codexsun-billing` / service `platform-api`, while the live API is owned by project `codexsun` / service `codexsun-api`. Preflight stopped before creating a backup or changing containers.
- Validation: automatic-export policy tests, all 102 CRM/Frappe unit tests, CRM Duties E2E, Mobile Contact Customer E2E, CRM contact-upsert E2E, Platform API typecheck/lint, Frappe boundaries, version check, and component documentation check pass.

## v-1.1.18

### [v 1.1.18] 2026-10-18 8:21 pm - Frappe bidirectional enquiry sync

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.18.
- Correct timezone-less Frappe creation and modification dates to Asia/Kolkata, and refresh imported comment timestamps on source retries.
- Poll Frappe enquiry and comment changes incrementally with a 24-hour replay window; label inbound and outbound queue results separately.
- Remove captured display names from the Frappe Customer Link payload on enquiry updates, preventing the HTTP 417 error.
- Validation: CRM/Frappe tests and E2E, API typechecks/lint/builds, module boundaries, component-doc checks, and dependency layout checks pass. Production deployment and readback are pending.

## v-1.1.17

### [v 1.1.17] 2026-10-18 7:38 pm - Import Frappe enquiry message history

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.17.
- Interpret timezone-less Frappe creation and modification timestamps as Asia/Kolkata before storing them in UTC, and refresh timestamps on already imported comments during source-directed retries.
- Validation: focused CRM/Frappe tests, API typechecks, lint, builds, and module-boundary checks pass. TECHMEDIA production timestamps were inspected; a deployed source re-import is still required to reconcile existing rows.

## v-1.1.16

### [v 1.1.16] 2026-10-18 7:28 pm - Frappe bulk import conflict recovery

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.16.

## v-1.1.15

### [v 1.1.15] 2026-10-18 7:12 pm - Frappe import ambiguous contact recovery

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.15.
- Preserve imported enquiries and Frappe history without attaching an arbitrary Core contact when a mobile number matches multiple contacts and Frappe has no Customer identity.
- Keep local contact creation and closure approval rules unchanged; focused CRM/Frappe tests pass. Live retry and reconciliation are pending deployment.

## v-1.1.14

### [v 1.1.14] 2026-10-18 6:58 pm - Frappe enquiry import recovery

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.14.
- Persist Frappe sync timestamps in MariaDB `DATETIME` format and make retries repair already-created enquiries, source links, contacts, and comments.
- Preserve closed Frappe statuses through the import-only CRM path while keeping local closure approval checks enforced.
- Validation: CRM/Frappe unit and isolated API tests pass; the live TECHMEDIA import is paused for this fix and still needs a resumed queue run and reconciliation.

## v-1.1.13

### [v 1.1.13] 2026-10-18 6:39 pm - Frappe enquiry import parity

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.13.
- Import Frappe enquiries into CRM with matching numeric `ENQ` serials, original creation/modified timestamps, mapped owner and assignee, and exact site-scoped Customer identity links in Core.
- Import Frappe Comment/Info history with source author and timestamp; stable retry keys and linked-enquiry reprocessing allow interrupted imports to resume without duplicating comments.
- Keep CRM as the local authority after the explicit inbound import. No database schema changed; isolated CRM/Frappe suite and targeted route tests pass. Live deployment and TECHMEDIA backfill remain pending.

## v-1.1.12

### [v 1.1.12] 2026-10-18 5:13 pm - CRM overview card accents

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.12.
- Match CRM overview summary cards to the HRMS metric layout, using distinct muted left-edge accents while keeping card surfaces neutral and navigation accessible.
- Restore explicit Frappe-to-CRM enquiry imports with matching `ENQ` serials, source creation/modified times, mapped owners and assignees, site-scoped Customer identities, and idempotent Comment/Info history.
- Reprocess linked source enquiries so interrupted comment imports can be retried; this path remains inbound-only, and production verification is pending.

## v-1.1.11

### [v 1.1.11] 2026-10-18 4:48 pm - Frappe contact identity and queue verification

#### Database Changes

- Database update: Yes (manual).
- Add a tenant-scoped Frappe Customer identity table keyed by source site and remote Customer document ID. Migration `1.0.87` preserves existing import links and stores stable local contact associations.

#### App Codebase Changes

- Bumped workspace version to 1.1.11.
- Store the actual Frappe Customer or Supplier document ID as the Core contact code, mark import/export matches and mismatches, and block mismatches before any remote contact write.
- Restrict Frappe Mobile Contact writes to the mobile number after the matching Customer or Supplier is verified; live test on `logicx.tmnext.in` confirmed Customer `C9138`, import retry identity, mobile-only post/readback, repeat export, mismatch blocking, and fixture cleanup.
- Calculate queue verification age from the queue database clock to avoid host/database timezone drift.
- Extend the queue live E2E to exercise automatic runtime pickup for database and Redis backends plus the reports artifact queue. All three completed; Redis was required for the test and the temporary container was removed.
- Pass `npm run check`, `npm run test:crm-frappe` (95 unit tests and three database E2Es), `npm run test:e2e:frappe-contacts-live`, `npm run test:queue-live`, and `npm run check:versions`.
- CRM Enquiry-to-Frappe automatic export remains stopped pending approval of the documented outbound-sync scope; this release does not claim Enquiry delivery.
- The standard clean build hit Windows `ENOTEMPTY` while clearing shared `dist`. A no-clean retry built 45 tasks but the Sites clients build stopped because the authenticated `CODEXSUN_SITES_TIRUPURCONNECT_SNAPSHOT` input was unavailable. Relevant Core, Frappe, CRM, and Platform package typechecks passed; the full build is not claimed.

## v-1.1.10

### [v 1.1.10] 2026-10-18 3:29 pm - CRM overview and Frappe contact sync

#### Database Changes

- Database update: Yes (manual).
- Add a separate tenant-scoped Frappe Mobile Contact export-link table and a follow-up migration that allows multiple CRM contacts to share the same remote mobile identity.

#### App Codebase Changes

- Bumped workspace version to 1.1.10.
- Build the CRM overview around enquiry and task workloads, call logs, activities, SOPs, duties, and permitted duty-report totals; align enquiry summary counts with visible records.
- Refine CRM navigation and workspaces, including Call Logs placement, removal of the deferred Research menu, list spacing, task priority/status choices, and editable contact details.
- Report Frappe connection readiness and queue-worker availability, and reject background-sync requests when the worker is disabled.
- Sync CRM contacts to Frappe Mobile Contact by validated mobile number, reusing shared remote identities and preserving independent inbound import associations.
- Record the CRM↔Frappe contact verification and cleanup E2E; pass the 95-test CRM/Frappe suite and its CRM duty, mobile-contact import, and contact-upsert E2Es.
- Pass the live `logicx.tmnext.in` Mobile Contact import, retry, create, shared-identity, update, and remote-cleanup round trip.
- Pass `npm run check`; repository docs, component docs, module boundaries, type checks, and lint all verify.

## v-1.1.9

### [v 1.1.9] 2026-10-18 1:09 pm - Portable Docs source verification

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.1.9.

## v-1.1.8

### [v 1.1.8] 2026-10-18 12:54 pm - CRM workflows and tenant administration

#### Database Changes

- Database update: Yes (manual).
- Add the tenant-scoped Enquiry WhatsApp handoff table and task-comment reply relationship with forward-only, repeatable migrations.
- Make CRM comment retries idempotent and record comment, job, checkpoint, closure, estimate, and WhatsApp activity in the combined work history.
- Seed every persisted permission onto the protected Admin role and restore protected Admin role membership for every active legacy admin user in each tenant.

#### App Codebase Changes

- Bumped workspace version to 1.1.8.
- Refactor Enquiry and Task details around one Actions history while retaining focused tabs, synchronized counts, inline property edits, and consistent tab/card framing.
- Align task pagination with Enquiries: 100 rows per page, showing pagination only when more than 100 rows exist. Keep Jobs panels compact and closure records table-aligned.
- Add persistent WhatsApp handoff history with sender, recipient, message, and time; expose action history refresh across comment, job, checkpoint, property, estimate, and closure writes.
- Add component and Docs references for Enquiry WhatsApp and keep release/task logs consistent with threaded task comments.
- Add the focused `test:e2e:crm-whatsapp` release command and cover tenant authorization, retry conflicts, migration repeatability, and rollback of incomplete handoffs.
- Update QCafe overview and workspace navigation refinements included in this source batch.
- Pass `npm run check`, version alignment, component documentation, and the focused WhatsApp, work-report, task-contact, and closure database E2Es. Platform API, Platform web, and Ecommerce shop builds pass.
- Platform web and shop builds retain chunk-size and ineffective HRMS dynamic-import warnings. The separate CODEXSUN E2E needs a local baseline `app_roles` table that is missing from the configured development database.

## v-1.1.7

### [v 1.1.7] 2026-10-17 10:00 pm - Loading stability and complete application release

#### Database Changes

- Database update: Yes. Add the nullable Chat read cursor and backfill its message watermark without deleting messages.
- Add Sites deployment records with revision uniqueness and a restricted site foreign key. Keep existing publication records.
- Include pending CRM and Core permission seed corrections. Apply only forward migrations and preserve current databases and uploads.
- Verify the existing CODEXSUN shop domain through its public DNS TXT token. Keep the existing Ecommerce entitlement unchanged.
- Require a verified database backup and retain the previous API, web, and shop images before rollout.
- Migration CLI skips only unprovisioned non-active tenants. Invalid active or configured targets still block release. Registry read failures no longer become an empty migration target list. Two target-selection tests pass.

#### App Codebase Changes

- Bump every workspace, lockfile, deployment sample, and Windows package manifest to version 1.1.7.
- Load the shared loader stylesheet independently, with fixed logo dimensions, theme visibility, token fallbacks, and reduced-motion support.
- Use narrow UI imports for login and recovery. Download tenant desk code alongside session verification while retaining authentication gates.
- Lazy-load additional app workspaces and expose a small Chat navigation contract. Avoid eager Super Admin workspace imports through query barrels.
- Bound Platform reads without automatically cancelling or retrying writes. Keep optional shop stories outside the primary loading path and skip disabled Blog requests.
- Include pending Chat read handling, CRM permissions and mobile navigation, Platform tenant operations, Sites publication/deployment, and TConnect-to-Sites composition changes.
- Preserve the existing WhatsApp basket request flow. This release does not add payment collection or stock reservation.
- Add the missing Sites deployment developer reference and synchronize 521 Docs pages across 25 app groups.
- Pass the full repository check, version alignment, 31 focused release tests, and 15 deployment/runtime/persistence contract tests.
- Add QCafe to the composed API Docker build and validate every resolver package against the build list.
- Fix multi-tab header overflow with aligned 64 KiB API and nginx request limits, plus adequate upstream response buffers.
- Clear invalid encrypted session cookies while preserving valid cookies in other tabs. A successful selected-slot login retires only that tab's previous session.
- Pass nine cookie/header tests, including a real HTTP request above the former 16 KiB Node default and rejection above 64 KiB.
- Revalidate shop HTML on refresh while retaining immutable hashed assets.
- The local clean-all build stopped on a Windows dist file lock. Targeted Framework, Platform web, and shop production builds passed.
- The Platform web build emits one remaining ineffective dynamic-import warning for the HRMS attendance gateway barrel, plus bundle-size warnings. Production rollout remains pending at commit preparation.

## v-1.1.6

### [v 1.1.6] 2026-10-17 - Live CRM role access and client APKs

#### Database Changes

- Reconciled Manager read grants for Contacts, Call Logs, SOPs, Duties, and Contact 360 in `techmedia_db` and `rainbow_db`. No table changes were required.
- Preserved write restrictions and existing data. Saved prior permission grants and runtime files for rollback.

#### App Codebase Changes

- Duty user filters accept all-duty read permission without assignment write permission.
- Verified Admin and Manager in both live tenants: 88 API reads and 60 browser page checks passed.
- Built separate Techmedia and Rainbow release APKs with distinct Android app IDs, Corporate ID defaults, and version 1.1.6.
- Passed the permission/work-report database regression, CRM API build and lint, boundaries, dependency layout, and component-documentation checks.

### [v 1.1.6] 2026-10-17 - Live CRM tenant acceptance

#### Database Changes

- Backed up and upgraded existing `techmedia_db` and `rainbow_db` through tracked migrations and seeds. Preserved existing users and shared infrastructure.
- Applied Chat read cursors and reconciled CRM/Core role grants. Admin, Super Admin, and Manager can read workspace setup.

#### App Codebase Changes

- Fixed Vite configuration startup warnings, persisted-role display, mobile request timeouts, and normal-user Task completion permission mapping.
- Verified both live Application overview pages and all five CRM pages for each tenant without browser warnings or errors.
- Verified Android enquiry GPS actions and duty report creation/editing against the live API. All 30 mobile tests passed.
- Detailed evidence and limits are in `apps/crm/agent/LIVE-VERIFICATION-2026-10-17.md`.

### [v 1.1.6] 2026-10-17 7:07 pm - CRM work reports, mobile workflows, and public delivery

#### Database Changes

- Added Chat read-message cursors to preserve unread counts across timezone differences and messages created in the same second. Applied and repeated the migration locally only.

- Database update: Yes (manual).
- Updates CRM work-report persistence and Chat permission seeds. Existing databases require reviewed migrations and permission seed execution before rollout.
- No live migration, external deployment, provider submission, or physical-device verification was performed during this release preparation.

#### App Codebase Changes

- Verified mobile Home card destinations, live task counts, assignment/message badges, and clear-after-read behavior. Fixed refresh callbacks and aligned the Activities count with its default page filter. Added three mobile regression tests and database unread-cursor assertions.

- Bumped workspace version to 1.1.6.
- Completed the pending CRM work-report host integration, transactional Chat delivery, duty notifications, and enquiry/task/duty action history changes.
- Updated CRM mobile action drawers, duty report history, work feeds, messaging, WebSocket adapters, and widget tests.
- Included the final mobile duty-report request fix: own-scope and pagination values use the API client's query argument.
- Updated Chat participant access, work-message creation, permission seeds, and realtime hooks.
- Updated tenant registry list handling, public blog delivery, static public document rendering, startup composition, and container/runtime configuration.
- Updated Ramu Tex fabric pages, responsive image assets, enquiry links, and contact metadata.
- Updated TConnect enquiry/registration feedback, public metadata, SEO delivery, and Cloudflare Worker source configuration.
- Included pending work-report, tenant, public-document, and TConnect browser verification tools. Component task files preserve earlier live verification evidence.
- Refreshed repository references and catalog hashes. Final Docs validation covers 519 pages across 25 app groups.
- Passed eight Platform/public-document tests, 21 TConnect tests, seven Docs tests, and all 26 CRM Flutter tests.
- CRM mobile analysis stopped before analysis because Flutter plugin builds require Windows Developer Mode symlink support. System settings were not changed.
- Passed the full repository check, including component documentation, cleanup regression tests, module boundaries, add-on validation, Docs validation, TypeScript, and lint.
- The first production build stopped on generated-output cleanup (`ENOTEMPTY`). The retry passed all 50 forced build tasks, artifact collection, and cleanup.
- Frontend bundle-size and ineffective dynamic-import warnings remain. Passed the version-bump regression test and version alignment.

## v-1.1.5

### [v 1.1.5] 2026-10-17 6:11 pm - CRM duty administration and public site updates

#### Database Changes

- Database update: Yes (manual).
- Added tenant-scoped CRM work reports with GPS, retry protection, and checkpoint sequence validation. Applied and repeated the additive migration on the local test tenant.
- Adds CRM duty-assignment/report edit-history migrations and administrative report permission seeds.
- Adds TConnect company credential persistence and a Sites D1 enquiry schema. Review and apply migrations and permissions for each configured target before rollout.
- Production database upgrades, external deployments, and provider operations were not repeated during this release preparation.

#### App Codebase Changes

- Bumped workspace version to 1.1.5.
- Unified mobile enquiry, task, and duty action drawers with an Action dropdown, input form, and Confirm & sync. Added shared web action history, assignment/report Chat delivery, and closure refresh.
- Verified native mobile GPS reports against local web history, task rejection/resubmission/approval, 26 Flutter tests, and focused CRM integration flows. No production deployment or new live Frappe verification is claimed.
- Added CRM duty assignment/report administration, edit history, grouped reporting summaries, task status filters, and simpler SOP screens.
- Updated Frappe duty field mappings and worker behavior with corresponding test and operational documentation.
- Added TConnect company credentials, public discovery and directory updates, standards references, sample badge presentation, and account/public browser verification scripts.
- Updated LogicX and Ramu Tex public pages, branding assets, font delivery, responsive layouts, and shared public styling.
- Added Sites Cloudflare Worker/D1 source configuration and enquiry storage, plus packaged-runtime performance and caching updates.
- Updated Platform app composition and repository documentation. Prior task files retain their existing browser, database, and performance evidence.
- Added the TConnect Credential developer guide and registered its declared synchronous contract in the module-boundary checker.
- Refreshed repository references and catalog hashes. Documentation validation covers 514 pages across 25 app groups.
- Passed 19 TConnect tests, 11 focused CRM/Frappe tests, seven Docs tests, three D1 enquiry tests, and the version-bump test.
- The Sites packaged-runtime integration test was skipped without its prepared runtime fixture. Its source test runner required the TypeScript loader for API imports.
- The initial full repository check passed after registering Credential's synchronous capability contract. More CRM work-report/chat and tenant public-blog changes arrived during the subsequent production build.
- Aligned the public portal's required blogEnabled response type with its service and route contract.
- Production build completed 49 of 50 tasks but failed Platform API compilation on the blogEnabled mismatch. The subsequent Platform typecheck reached a newer CRM work-report query against app_modules, which is absent from TenantDatabase.
- The final concurrent work-report and public-blog changes are included as source work. A successful full check/build for that later state remains unverified.
- Added a Work Report developer reference with its verification limits. Final Docs validation passes for 516 pages across 25 app groups.

## v-1.1.4

### [v 1.1.4] 2026-10-17 5:14 pm - Q Cafe kitchen workflows and CRM task improvements

#### Database Changes

- Database update: Yes (manual).
- Adds CRM task contact migration `crm.task.optional-contact-v4` and Q Cafe waiter, kitchen delivery, audit, and durable print-state migrations.
- Existing databases require reviewed migration preflight, backups, migration execution, and applicable permission seeds.
- CRM follow-up (2026-10-17): adds assignment/report edit-history migrations and administrative all-report permission grants. Applied and verified locally; production rollout remains pending.

#### App Codebase Changes

- Bumped workspace version to 1.1.4.
- Added Q Cafe kitchen preparation tokens, waiter registration and delivery confirmation, KOT billing guards, and durable host-printer dispatch state.
- Updated Q Cafe item-addition queuing, running-order and floor controls, kitchen workspaces, and printer settings.
- Updated CRM task contact handling, closure queries and pending badges, enquiry navigation, SOP forms/lists/details, and mobile job details.
- Updated LogicX application and workflow content, marketing settings, page layouts, and local brand images and icons.
- Updated the TConnect public brand, category discovery, directory pages, registration presentation, and public information routes.
- Updated Platform composition and module-boundary checks for the new Q Cafe waiter and kitchen flows.
- Component task files retain earlier browser and database evidence. Live migrations, physical printers, mobile builds, and deployment were not rerun during this release preparation.
- Added the missing Q Cafe Waiter developer guide and refreshed repository reference documents and catalog hashes.
- Passed two focused CRM task tests, all 19 TConnect tests, and all nine Q Cafe desktop/SQLite regression tests.
- Passed the full repository check, including component documents, cleanup tests, module boundaries, add-on validation, documentation coverage, TypeScript, and lint.
- Passed all seven Docs tests and the version-bump regression test.
- The first production build stopped on a Windows `EPERM` cleanup lock. The retry passed cleanup, all 50 forced build tasks, artifact collection, and workspace cleanup.
- Frontend bundle-size and ineffective dynamic-import warnings remain. No physical printing or production rollout is certified by these builds.
- CRM follow-up (2026-10-17): simplified SOPs to name, Department, Frequency, and Steps; added separate duty/report lists and new/edit forms with protected history and stable Frappe identities.
- Added administrative Duty Reporting summaries, date/search filters, totals, and report drill-through. Admin, Manager, and Super Admin can view all tenant reports; mobile own-report access is preserved.
- Matched task default Active filters and status badges to enquiries, refreshed recent enquiry/task panels, protected unsaved forms during navigation, and moved List in after Tasks.
- Passed scoped browser, type, lint, boundary, mapping, and isolated workflow checks. Live logicx.tmnext.in create/edit/readback checks passed for all four supported frequencies; all 12 remote test documents were removed and cleanup was verified.
- Live checks used direct worker execution. Background scheduling, final native mobile acceptance, and production deployment remain pending. See the [CRM work log](../../apps/crm/agent/WORK-LOG.md) for evidence and limits.

## v-1.1.3

### [v 1.1.3] 2026-10-17 3:37 pm - Business workflows, TConnect, and shared list controls

#### Database Changes

- Database update: Yes (manual).
- Includes TConnect tenant tables and permission seeds, Q Cafe settings/special/menu/order schema updates, and Sites publication/enquiry persistence.
- Includes Billing Sales and Export Sales migration changes. Existing databases need reviewed migration checks, backups, and applicable permission seeds.
- Live database upgrades, production provider operations, and deployment were not repeated during this release preparation.

#### App Codebase Changes

- Bumped workspace version to 1.1.3.
- Added TConnect public directories, member and buyer desks, controlled portal registration, enquiries, conversations, messages, and quotations.
- Added fixed Platform portal identity contracts and role policies for TConnect buyers and members.
- Updated Billing list queries, financial-year and currency context, reports, dashboard totals, payment auditing, and voucher lifecycle guards.
- Updated Sales and Export Sales compliance recovery, WhiteBooks sandbox configuration checks, QR rendering, and invoice pagination.
- Added host-composed list controls, column filters, header actions, and workspace form navigation across Core, Billing, Platform, and other app lists.
- Updated CRM contacts, duty/SOP persistence, Frappe duty field mappings, and related verification tools.
- Expanded Q Cafe settings, special pricing, menu images, floor bookings, kitchen workflows, and responsive application headers.
- Updated Sites publication and enquiry modules, portfolio layouts, LogicX branding, and local vendor-logo assets.
- Updated Ecommerce storefront image handling, journal content, and organisation documentation.
- Added full-source repository documentation references, synchronization checks, missing module guides, and guarded cache-cleanup tooling.
- Added the missing TConnect Message guide and refreshed repository references. Docs validation now covers 506 pages across 25 app groups.
- Passed the full repository check, including component documents, cleanup regression tests, module boundaries, add-on validation, Docs validation, TypeScript, and lint.
- Passed 19 TConnect tests, seven Docs tests, 14 focused Billing/Frappe tests, two invoice-rendering tests with the web JSX configuration, and the version-bump test.
- Prior component task files contain browser, sandbox-provider, and database verification evidence. Those live checks were not repeated for this release.
- Passed the root production build. Bundle-size and ineffective dynamic-import warnings remain in the frontend output.

## v-1.1.2

### [v 1.1.2] 2026-10-16 8:06 pm - Business applications and component documentation

#### Database Changes

- Database update: Yes (manual).
- Includes Billing compliance persistence and queue migrations, Q Cafe tenant POS/menu/order tables, Sites page/blog storage, and Ecommerce organisation settings.
- Includes tenant, company-selection, and app composition changes. Existing databases require reviewed migration preflight, backup, migration, and applicable permission seeds.
- Live database migration and production provider compatibility were not verified during this release preparation.

#### App Codebase Changes

- Bumped workspace version to 1.1.2.
- Added component README, task, plan, and skills documents across apps, developer kits, shared packages, workspace tools, and add-on guides.
- Added component-documentation checks and aligned Zetro's runtime loader, tests, and build collection with uppercase `SKILLS.md`.
- Added Sales and Export Sales compliance requests, provider result persistence, durable queue dispatch, cancellation recovery, and WhiteBooks configuration templates.
- Added Customer Summary and Supplier Summary print views and compliance controls in invoice forms and details.
- Added Q Cafe cloud modules and tenant web POS, menu masters, saved dine-in orders, table and seat allocation, kitchen tickets, and service pages.
- Added Sites portfolio page/blog editing, publication contracts, client identities, runtime controls, and standard portfolio templates.
- Added Ecommerce organisation settings, tenant branding/logo storage, storefront presentation updates, and local storefront runtime controls.
- Updated Platform application catalog, tenant app launch behavior, shared loading UI, production package resolution, and container source configuration.
- Excluded local Ecommerce upload storage from source control. Removed tracked generated Windows schemas under the existing generated-file ignore rule.
- Passed component documentation checks and both regression tests, module boundaries and their regression test, add-on validation, and repository lint.
- Passed 11 focused WhiteBooks client, Ecommerce runtime, and Zetro rule-loader tests, plus the version-bump test and version alignment.
- Passed the separate repository TypeScript run with 91 successful tasks and the final root dependency-layout check. Frontend dependency builds reported bundle-size warnings.
- Full `npm run check` stopped at Docs validation: the Ecommerce storefront-organisation module has no developer reference page.
- Prior component task files record local browser, sandbox provider, and database evidence. Those live checks were not repeated during release preparation.

## v-1.1.1

### [v 1.1.1] 2026-10-16 10:06 am - Version 1.1.1 release

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.1.1.
- Set Git commit labels to the requested minor.patch sequence. This release uses `#1.1`; later patch releases use `#1.2`, `#1.3`, and so on.
- Updated the GitHub commit helper to derive that label from the latest changelog version.

## v-1.1.0

### [v 1.1.0] 2026-10-16 9:37 am - Open-source README and version 1.1.0

#### Database Changes

- Database update: No. This update adds no schema, migration, seed, or tenant-data changes.

#### App Codebase Changes

- Rewrote the root README for public contributors with project scope, prerequisites, environment setup, configuration, architecture, tests, deployment, contribution steps, support, security reporting limits, and GPL-3.0 licensing.
- Corrected the supervised development service list and linked detailed operational and client guides.
- Set the root and all 51 npm workspaces to the requested version 1.1.0. Updated internal dependency ranges and root lockfile metadata.
- Aligned Windows Tauri/Cargo version metadata, the Windows Cargo lockfile entry, and deployment sample image tags with 1.1.0.
- Updated the versioning guide and README to allow explicitly requested major and minor version changes while retaining lockstep workspace versions.
- Documentation review passed formatting, all 33 local file links, all 24 referenced npm scripts, documentation validation, and version alignment before this release update.
- Passed npm run check for 1.1.0, including module-boundary checks and regression tests, add-on validation, Docs content validation, TypeScript, and lint. Passed the version-bump test, final dependency-layout check, version alignment, and focused formatting checks.
- No live database, browser E2E, native installer, or full production-build validation was performed for this documentation and version update.

## v-1.0.99

### [v 1.0.99] 2026-10-16 8:48 am - Repository baseline analysis and GitHub publication

#### Database Changes

- Database update: Yes (manual).
- This first source publication includes the existing module-owned migrations and seeds. This review adds no schema changes.
- Existing databases require their normal migration and seed process. Database compatibility was not verified against a live database.

#### App Codebase Changes

- Bumped all 51 npm workspaces, internal dependency ranges, the root lockfile, Windows manifests, and deployment samples to 1.0.99.
- Reviewed the source baseline: 19 application folders, Project Manager/UIUX/Zuno devkits, and shared Framework/UI packages.
- Confirmed the Platform Fastify API composes business modules and the React/Vite web shell consumes their public packages.
- Prepared the first application-source commit after the three-file GitHub initial commit. Existing local application work is included as a baseline.
- Verified direct GitHub CLI authentication for CODEXSUN, repository admin access, HTTPS Git credentials, and remote HEAD access.
- Passed the repository module-boundary check and its regression test, add-on package validation, and documentation validation for 261 pages across 23 app groups.
- Passed all three product-stack contract tests, all five deployment-environment contract tests, the separate Sites API typecheck, version alignment, and the final dependency-layout check.
- Full check did not pass: the first run hit an npm configuration failure in Sites API and a Windows EPERM cleanup error. The retry hit EBUSY while copying Docs content.
- Initial lint failed on an unused mobile parameter in CRM enquiry properties. That file changed during staging, and the focused CRM web lint rerun passed. Full lint remains unverified after that change. CRM API reports explicit-any warnings.
- Production build, live database migration/persistence, browser E2E, and mobile/native verification were not completed in this review.
- Confirmed local environment files remain ignored. A targeted scan found no private-key blocks or GitHub/AWS token patterns in the reviewed source paths.

## v-1.0.98

### [v 1.0.98] 2026-10-15 12:20 pm - working on task and sop

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.98.

## v-1.0.97

### [v 1.0.97] 2026-10-14 - CRM SOP and Duties modules

#### Database Changes

- Added tenant migrations for SOPs, SOP Items and revisions, Duty Assignments,
  Duty Reports, and the outbound Frappe sync queue.
- Added CRM permissions for SOP authoring, duty assignment, and duty reporting.

#### App Codebase Changes

- Added local CRM SOP authoring, revision publishing, user Duty assignment,
  Duty Reporting, and mobile My Duties/report submission.
- Added a durable CRM-to-Frappe queue, relay, and worker for published SOP Items,
  assignments, and reports. CRM remains the source of truth.
- Added local database E2E coverage for publish, assign, report, duplicate retry,
  queue creation, mocked Frappe field mapping and dependency order, and report
  persistence after reconnecting to the database.
- Fixed Duty Report own-scope access to fail closed when no active user is
  available; added report filters, totals, and pagination to the API and web UI.
- Unified immediate and relay queue idempotency keys, added an atomic sync-event
  claim, and queued published child-item updates after SOP title changes.
- Added web SOP editing, lifecycle controls, item revision authoring/history,
  and local assignment deactivation. Remote assignment deactivation remains
  pending because Frappe's current DocType contract has no inactive state.
- Updated mobile My Duties to read the paginated own-report response.
- Expanded local CRM E2E coverage for permission denial and concurrent worker
  claims.
- Passed CRM API, CRM web, Platform API, and Frappe API typechecks, CRM module
  boundary checks, mobile analysis, and all 22 mobile widget tests. Live delivery
  to a Frappe site remains unverified.

### [v 1.0.97] 2026-10-14 7:46 pm - CRM mobile job comment flow

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.97.
- Removed the 90-second mobile job-start delay so Start and Stop send their local CRM requests immediately.
- Removed the persisted pending-start countdown and its restore flow to prevent a delayed start after reopening the app.
- Added a mobile widget test that verifies both actions show their server returned comments.
- Passed the CRM mobile analyzer and all 22 mobile widget tests. Built and installed the Android debug app. Live action verification remains pending because the emulator was locked at the PIN screen.

## v-1.0.96

### [v 1.0.96] 2026-10-14 12:43 pm - refine on frappe sync

#### Database Changes

- Database update: Yes (auto-check).
- Added repeatable CRM contact permission seeds; existing tenant databases need the normal tenant seed run to receive these grants.
- Mobile location, charges, and collected amounts now add enquiry comments; start/stop and completion comments remain server-written and the completion comment appears after the feed refresh.

#### App Codebase Changes

- Bumped workspace version to 1.0.96.
- Corrected CRM contact lookup response keys to match the form contract, kept lookup creation URLs stable, and added defensive defaults for missing lookup arrays.
- Routed CRM contact requests through `crm.contact.*` authorization and seeded the corresponding contact permissions.
- Added contact lookup contract regression tests.
- Fixed amount-dialog controller disposal during its close animation and covered mobile action comments in widget tests.

## v-1.0.95

### [v 1.0.95] 2026-10-14 11:12 am - new update for crm

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.95.

## v-1.0.94

### [v 1.0.94] 2026-10-14 9:31 am - CRM mobile local sync verification

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.94.
- Verified that web-created enquiry #12 appears in the signed-in Android CRM app.
- Verified that an Android-created enquiry, its activity entry, a selected device call log, and its comment persist in the tenant-local database.
- Confirmed that the mobile enquiry and call-log test records have no Frappe sync queue events.
- The local test records remain: enquiry #13 has the title `CRM%`, and call log #20 has a test comment.
- Web UI verification of mobile-created records remains pending because the browser session expired during an API restart.

## v-1.0.93

### [v 1.0.93] 2026-10-14 8:29 am - working on crm and chat

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.93.

## v-1.0.92

### [v 1.0.92] 2026-10-14 7:55 am - working with chat

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.92.

## v-1.0.91

### [v 1.0.91] 13/10/2026 10:29 pm - Team notes and team chat apps with tenant desk launcher

#### Database Changes

- Added `notes_notes` table through migration `notes.001_foundation` with tenant migration batch, seed, and rollback wiring.
- Added `chat_channels` and `chat_messages` tables (channel foreign key, channel index) through migration `chat.001_foundation` with tenant migration batch, seed, and rollback wiring.
- Added `chat_attachments` and `chat_channel_members` through `chat.002_attachments` and `chat.003_members`, plus `chat_channel_reads` for server read receipts through `chat.004_reads`.
- Registered `notes.manage` and `chat.manage` permissions with admin grants in repeatable module seeds.

#### App Codebase Changes

- Added `apps/notes/api` (`@codexsun/notes-api`) and `apps/notes/web` (`@codexsun/notes-web`): team note CRUD with search, suspend, restore, and force delete.
- Added `apps/chat/api` (`@codexsun/chat-api`) and `apps/chat/web` (`@codexsun/chat-web`): team channels with channel-scoped messages, rename, suspend, restore, and dependency-protected channel delete.
- Composed both modules in Platform API with tenant company context and health registration.
- Registered Notes and Chat in the backend app registry, tenant defaults, frontend app registry, tenant desk pages, side menus, landing choices, and tenant access screens.
- Refined Chat to a WhatsApp-tone workspace: channel search with All/Unread/Favourites tabs, avatars with server unread badges, date pills, green/white bubbles with saved ticks, inline image rendering, file download cards, composer with image/file picker, group/broadcast kinds, member drawer with admin roles, and broadcast admin-only posting.
- Added quoted replies with jump-to-message, emoji reactions with counts, edit markers, and a cookie-authenticated WebSocket realtime gateway with live message fan-out, typing indicators, presence, reconnect sync, plus a managed browser client with heartbeat and backoff.
- Added quoted replies with jump-to, emoji reactions with counts, edit markers, and a cookie-authenticated WebSocket realtime gateway with live message fan-out, typing indicators, presence, reconnect sync, and a managed browser client with heartbeat and backoff.

### [v 1.0.91] 2026-10-13 9:11 pm - working on crm with mobile

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.91.

## v-1.0.90

### [v 1.0.90] 2026-10-13 11:31 am - CODEXSUN real-time web and Android device sync

#### Database Changes

- Database update: No. Requirements, approvals, and devices use the existing CODEXSUN tables, migrations, and permission seeds.

#### App Codebase Changes

- Bumped root, workspace, lockfile, Windows, deployment sample, and CODEXSUN Android versions to 1.0.90.
- Added authenticated Socket.IO WebSocket transport for web, desktop portal, and native Android device communication. Platform resolves the current tenant session and backend permissions.
- Restricted messages to the same actor and tenant. Added strict payload limits, message rate limits, connection limits, session revalidation, and revoked-access disconnects.
- Published requirement and device notifications after successful saves. Connected web query refresh and Android reloads so changes appear without manual refresh.
- Added the CODEXSUN Flutter Android app with tenant sign-in, idea capture, requirement submission, mobile decisions, persistent device registration keys, and memory-only session credentials.
- Fixed Android transport cleanup after server closure. Added bounded acknowledgments and cleared the signed-in screen after access denial.
- Added root mobile commands and setup instructions. Android output stays in root dist through an ignored Flutter build junction.
- Added WebSocket proxy support to Platform development routing and the demo Nginx configuration. Public VPS routing remains unchanged.
- Verified bidirectional browser and emulator messages, ideas created on both devices, and mobile approval updating the browser without refresh. Verified socket isolation and revocation, 13 focused tests, live MariaDB lifecycle tests, Android analysis and socket cleanup tests, API/web typechecks, lint, and builds.
- Installed the normal Android debug app after testing. Test credentials and test APKs are excluded from the source commit. Worker execution, native desktop packaging, mobile offline drafts, and cloud deployment remain future work.
- Release validation: all workspace typechecks, repository lint, lockstep versions, root dependency layout, focused tests, formatting, and the 1.0.90 Android build passed. Direct workspace typechecks replaced the repository runner after its build-output cache stalled. The full repository check stops at existing Docs knowledge boundary violations: missing events, worker, and sync role files. These files were already absent in the committed baseline.

## v-1.0.89

### [v 1.0.89] 2026-10-13 9:46 am - new development with codexsun

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.89.

## v-1.0.88

### [v 1.0.88] 2026-10-12 11:15 am - Developer documentation, hybrid MDX library and assistant references

#### Database Changes

- Database update: Yes. Apply the Docs-owned `docs.knowledge` migration and repeatable tenant seeds when enabling Docs on another deployment.
- Added `docs_knowledge_pages` and `docs_knowledge_activity` for source metadata, tenant Markdown overrides, optimistic revisions and audited edits/restores. Seeds register view/edit permissions and preserve tenant overrides and inactive grants.
- Core tables and historical migrations remain unchanged. The already-applied Docs migration identity and checksum remain stable.

#### App Codebase Changes

- Bumped root, workspace, lockfile, Windows manifest and deployment sample versions to 1.0.88.
- Added 231 developer Markdown/MDX pages across 19 application groups, covering 154 module/workspace references, application business purpose, workflows, source boundaries and documented implementation limits.
- Added source/hash/module coverage validation and production content copying. Wired React MDX compilation, app-grouped sidebar submenus, search, source view, heading links, table of contents and bookmarkable Docs Library pages.
- Added permission-protected hybrid file/database editing, optimistic conflict detection, activity history and repository restore. Git sources compile to React; database overrides render safe Markdown without executing MDX or JavaScript.
- Connected Zetro's explicit `/docs` command to bounded, cited tenant-authorized references with audited tool events and access-revocation checks. Added Super Admin Zuno repository documentation search through `search_developer_docs` and a read-only API.
- Fixed Zuno's synchronous host authorization adapter so allowed requests dispatch correctly. Forced fresh production builds to prevent overlapping root-dist cache snapshots from restoring stale compiled application output.
- Updated Docs authoring/setup documentation, repository inventory and assistant runtime guidance.
- Verified full repository checks, lockstep versions, dependency layout, fresh production builds, Docs source coverage, focused assistant/foundation regressions, database and composed API E2E, desktop/mobile browser editing and restore, safe overrides, live assistant reference reads and compiled production asset resolution.

## v-1.0.87

### [v 1.0.87] 2026-10-12 8:17 am - Align app desk access and CRM data sources

#### Database Changes

- Database update: No. App access and desk behavior use existing tenant settings and permissions; no schema, migration, seed, or data backfill is required.

#### App Codebase Changes

- Bumped root, workspace, lockfile, Windows manifest, and deployment sample versions to 1.0.87.
- Landing Desk now reads each enabled app's name, description, color, and icon from the Platform app registry, fixing repeated generic Application cards for HRMS, Docs, Himsx, Zetro, and Auditor while keeping Zetro's logo.
- LogicX ERP hides Schemes and redirects direct Schemes URLs to its overview when Billing is disabled; the existing API check remains the authority for Schemes access.
- Normalized the legacy `accounts.accounting` entitlement to `accounts.overview` in the tenant desk, matching backend tenant and app registry handling.
- Split CRM Data Source into a table list and a real provider form with strict local/Frappe validation. The CRM module now satisfies the frontend ownership boundary check without placeholder files.
- Added focused tests for app card identity, LogicX menu access, Accounts entitlement compatibility, and CRM provider validation.
- Verified focused tests, the full `npm run check` gate, dependency layout, lockstep versions, changed-file formatting, and the production Platform web build. The repository-wide format check reports many unrelated existing files; the Platform web build succeeds with large-chunk and ineffective-dynamic-import warnings.
- Fixed the Q Cafe web build so it requires local API and web ports only when the development server starts. The demo Docker build can now compile the workspace without development port settings.
- Applied the same development-only port checks to the Ecommerce web, Ecommerce storefront, and Project Manager web builds used by the demo image.

## v-1.0.86

### [v 1.0.86] 2026-10-12 7:44 am - HRMS, Docs and Himsx tenant app foundations

#### Database Changes

- Database update: Yes (permission and registry seeding only). No new business tables, DDL migrations or alterations to Core tables are introduced.
- Registered HRMS, Docs and Himsx in the existing Platform app registry and tenant activation contracts. Tenant provisioning seeds `hrms.overview.view`, `docs.overview.view` and `himsx.overview.view` only for enabled apps, with deterministic admin-role grants.
- Permission seeding is repeatable and preserves deliberately inactive permissions and role grants. Existing tenants need app registry seeding, effective Plan Access/Entitlements activation and tenant permission seeding before opening the new desks.
- Verified registry and permission seeding plus session/tenant isolation against the isolated development MariaDB tenant. Production databases were not modified.

#### App Codebase Changes

- Updated root/workspace versions, internal dependencies, the root lockfile, Windows manifests and deployment sample to lockstep version 1.0.86.
- Added separate API/Web workspaces for HRMS (Human Resource Management System), Docs (Documentation) and Himsx (Hospital Information Management System), each owning its read-only overview service, fixed API route, response contract, permission seed and frontend workspace/gateway/hooks.
- Wired all three apps into the tenant launcher, app switching, default-landing contracts, company landing-app validation, app-specific side menus and `/app/<app>/overview` and `/app/<app>/guide` routes. Desks use the existing authenticated Platform Main Layout and backend composition, without separate logins or browser token storage.
- Added live activation and permission checks, verified tenant context, safe loading/error/retry states, Overview and Getting Started pages, and production package-resolution/module-boundary registration.
- Added app-local READMEs covering purpose, implemented scope, API/desk URLs, activation, permissions, ownership and verification; updated root documentation and the project inventory.
- These are app foundations. Employee/payroll CRUD, document authoring and patient/clinical workflows remain explicitly planned modules; no business records are fabricated.
- Verified the six new API/Web module boundaries, dependency layout, workspace TypeScript/lint, production build, six focused tests, database-backed app access/activation/reseeding E2E, composed Platform E2E and launcher/desk/guide/mobile browser flows before the version update.
- Full `npm run check` is blocked by the pre-existing CRM data-source module missing `data-source.form.tsx` and `data-source.schema.ts`. This release does not add placeholder files to that unrelated module.

## v-1.0.85

### [v 1.0.85] 2026-10-11 11:34 pm - refine and added new app for qcafe

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.85.

## v-1.0.84

### [v 1.0.84] 2026-10-11 7:59 pm - update to new version

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.84.
- CRM Frappe Live now uses the same enquiry pages for create, edit, comments, job start/stop, vendor estimates, activity, and deletion, with Frappe lookup choices and record access checks. Local data behavior remains provider selected.

## v-1.0.83

### [v 1.0.83] 2026-10-11 6:38 pm - CRM enquiry, contact, and workspace refinements

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Release #83 updates all workspace packages, internal dependency ranges, the lockfile, Windows manifests, and the deployment sample to version 1.0.83.
- CRM matches enquiry phones with captured numbers and Core contacts. The new enquiry form shows five recent matches with links to each enquiry and the full list.
- The new enquiry form and API require a 10-digit mobile number.
- Enquiry lists support server-backed column search and inline filters. Escape selects the input text, clears it, then closes the filter on successive presses.
- The Enquiries breadcrumb uses its page name. The New enquiry button sits in the application header and aligns with the table.
- Core Contacts now has status and inline column filters, column visibility controls, and a white search strip like Enquiries.
- CRM report breadcrumbs follow the selected view. Date fields use compact widths, form controls share one height, and assignees have searchable lookup.
- Shared workspace dates use DD-MM-YYYY. A new formatter shows local date and time in list and detail views.
- Frappe enquiry lists now use the CRM search strip, inline column filters, status counts, column controls, mobile filter, and local table styling. The Frappe adapter applies these filters to live rows under the existing employee access rules.
- Frappe live enquiry Creator and Assigned to columns resolve employee codes to readable employee names. Missing employee records retain their codes.
- Frappe live navigation shows the All Enquiries total for view-all users without an employee mapping; personal totals remain zero until that user is mapped.
- Frappe Live enquiry rows now open a URL-backed detail page with the Local page layout, live record fields, employee names, and protected single-record reads. Browser back, forward, and direct reload keep the selected enquiry.
- The development API watcher now reloads when any app API source changes, including CRM and Frappe modules.

## v-1.0.82

### [v 1.0.82] 2026-10-10 1:28 pm - Ecommerce catalog and Techmedia computer storefront

#### Database Changes

- Database update: Yes. Added owner migrations `ecommerce.catalog.database-v1` and `ecommerce.storefront.database-v1`, ordered after Core and recorded in `migration_schema`.
- Added `ecommerce_catalog` and retained catalog activity, with unique existing Core product references, SKU/slug, merchandising fields, publication and lifecycle status. Core product/category tables and historical migration checksums remain unchanged.
- Added singleton storefront configuration, quote requests, quote item snapshots and storefront activity. Quotes persist contact consent, request idempotency and hashed client rate limits; foreign keys protect referenced catalog records.
- Tenant provisioning now seeds Ecommerce overview/catalog/storefront permissions and a disabled public store. Migration and seeding were verified on the isolated development MariaDB tenant; existing production tenants must run these migrations and permission seeds before activation.
- Imported eight actual public Techmedia products into the isolated development tenant and enabled its preview. This is a bounded development import, not live ERP synchronisation or a production data change.

#### App Codebase Changes

- Bumped root/workspace packages, internal dependency ranges, lockfile, Windows manifests and deployment sample to lockstep version 1.0.82.
- Added the tenant Ecommerce app to entitlement and app registry contracts, tenant desk navigation and launcher. Its authenticated frontend runs separately on 7030 with a non-secret session-slot handoff and the existing Platform backend on 7010.
- Added catalog management in both Platform and Ecommerce: Core lookups, search/filter/pagination, create/edit/details/activity, publication, suspend/restore and dependency-protected permanent deletion.
- Added the responsive Techmedia computer storefront on 7040 with real published products, category/search/sort, details, seller attribution and an in-memory quote basket. Bundled eight owned public reference product images; missing prices show Price on request and availability requires seller confirmation.
- Added verified-host public tenant resolution, safe public catalog projections, validated quote intake, protected staff publishing settings and a persisted quote inbox with audited status updates in both staff frontends.
- Extended the public industries/vendors/offers contract and documented future industry mapping, seller onboarding/offers, paid checkout, settlements and operations. Multiple persisted vendors and paid orders are not implemented; Techmedia.in and its DNS were not changed.
- Updated root development supervision, preflight, module-boundary checks, API source watching, production package resolution, workspace configuration, shared select disabled support and authoritative app/inventory documentation.
- Verified repository check/build, catalog and composed-runtime E2E, storefront domain/origin isolation, protected inbox, quote persistence/idempotency and Core preservation. Desktop/mobile browser checks and customer quote submission through staff inbox/status update passed.

## v-1.0.81

### [v 1.0.81] 2026-10-10 12:35 pm - Frappe enquiry sources, CRM workflows, and shared UI

#### Database Changes

- Database update: Yes (manual).
- Added tenant `frappe_data_sources` to store the selected provider for CRM enquiries. New rows default to the local provider.
- Existing tenant databases need the Frappe data source migration before the provider setting can be used. No database migration was run as part of this version update.

#### App Codebase Changes

- Bumped workspace version to 1.0.81.
- Added source-aware CRM enquiry routes and a paged live Frappe enquiry list for all, assigned, and created views.
- Show HTML-formatted enquiry titles and details as plain text in local and Frappe CRM tables without changing stored content.
- Reordered the CRM sidebar to put Contact and Enquiries after Overview, and changed the Reports menu label to List in.
- Grouped Contact 360, My Job, My Calls, and Common under a new On Research CRM sidebar menu.
- Added a tenant setting to select local or verified Frappe data for CRM enquiry lists. CRM reports still read local records and show that scope in the UI.
- Added paged Frappe enquiry preview and a queued import of unlinked enquiries with job progress, skip counts, and failure details.
- Expanded the shared UI library with workspace, agent, content, and commerce blocks, new components and themes, and matching UIUX gallery pages. Updated UI dependencies and the root lockfile.
- Updated Mermaid to 12.1.0 and pinned patched KaTeX and lodash-es transitive dependencies. Updated the demo build and API images to npm 12.2.0; the dependency audit now reports zero findings.
- Updated the Windows app manifests and deployment sample to the new lockstep version. No release tag or deployment was created.
- Passed version alignment, dependency layout, add-on, workspace TypeScript, lint, CRM and Frappe module boundaries, and 13 focused Frappe tests. The full repository check stops at the existing Zetro admin module boundary, which lacks five required frontend role files.

## v-1.0.80

### [v 1.0.80] 2026-10-06 11:52 pm - Project Manager, CRM, auditor, and UI updates

#### Database Changes

- Database update: Yes. Added Auditor client portal credentials and CRM enquiry comments, activity, jobs, estimates, and reference tables.
- Added CRM enquiry backfills for existing descriptions, activity, and List In, Status, and Priority references.
- Added Project Manager Ideas and activity tables for Super Admin idea tracking.
- Transferred Platform Registry table ownership from DevKit to Project Manager without copying records. Existing database upgrade and rollback must be verified before deployment.

#### App Codebase Changes

- Replaced the DevKit host with the Super Admin Project Manager package and kept it out of tenant app navigation.
- Added the Project Manager Ideas API and workspace with status, category, assignee, and archive actions.
- Added CRM enquiry work, comments, reference workspaces, contact lookup, and HTML comment sanitization.
- Added encrypted Auditor portal credentials with separate view, update, and reveal permissions and audit events.
- Added tenant user role choices and role assignment when creating or editing a user.
- Expanded shared UI layouts, interface topology controls, and the UIUX gallery.
- Registered the CRM and Auditor API packages in production artifact resolution and extended migration checks to DevKit sources.
- Passed workspace checks, production build, migration and deployment contracts, production API smoke, and focused credential and Project Manager tests.

### [v 1.0.80] 2026-10-06 6:21 pm - CODEXSUN identity migration and CRM contacts navigation

#### Database Changes

- Database update: Yes (manual). Deployment database names, users, service names, and volume names changed to CODEXSUN defaults. Existing deployments must map their data and credentials before upgrade; no table schema rewrite is included.
- Kept the recorded DevKit migration checksum stable so existing databases can continue through the migration ledger.

#### App Codebase Changes

- Bumped workspace version to 1.0.80.
- Renamed internal packages, environment keys, runtime identifiers, container resources, and tooling from CXApp to CODEXSUN.
- Added CRM Contacts navigation and an overview action that opens Core's existing Contact workspace and API.
- Kept Leads and Deals as planned CRM modules without adding new data screens or database tables.
- Clarified single-client and multi-tenant setup in `.env.example` and documented Core Contact ownership in the module boundaries.
- Set `CODEXSUN/codexsun` as the active repository and Windows release source.
- Added a UIUX gallery workspace for shared design foundations, layouts, workspace blocks, and components.

## v-1.0.79

### [v 1.0.79] 2026-10-01 6:20 pm - Billing export settlement, scoped openings, and statement age

#### Database Changes

- Database update: Yes (manual).
- Added separate Receipt export allocations without rewriting domestic allocation records.
- Added company/year opening balances, save activities, and explicit legacy assignment records.
- Appended new migration steps after existing migrations. Legacy contact openings remain unchanged.
- No cloud migration or production deployment was run. Restored-production upgrade verification remains pending.

#### App Codebase Changes

- Bumped workspace version to 1.0.79.
- Added mixed domestic/export Receipt allocations with currency checks, locked balance validation, and invoice edit protection.
- Added Admin-only opening balance controls to Billing Settings and scoped opening reads to statements and summaries.
- Fixed Receipt and Payment candidate restoration across party, currency, and cancelled-entry changes.
- Added the repeatable Billing regression suite and fixed premature quotation fixture database cleanup.
- Added Age after Balance in customer and supplier tables and prints, using days since bill date in the `62 d` format.
- Removed the printed ageing summary block and centered printed table headings.
- Resolved stale report updates by mapping the public report package entry to its workspace source in Vite.
- Verified Customer Statement ages in Chrome. Full export settlement, saved opening persistence, and physical print browser checks remain pending.
- Passed workspace checks, production build, dependency layout, version alignment, 13 Billing unit tests, both isolated database stages, and eight migration-contract tests.

## v-1.0.78

### [v 1.0.78] 2026-10-01 2:24 pm - Billing statement ageing and task plan

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.78.
- Added customer and supplier statement ageing at the end of printed statements, with invoice-date buckets and separate draft reservations.
- Reconciled ageing against closing balances and rejected inconsistent allocation totals or invalid contact selections.
- Saved the outstanding implementation plan in `apps/billing/README.md`; legacy opening balances remain unchanged.
- Passed workspace type checks, lint, addon and module-boundary checks. Calculation tests and three local customer statements passed; browser print and live supplier-data checks remain pending.

## v-1.0.77

### [v 1.0.77] 2026-10-01 2:21 pm - Statement ageing and outstanding task plan

#### Database Changes

- Database update: No. Legacy contact openings remain unchanged pending explicit company/FY assignment.

#### App Codebase Changes

- Saved the Billing outstanding task plan and acceptance checks in `apps/billing/README.md`.
- Added invoice-date ageing to customer and supplier statement responses and the end of their print layouts.
- Honored posted invoice allocations before applying remaining credits to undated opening balances and oldest invoices for reporting only.
- Showed 0–30, 31–60, 61–90, and 91+ day buckets, undated openings, credit balances, and separate draft reservations.
- Rejected invalid contact selections instead of silently selecting a different contact.
- Included inactive contacts and removed the 500-contact cap from statement lookups.
- Passed Billing API/web builds, lint, module boundaries, and two ageing calculation tests.
- Verified three local customer statements reconcile independently of page and From date. Live supplier-data and browser print verification remain pending.

### [v 1.0.77] 2026-10-01 2:08 pm - Billing conversion and outstanding safeguards

#### Database Changes

- Database update: No (manual).
- No schema migration or data backfill is required. Existing invoice items and amounts are not rewritten.

#### App Codebase Changes

- Bumped workspace version to 1.0.77.
- Added manual quotation linking to an existing Sales invoice. This action changes only the quotation link, not invoice items or amounts.
- Restricted invoice selection to the same company, financial year, customer, and currency. Rejected cancelled invoices and conflicting links.
- Made single and batch automatic conversion atomic with quotation locks, shared transactions, and rollback on failure.
- Rejected batch conversion when quotation addresses, tax type, currency, ledger, terms, or work order differ.
- Protected linked quotations from edits, suspension, and deletion. Protected linked invoice identity fields and deletion.
- Blocked Sales and Purchase changes while active receipt or payment allocations exist, including draft reservations.
- Reconciled CGST and SGST rounding in quotation, sales, purchase, and export sales forms, API totals, and print views.
- Included inactive contacts with outstanding balances and removed the 500-contact limit from customer and supplier summaries.
- Verified local browser linking to `SAL-0007`. Invoice header and item data remained identical before and after linking.
- Verified repeat-link safety, wrong-customer rejection, missing-invoice rejection, concurrent automatic conversion, and rollback.
- Added money, conversion, allocation, and lifecycle regression tests.
- Passed repository-wide typecheck, lint, module boundaries, add-on compatibility, version alignment, and dependency-layout checks.
- The isolated quotation E2E fixture remains blocked by its parent-table foreign key setup. Full migration and tenancy certification remain unverified.

## v-1.0.76

### [v 1.0.76] 2026-09-28 5:46 pm - Billing Admin entry access

#### Database Changes

- Database update: Yes (manual).
- Added an idempotent tenant-role migration that changes the legacy Admin label from `Tenant Administrator` to `Admin`.
- Seeded missing Admin and Super Admin Billing permissions and legacy role assignments without replacing existing role records.

#### App Codebase Changes

- Bumped workspace version to 1.0.76.
- Fixed quotation conversion by allowing Sales to allocate an automatic invoice number before requiring a final number.
- Kept the required-number validation for manual numbering and invoice edits.
- Refreshed the Sales query cache after single and batch quotation conversions.
- Verified a local live API conversion to `SAL-0003`, persisted invoice data, and duplicate-conversion rejection.
- Verified two local audit quotations consolidate into draft invoice `SAL-0004` with matching totals and links.
- Billing build, lint, boundary, and dependency checks passed. The isolated quotation E2E fixture failed its parent-table foreign key setup.
- Added one tenant-scoped Billing access contract for all Billing document modules.
- Allowed Admin and Super Admin users to edit draft, confirmed, and suspended Billing entries when they have the assigned role.
- Applied the access decision to quotation, sales, purchase, export sales, payment, and receipt list and document views.
- Returned the Billing access result in the standard API envelope so the web client displays Edit actions correctly.
- Verified live Admin access, update permission, and non-destructive delete authorization for all six Billing document modules.

## v-1.0.75

### [v 1.0.75] 2026-09-28 4:59 pm - Billing outstanding summary reports

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.75.
- Added Customer Summary and Supplier Summary reports under Billing Reports.
- Added tenant-scoped summary routes that return one non-zero outstanding balance per customer or supplier.
- Customer Summary combines opening balance, confirmed sales, confirmed export sales, and posted receipts.
- Supplier Summary combines opening balance, confirmed purchases, and posted payments.
- Added search, debit, credit, and balance totals to both summary pages.
- Added Customer Summary and Supplier Summary to the tenant desk route map and Reports navigation.
- Added Party-wise totals to quotation, sales, purchase, export sales, receipt, and payment lists.
- Updated the Billing Reports E2E check to establish the active company and financial-year scope before calling report services.
- Verified the new summary pages against the active tenant database and confirmed the report route contract.

## v-1.0.74

### [v 1.0.74] 2026-09-08 7:32 pm - Accounts and cloud deployment updates

#### Database Changes

- Database update: Yes (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.74.
- Included Accounts API and Auditor web packages in the production API and web container builds.
- Initialized `/storage/app/public` before application replacement so public tenant storage links resolve on cloud deployments.
- Added guarded updater diagnostics for failed API replacement and storage initialization after successful migrations.
- Preserved Accounts date-only and audit timestamp values as API strings with the MySQL `dateStrings` option.
- Added the direct `ioredis` Platform API dependency and aligned the Task Manager persistence contract test with the tenant migration helper names.
- Verified Accounting E2E, Platform persistence contract tests, Accounts and Platform API typechecks, dependency layout, version alignment, and whitespace checks.

## v-1.0.73

### [v 1.0.73] 2026-09-08 6:53 pm - Billing numbering and quotation conversion hardening

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.73.
- Routed quotation-to-sales conversion through Sales-owned automatic invoice reservation instead of reusing a preformatted quotation-flow number.
- Consolidated combined quotation lines only when item identity, rate, and description match; different lines remain separate and only matching quantities are added.
- Normalized persisted Billing numbering settings and next-number calculations to start at 1, preventing negative automatic numbers across sales, quotation, purchase, export sales, payment, and receipt flows.
- Verified Billing API typecheck, lint, version alignment, and whitespace checks.

## v-1.0.72

### [v 1.0.72] 2026-09-07 8:19 am - Billing navigation and list controls

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.72.
- Changed tenant sidebar and workspace switching to open each target list or default page with a fresh workspace state.
- Added a discard-changes dialog before sidebar navigation leaves an edited form.
- Removed Suspend from Quotation, Sales, Purchase, and Export Sales preview pages. Kept the existing Suspend action in each document list row menu.
- Removed Year-wise totals from all billing document lists. Bill-wise and Month-wise remain available for quotation, sales, purchase, export sales, payment, and receipt.

## v-1.0.71

### [v 1.0.71] 2026-09-05 7:32 pm - Billing list date filters and totals views

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.71.
- Added server-side From/To date filtering to quotation, sales, purchase, payment, receipt, and export sales list APIs.
- Added a separate Date range filter control to each billing document list. The filter resets pagination and keeps existing search, status, company, and financial-year scope rules.
- Added Bill-wise, Month-wise, and Year-wise table view controls to the same six lists.
- Kept Bill-wise as the normal document table. Month-wise and Year-wise replace its rows with grouped taxable, GST, amount, and document-count totals.
- Kept payment and receipt grouped columns aligned with their Amount and Allocated values.
- Removed the expanded totals panel and its duplicate table so each page shows one list table at a time.

## v-1.0.70

### [v 1.0.70] 2026-09-05 5:41 pm - version update

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.70.

## v-1.0.69

### [v 1.0.69] 2026-09-05 5:35 pm - Accounts table-prefix migration compatibility

#### Database Changes

- Database update: Yes (auto-check).
- Added Accounts migration v6 to rename every supported legacy `acc_*` table to its module-owned `accounts_*` name.
- Kept already-applied v1 migration checksums stable and added a v2 standard-column pass after the rename, so existing migration ledgers remain valid.
- Normalized migrated Accounts status columns to `VARCHAR(24)` and backfilled required standard identity and audit columns through the existing safe helper.
- The upgrade refuses to run when a legacy and current table pair coexist, preventing an implicit merge or data loss.

#### App Codebase Changes

- Bumped workspace version to 1.0.69.
- Updated Accounts repositories, seeders, and end-to-end assertions to use the `accounts_*` ownership prefix for all new and upgraded schemas.
- Extended the migration contract gate to recognize `accounts_` as a tenant-database module owner prefix.
- Preserved duplicate-key retry compatibility for legacy named database constraints during the transition.
- Verified fresh Accounts migration, a disposable legacy-prefix upgrade, Accounts typecheck and lint, migration contracts, and module boundaries.

## v-1.0.68

### [v 1.0.68] 2026-09-02 8:56 pm - Billing address reactivity and Core form input handling

#### Database Changes

- Database update: Yes (manual).
- Restored File Manager's owner database startup and repeatable migration flow.
- Kept existing `fm_*` data compatible and added migration checksum validation on restart.
- Core Company, Core Contact, and Billing Sales need no schema migration.

#### App Codebase Changes

- Bumped workspace version to 1.0.68.
- Replaced the stale GitHub Blog dependency with the exact Blog 1.0.16 npm release.
- Updated File Manager to the exact 1.1.5 npm release with lockfile integrity metadata.
- Restored File Manager API startup and shutdown beside Blog in the shared add-on host.
- Read active add-on versions from installed package metadata instead of hardcoded host values.
- Added add-on package, registry-release, and production-artifact startup checks.
- Added production package resolution so compiled APIs load compiled `@codexsun/*` packages.
- Refreshed Sales contacts on mount and window focus so saved Contact changes appear without stale lookup data.
- Preserved existing Contact addresses and address IDs when Sales updates the selected Contact.
- Re-resolved Sales billing and shipping addresses after Contact edits, including current state and location names.
- Kept Company and Contact text unchanged while users type across all form tabs.
- Trimmed Company and Contact text only during save, including nested addresses, bank accounts, communication details, and social links.
- Allowed spaces in Contact codes during typing and converted them to uppercase hyphenated codes during save.
- Added regression tests for Sales Contact reactivity and Company and Contact save-time text normalization.

## v-1.0.67

### [v 1.0.67] 2026-08-25 2:05 pm - update latest npm packages and tenant domain resolver

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.67.

## v-1.0.66

### [v 1.0.66] 2026-08-25 1:56 pm - Multi-domain tenant isolation and dependency hardening

#### Database Changes

- Database update: No (manual).
- No schema migration is required; existing tenant, domain, and session records remain compatible.

#### App Codebase Changes

- Bumped workspace version to 1.0.66.
- Updated all npm workspaces to their latest permitted dependency releases, regenerated the lockfile, and verified zero known audit vulnerabilities.
- Removed the `@codexsun/file-manager` dependency and its API host, tenant navigation, domain types, database provisioning, environment variables, and deployment configuration.
- Kept Blog operational after File Manager removal by aligning the host adapter and public media behavior with the current Blog package contract.
- Added the missing `@codexsun/framework/addons` runtime export wrapper and verified the add-on lifecycle contract.
- Preserved `app.codexsun.com` as the shared Corporate-ID domain while allowing individually verified tenant domains to authenticate without a redundant Corporate ID prompt.
- Added versioned tenant-specific JWT signing-key derivation so platform, ALTEX, COTTON, and other tenant tokens use cryptographically isolated keys.
- Continued binding authenticated sessions to the exact login hostname and retained host-only production cookies for parallel tenant sessions in one browser.
- Keyed tenant database pools and new tenant storage roots by immutable tenant UUID, with protection against cross-tenant database ownership collisions.
- Hardened add-on activation cleanup errors by preserving their underlying causes.
- Added focused tenant-key isolation tests and verified all workspace typechecks, lint tasks, production builds, dependency checks, and add-on contract tests.

## v-1.0.65

### [v 1.0.65] 2026-08-20 11:50 pm - Blog, storage, and deployment integration

#### Database Changes

- Database update: Yes (manual).
- Added a separate File Manager database, application user, and grants for its owner-managed `fm_*` tables.
- Added repeatable File Manager database provisioning for local development and container deployment.

#### App Codebase Changes

- Bumped workspace version to 1.0.65.
- Registered Blog and File Manager as tenant applications with owned routes, navigation, landing support, and workspaces.
- Pinned the composed Blog package contract to version 1.0.9.
- Made the public home-page story desk use the Blog API as its content source, with static content only for connection failures.
- Added storage-aware Blog media paths and expanded the public tenant site with reusable editorial and marketing sections.
- Resolved linked Blog and File Manager dependencies and styles through CODEXSUN's single root dependency tree.
- Added mandatory File Manager environment values, deployment validation, credential generation, and startup connectivity checks.
- Added development contract tests for linked owner-package resolution and File Manager provisioning.
- Added inline ledger-group creation to the Cash Book ledger workflow.

## v-1.0.64

### [v 1.0.64] 2026-08-20 10:42 am - Accounts security and workspace hardening

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.64.
- Enforced Accounts permissions for view, create, update, delete, lifecycle, and posting actions.
- Bound Accounts actor identity to the request scope and recorded authenticated users in accounting audit fields.
- Made journal line allocation and journal posting transaction-safe for concurrent requests.
- Added automatic `JV-######` journal numbering when the entry number is blank.
- Kept company and financial-year browser context session-scoped to prevent stale tenant context after login changes.
- Verified Accounts API/web typechecks, module boundaries, and accounting E2E flows.
- Repaired the root npm workspace installation so `@codexsun/accounts-api` and `@codexsun/accounts-web` resolve through the
  single root `node_modules` tree during Platform startup.
- Updated every external npm dependency to the latest registry release, including React 19.2, TanStack Table 9,
  Tiptap 3, BullMQ 6, Framer Motion 13, Fastify 5.12, Tauri 2.11, Vite 8.2, and the current tooling packages.
- Migrated the shared editor to the Tiptap 3 named `TextStyle` export and `setContent` options contract, and moved
  existing table consumers to TanStack Table 9's official legacy-compatibility entry point.
- Overrode the vulnerable transitive `deepmerge-ts` release with compatible version 8.0.1; `npm audit` now reports
  zero known vulnerabilities and the Mail HTML-to-text parser smoke test passes.
- Verified all workspace typechecks, lint, module boundaries, production builds, dependency layout, version
  alignment, and live Platform API startup with Accounts routes and a healthy `/health` response.

## v-1.0.63

### [v 1.0.63] 2026-08-17 5:38 pm - Desktop Top Version working

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.63.

## v-1.0.62

### [v 1.0.62] 2026-08-16 12:20 pm - Windows update feed registration

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.62.
- Replaced the timeout-prone update-feed reinstall with direct Windows package auto-update settings
  registration after the signed MSIX is installed.
- Added post-registration checks for the App Installer URI, launch-time update checks, and the
  automatic background update task.
- Kept App Installer deployment as the compatibility fallback on Windows versions that do not expose
  the direct update-settings command.
- Replaced the WinUI 3/.NET 10 host with a Tauri 2/Rust host that reuses the Platform React login and
  desk through the installed WebView2 runtime.
- Preserved the existing `%LOCALAPPDATA%\CODEXSUN\Desktop\workspace.db` projection and added Rust
  validation plus WAL-backed SQLite tests for canonical tenant identity data.
- Restricted desktop navigation to local launcher content and `https://app.codexsun.com`, kept
  Corporate ID visible and mandatory, and exposed only the safe workspace-projection bridge.
- Replaced MSIX/App Installer release assembly with a current-user NSIS installer, Windows
  Authenticode signing, Tauri updater signatures, a GitHub `latest.json` feed, checksums, install,
  uninstall, and WinUI migration scripts.
- Added a separate updater signing identity and GitHub Actions secret contract. Node.js remains the
  cloud runtime and build tool and is not shipped as a permanent desktop sidecar.
- Verified the Tauri development host in the real Windows UI: one responsive CODEXSUN window rendered
  the cloud login with Corporate ID, Email, Password, Forgot password, and Sign in controls.

## v-1.0.61

### [v 1.0.61] 2026-08-16 11:57 am - Windows framework runtime activation

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.61.
- Superseded 1.0.60 after the installed package failed before application startup with WinUI
  activation error `0x80040111`.
- Declared the Windows host as an MSIX application and changed the package to the supported
  framework-dependent Windows App SDK deployment model.
- Added the Microsoft-signed x64 Windows App Runtime package to every release, checksum manifest,
  GitHub release, App Installer dependency graph, and verified installer path.
- Restored `XamlControlsResources` so WinUI and WebView2 controls resolve their theme resources at
  runtime.
- Kept direct signed-package installation authoritative and made update-feed registration
  non-destructive when the remote GitHub feed is temporarily unavailable.

## v-1.0.60

### [v 1.0.60] 2026-08-16 11:38 am - Windows packaged runtime activation

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.60.
- Superseded the 1.0.59 Windows package after installed-runtime verification showed that it still
  stopped before the WebView2 control reached its loaded state.
- Replaced manual MSIX assembly with the supported Windows App SDK packaging target so the package
  includes the generated `resources.pri`, WinUI activation metadata, and WebView2 registration as
  one validated contract.
- Added the Windows package manifest to lockstep version updates and `check:versions`; release tags
  can no longer publish a package whose identity version differs from the workspace version.
- Changed the release installer to download and validate the signed MSIX, force an in-place update,
  register the App Installer update feed, and verify the exact installed release version.
- Replaced the packaging checksum cmdlet dependency with a direct SHA-256 implementation that works
  consistently in Windows PowerShell and GitHub Actions.

## v-1.0.59

### [v 1.0.59] 2026-08-16 11:18 am - Windows runtime launch fix

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.59.
- Fixed installed Windows startup by adding the WebView2 in-process COM registration required by
  the MSIX package contract.
- Aligned the .NET 10 host target with the current Windows 10 SDK contract while keeping Windows
  10 version 2004 as the minimum supported client version.
- Delayed WebView2 startup until its WinUI control is loaded and removed the redundant direct
  WebView2 NuGet reference supplied by the Windows App SDK.
- Added bounded local startup diagnostics under `%LOCALAPPDATA%\CODEXSUN\Desktop\startup.log` so a
  packaged launch failure can be diagnosed without exposing tenant credentials or session tokens.
- Kept the current Windows release scoped to tenant enrollment and the canonical cloud workspace;
  offline Billing runtime and synchronization remain later release gates.

## v-1.0.58

### [v 1.0.58] 2026-08-16 9:37 am - Windows installer and automatic updates

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.58.
- Added the x64 WinUI 3 and .NET 10 Windows host with WebView2, a safe tenant workspace bridge, and
  device-local SQLite enrollment state.
- Added deterministic MSIX packaging, CODEXSUN package icons, SHA-256 checksums, current-user install
  and uninstall commands, and stable App Installer release assets.
- Added a GitHub Actions release workflow for `v-<version>` tags. It rejects version/tag mismatch,
  validates the source, builds the Windows host, signs the MSIX, and publishes the release assets.
- Required the `CODEXSUN_WINDOWS_SIGNING_PFX` and `CODEXSUN_WINDOWS_SIGNING_PASSWORD` repository secrets.
  The release stops before publication if the trusted signing identity is unavailable.
- Connected App Installer launch and background update checks to stable assets under the latest
  CODEXSUN/codexsun GitHub release.
- Added a first-release installer that validates and trusts the private CODEXSUN sideloading
  certificate for the current user before it installs the automatic-update feed.
- Added the public signing certificate and install/uninstall scripts to the release assets. The
  private certificate stays only in GitHub Actions secrets.
- Added administrator elevation to trust the self-signed release certificate in the machine root
  and trusted-people stores. Windows AppX requires machine trust for this private certificate.
- Changed CI verification to match the MSIX signer thumbprint against the generated public
  certificate. This avoids an interactive root-trust prompt on the GitHub runner.
- Cleared SignTool's handled untrusted-root exit code after the signer thumbprint check so the
  private sideloading release can continue to GitHub publication.
- Made GitHub publication replace assets when a release tag is rebuilt. A failed installer fix can
  now update the same release without creating a duplicate release.
- Updated the GitHub checkout, Node.js setup, and .NET setup actions to their current runtimes. This
  removes the deprecated Node.js 20 action warning from the Windows release.
- Documented the one-tenant offline-first target, cloud control-plane boundary, release process, and
  current limitation: the Windows host is an enrollment foundation until the local runtime and
  module-owned synchronization implementations are complete.

## v-1.0.57

### [v 1.0.57] 2026-08-13 2:01 am - Development restart and deployment compatibility

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.57.
- Changed `npm run dev` to supervise the Platform API and Platform Web as separate processes.
- Restarted only the failed process after a process exit or three failed health checks.
- Kept the sibling process available during an API or web restart.
- Added a graceful child shutdown request with a three-second forced-stop fallback.
- Limited restart loops to five attempts within 30 seconds.
- Kept backend source and `.env` watching in the API process.
- Kept frontend hot reload and configuration restart behavior in Vite.
- Retained `npm run dev:api` and `npm run dev:web` for separate local development processes.
- Added contract tests for independent restarts and graceful shutdown order.
- Verified both restart directions live with HTTP 200 responses on ports 7010 and 7020.
- Documented the combined and separate local development commands.
- Added DevKit API and Web packages to the production container build and runtime images.
- Replaced the host deployment-file bind with an image-owned empty `.env` and Compose runtime variables.
- Updated the deployment smoke test to use the `tenants` table and configured default tenant identity.
- Added `mariadb-dump --no-defaults` to prevent host or container client settings from changing backups.
- Added deployment contract tests for the container environment, backup, tenant table, and tenant identity rules.

## v-1.0.56

### [v 1.0.56] 2026-08-11 6:29 pm - Application company branding

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.56.
- Used the Application Company legal name as the public home and desk brand name.
- Used the Company name when the legal name is empty.
- Connected the public tenant home, tenant desk, Billing desk, and document header to the Company logos.
- Added a tenant-resolved public logo route for the Application Company.
- Scoped new logo files by Company ID and kept a read fallback for old tenant-wide logo files.
- Fixed logo upload and read requests for HttpOnly cookie sessions.
- Checked Company access before upload and read operations.
- Disabled logo upload until the Company record exists and removed placeholder logo paths.
- Updated the tenant access test for the Company-scoped logo route.
- Documented the Storage Manager Company logo routes and storage rules.

## v-1.0.55

### [v 1.0.55] 2026-08-07 9:46 am - Super Admin session recovery

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.55.
- Added the public `/sa/refresh` route for recovery when an invalid tenant session holds the Super Admin desk loader.
- Added `/auth/session/reset` to revoke the current server session and clear current and legacy authentication cookies.
- Cleared browser tenant context and query caches before redirecting to a fresh Super Admin login.
- Allowed public login and reset routes to continue without tenant validation after the server validates the base session claims.
- Added focused tests for the public reset path and the refreshed-session login message.
- Rejected partial numeric prefixes in tenant, tenant-domain, and version parsing to prevent wrong-record selection.
- Changed tenant-domain update and verification routes to use public UUIDs instead of internal numeric IDs.
- Documented Testing Lab software as a separate tenant-activated add-on that uses Billing only through public contracts.

## v-1.0.54

### [v 1.0.54] 2026-08-05 6:45 pm - GST statement tabs and separate printing

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.54.
- Moved the monthly GST filing fields into a dedicated `Filed details` tab, keeping the Sales,
  Purchase, HSN, and reconciliation reports together under the `GST statement` tab.
- Added independent Sales and Purchase print actions that render only the selected document and HSN
  report while retaining the combined GST Statement print option.
- Separated Sales and Purchase HSN-wise reports into their own card row and stretched both document
  report panels to the same height for a stable two-column comparison.
- Added reversible row visibility checkboxes to both document reports, recalculated the moved bottom
  totals from visible rows only, and aligned scoped printing with the visible document selection.
- Fixed the shared print-sheet root so Sales and Purchase GST print actions render their selected
  report tables instead of exposing the embedded print stylesheet as page text.

## v-1.0.53

### [v 1.0.53] 2026-08-05 6:10 pm - Mail settings and fallback reliability

#### Database Changes

- Database update: Yes (`billing.reports.gst-statement.filing-v1`).
- Added company, financial-year, year, and month-scoped GST filing persistence for the opening GST
  balance plus GSTR-1 and GSTR-3B ARN numbers and filed dates.

#### App Codebase Changes

- Bumped workspace version to 1.0.53.
- Reorganized the tenant Mail settings dialog into shared spring-animated Outbound, Inbound, and
  Test delivery tabs while preserving entered values across tab changes and keeping Save/Cancel
  controls fixed in the dialog footer.
- Fixed stale environment SMTP fallback configuration during local development by making the API
  watcher observe the root `.env` file and letting each restarted API child reload current mail
  credentials instead of inheriting the watcher's original `.env` snapshot.
- Confirmed the normal Mail queue fallback flow against Hostinger SMTP: the controlled delivery
  completed on its first attempt through the environment provider and persisted the returned
  provider message ID on the sent Mail record.
- Reworked GST Statement into a monthly filing workspace with month/year controls, side-by-side
  Sales/Outward and Purchase/Inward document registers, contact GSTIN, mixed tax-rate visibility,
  invoice totals, and separate HSN/product summaries derived from confirmed Billing documents.
- Added the GST reconciliation formula `opening balance + Sales GST - Purchase GST = balance`,
  editable filed-return details, and a filing-oriented print layout containing both document and HSN
  reports plus GSTR-1/GSTR-3B ARN status.

## v-1.0.52

### [v 1.0.52] 2026-08-05 5:30 pm - Billing activity separator

#### Database Changes

- Database update: Yes (`mail.hostinger-provider-v1`).
- Added encrypted Hostinger Mail API token and mailbox resource ID fields to tenant Mail settings.

#### App Codebase Changes

- Bumped workspace version to 1.0.52.
- Replaced the malformed activity timeline separator with `@` in Sales, Quotation, Purchase, and
  Export Sales show pages.
- Added Hostinger Mail API as a tenant-selectable outbound provider, including encrypted token
  persistence, mailbox resource selection, queued delivery, and Base64 PDF attachment support while
  retaining SMTP and environment fallback behavior.

## v-1.0.51

### [v 1.0.51] 2026-08-01 11:22 am - Independent compliance and normal text entry

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.51.
- Made Sales E-invoice and E-way behavior independent: Billing settings now support either feature
  alone, each form section has its own persisted Clear operation, and clearing one compliance record
  leaves the other untouched.
- Tightened Sales print visibility so acknowledgement fields require a non-empty IRN and E-way date
  requires a non-empty E-way bill number; E-way-only documents print without enabling E-invoice.
- Expanded focused MariaDB coverage for E-invoice-only and E-way-only persistence, independent clear
  endpoints, database-row removal, and the print visibility contract.
- Restored normal trailing-space typing and caret behavior for Company and Contact legal names,
  second address lines, and bank holder names while trimming those values only when saving.
- Hydrated contact GSTIN into Quotation, Sales, Purchase, and Export Sales document responses and
  rendered it in every Bill-to and Ship-to show/print preview, with real MariaDB coverage across all
  four document types, and tightened the GSTIN/UIN and State Name label-to-value spacing.
- Added each product's GST percentage to the Quotation, Sales, Purchase, and Export Sales
  autocomplete dropdown labels while preserving the clean product name when selected and saved.
- Replaced the simulated Billing Entry tools PDF toast with real multi-copy PDF generation,
  tenant-scoped Queue Management tracking, browser download, Mail-queued PDF attachments, and a
  new-tab WhatsApp handoff that downloads the PDF and clearly requires the user to attach and send it.

## v-1.0.50

### [v 1.0.50] 2026-08-01 10:50 am - Persist Sales compliance drafts

#### Database Changes

- Database update: Yes (`billing.sales.compliance-drafts-v1`).
- Added a forward, tenant-scoped Billing migration that allows draft E-invoice IRNs and E-way
  bill numbers/dates to remain empty while preserving generated-document uniqueness, and stores
  E-way transporter name and GST snapshots for reliable reloads.

#### App Codebase Changes

- Bumped workspace version to 1.0.50.
- Persisted E-invoice and E-way draft details inside the same transaction as normal Sale create and
  update operations, preventing transport, vehicle, date, notes, acknowledgement, IRN, and signed-QR
  input from disappearing after Save or reload.
- Added focused MariaDB persistence coverage for compliance draft creation, direct table rows,
  editing, API reload, and Billing database connection restart through
  `npm run test:e2e:sales-compliance`.

## v-1.0.49

### [v 1.0.49] 2026-08-01 10:12 am - Billing adaptive document printing

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.49.
- Locked quotation, sales, purchase, and export-sales item prints to one Billing-owned adaptive pagination contract: 13-15 items retain the 12-plus-remainder layout, larger documents balance 12-15 items on the first page, middle pages hold up to 12, and continuation/final pages retain at least 4 items whenever redistribution is possible.
- Standardized the four print item tables with unrestricted product/description wrapping, indented valid Colour/Size details, three-line item slots, missing-item-only line reservations, darker table borders, calculated page and carried-forward totals, and explicit continuation markers.
- Expanded receiver and authorised-signature space, kept compact A4 totals and footers, and made Sales e-invoice print metadata render persisted IRN, acknowledgement, and E-Way Bill values only when each value is present.

## v-1.0.48

### [v 1.0.48] 2026-08-01 7:21 am - Billing quotation and sales list cleanup

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.48.
- Removed the contact-filter card from the Billing Quotation list while preserving quotation
  search, status filtering, column controls, row selection, invoice generation, totals, and
  pagination.
- Removed the unused select-all and per-row multi-select controls from the Billing Sales list,
  including their local selection state and handlers, while preserving print controls, row actions,
  totals, and pagination.
- Removed the supplier contact-filter card from the Billing Purchase list while preserving purchase
  search, status filtering, multi-select invoice generation, totals, and pagination.
- Added a persisted Billing Settings Work order layout toggle with backward-compatible defaults and conditional work-order controls in quotation, sales, and purchase forms. Receipt and payment currently have no work-order field/API contract to toggle.
- Ported Billing Stack show/print enhancements into CODEXSUN quotation, sales, and purchase: configurable document titles, shared letterhead headers, address-mode layouts, bank details, amount-in-words, signature/footer sections, compact totals, richer feedback, and sales e-invoice print details.
- Tuned quotation, sales, and purchase print item tables with product/description on the first Particulars line, valid Colour/Size values on a dedicated second line, wider particulars columns, darker borders, balanced item-row spacing with a larger first-row top buffer, tighter blank rows, and compact totals and footer sections.
- Reworked quotation, sales, and purchase A4 pagination to fit up to 20 items on the first page and 12 items on each continuation page, retain the 12-row blank reservation for short final pages, and prevent signatures or jurisdiction footers from spilling onto an extra sheet.
- Added calculated page totals, cumulative carried-forward totals, and explicit "To be continued" markers to multi-page Billing prints; removed duplicate Colour/Size columns because valid values are already rendered in the wider Particulars column.
- Updated Sales e-invoice print details to render persisted IRN, Ack No., Ack Date, E-Way Bill No., and E-Way Bill Date independently, omitting both the label and value whenever a field is empty.
- Standardized quotation, sales, and purchase print item slots to a three-line reserved height across the 12-row final-page pattern, including matching dummy rows, and indented Colour/Size beneath the primary particulars line.
- Refined Billing print pagination with unrestricted particulars wrapping, Colour/Size on the following indented line, line-budgeted placeholders only for missing item slots, and a taller receiver/authorised-signature area instead of trailing dummy lines. Invoices with 13-15 items retain the 12-plus-remainder split; larger invoices balance 12-15 items on the first page, up to 12 on middle pages, and at least 4 on continuation/final pages whenever the document size permits.
- Locked Export Sales item printing to the same adaptive Billing pattern as quotation, sales, and purchase, including balanced page sizes, wider wrapping particulars, indented Colour/Size, line-budgeted missing slots, calculated page/carried-forward totals, and continuation markers.

## v-1.0.47

### [v 1.0.47] 2026-07-31 5:58 pm - Harden browser and module session handling

#### Database Changes

- Database update: No (manual).
- Replaced per-record Billing list hydration with module-owned batch reads for quotation, sales,
  purchase, export sales, payment, and receipt documents. A 100-row Sales or Export Sales page now
  uses five bounded statements instead of up to 302 queued statements, without changing schemas or
  response contracts.

#### App Codebase Changes

- Bumped the synchronized workspace version to 1.0.47.
- Hardened browser session expiry handling so only the explicit `AUTH_SESSION_EXPIRED` contract
  clears local context and redirects to login; domain, permission, validation, and upstream lookup
  authorization failures remain visible without destroying a valid session.
- Made active encrypted session cookies take precedence over retired browser bearer tokens while
  preserving bearer JWT propagation for authenticated loopback module-to-Core requests.
- Standardized missing and invalid Framework authentication as `AUTH_SESSION_EXPIRED`, allowing
  ordinary protected routes—not only `/auth/session`—to recover consistently when a cookie expires
  or disappears.
- Removed Mail's legacy local-storage JWT usage, restored session-scoped tenant context reads, and
  enabled credentialed cookie requests for the Mail API.
- Added focused regression coverage for cookie-versus-bearer selection, trusted loopback bearer
  forwarding, explicit expiry classification, and non-session 401 preservation.
- Confirmed fresh login clears browser session context, replaces every current or legacy session
  cookie, revokes the previously presented server session, and added lifecycle coverage proving the
  retired cookie is rejected while the new cookie remains authenticated.
- Added the Cloudflare MariaDB tunnel runbook for server routing, new Windows client installation,
  SQLyog configuration, verification, reconnection, and troubleshooting.
- Hardened CODEXSUN Docker updates with source-to-image version matching, an exclusive host lock,
  explicit migration compatibility approval, dirty-worktree control, disk-space preflight,
  SHA-256 backup verification and retention, plus per-attempt deployment audit metadata.
- Debounced and cancellation-wired all Billing transaction searches, ran page and count reads in
  parallel, retained prior page data during refresh, and removed the forced Billing-settings reload
  from New Sale and New Export Sale.
- Added bounded React Query freshness and cache lifetimes, disabled expensive focus-triggered
  refetches, and assigned longer freshness to tenant runtime, company/year context, and Billing
  settings while keeping mutation invalidation authoritative.
- Added idle Billing workspace preloading and immutable hashed-asset caching so first navigation pays
  less chunk latency while visible layouts and module flows remain unchanged.
- Added an authenticated lightweight route for automatic quotation, sales, purchase, and export
  sales printing. Hidden print frames now restore trusted session company/year context and load only
  the owning Billing print module instead of booting the complete tenant desk; ordinary print-page
  navigation and printed output remain unchanged.
- Consolidated repeated quotation, sales, purchase, and export-sales master reads into Billing-owned,
  company-scoped lookup cache keys with bounded freshness. Switching forms now reuses matching live
  contacts, products, work orders, address data, and product masters while existing create/edit
  refetches keep the shared cache authoritative and prevent cross-company reuse. Lookup requests
  also wait for the trusted company context instead of issuing an initial context-free request.
- Mounted the shared global loader before the initial runtime-configuration request and contained
  lazy tenant workspace fallbacks inside the existing desk shell. Sidebar and record navigation now
  uses React transitions so a late module chunk no longer replaces an already-visible page with a
  full-screen loader.

## v-1.0.46

### [v 1.0.46] 2026-07-31 2:26 pm - Manual Tenant Database Lifecycle and User Manager

#### Database Changes

- Removed automatic tenant database provisioning and re-installation from tenant create and edit.
  Tenant identity, connection settings, domains, enabled applications, and portal content now save
  to the Platform database independently of the tenant database lifecycle.
- Made tenant database inspection operator-driven. Opening a tenant no longer connects, installs,
  or migrates its database; Check connection, New setup, Re-install, and Safe migrate remain
  explicit manual actions.
- Added exact offline connection details plus applied migration versions to tenant database status
  and show pages, and registered the tenant Task Manager migration through its module-owned ledger.
- Database update: Manual only. Existing installed tenants can use Safe migrate; uninstalled tenants
  require New setup when the operator is ready.

#### App Codebase Changes

- Bumped the synchronized workspace version to 1.0.46.
- Added Super Admin Tenant Setup -> User Manager navigation with an explicit tenant selector,
  isolated tenant-user listing, create and edit forms, lifecycle controls, validation, and
  persistence coverage against the selected tenant database.
- Replaced generic tenant-user database failures with actionable setup or credential-reference
  errors, and disabled automatic query retries for unavailable tenant databases.
- Fixed production company saves with an industry selected by replacing the domain-sensitive
  loopback HTTP validation call with an injected Platform-owned industry lookup contract.
- Fixed New Sale redirecting valid users to session-expired login: authenticated module-to-Core
  lookup calls over the local Platform API are now recognized as trusted loopback bearer requests,
  while the browser clears login state only for the explicit `AUTH_SESSION_EXPIRED` response code.
- Confirmed tenant logins are independent session records, so signing in on another computer does
  not revoke an existing computer's session.
- Changed absent company logo variants from filesystem-backed 500 errors to the existing
  `COMPANY_LOGO_NOT_FOUND` 404 response understood by the company form.
- Added inline progress spinners and processing labels to New setup and Re-install controls.
- Migrated Platform and shared UI charts to Recharts 3, added the compatible React dependency, and
  updated tooltip and legend typings to the Recharts 3 API.
- Expanded tenant database and access regression coverage for manual provisioning, migration state,
  cross-tenant isolation, Super Admin user create/edit persistence, cleanup, and unavailable
  database error reporting.

## v-1.0.45

### [v 1.0.45] 2026-07-31 8:54 am - Tenant Task Manager Live Persistence

#### Database Changes

- Added module-owned Task Manager tables, indexes, lookup defaults, and
  rollback wiring to enabled tenant databases while preserving the separate
  Super Admin scope in the Platform database.
- Added the protected `platform.task-manager.access` tenant permission and
  tenant-specific scope keys so todos and lookups remain isolated even inside
  their owning database.
- Enabled and provisioned Task Manager for the CODEXSUN tenant in
  `codexsun_db`; the live tenant now has active module settings, both Task
  Manager tables, and all 14 default lookup records.
- Database update: Yes (tenant migration and seed required).

#### App Codebase Changes

- Bumped workspace version to 1.0.45.
- Added Task Manager to the tenant app registry, breadcrumb app switcher,
  landing choices, and tenant desk navigation with Overview and Todo entries.
- Routed the shared Task Manager workspace through desk-aware API calls and
  database-injected services, with enabled-module and role-permission checks
  for tenant requests.
- Added request validation plus live regression coverage for platform and
  tenant restart persistence, two-database isolation, default seeding, and
  rollback cleanup.

## v-1.0.44

### [v 1.0.44] 2026-07-30 11:29 pm - DevKit Platform Registry Consolidation

#### Database Changes

- Migrated Super Admin Task Manager todos and lookup values from runtime JSON
  persistence to module-owned `task_manager_todos` and
  `task_manager_lookups` Platform MariaDB tables with integer identities,
  8-character UUIDs, audit fields, indexes, and repeatable default lookup
  seeding. Existing Task Manager JSON files are imported idempotently as
  read-only legacy input.
- Retired the process-memory queue backend. Existing `memory` runtime settings
  and environment values safely normalize to the durable database queue, while
  BullMQ with Redis remains available for distributed processing.
- Replaced Billing's process-memory domain-event and queue arrays with
  tenant-owned `billing_domain_events` and `billing_outbox_jobs` tables for
  Quotation, Purchase, Payment, and Dashboard runtime records.
- Moved sign-in throttling counters to the Platform
  `auth_login_attempts` table using hashed attempt keys so limits survive
  restarts and apply consistently across API processes.
- Database update: Yes (manual).
- Added forward migrations that preserve existing registry data while renaming
  retained tables to the `devkit_platform_registry_*` ownership namespace.
- Added one-time cleanup of retired DevKit project, issue-roadmap, planning,
  task, synchronization, attachment, and legacy user tables in master and
  enabled tenant databases.

#### App Codebase Changes

- Restricted DevKit to the Super Admin desk and master database. Tenant desks
  no longer expose DevKit in the breadcrumb app switcher, landing choices,
  routes, app assignments, permissions, migrations, or seeds; direct tenant
  API access now fails with a Super Admin-only response while the Super Admin
  Platform Registry remains available.
- Replaced Task Manager JSON stores with repository and service paths backed by
  the Platform database, and added persistence regression coverage that
  prevents JSON writes or the in-memory queue backend from returning.
- Classified remaining maps and browser storage as transient connection pools,
  migration guards, request de-duplication, UI selections, or non-authoritative
  client context; these are intentionally not business persistence.
- Bumped workspace version to 1.0.44.
- Released DevKit as a Platform Registry-only application across its API,
  frontend workspace, Platform navigation, package exports, and production
  assets.
- Removed the Overview, Projects, Issue Roadmap, Tasks, Whiteboards, GitHub,
  Design System, Sync, and Work Automation modules, routes, dependencies,
  environment settings, seeds, and empty directories.
- Updated module-boundary enforcement, repository inventory, and composed E2E
  coverage; retired DevKit endpoints are explicitly verified as unavailable.
- Changed Quotation, Sales, Purchase, Receipt, Payment, and Export Sales
  quantity, price/rate, amount, allocation, adjustment, and round-off controls
  to decimal-friendly text inputs. Editable text is preserved while typing,
  owner API routes parse finite decimals before service processing, and
  regression tests prevent native number boxes and keystroke coercion from
  returning.
- Fixed Quotation, Sales, Purchase, and Export Sales product popups so inline
  Product Category, HSN Code, Unit, and GST Tax creation reaches the correct
  Core owner contract, refreshes and selects the persisted option, and works
  during both product creation and editing. Product and address popups now show
  save/API failures in a compact top banner, mark mandatory fields, and use red
  invalid rings without per-field helper text. Refreshed and newly created
  product lookup options now share the same persisted ID, preventing duplicate
  dropdown rows while retaining Core uniqueness enforcement. Successful
  product creation or editing from a Billing document now invalidates Core's
  public Product Master query so the master list is current on navigation.
- Fixed Billing product editing for Core's persisted no-tax sentinel. Product
  popup writes now submit only Core-owned Product fields, so the sentinel's
  internal `-1` tax rate is not rejected by Billing validation, and dropdowns
  display its `-` description instead of `-1%`.
- Canonicalized newly created Core GST tax records to store only their numeric
  rate (for example `34`) while Billing product popups and Product Master
  consistently render the presentation label as `34%`. Existing default tax
  seed descriptions are normalized repeatably, and the protected no-tax
  sentinel continues to display as `-`.
- Made Work Order code mandatory in Quotation, Sales, Purchase, and Export
  Sales quick-create and edit popups. Missing names or codes now keep the popup
  open, show a compact top error banner, and highlight the invalid controls
  without adding per-field helper text. Invalid inputs retain their red border
  and focus ring while empty, then return to the normal input style as soon as
  the user enters a valid value.

## v-1.0.43

### [v 1.0.43] 2026-07-30 11:21 pm - DevKit Platform Registry Consolidation

#### Database Changes

- Database update: Yes.
- Preserved registry hierarchy and audit data while renaming its tables to the
  `devkit_platform_registry_*` ownership namespace.
- Added a one-time cleanup migration that removes retired DevKit project,
  attachment, planning, task, sync, and legacy user tables from master and
  enabled tenant databases.

#### App Codebase Changes

- Reduced DevKit to the Platform Registry frontend workspace and backend module.
- Removed Overview, Projects, Issue Roadmap, Tasks, Whiteboards, GitHub,
  Design System, synchronization, and work-automation UI, routes, modules,
  assets, dependencies, environment settings, and empty directories.
- Updated Platform composition, module-boundary enforcement, documentation,
  production asset copying, and composed E2E coverage for the registry-only
  contract.

### [v 1.0.43] 2026-07-30 10:59 am - Production Environment and Deployment Hardening

#### Database Changes

- Database update: Yes.
- Made migration checksums build-mode stable across source execution and compiled
  production containers, and expanded the migration contract suite to reject
  duplicate SQL columns and ambiguous repeatable-seed updates.
- Added forward migration steps that install database-generated 8-character
  UUID defaults on existing Platform, tenant-runtime, Core, Billing, and Mail
  tables without replacing persisted identifiers.
- Corrected duplicate company social-link and Billing settings column
  declarations and qualified the contact seed's no-op duplicate update for
  repeatable MariaDB execution.
- Kept the default company, financial year, and landing application in the
  tenant database's singleton `core_default_company_settings` record so startup
  selection survives application and infrastructure restarts.

#### App Codebase Changes

- Bumped workspace version to 1.0.43.
- Made the root `.env` the mandatory deployment source for application ports,
  MariaDB, Redis, File Browser, JWT/session keys, administrator accounts, tenant
  defaults, image versions, and public runtime settings; removed deployment
  fallbacks and the secondary deploy-environment contract.
- Added interactive credential-preserving environment configuration,
  non-interactive infrastructure-secret generation, strict production
  validation, and startup connectivity smoke tests for MariaDB and Redis.
- Grouped the root `.env` and `.env.example` into readable runtime, database,
  queue, mail, tenant, authentication, user, storage, tooling, and deployment
  sections; made the configuration writer preserve those comments and blank
  lines on every update instead of flattening the environment file.
- Reduced Platform listener configuration to API port, Web port, and canonical
  Web origin; runtime code now derives bind addresses, the internal API URL,
  Vite allowed hosts, proxy targets, and local CORS aliases instead of requiring
  five duplicate host/URL environment values.
- Unified landing-application reads and writes through Default Company so
  Tenant App Connections, the tenant Landing Desk, and Default Company editing
  update the same persisted startup record.
- Updated tenant login/session startup to resolve the company, financial year,
  enabled applications, and landing application from the configured Default
  Company instead of tenant settings.
- Hardened Compose, Dockerfiles, setup, migration, cleanup, smoke-test, and
  database-user tooling to fail when required environment input is absent and
  to preserve named MariaDB, Redis, media, and application-storage volumes.
- Added root `setup.sh` and guarded `update.sh` deployment entrypoints in the
  TechMedia operator style, including read-only update checks, Compose ownership
  refusal, pre-migration MariaDB backup, application-only replacement, complete
  smoke verification, and automatic API/Web image rollback on failure.
- Made root `setup.sh` run environment configuration and deployment validation
  automatically, with a Docker Node fallback so Linux deployment hosts do not
  require a host-level Node.js or npm installation.
- Consolidated the complete installer and environment configuration workflow
  into the repository-root `setup.sh`; removed the nested
  `.container/setup.sh` entrypoint and updated cleanup and recovery guidance to
  call the root installer.
- Added an optional root setup cleanup menu with application-only,
  data-preserving runtime, and complete local-data scopes; full cleanup covers
  MariaDB, Redis, File Browser, application storage, named volumes, and the
  CODEXSUN network, while BuildKit pruning remains a separate explicit choice.
- Made deployment configuration apply the required production, container
  MariaDB, Redis queue, and single-tenant seed selections before validation so
  root setup does not depend on manual development-to-container `.env` edits.
- Split local development `.env` from private
  `.container/deploy.env`, added a shareable `deploy.env.sample`, and rewired
  Compose, setup, update, cleanup, migrations, and smoke tooling to the
  deployment file so local and container runtimes can operate in parallel.
- Added separate setup confirmations for copying compatible non-secret local
  values and reusing local credentials; deployment ports, database topology,
  container resources, and existing deployment secrets remain independently
  owned.
- Made the root setup dialogue show exact current non-secret deployment values
  instead of hashes, label existing credentials without printing them, and run
  the environment configurator directly through Node.js without npm wrapper
  noise.
- Replaced the session-expired card inside tenant, administrator, and super
  administrator login forms with one compact yellow message badge below the
  shared login card.
- Renamed the deployed application containers from
  `codexsun-platform-api`/`codexsun-platform-web` to `codexsun-api`/`codexsun-web` and
  updated the internal API hostname, cleanup workflow, and deployment
  documentation.
- Verified a production build and repeat deployment with persistent
  MariaDB/Redis/File Browser data, authenticated Super Admin, software-admin,
  tenant-admin, default-tenant-admin, and File Browser access, plus live API,
  web, media, database, tenant-module, and internal container-connectivity
  smoke checks.

## v-1.0.42

### [v 1.0.42] 2026-07-21 11:52 pm - updated dockers

#### Database Changes

- Database update: Yes.
- Consolidated the current fresh-install schema into module-owned Platform,
  tenant-runtime, Core, Billing, and Mail batch-1 migrations.
- Added the shared `app_migration_batches` version/checksum/status ledger,
  advisory locking, bounded batch execution, checksum validation, retry state,
  guarded rollback, and reversible legacy table-prefix planning.
- Standardized fresh tables on integer auto-increment IDs, 8-character UUIDs,
  status and audit timestamps, `created_by`, owner prefixes, and explicit
  foreign-key delete policies.
- Removed destructive baseline table/column drops and moved compatibility data
  updates out of repeatable seeders.
- Made default seeders additive so existing tenant-admin passwords, tenant
  module JSON, and edited Core lookup data are preserved.
- Added migration contract tests for schema standards, destructive-DDL
  exclusions, checksum changes, and forward/backward prefix compatibility.

#### App Codebase Changes

- Bumped workspace version to 1.0.42.
- Redirected expired browser sessions from every protected Platform, Core,
  Billing, and Mail screen to the correct tenant, staff, or Super Admin login
  route, cleared cached session context, and added a session-expired login
  banner without redirecting failed login or other public requests.

## v-1.0.41

### [v 1.0.41] 2026-07-21 10:58 pm - Platform Runtime Resilience and Browser Compatibility

#### Database Changes

- Database update: No (runtime transport, process supervision, deployment routing, browser compatibility, tests, and documentation only).

#### App Codebase Changes

- Fixed local login CORS by deriving exact `localhost:7020` and `127.0.0.1:7020` development origins from the canonical Platform Web configuration while retaining exact-origin production enforcement.
- Changed Platform browser API traffic to the same-origin `/api/platform` route and added matching Vite and nginx proxies so live cloud bundles never embed loopback or container-only API addresses.
- Separated development dependency installation from production Web compilation so deployed Vite bundles use production mode.
- Added API-first readiness gates and continuous API/Web health supervision to the combined root `dev` runtime while retaining `dev:api` for backend-only development and `dev:web` for frontend-only development.
- Made the separate `dev:web` startup wait for the configured Platform API health endpoint before launching Vite, preventing transient `ECONNREFUSED` proxy failures when frontend and backend commands start concurrently.
- Normalized empty and non-JSON gateway responses in the Platform browser transport so upstream failures produce actionable availability messages instead of `Unexpected end of JSON input`.
- Added the `Permissions-Policy: unload=*` compatibility response header in Vite and nginx for Chromium browser-extension listeners, including injected frames.
- Added trusted login-preflight and rejected-origin E2E coverage, and verified composed runtime startup, same-origin login routing, browser response headers, module boundaries, dependency layout, TypeScript, lint, and production builds.
- Bumped workspace version to 1.0.41.

## v-1.0.40

### [v 1.0.40] 2026-07-21 1:46 pm - Environment Contract Consolidation

#### Database Changes

- Database update: No (runtime configuration, application wiring, deployment, and documentation changes only).

#### App Codebase Changes

- Consolidated the development and deployment environment contracts so each runtime feature has one canonical variable.
- Removed the duplicate `API_HOST`, `PLATFORM_WEB_ORIGINS`, `VITE_PLATFORM_API_URL`, `VITE_TENANT_NAME`, and `VITE_DEV_AUTO_TENANT_LOGIN` environment entries.
- Made `PLATFORM_API_URL` the single internal API endpoint consumed by the Platform server and Vite proxy; browser builds now use the fixed same-origin `/api/platform` route.
- Reused `DEFAULT_TENANT_NAME` and `DEV_AUTO_TENANT_LOGIN` for browser build configuration instead of maintaining frontend-only aliases.
- Reduced the primary runtime block to `NODE_ENV`, `PLATFORM_API_PORT`, `PLATFORM_WEB_PORT`, `PLATFORM_WEB_ORIGIN`, and `PLATFORM_API_URL`.
- Derived local CORS compatibility for equivalent `localhost` and `127.0.0.1` origins from the single configured Web origin.
- Added exact login-preflight coverage, kept unconfigured origins blocked, and routed container/browser API traffic through same-origin nginx and Vite proxies so cloud bundles never embed loopback API addresses.
- Separated development dependency installation from production Vite compilation so live bundles report production mode while retaining all build tooling.
- Added an `unload` compatibility permissions policy to Platform Vite and nginx responses so legacy browser-extension listeners, including injected frames, do not emit Chromium policy violations during the staged deprecation.
- Sequenced the consolidated development startup behind API and Web health gates, made legacy `dev:api` and `dev:web` commands start the complete Platform runtime, and stopped the stack when either owned process exits.
- Normalized empty and non-JSON gateway responses in the Platform browser transport so an unavailable API produces an actionable error instead of an `Unexpected end of JSON input` exception.
- Required published application and infrastructure ports, public URLs, and GSP endpoints to come from deployment environment input while retaining fixed private container implementation ports.
- Updated container build arguments, Compose wiring, preflight startup, smoke checks, examples, and deployment documentation for the consolidated contract.
- Bumped workspace version to 1.0.40.

## v-1.0.39

### [v 1.0.39] 2026-07-21 10:18 am - Unified Platform Runtime and Package Manifests

#### Database Changes

- Database update: No (runtime, tooling, packaging, deployment, and documentation changes only).
- Enabled Billing and Mail by default for newly created tenants and reconciled default-tenant seeds, while retaining explicit per-tenant opt-out controls.

#### App Codebase Changes

- Consolidated application startup into the single root `npm run dev` command, which launches only the Platform API on
  port 7010 and Platform Web on port 7020.
- Converted Core, Billing, and Mail into Platform-composed API/web packages while retaining Framework and UI as shared
  infrastructure packages with explicit ownership boundaries.
- Removed standalone Core and Billing server/Vite entrypoints, obsolete ports 7030 through 7060, the domain gateway,
  product-specific process controls, and stale development environment variables.
- Reduced container, hosted nginx, systemd, CI, smoke-test, and product-stack configuration to the composed Platform API
  and Platform Web deployment.
- Consolidated shared compiler, lint, build, type, Vite, Tailwind, and operational tooling into the root `package.json`;
  workspace manifests now retain only package checks and direct runtime dependency contracts.
- Moved database operations and the sole development command to the root manifest, removed unused dependency declarations,
  transferred UI-owned fonts and editor/style dependencies to `@codexsun/ui`, and regenerated the single root lockfile.
- Added composed Platform runtime E2E coverage and updated persistence and live-mass harnesses to consume the Platform
  composition root instead of standalone product applications.
- Consolidated Platform, tenant runtime, Core, Billing, and Mail migration/seed orchestration into one deterministic
  dependency order while retaining every SQL migration and seeder inside its owning module.
- Split tenant migration from seeding, repaired root database commands that referenced removed workspace scripts, and
  made tenant setup/reinstall run all selected migrations before repeatable seeders.
- Added per-leaf Core migration ledger entries, executed every Billing module seeder, included Platform lifecycle
  policies previously skipped by master bootstrap, and expanded reinstall E2E coverage to verify Mail.
- Updated startup, deployment, app-orchestration, package-management, inventory, and UI verification documentation to
  describe the two-port composed Platform runtime.
- Validated the production container stack locally with Platform API/Web, MariaDB, Redis, Media, the default `codexsun`
  tenant, Billing, Mail, and all administrator login paths; expanded the reusable smoke test to cover these dependencies.
- Consolidated deploy environment preparation for database, super-admin, software-admin, tenant-admin, default tenant,
  and Mail fallback values, while keeping the generated credential file ignored and persistent.
- Fixed the container migration-state command after root manifest consolidation and upgraded jsPDF and Nodemailer to
  patched releases with a zero-vulnerability production dependency audit.
- Added a separate pre-start container runtime refresh command that synchronizes Node and npm from the development
  workspace, pulls and verifies the matching base image, and installs the same npm release in the API runtime image.
- Hardened PDF capture with a bounded render size and disabled Nodemailer filesystem/URL content access while retaining
  the latest compatible jsPDF and Nodemailer releases.
- Added an explicit multi-origin CORS allowlist so container Web access through both `localhost` and `127.0.0.1` can
  authenticate against the Platform API while production deployments retain an exact origin list.
- Bumped workspace version to 1.0.39.

## v-1.0.38

### [v 1.0.38] 2026-07-21 9:26 am - Repository Application Cleanup

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Removed the complete B2B Connect and Ecommerce application boundaries, including API/web workspaces, public pages,
  authentication and profile modules, container projects, deployment composition, routes, menus, environment values,
  package dependencies, generated output, and active documentation references.
- Removed the complete Data Bridge and Kitchen Serve application boundaries, including their migration/reconciliation
  and service-order modules, Platform desk/orchestration integration, development and preflight services, runtime ports,
  deployment stubs, workspace packages, local JSON runtime stores, generated artifacts, and active documentation.
- Removed the complete Sites application boundary and all CODEXSUN, LogicX, and Tech Media client implementations,
  media assets, Vite workspace, development/domain routes, product-stack contract, static container project, hosted
  publishing configuration, environment values, release tags, build output, and active architecture references.
- Reduced the active repository to Platform, Core, Billing, and Mail with eleven npm workspaces, one Billing product
  release contract, and one container deployment composed from Billing plus the persistent MariaDB, Redis, and Media
  infrastructure layer.
- Cleaned root scripts, module-boundary registration, app orchestration, package manifests, the root lockfile, environment
  templates, Docker helpers, hosted nginx guidance, repository inventory, deployment documentation, caches, and root
  production output so removed applications are not part of active source or generated artifacts.
- Updated the supported development baseline to Node.js 26.5.0, npm 12.0.1, and TypeScript 7.0.2 while retaining npm
  as the sole root workspace package manager and preserving a single root dependency tree and build-output directory.
- Verified a clean npm installation, module ownership boundaries, the reduced product-stack contract, TypeScript, ESLint,
  production builds, dependency layout, version alignment, shell syntax, diff integrity, and active-source/generated-output
  trace scans after the cleanup. Database-backed and live-browser E2E suites were not part of this cleanup verification.
- Bumped workspace version to 1.0.38.

## v-1.0.37

### [v 1.0.37] 2026-07-19 1:39 pm - Billing-First Public Product Experience

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Removed the Sites application, its three public-site clients, static assets, workspace package, development commands,
  product-stack contract, container image/Compose project, hosted publishing rules, and environment/deployment entries.
- Bumped workspace version to 1.0.37.
- Repositioned the Platform-owned public application site around a billing-first product story covering quotations,
  invoices, GST-ready document preparation, e-way bills, e-invoices, sales, purchases, receipts, payments, ledgers,
  receivables, reports, and digital document history.
- Rewrote Home, Billing, Features, Security, Blog, Updates, About, Contact, Privacy, and Terms with practical content for
  billing staff, accounts teams, business owners, new-employee onboarding, responsibility changes, and staff handovers.
- Removed tenant-architecture, multi-tenant, multi-company, and industry-pack marketing language from the rendered public
  experience while retaining the existing backend-driven brand, theme, login, and connected-site contract.
- Added reusable billing editorial data for invoice, compliance, accounts, monitoring, automation, handover, and digital
  documentation stories without moving application business behavior outside its owning modules.
- Added colour-coded billing and accounts cards, animated live-status indicators, rotating control rings, document-flow
  interactions, responsive hover states, and reduced-motion-safe fallbacks.
- Limited AI and maintenance messaging to supporting concerns: reviewed assistance for repetitive preparation and
  unobtrusive background processing for exports, integrations, documents, and service operations.
- Added a CODEXSUN fallback brand for an unconfigured local public portal while preserving configured organisation branding.
- Verified formatting, Platform Web lint and TypeScript, Platform module boundaries, root dependency layout, version
  alignment, production build output, all public routes, billing-language exclusions, and desktop/mobile rendering.

## v-1.0.36

### [v 1.0.36] 2026-07-19 - Billing-First Public Product Story

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Reworked the complete public application site around invoicing, e-way bills, e-invoices, accounts, live monitoring,
  staff controls, handovers, workflow accuracy, and digital documents.
- Removed tenant-architecture, multi-tenant, and industry-pack language from customer-facing copy while preserving the
  existing backend-driven branding and application entry contract.
- Added colour-coded billing content, animated document-flow cues, live status accents, and reduced-motion-safe
  interactions across the public pages.
- Kept maintenance and AI as supporting product concerns rather than the primary marketing story.

### [v 1.0.36] 2026-07-19 - Rich Tenant Product Experience

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Upgraded the tenant-aware public application site with richer product storytelling, tenant-derived workspace previews,
  progressive-growth journeys, operational outcomes, editorial blog presentation, release guidance, support preparation,
  page-owned FAQs, and expanded privacy and terms content.
- Added and wired a dedicated `/security` page covering domain-based tenant resolution, authenticated access, role and
  permission scope, tenant database routing, audit expectations, and evidence-based assurance without unsupported
  certification claims.
- Expanded the shared tenant-site visual system with responsive product-preview, security-model, capability, growth,
  editorial, FAQ, assurance, and legal content blocks while preserving the tenant portal module as the only public data
  contract.

### [v 1.0.36] 2026-07-19 - Tenant-Aware Public Application Pages

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Refactored the Platform tenant home into an extensible public application-site composition with tenant-aware context,
  shared navigation and footer blocks, landing sections, and a reusable page template under `src/public/tenant-site`.
- Added and wired public Workspace, Features, Blog, Updates, About, Contact, Privacy, and Terms pages. Every page resolves
  the current tenant's domain branding, theme, content, login route, and connected public-site URL through the existing
  tenant portal read contract.
- Expanded the application footer into standard Workspace, Company, and Application navigation groups without coupling
  the app-owned public pages to the separate Sites application.

### [v 1.0.36] 2026-07-19 - Platform Tenant Home Public Ownership

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Moved the tenant-facing Platform home page and its page stylesheet from the tenant portal module into
  `apps/platform/web/src/public`, while keeping tenant portal data access and types owned by the module.
- Updated the `/` route to lazy-load the new `public/tenant-home.tsx` entry directly.

### [v 1.0.36] 2026-07-19 - Platform Dashboard Home Correction

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Corrected the shared dashboard Home action to return to the Platform root on the current app origin. Local access
  from `http://127.0.0.1:7020` now returns to `http://127.0.0.1:7020/` instead of the public Sites hostname.

### [v 1.0.36] 2026-07-19 - Dashboard Header Actions

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Removed the unused desk-tools suitcase control and the hardcoded notification count from the shared dashboard top
  bar.
- Dashboard Home now resolves the tenant-configured public site with the deployed Codexsun public-site origin as its
  fallback, and top-bar Logout now closes the active desk session before returning to its login page.

### [v 1.0.36] 2026-07-18 10:52 pm - Warm-Cache Tenant Reinstall Repair

#### Database Changes

- Database update: No new schema definition. Existing tenant databases can be repaired through the same managed
  setup/reinstall path.
- Core and Billing maintenance lifecycles now invalidate only the target tenant's in-process bootstrap state before
  rerunning their owned migrations and repeatable seeds. This restores the complete selected-app schema even when the
  database was dropped or recreated while the Platform API remained running.

#### App Codebase Changes

- Tenant app composition now calls the forced Core and Billing tenant migration contracts for every managed setup,
  reinstall, safe migration, tenant save/update, and database CLI migration.
- Expanded the bootstrap E2E to warm both app caches, drop the tenant database, run Re-install in the same process,
  and verify the complete 20-migration Billing schema is rebuilt with no running maintenance rows.

### [v 1.0.36] 2026-07-18 10:32 pm - Selected-App Tenant Provisioning Lifecycle

#### Database Changes

- Tenant creation, update, setup, reinstall, safe migration, and database CLI migration now apply the selected app
  lifecycle in dependency order: Platform tenant foundation first, Core prerequisites before Billing, Billing-owned
  migrations and repeatable seeds next, and Mail only when Mail is enabled.
- Billing-selected tenants now receive the complete 20-row migration ledger and all Core/Billing tables during the
  initial tenant save instead of stopping at the Platform/Mail foundation.
- Database maintenance operations now complete or fail their original run row. The Platform migration removes the
  historical duplicate `running` row when its exact matching terminal row was written at the same timestamp.
- Existing tenant data is preserved. Re-running the tenant migration is required to install missing selected-app
  tables in already-created tenant databases.

#### App Codebase Changes

- Added public Core and Billing tenant database lifecycle exports and a Platform composition sequence that consumes
  module-owned migrations without moving schema behavior out of the owning applications.
- Tenant database migration plans now include the complete selected-app plan, so pending migration status reflects
  Core, Billing, and Mail requirements rather than Platform foundation migrations alone.
- Expanded the bootstrap E2E to create a Billing-selected tenant through the same Tenant Service save path, verify all
  required tables and 20 migrations, confirm Mail remains uninstalled when not selected, and validate both run
  finalization and legacy-run reconciliation across restart.

### [v 1.0.36] 2026-07-18 10:09 pm - Tenant App Selection Cards

#### Database Changes

- Database update: No. Tenant app activation continues to use the existing registry and tenant connection contracts.

#### App Codebase Changes

- Reworked Tenant app-selection cards in both show and upsert flows with the established three-column tile layout,
  app-specific icons, Enabled/Disabled status pills, descriptions, and top-aligned activation switches.
- Kept the Application connection visibly enabled and locked, preserved landing-app selection and save behavior, and
  added an iconless option to the shared workspace status badge for compact card statuses.

### [v 1.0.36] 2026-07-18 9:59 pm - Established Login Experience Restored

#### Database Changes

- Database update: No. Authentication persistence and API contracts are unchanged.

#### App Codebase Changes

- Restored the established shared `AuthLayout` experience for `/login`, `/sa/login`, and the shared admin login route,
  including the CODEXSUN brand mark, desk-specific badge, design-system fields, submit button, loading state, and error
  presentation.
- Removed the replacement public-site login markup, tenant-portal branding request, cross-login links, and its obsolete
  page-specific stylesheet without changing login submission, development auto-login, or post-login destinations.

### [v 1.0.36] 2026-07-18 9:40 pm - Same-Origin Core and Billing API Routing

#### Database Changes

- Database update: No. This fix changes browser-to-API routing only.

#### App Codebase Changes

- Replaced browser-facing loopback Core and Billing API URLs with same-origin `/api/core` and `/api/billing` gateway
  paths so Platform works from `127.0.0.1:7020`, `app.codexsun.test`, tenant app domains, and `app.codexsun.com` without
  CORS exceptions.
- Added Core and Billing proxying to their local Vite entry points, the Platform Vite server, and the hosted nginx
  Platform server while preserving existing tenant authorization and database-context headers.
- Added hosted Core and Billing API systemd units and deployment commands required by the production API proxies.
- Documented same-origin Platform/Core/Billing API routing and hosted verification commands.

### [v 1.0.36] 2026-07-18 2:40 pm - Marketing and Tenant App Portal Separation

#### Database Changes

- Database update: No schema or seed migration. Tenant-specific portal content uses the existing tenant-owned
  `payload_settings` JSON column under the validated `appPortal` key.

#### App Codebase Changes

- Removed the Platform web dependency, TypeScript alias, lazy imports, and root marketing routes for
  `@codexsun/sites-web`; Platform and Sites now build and run without importing each other.
- Kept the existing CODEXSUN marketing site under Sites and routed its application, status, and login links through
  `VITE_PLATFORM_WEB_ORIGIN`, targeting `app.codexsun.com` in production.
- Added a responsive Platform app portal at `/` with shared tenant-aware navigation, animated slider, feature cards,
  update/blog cards, public-site return link, workspace login actions, and footer.
- Added the validated public `/public/app-portal` API projection with domain resolution, canonical default-tenant
  fallback, safe URL handling, bounded content, and no exposure of raw tenant settings or database credentials.
- Added an App portal tab to tenant upsert for per-tenant brand, theme, hero, slider, features, updates, footer, and
  optional marketing-site content while preserving unrelated tenant payload settings.
- Added `app.codexsun.test` to the local domain gateway, removed the old `aaran.test` root-to-login redirect, and
  documented the local-to-live domain mapping for `app.codexsun.com` and `app.tenant.com`.
- Updated hosted environment and architecture guidance with `PLATFORM_PUBLIC_SITE_ORIGIN`, strict Sites/Platform
  ownership, tenant-domain registration, and production publishing behavior.
- Verified Platform API/web and Sites lint, TypeScript, module boundaries, all production builds, desktop/mobile app
  portal rendering, tenant-safe API fallback, and preservation of the CODEXSUN marketing homepage.

### [v 1.0.36] 2026-07-18 10:23 am - Client Sites and Domain Routing

#### Database Changes

- Database update: No (manual). No tenant, tenant-domain, migration, seed, or tenant-database record was created or changed in this release.

#### App Codebase Changes

- Added the dedicated `apps/sites/web` workspace with independently owned CODEXSUN, LogicX, and Tech Media public-site clients and separate production artifacts under `dist/apps/sites/web/{client}`.
- Moved the CODEXSUN creator site out of Platform public source while retaining temporary Platform composition through the Sites public export for local root-route compatibility.
- Adapted the Interfrozt frontend into the CODEXSUN identity without redesigning its visual foundation, including refined navigation, animated hero messaging, product sections, enterprise presentation, outcome content, compact page rails, and responsive public layouts.
- Reworked Selected Work into a compact project grid with independently presented CODEXSUN Platform, Billing Suite, and Zero case material, while removing the obsolete Project Overview presentation.
- Added independently branded LogicX and Tech Media sites that reuse only visual infrastructure and retain concrete client-owned content, routes, metadata, and themes.
- Added temporary root development commands for CODEXSUN, LogicX, and Tech Media on ports `7130`, `7131`, and `7132`, plus a combined `npm run dev:sites:all` launcher.
- Added the local port-80 development domain gateway for `codexsun.test`, `logicx.test`, `techmedia.test`, and the `aaran.test` Platform tenant workspace, including Vite WebSocket forwarding and preserved tenant host headers.
- Changed Platform development API access to the same-origin `/api/platform` path so tenant-domain resolution receives the browser hostname instead of the loopback API hostname.
- Expanded the hosted nginx baseline to publish `codexsun.com`, `logicx.in`, and `techmedia.in` from independent Sites artifacts while serving `app.codexsun.com` and registered tenant domains from Platform.
- Updated deployment, project inventory, environment, build, DNS, certificate, and hosted publishing documentation for the new Sites and domain topology.
- Verified formatting, Platform and Sites lint and TypeScript, module boundaries, dependency layout, local hostname routing, same-origin Platform API health, and Platform plus all three Sites production builds.
- Bumped workspace version to 1.0.36.

## v-1.0.35

### [v 1.0.35] 2026-07-17 8:54 am - Billing and Business Services Planning

#### Database Changes

- Database update: No. This release changes product planning, release history, and lockstep package versions only; tenant and Platform schemas remain unchanged.

#### App Codebase Changes

- Added the dated Billing, Accounting, Compliance, and Business Services plan under `assist/execution/planning.md`.
- Recorded the live Billing and Core capability inventory, current readiness limitations, and the prioritized GST, bookkeeping, audit, receivable/payable, purchase-automation, and commercial-document roadmap.
- Defined module ownership boundaries for Billing documents, Accounting books, Compliance workflows, reporting read models, and asynchronous integrations so future work does not become a centralized business engine.
- Added adjacent client-service plans for collections, virtual CFO, loan readiness, payroll, TDS, inventory control, CRM, industry packs, digital commerce, document automation, migration, and managed back-office operations.
- Added commercial packages, launch sequencing, client-acquisition offers, positioning messages, compliance wording, delivery gates, and measurable success criteria.
- Bumped workspace version to 1.0.35.

## v-1.0.34

### [v 1.0.34] 2026-07-15 11:13 pm - Billing Address and Date Picker Reliability

#### Database Changes

- Database update: Yes. Added tenant-owned `mail_settings`, `mail_messages`, `mail_attachments`, and `mail_events` tables with repeatable migrations and permission seeding.
- Mail credentials are encrypted before tenant persistence; message, attachment, provider, and delivery state remain inside each tenant database.

#### App Codebase Changes

- Added the standalone Mail API/web workspaces with Inbox, Outbox, Drafts, Scheduled, Sent, Failed, Trash, rich compose, attachments, tenant SMTP plus IMAP/POP3 settings, environment fallback, and responsive three-column navigation.
- Added tenant-aware queue processing for SMTP delivery and inbound synchronization with idempotency, retry/backoff, delivery events, failed-message visibility, and environment credential fallback.
- Wired Sales, Quotation, Purchase, and Export Sales email tools to capture their rendered document as a PDF, prepare a branded rich message, and enqueue delivery through Mail's public contract.
- Corrected Quotation address and compliance presentation by exposing the document date in the list and resolving customer GSTIN plus Billing/Shipping State names and codes for show and print output.
- Added a narrow Core Contact-address create/update contract that preserves sibling addresses and validates the persisted Country, State, District, City, Pincode, and Address Type hierarchy.
- Wired Quotation, Sales, Purchase, and Export Sales address editors through their module-owned Billing lookup routes so an address popup can append a missing address or update the selected address without replacing the Contact or collapsing formatted location lines into Address line 2.
- Added visible Country selection to the Billing and Shipping address editors, retained India as the create default, cleared dependent location values when Country changes, and hydrated edit forms from structured address records.
- Confirmed Receipt and Payment continue to use their structured Contact popup with visible Country and India default behavior.
- Refined the shared workspace date picker with compact Month and Year autocomplete controls, equal fixed-height scrollable lists, narrow aligned dropdowns, ultra-thin scrollbars, single-line options, typed filtering, and full-list display with the current value highlighted whenever either control receives focus.
- Added opt-in presentation controls to `WorkspaceLookup` for compact option rows, dropdown width/class overrides, icon visibility, clearing behavior, and full-list-on-focus behavior without changing existing lookup defaults.
- Verified Core API, Billing API, Billing web, and UI package formatting, lint, TypeScript, production builds, module boundaries, dependency layout, diff integrity, and database-backed Quotation persistence/conversion coverage during the implementation batch.
- Bumped workspace version to 1.0.34.

## v-1.0.33

### [v 1.0.33] 2026-07-14 11:25 pm - Billing Concurrency and Tenant Runtime Hardening

#### Database Changes

- Database update: Yes (automatic repeatable tenant authorization seeds; no schema migration).
- Added module-owned Core and Billing permission seeds that upsert the new view, create, update, delete, lifecycle, and compliance permissions and grant them to each tenant administrator role during lazy tenant bootstrap.
- Existing tenant databases receive the authorization repair automatically on their first Core or Billing bootstrap after deployment; no table alteration or manual data backfill is required.

#### App Codebase Changes

- Consolidated production deployment into four independent MariaDB, Redis, Media, and Billing stacks; Billing now packages Framework-backed Platform, Core, and Billing services.
- Live-tested the complete local Docker deployment, including production migration gating, persistent Billing storage ownership, the Platform public-storage compatibility link, authenticated Redis and Media access, and health checks for all six Billing services.
- Split complete-stack lifecycle into non-destructive `setup.sh` install/reinstall commands and a Billing-only `deploy.sh`; Billing reinstall now replaces only application containers/images, applies forward migrations, reports the migration ledger, and cannot manage infrastructure or remove database volumes.
- Added repeatable default-tenant deployment inputs, persistent tenant-storage mapping, and setup-time MariaDB grant reconciliation; live install, full reinstall, and Billing-only reinstall preserve the `1:1:19:1` master/tenant migration-and-user signature while all endpoints remain healthy.
- Finalized the deployment lifecycle commands: `.container/setup.sh` installs the complete stack, `.container/setup.sh --reinstall` rebuilds every stack without deleting named volumes, and `.container/deploy.sh billing --reinstall` replaces only Billing backend/frontend containers and images while leaving MariaDB, Redis, and Media untouched.
- Added pre-teardown configuration validation, infrastructure health checks, forward-only migration execution, and applied migration-ledger reporting. Database fresh/reset flags remain prohibited and neither reinstall path contains database-drop or volume-removal operations.
- Added an ignored deployment input workflow that preserves explicit operator values, imports matching secrets from repository `.env`, generates missing random credentials, and synchronizes the Media administrator with the resolved Super Admin password.
- Replaced per-app duplicate images with one shared Billing API image, one shared Billing web image, and one explicit Platform/Core/Billing migration image, leaving room for Accounts modules to extend the same release boundary.
- Added concurrent Sales invoice reservation recovery: conflicting create or draft-update requests save with the next configured number and return a user-visible warning, while the persisted next-number setting advances atomically.
- Added retry-safe document line numbering across Quotation, Sales, Purchase, Export Sales, Payment, and Receipt to prevent simultaneous same-tenant inserts from failing on line-number collisions.
- Serialized Payment and Receipt allocation validation with row locks and deterministic lock ordering so two users cannot allocate the same outstanding Purchase or Sale balance.
- Enforced tenant role permissions for Core and Billing read, mutation, lifecycle, and compliance requests instead of relying on tenant-token membership alone.
- Limited Core and Billing tenant connection pools, evicted pools after ten minutes of inactivity, and replaced startup-wide tenant migration and seeding with lazy per-tenant bootstrap while retaining the explicit database-stack migration command.
- Added module-owned SQL pagination, server-side search and status filtering, bounded hydration, and accurate totals for Quotation, Sales, Purchase, Export Sales, Payment, and Receipt workspaces; page size is capped at 200 records.
- Extended persistence and five-tenant mass E2E coverage for concurrent Sales numbering, bounded document pages, tenant isolation, authorization seed upgrades, fresh bootstrap, and restart bootstrap behavior.
- Bumped workspace version to 1.0.33.

## v-1.0.32

### [v 1.0.32] 2026-07-14 09:32 pm - Tamil Nadu State Priority

#### Database Changes

- Database update: Yes (automatic repeatable Core seed ordering; no schema migration).
- Kept the fallback `-` State first, made Tamil Nadu the second State with sort order one, and shifted the earlier seeded States down to preserve unique deterministic ordering.

#### App Codebase Changes

- Extended persistence E2E coverage to require `-` first and Tamil Nadu second in the database-backed State lookup order.
- Verified the same ordering in the live tenant database after Core startup reseeding.

### [v 1.0.32] 2026-07-14 09:29 pm - India-First Country Default

#### Database Changes

- Database update: Yes (automatic repeatable Core seed cleanup; no schema migration).
- Removed the `-`/`UNKNOWN` Country seed and made India the first Country seed with sort order zero.
- Reparented the fallback and legacy user-created States plus existing Contact address Country references from the removed Country to India before deleting the obsolete Country row.
- Kept the fallback State, District, City, and Pincode chain valid under India for minimal Contact defaults.

#### App Codebase Changes

- Made new Contact popups resolve their initial India label to the persisted India Country ID in Quotation, Sales, Purchase, Export Sales, Payment, and Receipt while retaining full Country override support.
- Extended tenant persistence E2E coverage for fresh India-first seeds, absence of the hyphen Country, fallback hierarchy validity, legacy State and Contact-address cleanup, and repeatable reseeding.
- Verified the live Sales new-Contact popup starts with India and can be overridden with United States.

### [v 1.0.32] 2026-07-14 09:16 pm - Contact Country Selection

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Added a visible, database-backed Country lookup before State in the Quotation, Sales, Purchase, Export Sales, Payment, and Receipt contact popups.
- Made a Country change clear the dependent State, District, City, and Pincode values so each lower lookup is filtered through one consistent persisted hierarchy.
- Verified in the live Sales popup that changing the default `-` Country to India exposes and selects Tamil Nadu without changing persisted contact data during the test.

### [v 1.0.32] 2026-07-14 09:07 pm - Referenced Contact Address Persistence

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Changed Contact address persistence to update retained addresses in place, preserving IDs already referenced by Quotation, Sales, Purchase, and Export Sales records instead of deleting and recreating them during a Contact edit.
- Added a clear conflict response when an address that is still referenced by a Billing record is intentionally removed.
- Added a tenant-database persistence regression that edits a Contact after its address is referenced by a Quotation and verifies that the address ID remains stable.
- Verified the live Sales contact popup through Chrome, the Core and Billing production builds, module boundaries, dependency layout, and the complete tenant-isolated Billing persistence E2E.

### [v 1.0.32] 2026-07-14 08:51 pm - Calm Workspace Data Loading

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Replaced animated workspace table and lookup skeletons with plain loading states so initial data requests no longer shimmer or fade the surrounding interface.
- Kept the last settled table rows visible while Company, Contact, Product, and Work Order searches request their next server-filtered result, preventing table collapse and flicker during typing.
- Applied the plain table-loading state across Core, Platform, and Billing workspaces through the shared workspace table primitive and the remaining module-owned custom tables.

### [v 1.0.32] 2026-07-14 06:37 pm - Company Billing Compliance Bootstrap

#### Database Changes

- Database update: Yes (automatic tenant migration).
- Added company-scoped Billing settings keyed by Company inside each tenant database, with a one-time compatibility fallback that copies the existing tenant-wide Billing setting into a Company's first settings row.
- Added Purchase-owned E-way and E-invoice JSON columns so supplier compliance references persist with each Purchase.

#### App Codebase Changes

- Added `None`, `E-way only`, and `E-invoice + E-way` GST API modes and synchronized the Billing switches so E-invoice cannot be enabled without E-way.
- Wired the saved Company mode to show or omit E-way and E-invoice tabs in Sales, Purchase, and Export Sales, and enforced the same capability checks on Sales and Export Sales generation endpoints.
- Added a tenant startup gate that confirms the authenticated session, loads the enabled tenant apps, resolves the default Company and Financial Year, publishes that context, and preloads Company Billing settings before the first application workspace paint.
- Keyed Billing settings queries and mutations by Company so Company changes cannot reuse another Company's cached feature configuration.
- Verified the Billing migration stack, company setting mode round-trips, module boundaries, dependency direction, lint, typecheck, production builds, and tenant-isolated Billing persistence E2E.

### [v 1.0.32] 2026-07-14 11:47 am - Production Docker Setup Notes

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Added `assist/execution/setup.md` as the production Docker setup helper, documenting the active `.container/` deployment bundle, image build inputs, runtime services, environment requirements, upgrade path, clean reinstall flow, storage, admin tooling, reverse proxy notes, and pre-production checks.
- Recorded the installed Docker image base and runtime packages used by the production build: Node.js 22 Bookworm slim with `ca-certificates`, `curl`, `git`, `mariadb-client`, `nano`, `redis-tools`, and `sudo`.
- Replaced the shared runtime image with independently versioned Platform, Core, and Billing API/Web images plus a dedicated migration runner.
- Split MariaDB, Redis, Pictures, Files, and every application stack into individually deployable Compose projects joined through the external `codexsun-network`.
- Added explicit persistent volumes for database data/backups, Redis, each app stack, picture content/metadata, and file content/metadata; reinstall now preserves all data unless a targeted wipe flag is explicitly enabled.
- Added the Pictures/Files media setup workflow that initializes both File Browser databases and keeps their admin passwords synchronized with `SUPER_ADMIN_PASSWORD` from the repository `.env` without printing the credential.
- Tightened destructive media setup so `--wipe-media` is rejected without `--reinstall`, attached containers are reported before a wipe, and every requested Docker volume removal is verified instead of silently ignoring failures.
- Pinned all upstream Docker bases and aligned CODEXSUN image tags with workspace version `1.0.32`, with no production `latest` tags.
- Bumped workspace version to 1.0.32.

## v-1.0.31

### [v 1.0.31] 2026-07-14 11:08 am - Minimal Billing Draft and Default Reference Fixes

#### Database Changes

- Database update: Yes (manual).
- Updated the Product seed so the protected `-` product resolves its Product Type, Product Category, HSN Code, Unit, and GST Tax foreign IDs from the existing `-` records, falling back to the first active persisted record without creating anonymous masters.
- Updated the Contact seed to resolve the demo contact's persisted Contact Type and Contact Group and to backfill one default `-` address for every active contact that has no address, using the connected seeded Country -> State -> District -> City -> Pincode hierarchy.
- Existing tenant databases require the normal repeatable Core seed pass to receive the Product relationship repair and missing-address backfill; no new table or schema migration is required.

#### App Codebase Changes

- Fixed Quotation, Sales, Purchase, and Export Sales quick-product requests so persisted Product Category, HSN Code, Unit, and GST Tax IDs are submitted as numeric foreign IDs instead of invalid strings.
- Expanded the Core Product response with its resolved type, category, HSN, unit, and GST tax relationship values and made minimal product creation reuse the existing fallback masters.
- Added default-address enrichment to minimal Contact creation so inline contacts created without address details still return a persisted address owned by that contact.
- Aligned the Core Contact Legal Name interaction with the Billing contact popup: leaving Name derives an uppercase Legal Name until it is manually edited, and the magic action restores and refreshes that derived value on demand.
- Allowed contact-only draft creation for Quotation, Sales, Purchase, and Export Sales and zero-value draft creation for Receipt and Payment while preserving line-item requirements for confirmation and positive-total requirements for posting.
- Added fallback Ledger and Work Order resolution for minimal Billing drafts and fallback cash/bank Ledger resolution for Receipt and Payment without creating placeholder business records.
- Extended the tenant-isolated persistence E2E to cover minimal Product and Contact creation, all six minimal Billing draft flows, default foreign-reference resolution, cleanup, and rejection of empty confirmation/posting actions.
- Bumped workspace version to 1.0.31.

## v-1.0.30

### [v 1.0.30] 2026-07-13 11:22 pm - Fresh Database Startup Verification

#### Database Changes

- Database update: Yes (manual).
- Verified migration preflight against the freshly reinstalled `codexsun_master_db` and its registered `codexsun_db` tenant target with no missing or invalid database mapping.
- Ran the complete Platform -> Core -> Billing migration stack successfully and confirmed one applied master migration plus all 19 tenant migration markers, including the five tenant access-control owners and the seven Billing foundations.
- Ran the live seed stack twice without duplicate records or failures, confirming repeatable app-registry, default tenant, domain, subscription, tenant-module, Core, and Billing seed behavior.
- Verified the disposable fresh-start and restart path produces identical persisted state: three platform apps, two plans, one tenant/domain/subscription, two tenant module settings, one `codexsun` company, one current financial year, one default-company setting, one demo supplier, one Billing setting, and all seven Billing root tables.
- Confirmed the default-company seed resolves the first `codexsun` company and current financial year through persisted database identities after a clean installation.

#### App Codebase Changes

- Added independently owned tenant User, Role, Permission, User Role, and Role Permission backend/frontend modules with tenant-bound authorization, migrations, seeders, lifecycle APIs, application-desk pages, and Access Control sidebar composition.
- Added mutation confirmations, success/error notifications, API-aware automatic list return, protected-record handling, and password masking across the tenant access workspaces.
- Split application routes and tenant business workspaces into lazy production chunks; the tenant desk entry chunk decreased from 801.95 kB (139.64 kB gzip) to 37.33 kB (8.80 kB gzip).
- Verified the fresh database startup with `db:migrations:preflight`, `db:migrations:run`, two `db:seed` passes, migration-ledger inspection, and the restart-safe Platform/Core/Billing bootstrap E2E.
- Bumped workspace version to 1.0.30.

## v-1.0.29

### [v 1.0.29] 2026-07-13 4:48 pm - working on sales

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.29.

## v-1.0.28

### [v 1.0.28] 2026-07-13 9:52 am - Common List Serial Columns

#### Database Changes

- Database update: Yes (manual).
- Consolidated the fresh Contact migration around the Contact master and its five owned child tables: emails, phones, addresses, bank accounts, and social links.
- Added concrete foreign keys for Contact type/group, address type, location hierarchy, and bank-name references; existing databases require the normal fresh migration path to receive the consolidated schema exactly.

#### App Codebase Changes

- Standardized all 29 Core Common frontend lists so the module-owned `sortOrder` field appears first as a centered `#` serial column with a fixed 64 px width and tabular numeric alignment.
- Preserved strict leaf ownership by keeping the serial-column definition inside each Common list rather than introducing shared or centralized business-column configuration.
- Refactored Core Master Contact into a complete module-owned backend and frontend implementation with exact migration, repository, service, routes, seed, types, list, form, hooks, services, workspace, and index responsibilities.
- Added the animated `Details`, `Tax Details`, `Communication`, `Addresses`, `Finance`, and `More` Contact form tabs with repeatable emails, phones, addresses, bank accounts, and social links.
- Wired Contact Type, Contact Group, Address Type, Bank Name, Country, State, District, City, and Pincode as searchable foreign-reference lookups with in-context creation and dependent location filtering.
- Replaced Contact child JSON read behavior with transactional persistence and hydration through the five Contact-owned child tables, including parent-reference and location-hierarchy validation.
- Verified Contact create-and-read persistence against a disposable freshly migrated tenant database, including one persisted row in every Contact child table.
- Fixed Contact address persistence so a selected country or postal code is retained even when the optional Address line 1 is empty; changing country now persists the new country while clearing stale State, District, City, and Postal Code references in sequence.
- Replaced the India-only six-digit Pincode validation with an international 2-20 character postal-code contract supporting letters, numbers, spaces, and hyphens in both the Common Pincode owner and Contact lookup creation popup.
- Moved Contact next-code generation to the Contact backend using all persisted codes, recognizing both `C-0000` and legacy `C_0001` sequences while returning the canonical next `C-####` value independently of frontend search filters.
- Aligned the Contact postal-code creation popup with the Common Country upsert tone using a compact dialog width, padded header and fields, descriptive copy, footer divider, and consistent primary/cancel action spacing.
- Replaced Product's raw Product Type, Product Category, HSN Code, Unit, and GST Tax ID inputs with Product-owned autocomplete lookups, fixed Common relationship endpoints, create-and-select flows, active-reference validation, and persisted numeric foreign IDs.
- Bumped workspace version to 1.0.28.

## v-1.0.27

### [v 1.0.27] 2026-07-13 8:35 am - rework on core

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.27.

## v-1.0.26

### [v 1.0.26] 2026-07-13 1:31 am - Root npm Workspace and Repository Cleanup

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Standardized the monorepo on npm workspaces with one root `node_modules`, one root `package-lock.json`, and no pnpm or Yarn lockfiles, stores, or workspace-local dependency trees.
- Standardized generated build output on the root `dist` tree and removed nested `node_modules`, `dist`, and `dist-types` artifacts and local output configuration.
- Added mandatory Assist governance and agent rules requiring npm commands to run from the repository root and requiring `npm run dependencies:check` plus nested-artifact scanning after dependency, workspace, package, or build changes.
- Removed generated Codex runtime logs, audit output, Turbo and IDE caches, automated test/spec/E2E sources, Playwright configuration, test-runner scripts and dependencies, and the Framework test-only export.
- Updated the module-boundary checker so production module ownership validation no longer requires removed test/spec role files.
- Verified the cleaned repository with npm dependency-tree validation, root dependency-layout validation, Prettier, ESLint, and TypeScript.
- Bumped workspace version to 1.0.26.

## v-1.0.25

### [v 1.0.25] 2026-07-12 10:17 pm - Common Module Boundary and Location Hierarchy

#### Database Changes

- Database update: Yes (manual).
- Rebuilt the Core location foundation migrations as independent Country, State, District, City, and Pincode tables with ordered foreign keys and relationship-safe delete restrictions.
- Added scoped uniqueness for State per Country, District per State, City per District, and Pincode per City.
- Moved Country, Indian State and territory, Tamil Nadu District and City, and supported Pincode seed records into their owning modules with deterministic, idempotent upserts.
- Preserved the ordered Country -> State -> District -> City -> Pincode migration and seed sequence.
- Removed redundant `tenant_id` columns and tenant-scoped indexes from all 24 non-location Core Common master migrations; the selected tenant database is now the sole data-isolation boundary.
- Changed Common master uniqueness from `(tenant_id, primary field)` to database-local primary-field uniqueness and removed tenant prefixes from generated record IDs.
- Existing development databases created from the earlier Common schema require the fresh migration workflow to physically rebuild the tables without legacy `tenant_id` columns.
- Fixed invalid trailing commas after the final unique key in all 24 non-location Common table migrations and quoted the Month `from_date` and `to_date` identifiers for MariaDB compatibility.

#### App Codebase Changes

- Refactored all 29 Core Common leaf modules to the reduced nine-file backend contract: migration, module, repository, routes, seed, service, test, types, and index.
- Replaced all 24 generic Common master wrappers with module-owned migrations, typed records and payloads, direct SQL repositories, validation services, Fastify routes, lifecycle behavior, seeds, and contract tests.
- Removed the Common master definition registry and the shared migration, repository, route, seed, service, context, and type factories; no Common leaf module extends, aliases, or delegates its backend behavior to a generic foundation.
- Removed separate definition, event, sync, and worker placeholder files while preserving each module's fields, protected placeholder rows, seed values, routes, lifecycle behavior, and table ownership.
- Removed Common-level `x-tenant-id` parsing, logical global/tenant row filtering, tenant parameters, and `tenantId` response fields; Common requests now rely exclusively on the fail-closed `x-tenant-db` database context.
- Replaced the former shared location backend with independently owned Country, State, District, City, and Pincode repositories, services, routes, contracts, migrations, seeds, and tests.
- Added normalized Country, State, District, and City relationship joins and parent validation throughout the location hierarchy.
- Added separate Pincode individual and relation endpoints; relation reads return the complete City, District, State, and Country hierarchy.
- Removed obsolete shared location helpers, shared seed data, and the stale legacy location database test that targeted the deleted global/tenant location contract.
- Formatted the complete Core Common backend and verified it with Prettier, ESLint, TypeScript, and Core API tests.
- Rebuilt all 29 Core Common frontend leaf modules as independently owned nine-file bundles: workspace, list, form, services, hooks, schema, types, spec, and index.
- Standardized Contact, Product, Workorder, Other, and Location masters on the Contact Types interaction tone with searchable paginated lists, popup upsert forms, active-state controls, edit, suspend/restore, and force-delete row actions.
- Wired every frontend leaf directly to its owning Core API route through the fail-closed `x-tenant-db` context and removed frontend `tenantId` and `x-tenant-id` handling.
- Consolidated module definitions into each leaf's owned types file and removed the unused shared Location frontend runtime; Common leaf modules no longer borrow or wrap the legacy Common Master or Location implementations.
- Verified the complete Core Common frontend with Prettier, ESLint, TypeScript, 30 passing module specs, a production build, and browser-level Country list and popup-upsert checks.
- Verified the corrected Common migrations through a real configured-database Core API bootstrap through `app.ready` and `server.listen`.
- Added a disposable MariaDB Common E2E regression covering create, restart persistence, read, update, suspend, restore, force delete, response request metadata, and the complete Pincode-to-City-to-District-to-State-to-Country relation read.
- Standardized every Core-owned table primary key on `id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`, including all Common, Location, Master, Organisation Company, and Master child tables.
- Removed persisted and API-facing UUID columns from the complete Core schema and converted Core foreign-key and lookup ID columns to integers.
- Updated Core API repositories, seeds, services, events, sync contracts, Core Web modules, and Platform tenant-desk consumers for numeric record IDs while retaining string conversion only at URL, form-control, and local-storage boundaries.
- Extended disposable MariaDB E2E coverage to assert that every Core table has an integer auto-increment ID, no Core table contains a UUID column, Master child rows receive numeric IDs, relations remain valid, and tenant isolation still passes.
- This is a destructive development-schema change: databases created with string IDs or UUID columns must use the documented fresh migration workflow; existing IDs are not automatically remapped.
- Replaced every Core `is_active TINYINT(1)` persistence column with `status VARCHAR(24) NOT NULL DEFAULT 'active'`, including 24 non-location Common masters and Master social-link child tables.
- Removed the duplicate Master/Company `is_active` column, standardized its existing status column from `VARCHAR(32)` to `VARCHAR(24)`, and changed its tenant-state index to use status.
- Preserved the existing frontend `isActive` interaction contract by translating it to `active`/`inactive` status values in Core repositories; Master suspension continues to persist the explicit `suspend` status.
- Extended MariaDB schema E2E assertions to reject any remaining Core `is_active` column and any status column that is not `VARCHAR(24)` with the `active` default.
- Renamed the Month persistence and application contract from `from_date`/`to_date` and `fromDate`/`toDate` to `start_date`/`end_date` and `startDate`/`endDate`, including seeds, validation, repositories, frontend fields, and labels.
- Removed the unused top-level Core Common sync policy and worker placeholder files after confirming they had no executable imports or exports.
- Corrected the generic Master child-table migration so only Companies and Contacts own address, bank-account, email, phone, and social-link tables.
- Removed obsolete `products_*` and `work_orders_*` contact-detail child tables, stopped child synchronization for Product and Work Order records, and normalized any supplied contact-detail payloads to empty collections.
- Added MariaDB schema assertions requiring all ten Company/Contact child tables while rejecting every Product/Work Order contact-detail child table.
- Bumped workspace version to 1.0.25.

## v-1.0.24

### [v 1.0.24] 2026-07-12 7:34 pm - reworking on full app

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.24.

## v-1.0.23

### [v 1.0.23] 2026-07-12 11:12 am - working on migration

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.23.

## v-1.0.22

### [v 1.0.22] 2026-07-11 7:05 pm - Super Admin App Operations Experience

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Reworked the Super Admin repository app strip into a fixed responsive five-column grid with automatic wrapping and no horizontal scrollbar.
- Added distinct light pastel gradients, coordinated icon treatments, soft borders, and corner-white glow effects for each repository app card.
- Applied the selected app's visual identity to the App Operations hero while keeping operational controls and status information clear.
- Added low-intensity app-matched gradients to service metrics without changing service-list or supporting-panel surfaces.
- Preserved responsive layouts, dark-mode variants, hover feedback, and status-badge contrast across the updated operations experience.
- Verified the Platform web application with focused formatting, TypeScript checks, and repository diff validation.
- Bumped workspace version to 1.0.22.

## v-1.0.21

### [v 1.0.21] 2026-07-11 5:42 pm - Super Admin App Operations

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Removed the redundant page-title breadcrumb segment from the Super Admin top bar.
- Replaced the Super Admin overview dashboard cards with a compact live strip for every runnable repository app.
- Added App Operations maintenance pages with service availability, port response time, managed uptime, terminal PID, and per-service health metrics.
- Added guarded Open & start, Stop, Update, and Refresh controls; app starts and updates open in new visible terminals while stop is limited to process trees recorded by the orchestrator.
- Added independent Start, Stop, and Restart controls for every API/Web service with service-specific PID and uptime ownership.
- Enlarged repository app and metric cards with mild theme-token gradients, stronger icon treatment, and improved hover elevation.
- Reworked the repository app strip into a fixed responsive grid with five cards per wide row, automatic wrapping, no horizontal scrollbar, and a distinct theme-token color treatment for each app.
- Bumped workspace version to 1.0.21.

## v-1.0.20

### [v 1.0.20] 2026-07-11 5:15 pm - working on platform registry

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.20.

## v-1.0.19

### [v 1.0.19] 11/07/2026 11:10 am - Task Manager Todo editor and workflow improvements

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Added a module-owned minimal Todo rich-text editor with essential formatting controls, clean list previews, and shared workspace styling.
- Bumped workspace version to 1.0.19.

## v-1.0.18

### [v 1.0.18] 2026-07-11 9:54 am - working on eway and einvoice

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.18.
- Added shadcn Typeset, Geist Variable, and Geist Mono typography assets to the shared UI stylesheet.
- Applied the `typeset typeset-article` preset to the Workspace Editor rich-content preview, replacing its previous `prose` styling.

## v-1.0.17

### [v 1.0.17] 2026-07-11 12:33 am - Independent export sales clone

#### Database Changes

- Database update: Yes (manual).
- Wired the Export Sales migration into tenant billing database bootstrap and added the Export Sales lookup routes.

#### App Codebase Changes

- Refactored Export Sales into an independent clone of the Quotation/Sales workspace with matching list, upsert, item entry, autocomplete, totals, show, activity tools, and print preview flows.
- Added Export Sales revoke/delete workflow parity, validation handling, and deferred accounting posting behavior.
- Bumped the workspace version to 1.0.17.

## v-1.0.16

### [v 1.0.16] 2026-07-10 11:22 pm - Contact legal name magic autofill

#### Database Changes

- Database update: No (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.16.

## v-1.0.15

### [v 1.0.15] 2026-07-10 10:55 pm - Independent sales module clone

#### Database Changes

- Database update: Yes (manual).
- Added sales migration fields for tax type, work order, sales ledger, terms, and GST split values.
- Added the Sales-owned Core lookup proxy for contacts, addresses, products, categories, HSN codes, units, taxes, colours, sizes, and work orders.

#### App Codebase Changes

- Cloned the quotation list, upsert, show, print preview, and print route into independent Sales-owned UI code.
- Added Sales item entry with product autocomplete, inline lookup creation, tax-aware CGST + SGST or IGST columns, totals, and round-off controls.
- Added Sales contact and address autocomplete flows with editable billing and shipping address dialogs.
- Added Sales comments, activity timeline, entry tools, print copies, navigation, status actions, and save toasts.
- Removed the older Sales form/list implementation from the active module exports so the cloned Sales workflow is the only owned frontend path.
- Bumped the workspace version to 1.0.15.

## v-1.0.14

### [v 1.0.14] 2026-07-10 10:02 pm - Quotation save, submit, revoke, and edit controls

#### Database Changes

- Database update: Yes (auto-check).
- No quotation database schema changes were introduced by this work.

#### App Codebase Changes

- Added separate Save and save-action dropdown controls for saving drafts, submitting quotations, and admin revoke.
- Added draft/submitted workflow handling with revoke support for eligible non-invoiced quotations.
- Locked quotation editing after submission for regular users and kept invoiced quotations protected.
- Added fixed footer New quotation navigation for starting a fresh quotation without leaving the workspace.
- Bumped workspace version to 1.0.14.

## v-1.0.13

### [v 1.0.13] 2026-07-10 3:41 pm - Quotation Contact Quick Upsert

#### Database Changes

- Database update: Yes (manual).
- No database schema changes. The quotation lookup proxy creates and updates existing Core contact records.

#### App Codebase Changes

- Added a contact-only quick upsert dialog to the Quotation customer lookup with name, legal name, phone, email, and address lines.
- A missing contact search now offers New contact; saving silently refreshes the lookup and selects the created contact.
- Selected contacts show an arrow edit control in place of the lookup chevron; saving refreshes and retains the edited contact selection.
- Added Billing API proxy routes for Quotation contact create/update so browser traffic remains within the Billing module boundary.
- Split quick contact upsert into Details and Address tabs, added GSTIN and Address Type, and made State, District, City, and Pincode dependent lookup/create controls with India as the hidden default country.
- Widened the contact dialog, changed the fast-entry fields to a single-column flow, removed Email from the form, and made Address Type a create-capable autocomplete.
- Added Quotation-owned create/edit lookup popups for Products and Work Orders, inline Colour and Size creation, and an Items tab that contains both quotation lines and totals without the former tab-area divider.
- Bumped workspace version to 1.0.13.

## v-1.0.12

### [v 1.0.12] 2026-07-10 3:27 pm - Quotation Module Consolidation

#### Database Changes

- Database update: Yes (manual).
- Stopped the legacy Entries migration from creating new quotation entry tables. Existing legacy tables are retained for non-destructive upgrades.

#### App Codebase Changes

- Removed the duplicate Entries quotation routes, conversion endpoint, renderer, types, and its obsolete database test.
- Made `billing/quotation` the single quotation workflow, including conversion to a Sales invoice and storing the generated invoice number on the quotation.
- Added draft-only edit/confirm guardrails, cancellation rules, duplicate-number validation, and deterministic configured numbering for new quotations.
- Published quotation domain events and enqueued workflow jobs for create, update, confirm, cancel, and conversion actions.
- Added a Billing-owned Core lookup proxy for contacts, work orders, products, colours, and sizes; the Quotation browser UI no longer calls Core directly.
- Removed unused quotation form/list duplicates and added Quotation service regression tests for numbering, lifecycle, conversion, events, and queue jobs.
- Bumped workspace version to 1.0.12.

## v-1.0.11

### [v 1.0.11] 2026-07-10 2:23 pm - Quotation item table polish

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped workspace version to 1.0.11.

## v-1.0.10

### [v 1.0.10] 2026-07-10 12:00 pm - Core Work Order Module Ownership

#### Database Changes

- Database update: Yes (manual).
- Added the protected Work Order placeholder seed (`WO-0000`) for `work_orders`.
- Aligned master-record protection so global and placeholder records are blocked consistently in update, status, and force-delete flows.

#### App Codebase Changes

- Moved Work Order out of the shared master workspace/list wrappers into module-owned `work-order` workspace, list, form, hooks, services, and definition files.
- Flattened the Work Order form into one owned panel and removed inherited Contact/Product tabs.
- Removed Contact lookup and Contact list column from Work Order so the module no longer feels coupled to Contact master behavior.
- Kept Work Order name and code as edit links for editable rows while protected rows render plain text with the protected indicator.
- Removed Work Order-specific branches from the shared master workspace so future Contact/Product changes do not bleed into Work Order.
- Verified the refactor with Core Web and Platform Web type checks.
- Bumped workspace version to 1.0.10.

## v-1.0.9

### [v 1.0.9] 2026-07-09 7:53 pm - Billing Settings and Quotation Workflow

#### Database Changes

- Database update: Yes (manual).
- Preserved operator-configured tenant app access during default-tenant boot seeding instead of replacing it with seed defaults.
- Synchronized tenant module settings so disabled and enabled app records remain accurate after provisioning and restart.
- Extended tenant billing settings JSON with shared layout, printing, customisation, feature, and document-numbering defaults.
- Added backward-compatible normalization for legacy per-document layouts and removed obsolete hidden feature and totals settings.
- Added tenant-scoped automatic numbering profiles for Sales, Quotation, Purchase, and Export Sales.

#### App Codebase Changes

- Added development-only CODEXSUN tenant auto-login controlled by `.env`, using the normal server-side credential verification and session flow.
- Added Billing API to the Platform development stack and verified Billing Settings startup, CORS, and tenant database loading.
- Rebuilt Billing Settings with shared global PO, DC, Colour, Size, E-invoice, and E-way controls for Quotation, Sales, and Purchase.
- Added persisted Printing controls, custom terms, live letterhead preview/designer, document titles, print language, and focused feature switches for Quotation, Export Sales, and TConnect.
- Added a Document Settings workspace with automatic mode, prefix, separator, suffix, next number, padding, and live previews.
- Connected automatic numbering to Sales and Quotation creation and advanced counters only after successful saves.
- Reshaped Quotation entry with header tabs, Details, Other Details, Address, and Terms sections; removed Quotation E-way and E-invoice tabs.
- Reordered Quotation details into customer/work-order and number/date/tax columns, moved item entry into Details, aligned totals right, and added Save, Save & Print, and Cancel footer actions.
- Connected Quotation PO, DC, Colour, and Size item columns to the global Billing Layout switches.
- Added regression coverage for tenant access preservation and updated Billing Settings validation for the finalized payload.
- Bumped workspace version to 1.0.9.

## v-1.0.8

### [v 1.0.8] 2026-07-09 5:17 pm - update sales quotations

#### Database Changes

- Database update: Yes (auto-check).

#### App Codebase Changes

- Bumped workspace version to 1.0.8.

## v-1.0.7

### [v 1.0.7] 2026-07-08 7:28 pm - Database Lifecycle CLI

#### Database Changes

- Database update: Yes (manual).
- Added Platform database lifecycle commands for master and tenant databases: `db:migrate`, `db:seed`, `db:drop`, and `dbmigrate:fresh`.
- Added a Platform API database CLI that reuses the same Kysely migration and seed paths as application startup.
- Added tenant app-module migration and seed passes so registered tenant databases are migrated and seeded from the master tenant registry.
- Added `CODEXSUN_DB_FRESH_ON_START` to optionally drop, recreate, migrate, and seed configured databases during API startup.
- Added destructive action guards: `CODEXSUN_DB_RESET_CONFIRM=DROP_DATABASES`, plus `CODEXSUN_ALLOW_PRODUCTION_DB_RESET=1` when `NODE_ENV=production`.
- Made drop/fresh remove registered tenant databases before dropping the master database.

#### App Codebase Changes

- Simplified the tenant Countries list and editor to show only country name, country code, status, and active control;
  ISO, dial, currency, and sort-order fields remain backend-compatible but are hidden from the tenant frontend.
- Added tenant Country row actions for view, edit, suspend, and guarded force delete, with global country protection.
- Restyled the location Active control as a compact input-height status switch without helper text.
- Fixed bodyless location action requests so Suspend and Force delete are not rejected as empty JSON payloads.
- Replaced generic location duplicate failures with exact name/code conflict messages in the form error banner.
- Simplified the tenant State editor to State name, GST State code, Country, and Active in the same full-width tone as Country.
- Added State view, edit, suspend, and guarded force-delete row actions.
- Added reusable location dependency checks that block force deletion while child location records still reference a parent.
- Applied the finalized full-width master form and row-action pattern to Districts, Cities, and Pincodes.
- Replaced Pincode parent-name inputs with cascading Country, State, District, and City references.
- Enabled editing, suspension, and guarded deletion of seeded District, City, and Pincode rows inside each isolated tenant database.
- Made primary District, City, and Pincode values open Edit directly, removed redundant View actions, and protected the `-` placeholder rows.
- Backfilled seeded Pincodes with Country, State, District, and City IDs so legacy records populate relationship controls and participate in dependency checks.
- Added Tenant-pattern pagination to every location master list with rows-per-page controls, filtered totals, stable row numbering, and page reset on filter changes.
- Applied the finalized master-list pattern to Contact Groups, Contact Types, Address Types, and Bank Names.
- Added protected `-` seeds, editable seeded rows, pagination, clickable names, lifecycle menus, compact Active controls, and force delete for those four masters.
- Seeded Contact Groups with Business and Web Clients, and Contact Types with Customer, Supplier, Vendor Customer, Staff, and Employee.
- Expanded Bank Names from the current RBI directory across public, private, local-area, small-finance, payments, regional-rural, foreign, and state cooperative banks.
- Replaced protected-row text with a shared amber shield indicator and hover tooltip across location and contact masters.
- Extended the finalized protected-row, editable seed, pagination, lifecycle menu, compact Active, and no-sort-order pattern to all Product, Work Order, and Other common masters.
- Added persisted Currency symbols with INR and USD seed backfill, plus reusable missing-column migration support for common masters.
- Converted Months into FY 2026-27 accounting periods with Name, From date, To date, and Active.
- Added loud CLI/startup warnings before destructive database lifecycle actions.
- Added stable migration preflight/list/run/local-test, dump, restore-test, and backup-verification command names.
- Added explicit safety guards for restored-dump migration tests, sandbox restore tests, production backup verification, and backup artifact verification.
- Added database migration, backup, and legacy client migration runbooks plus reusable legacy intake/mapping/validation/cutover templates.
- Documented the baseline backup and restore-test schedule.
- Added console progress logs for database bootstrap, master/tenant database creation, migrations, platform app seeding,
  default tenant seeding, tenant module seeding, tenant admin seed status, and database CLI commands.
- Standardized Platform dev logs so `platform-api` displays as `api` and `platform-web` displays as `web` in stack and
  preflight output.
- Closed tenant database pools after provisioning so one-shot DB commands exit cleanly.
- Documented lifecycle switches in `.env` and `.env.example`.
- Bumped workspace version to 1.0.7.

## v-1.0.6

### [v 1.0.6] 2026-07-08 7:20 pm - Env Driven Tenant Domain Seed

#### Database Changes

- Database update: Yes (manual).
- Added `DEFAULT_TENANT_DOMAIN` so the test-only default tenant seed stores its primary domain from env.
- Added `TENANT_DOMAIN_BASE` so newly created tenant domains are generated from env instead of a hard-coded `.codexsun.local` suffix.
- Set the local/test default domain values to `localhost` in `.env` and `.env.example` while keeping seed data disabled and blank by default.
- Updated the CODEXSUN auth e2e to verify login through the seeded `localhost` tenant domain.

#### App Codebase Changes

- Removed the remaining hard-coded default tenant domain suffix from Platform API tenant seed/repository paths.
- Added `assist/documentation/project-inventory.md` as the current workspace inventory and latest work update for future agents.
- Linked the project inventory from `assist/README.md` and added it to the recommended reading order.
- Bumped workspace version to 1.0.6.

## v-1.0.5

### [v 1.0.5] 2026-07-08 7:04 pm - Test-Only Default Tenant Seed

#### Database Changes

- Database update: Yes (manual).
- Moved the default tenant seed behind `ENABLE_DEFAULT_TENANT_SEED=1`.
- Cleared fixed master database, tenant database, DB user, DB password, JWT, and seed user values from `.env` and `.env.example`.
- Made `DEFAULT_TENANT_*` optional for normal runtime and required only when the test seed switch is enabled.
- Kept CODEXSUN seed data inside e2e setup only, with disposable test databases.

#### App Codebase Changes

- Updated the environment helper banner to explain that default tenant values are test-only.
- Updated tenant database e2e setup to explicitly enable and configure the default seed for test runs.
- Bumped workspace version to 1.0.5.

## v-1.0.4

### [v 1.0.4] 2026-07-08 6:59 pm - Strict Environment Configuration

#### Database Changes

- Database update: Yes (manual).
- Removed runtime fallback database names from Platform, Core, Billing, and database helper code.
- Required `DB_MASTER_NAME`, `DB_USER`, `DB_PASSWORD`, and `DEFAULT_TENANT_*` values to come from explicit environment configuration.
- Changed the database user helper to read root `.env` and require configured admin/app user credentials and tenant database values.
- Kept e2e database tests isolated by injecting their own disposable environment values.

#### App Codebase Changes

- Added a shared missing/invalid `.env` banner with setup commands: `Copy-Item .env.example .env` and `npm run env:jwt-secret`.
- Removed runtime JWT development-secret fallbacks from Core and Billing APIs.
- Removed hard-coded admin email placeholders from shared UI layouts.
- Bumped workspace version to 1.0.4.

## v-1.0.3

### [v 1.0.3] 2026-07-08 6:52 pm - CODEXSUN Database Naming Seed

#### Database Changes

- Database update: Yes (manual).
- Changed the default master database name from `codexsun_master_db` to `codexsun_master_db`.
- Changed the default `CODEXSUN` tenant database name from `codexsun_tenant_db` to `codexsun_db`.
- Updated Platform, Core, Billing, setup tooling, and assist architecture references to use the new master database default.
- Kept the default tenant seeder idempotent so first boot creates or updates the `CODEXSUN` tenant with the new tenant database name.

#### App Codebase Changes

- Updated the `CODEXSUN` tenant auth e2e to run against disposable databases using the new naming pattern and verify seed, login, JWT/session, and tenant runtime.
- Bumped workspace version to 1.0.3.

## v-1.0.2

### [v 1.0.2] 2026-07-08 6:35 pm - Default CODEXSUN Tenant Auth Seed

#### Database Changes

- Database update: Yes (manual).
- Added an idempotent default tenant seed for `CODEXSUN` during Platform API bootstrap.
- Added `.env`-driven default tenant settings: name, corporate ID, slug, tenant database name, and default tenant admin credentials.
- Provisioned the default `CODEXSUN` tenant database with tenant module settings and a tenant-local admin user when `DEFAULT_TENANT_ADMIN_PASSWORD` is configured.
- Kept tenant identity database-owned by seeding master tenant and tenant domain rows, with `uuid` used for external JWT/session identity.

#### App Codebase Changes

- Hardened tenant login around the seeded tenant path: Corporate ID + domain resolution, tenant database lookup, tenant-local user verification, signed JWT issue, session verification, and tenant runtime access.
- Added `CODEXSUN` start-to-finish e2e coverage that boots the app, seeds the tenant, logs in, verifies the signed JWT/session, resolves runtime, and cleans up disposable databases.
- Updated platform e2e script to include both tenant database isolation and default tenant auth flows.
- Bumped workspace version to 1.0.2.

## v-1.0.1

### [v 1.0.1] 2026-07-08 2:12 pm - Clean Platform Foundation

#### Database Changes

- Removed copied demo tenant seed data from the Platform API in-memory tenant repository.
- Kept the tenant registry empty by default so the platform starts without fake customer data.
- Kept tenant module persistence as an in-memory foundation only; no production database migration was added in this baseline.

#### App Codebase Changes

- Reduced the copied workspace to the current runnable foundation: `apps/platform/api`, `apps/platform/web`, `packages/framework`, `packages/ui`, and tooling.
- Reorganized Platform Web into a clean source structure:
  - `src/app` for bootstrap, providers, router, and design-system setup.
  - `src/desks` for `/sa`, `/admin`, and `/app` desk shells.
  - `src/modules/tenant` for the tenant frontend module.
  - `src/routes/public` for home, login, and status routes.
  - `src/shared` for API client, auth gate, and document title helpers.
- Removed the old `src/pages` dumping area, copied super-admin pages, template pages, design-system demo page, and stale tenant pages.
- Added the first standard Platform API module under `apps/platform/api/src/modules/tenant` using the required module file pattern:
  - `tenant.module.ts`
  - `tenant.service.ts`
  - `tenant.repository.ts`
  - `tenant.routes.ts`
  - `tenant.events.ts`
  - `tenant.migration.ts`
  - `tenant.worker.ts`
  - `tenant.seed.ts`
  - `tenant.sync.ts`
  - `tenant.test.ts`
  - `tenant.types.ts`
  - `index.ts`
- Updated the module-boundary checker to validate the current one-folder, module-prefixed file standard instead of the older folder-heavy pattern.
- Replaced the Platform Web API client with a local envelope-aware fetch client.
- Simplified Platform API auth/session routes into a development foundation without fake tenant records.
- Cleaned `/`, `/sa`, `/admin`, `/app`, and `/status` so they no longer show demo tenant names, fake databases, fake users, scaffold labels, or copied product claims.
- Removed unimplemented future module choices from tenant setup; tenant access now only guarantees `platform.tenant`.
- Removed copied API JSON registries, old e2e references, invalid database scripts, and stale Playwright config.
- Removed unused demo dashboard blocks and fake menu defaults from `packages/ui`.
- Pruned copied public/design/print CSS from Platform Web and kept only styles used by the current routes.
- Set Vite cache under the root dependency tree and kept a single root `node_modules`.
- Kept build output collected under the root `dist/` packaging surface.
- Verified the cleaned foundation with:
  - `npm.cmd run check`
  - `npm.cmd run build`
  - route smoke checks for `/`, `/sa`, `/admin`, `/app`, and `/status`.
