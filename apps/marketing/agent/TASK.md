# Marketing Delivery Tasks

## Current assignment and authority

Planning review: 25-10-2026. Current assignment: rewrite PLAN/TASK only.
These documents authorize no implementation, agent dispatch, database/activation change, external send, commit, push, version bump, or deployment.
The receiving supervisor must derive implementation scope from the user's actual follow-up request.
Preserve existing staged, unstaged, untracked, and concurrent changes.

[PLAN](PLAN.md) defines current gaps, owners, CRM visual rules, phases, and E01-E23 acceptance scenarios.
Phase 1 remains open. Source presence does not close a task.
Separate historical checks, current local checks, authenticated browser behavior, provider pilots, and deployment.
Historical completed items below retain their original scope. They do not claim fresh verification on 25-10-2026.

## Current ownership correction

Marketing owns Lead -> Qualification -> Sales Conversion -> Outcome, including its follow-up and recipient restriction policy.
CRM is a visual reference only. No agent may change CRM code, migrations, seeds, settings, permissions, routes or jobs.
No new Marketing lifecycle operation may call CRM intake, qualification, conversion, task or scheduler services.
This instruction supersedes earlier ownership plans and historical completed checkpoints. Runtime cutover still requires implementation authorization.

## Historical completed checkpoints

- [x] Create README, PLAN, TASK, and SKILLS under `apps/marketing`.
- [x] Define a shared client dashboard with a separate tenant database for each client.
- [x] Define app ownership, isolated connections, CRM-style screens, email campaigns, phases, and exit gates.
- [x] Exclude TikTok and reserve cross-client administration for a separate future app.
- [x] 0.1 Review app documentation and relevant source/public contracts. Record G01-G14 and owner backlog links.
- [x] 0.2 Reconcile CRM Campaign and promotional/service Consent ownership across Marketing and CRM documents.
- [x] 0.3 Specify canonical CRM Lead intake, duplicate review, assignment, conversion linkage, and outcome contract proposals.
- [x] 0.4 Specify Mail campaign dispatch, delivery feedback, suppression, sender binding, and unsent-cancellation proposals.
- [x] 0.5 Record existing Telegram account-session behavior and assign the future Bot API transport/webhook to Chat.
- [x] 0.6 Define company/brand scope, proposed permission bundles, record visibility, revision approval, and retention ownership.
- [x] 0.7 Prepare the provider account-readiness register and fallback matrix. Actual account facts remain explicitly unverified under R01-R06.
- [x] 0.8 Specify OAuth/callback mapping, account collision handling, shared routing metadata, rotation, and future transfer policy.
- [x] 0.9 Specify public form, unsubscribe, tracking, preview, media, and existing Sites/domain-app forwarding boundaries.
- [x] 0.10 Specify disposable two-tenant fixtures and replay, callback confusion, suppression, activation, and queue failure scenarios.
- [x] 1.14a Implement and locally verify the promotional email evidence/check slice across Marketing, CRM, Core identity lookup, and Mail safety.

## Supervisor dispatch and file leases

SUP supervises and owns shared Platform integration edits.
UI owns Marketing web. MKT owns Marketing API. INT owns Marketing-side adapters and permitted non-CRM public contracts. CRM/Frappe files are excluded. QA owns leased verification files.
Use at most SUP plus three workers. QA replaces a completed/idle developer slot.

### Active File Leases (Waves 1A-1C)
- **SUP (Supervisor)**:
  - `apps/marketing/agent/TASK.md`
  - `apps/marketing/agent/LOCAL-ACCEPTANCE.md`
  - `apps/platform/api/src/marketing-host.ts`
  - `apps/platform/web/src/modules/marketing/marketing-navigation.ts`
  - `apps/platform/web/src/modules/marketing/marketing-host.tsx`
  - `apps/platform/web/src/app/app-registry.ts`
  - `apps/platform/web/src/desks/tenant/AppDesk.tsx`
- **MKT (Marketing Backend Worker)**:
  - `apps/marketing/api/src/context.ts`
  - `apps/marketing/api/src/index.ts`
  - `apps/marketing/api/src/modules/lead/**`
  - `apps/marketing/api/src/modules/qualification/**`
  - `apps/marketing/api/src/modules/conversion/**`
  - `apps/marketing/api/src/modules/outcome/**`
  - `apps/marketing/api/src/modules/follow-up/**`
  - `apps/marketing/api/src/modules/submission/**`
  - `apps/marketing/api/src/modules/brand/**`
  - `apps/marketing/api/src/modules/campaign/**`
  - `apps/marketing/api/src/modules/capture/**`
  - `apps/marketing/api/src/modules/consent/**`
- **UI (Marketing Frontend Worker)**:
  - `apps/marketing/web/src/index.ts`
  - `apps/marketing/web/src/modules/brand/**`
  - `apps/marketing/web/src/modules/campaign/**`
  - `apps/marketing/web/src/modules/capture/**`
  - `apps/marketing/web/src/modules/submission/**`
  - `apps/marketing/web/src/modules/connection/**`
  - `apps/marketing/web/src/modules/consent/**`
  - `apps/marketing/web/src/modules/lead/**`
  - `apps/marketing/web/src/modules/qualification/**`
  - `apps/marketing/web/src/modules/conversion/**`
  - `apps/marketing/web/src/modules/outcome/**`
  - `apps/marketing/web/src/modules/follow-up/**`
- **INT (Integration Worker)**:
  - `apps/marketing/api/src/modules/connection/connection.google.ts`
  - `apps/marketing/api/src/modules/connection/connection.types.ts`
  - Marketing adapter files and provider mock connectors
- **QA (Independent QA Worker)**:
  - `tools/e2e/marketing-isolation.e2e.ts`
  - `tools/e2e/marketing-lifecycle.e2e.ts`
  - `tools/e2e/marketing-browser.mjs`

### S00 Frozen Contracts & Specifications
- **State Transition Matrix**:
  - `Submission`: pending -> delivered (storing Marketing `lead_uuid`).
  - `Marketing Lead`: new -> contacted -> qualified | disqualified | deferred.
  - `Marketing Qualification`: qualified, disqualified, deferred decisions with criteria, reason, reviewer, and revision.
  - `Marketing Sales Conversion`: from qualified Lead only. Statuses: converted, cancelled, reversed with declared value/currency and cancellation reason.
  - `Marketing Outcome`: terminal disposition (won, lost, nurture, unresponsive, withdrawn). Explicit reopen/correction references previous outcome record.
  - `Marketing Follow-up / Reminders`: call, email, meeting, review with pending, completed, cancelled status.
  - `Marketing Contact Restrictions`: restricted, released with channel (email, phone, all) and immutable evidence. Mail suppressions checked in tandem; neither clears the other.
- **Canonical Web Routes**:
  - `/app/marketing/brands`
  - `/app/marketing/campaigns`
  - `/app/marketing/captures`
  - `/app/marketing/submissions`
  - `/app/marketing/leads`
  - `/app/marketing/qualifications`
  - `/app/marketing/conversions`
  - `/app/marketing/outcomes`
  - `/app/marketing/follow-ups`
  - `/app/marketing/connections`
  - `/app/marketing/consents`
- **UI Interaction & Layout Standard**:
  - One toolbar containing: Search input, `WorkspaceDateRangePicker`, Column-search toggle button (`SlidersHorizontal` with badge count), active filter badge, Filters dropdown, Columns dropdown.
  - Column search inputs rendered in first white `tbody` row using `WorkspaceColumnFilter`.
  - Separate page rendering: List, Show (`show=<uuid>`), and Upsert New (`new`) / Edit (`edit=<uuid>`). No list behind Show or Upsert.
  - Forms: `WorkspaceUpsertPage`, `WorkspaceFormSurface`, `WorkspaceFormBody`, `WorkspaceFormActions`, `WorkspaceFormGrid` (2 columns desktop, 1 mobile), `WorkspaceFormField` (with `required` red asterisk), `WorkspaceSwitchCard` for status, themed selects/lookups/dates, error banner displayed only after failed save attempt.

### S01 Recorded Baseline
- Timestamp: 2026-10-25T14:12:20+05:30
- Branch: `main` (commit head aligned with origin/main)
- Pre-existing working tree state:
  - Modified outside Marketing: `apps/billing/*`, `apps/crm/*`, `apps/platform/*`, `assist/*`, `devkits/*`, `packages/ui/src/styles.css`, `packages/ui/src/workspace/table.tsx`, `tools/*`
  - Untracked directories: `.container/agent/`, `apps/chatb/`, `apps/cxmobile/`, `apps/ecommerce/`, `apps/frappe/`, `apps/worker/`, `tools/container-testing/`, etc.
  - Marketing files modified: `apps/marketing/agent/PLAN.md`, `apps/marketing/agent/TASK.md`
  - Marketing files untracked: `apps/marketing/agent/ANTIGRAVITY-HANDOFF.md`, `apps/marketing/agent/ANTIGRAVITY-WORKERS.md`
- Preservation rule: Zero resets, stashes, commits, pushes, version bumps, or cloud deployments. Every pre-existing modification is strictly preserved.

| Order      | Assignment                                                                                                                              | Prerequisite                        | Acceptance and return                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| S00        | SUP freezes routes/query state, list/filter/date/count, relationship labels, lifecycle, scope, migrations and errors                    | Actual implementation authorization | Written contract decisions, fixture actors, exact file leases, exclusions, E2E IDs |
| S01        | SUP records current branch/dirty paths, confirms source baseline, and allocates UI/MKT/INT files                                        | S00                                 | Existing changes preserved. No shared-file collisions or assumed external access   |
| Wave A     | UI handles 1.3/1.4, MKT supplies list/1.6 contracts, MKT owns 1.10 lifecycle contracts; INT reviews Marketing-side cutover requirements | S00/S01                             | Reviewed owner work and checks. Platform requirements return to SUP                |
| Wave B     | MKT handles 1.7-1.9, MKT owns 1.10; INT handles 1.12/1.13 without CRM edits, QA starts stable E01-E07                                   | Accepted Wave A contracts           | One writer per file. Failed acceptance returns to its owner                        |
| Wave C     | INT/MKT close 1.5/1.14 regressions, QA verifies E08-E15, SUP integrates                                                                 | Waves A/B                           | Current signed-session flow, isolation/recovery proof, concrete remaining blockers |
| Phase gate | SUP reviews diffs and repeats the composed journey                                                                                      | Applicable E01-E15                  | Accept or reject Phase 1 from evidence, not worker summaries                       |

Each dispatch includes IDs, exact paths, public contracts, permitted/prohibited actions, fixtures, checks and expected evidence.
Request another lease before editing Platform, shared UI, root tooling, catalog generation, or another business owner.
No two agents write the same file. Do not reset another agent's changes or assume its output is verified.

## Phase 1: Tenant foundation and capture MVP

Broad tasks remain open under the revised acceptance gate. Existing code is the starting point.
Do not rebuild working features merely because broader acceptance is unchecked.

| Task  | Worker and boundary                           | Deliverable                                                                                                             | E2E gate                                 |
| ----- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1.1   | SUP, Platform composition                     | Signed login, launcher, enabled/disabled desk, grants, setup and migration ordering                                     | E01/E11/E14                              |
| 1.2   | MKT + SUP + INT, separate owners              | Trusted tenant/company/Brand scope across requests, caches, lookups, files, exports and jobs                            | E10-E14                                  |
| 1.3   | UI, Marketing web                             | Existing and new lifecycle list/Show/upsert surfaces follow current CRM Enquiry design                                  | E02-E05                                  |
| 1.4   | UI + MKT, leased web/API files                | Required actions, errors/revisions, lifecycle/activity, retention/export rules                                          | E03/E04/E15                              |
| 1.5   | MKT + INT, connection owner and SUP adapter   | Capability-specific OAuth, selection, encryption, refresh/revocation, collision and key policy                          | E12/E13, applicable E16 foundation cases |
| 1.6   | MKT + UI                                      | Campaign relationships/tracking, frozen lifecycle, duplication without inherited execution authority                    | E03/E04/E11/E15                          |
| 1.7   | MKT + INT Sites                               | Versioned Capture/notice, verified publication/origin, preview/unpublish, protected bindings                            | E06/E09/E11                              |
| 1.8   | MKT + UI                                      | CSV/JSON mapping, preview, provenance, errors, duplicate decisions and stable resume                                    | E07/E11/E15                              |
| 1.9   | MKT + SUP queue                               | Durable source receipt/outbox, bounded retry/recovery, handoff status and permitted links                               | E06/E08/E13                              |
| 1.10  | MKT + UI, Marketing-owned lifecycle leaves    | Marketing Lead, Qualification, Sales Conversion, Outcome, assignment and follow-up with idempotent transitions          | E06/E07/E08/E11                          |
| 1.11  | QA independent acceptance                     | Two signed local tenants, scope/header swaps, denied API/export/preview/media and cache tests                           | E01/E05/E11/E13                          |
| 1.12  | MKT + SUP, Marketing-side cutover only        | New flow calls/writes Marketing only. Preserve legacy CRM-linked receipts/jobs without replay, migration or CRM changes | E09/E13                                  |
| 1.13  | INT Sites                                     | Existing SQLite/D1 source ownership, durable forwarding/replay and outage behavior                                      | E06/E08/E09                              |
| 1.14  | MKT Marketing policy + permitted Mail adapter | Marketing-owned consent/restrictions plus Mail safety. Review legacy policy disposition without bypassing restrictions  | E10/E11/E13                              |
| 1.14b | Later channel/transport owner                 | Repeat eligibility/approval at enqueue and execution when dispatch exists                                               | E18-E20, deferred to the owning phase    |

- [x] S00 Freeze receiving-agent contracts and implementation scope.
- [x] S01 Allocate files and preserve the shared-checkout baseline.
- [ ] 1.1 Revalidate activation, app loader, setup and public composition.
- [ ] 1.2 Close request/cache/file/export/job isolation acceptance.
- [ ] 1.3 Complete all existing six and new lifecycle CRM-tone list/Show/upsert surfaces.
- [ ] 1.4 Complete relevant lifecycle/actions/activity and explicit retention/deletion exceptions.
- [ ] 1.5 Close connector foundation security and honest capability states.
- [ ] 1.6 Complete Campaign relationships/tracking/duplication under the frozen lifecycle.
- [ ] 1.7 Close verified Sites-managed Capture publication and intake.
- [ ] 1.8 Complete mapping, duplicate/provenance review, errors and resumable imports.
- [ ] 1.9 Close durable handoff/restart/replay and status acceptance.
- [ ] 1.10 Complete Marketing Lead, Qualification, Sales Conversion, Outcome, assignee and follow-up acceptance.
- [ ] 1.11 Pass authenticated two-tenant isolation and cache/export/preview denial cases.
- [ ] 1.12 Pass Marketing-only lifecycle/cutover tests with zero CRM/Frappe calls or writes.
- [ ] 1.13 Pass existing Sites SQLite/D1 intake and forwarding.
- [ ] 1.14 Revalidate the email check slice and carry later execution requirements forward.
- [ ] 1.14b Pass other channel and dispatch-bound policy gates in their later phases.

1.14a remains historically complete for the earlier CRM-linked email slice, not the revised Marketing-only policy. It does not establish a campaign sender or close 1.14b.
Do not require Phase 3 delivery to close Phase 1. Accept the Phase 1 email check contract and carry execution checks forward.

### Marketing lifecycle implementation breakdown

- [ ] M01 Define Marketing-owned Lead, Qualification, Sales Conversion and Outcome API/Web leaves and their schema/permissions in S00.
- [ ] M02 Implement stable Submission-to-Lead intake, explicit duplicate/identity decisions, assignment and activity inside Marketing.
- [ ] M03 Implement versioned Qualification evidence, reviewer/decision/reason and allowed qualified/disqualified/deferred transitions.
- [ ] M04 Implement idempotent Sales Conversion from a qualified Marketing Lead, with explicit evidence, cancellation/reversal and revision checks.
- [ ] M05 Implement coherent Outcome decisions, reason/date, deliberate reopen/correction and permitted source drill-down.
- [ ] M06 Add Marketing-owned follow-up/reminders and do-not-contact/release policy. Do not delegate either to CRM.
- [ ] M07 Inventory existing CRM-linked jobs/receipts. Plan Marketing-side cutover without rewriting, replaying or deleting legacy records.
- [ ] M08 Replace new-flow CRM integration only inside Marketing and necessary Platform composition. Make no CRM/Frappe edits or automatic migrations.
- [ ] M09 Keep consent/transport safety fail-closed until Marketing policy and unresolved legacy restriction disposition are verified.
- [ ] M10 Run E06/E08/E09/E10/E11/E13 with zero CRM/Frappe calls/writes and unchanged legacy data.

Sales Conversion is a Marketing business outcome, not an invoice, payment or verified revenue claim.
Core identity references and Billing references remain optional public integrations. They do not own the Marketing lifecycle.
Every new lifecycle module needs the same list/Show/upsert design-system and tenant-isolation acceptance as the existing screens.

### UI breakdown: list, Show, upsert

- [ ] U01 Put breadcrumb/New in the App Header. Remove duplicate canvas title/description and routine Refresh.
- [ ] U02 Keep search, shared date range, column-search toggle, accurate selected-filter badge, Filters and Columns in one toolbar.
- [ ] U03 Add the shared white column-search row below headings. Verify alignment, hiding/clear, Escape and paging.
- [ ] U04 Add contracted page sizes and scoped counts. Persist all list state in the URL.
- [ ] U05 Freeze canonical list/new/Show/edit routes with SUP and preserve existing query bookmarks.
- [ ] U06 Render one page view only. No list behind an upsert or Show. Handle missing/foreign/revoked records.
- [ ] U07 Use shared surface/body/actions, date/date-time controls, themed select/lookup, status switch cards and footer.
- [ ] U08 Preserve Save/Update, required markers, delayed banner/border/helper validation, pending/error states and dirty navigation.
- [ ] U09 Use dedicated compact Show/context/activity cards and contextual actions with permitted parent labels.
- [ ] U10 Preserve immutable Consent behavior. Distinguish evidence action from current eligibility.
- [ ] U11 Compare every screen with current CRM Enquiries in the real shell at desktop/mobile widths and supported themes.

Return E02-E05 evidence for each page. One Brand screenshot does not cover all entities.
Mutable records need Edit/revision tests. Consent needs append/replay checks and no forbidden Edit/Delete.
Every domain-specific button needs its own working authorized operation.

## Account and client rollout prerequisites

These previously open gates remain open. Keep credentials outside repository documents.

- [ ] R01 Verify client-selected Brands/accounts, ownership evidence and authorized operators.
- [ ] R02 Verify current official capabilities, scopes/reviews, limits, availability, quotas and costs.
- [ ] R03 Verify provider/privacy/deletion setup, domains/callbacks and credential handling.
- [ ] R04 Verify the tenant bulk sender/provider, feedback, volume allowance and cost cap.
- [ ] R05 Obtain business approval for notice, sender details, controller scope, provenance and retention.
- [ ] R06 Run only separately authorized pilots and retain per-tenant capability evidence.

## Later phases: retained scope and assignment

Earlier Phase 2-6 tasks remain open with stable IDs below.
UI owns Marketing screens. MKT owns Marketing business records. INT owns permitted transport/source adapters. CRM/Frappe edits and new dependencies are excluded.
SUP freezes shared contracts and integrates Platform. QA independently executes the phase gate.
Phase 2 uses E16/E17. Phase 3 uses E18/E19. Phase 4 uses E20. Phase 5 uses the applicable connector/inbox gates.
Phase 6 uses E21-E23 and operational cases from E11/E13/E14/E22.

## Phase 2: Social lead capture and publishing

- [ ] 2.1 Implement Meta Lead Ads notification, detail retrieval, source mapping, and supported reconciliation.
- [ ] 2.2 Implement Google Ads lead webhook verification and separate test submissions from production.
- [ ] 2.3 Build content drafts, revisions, media library, channel variants, and per-channel previews.
- [ ] 2.4 Build revision-bound approval, rejection reasons, scheduling, cancellation, and timezone handling.
- [ ] 2.5 Implement Facebook Page publishing for verified capabilities.
- [ ] 2.6 Implement Instagram professional publishing for verified formats and capabilities.
- [ ] 2.7 Build calendar and manual publishing tasks with evidence, native destination, media download, and caption copy.
- [ ] 2.8 Implement durable publication jobs, rate limits, uncertain-result reconciliation, and safe retries.
- [ ] 2.9 Verify reconnect, token expiry, stale callbacks, cross-tenant account collision, and disconnect behavior.

Exit evidence: authorized live lead and publishing pilots, provider references, replay tests, and restart recovery.
Manual confirmation remains distinct from API-confirmed publication.

## Phase 3: Email campaigns

- [ ] 3.1 Extend Mail public contracts and assess a suitable bulk email transport/provider.
- [ ] 3.2 Verify sender/domain ownership and SPF, DKIM, DMARC, provider limits, and feedback capability.
- [ ] 3.3 Build email campaign list, Show, upsert, sender selection, subject, preheader, and HTML/plain-text templates.
- [ ] 3.4 Build sanitized desktop/mobile preview, variable validation, and approved test-recipient sends.
- [ ] 3.5 Build segments, consent evidence, exclusion review, deduplication, and approved audience snapshots.
- [ ] 3.6 Implement preference management, visible unsubscribe, applicable one-click unsubscribe, and scoped public tokens.
- [ ] 3.7 Integrate authenticated bounce, complaint, delivery, and unsubscribe events through Mail.
- [ ] 3.8 Enforce campaign and delivery-safety suppression at enqueue and execution, including active-batch withdrawal.
- [ ] 3.9 Build revision-bound approval, schedule, batched sending, pause/resume, unsent cancellation, and safe retry.
- [ ] 3.10 Build recipient outcomes, limited engagement metrics, audit, quotas, and authorized exports.
- [ ] 3.11 Run a limited approved live pilot and reconcile transport acceptance against available delivery evidence.
- [ ] 3.12 Block implicit environment/shared-sender fallback for campaign dispatch without changing existing non-campaign transport behavior.

Exit evidence: verified sender, correct recipients, functional unsubscribe, suppression race tests, and isolated delivery records.
SMTP acceptance, open pixels, and scanned links must not appear as proven inbox delivery or human engagement.

## Phase 4: Conversations and nurturing

- [ ] 4.1 Implement tenant-owned WhatsApp Business connection using Cloud API or an authorized provider.
- [ ] 4.2 Enforce consent, approved templates, service windows, limits, and escalation.
- [ ] 4.3 Build permitted inbox threads, assignment, replies, drafts, resolve/reopen, and Marketing Lead/conversion/outcome links.
- [ ] 4.4 Add bounded automation templates with versioned triggers, conditions, delays, caps, and approved actions.
- [ ] 4.5 Build Marketing-owned follow-up actions and reminders linked to its Leads/conversions. Do not call CRM tasks or schedules.
- [ ] 4.6 Stop or pause relevant enrollment on reply, opt-out, conversion, complaint, suspension, or human takeover.
- [ ] 4.7 Prevent integration event loops and duplicate cross-app actions.
- [ ] 4.8 Verify current authorization, consent, account rights, and approval again before every external action.

Exit evidence: verified inbound/outbound pilot and no queued action after the tested stop condition takes effect.

## Phase 5: Remaining channels

- [ ] 5.1 LinkedIn: approved publishing/engagement and separately approved Lead Sync.
- [ ] 5.2 Google Business Profile: verified locations and supported posts/reviews/performance.
- [ ] 5.3 YouTube: authorized uploads, visibility, processing, quota, and supported analytics.
- [ ] 5.4 Threads: authorized content, supported replies, and insights.
- [ ] 5.5 Pinterest: production access, Pins/boards, visibility, and supported analytics.
- [ ] 5.6 X: authorized capabilities, usage budgets, cost limits, and supported fallback.
- [ ] 5.7 Telegram: new Chat-owned Bot API adapter/transport contract, bot/channel rights, webhook receipts, and recipient eligibility. Preserve existing account-session polling.
- [ ] 5.8 For each channel, test OAuth, account binding, callbacks, formats, limits, revoke/disconnect, and tenant isolation.
- [ ] 5.9 Record unavailable features accurately and provide supported manual/import workflows.

Exit evidence: per-channel capability records and live evidence for every feature marked enabled.
TikTok remains excluded. No channel is complete merely because its connector settings screen exists.

## Phase 6: Attribution and operational readiness

- [ ] 6.1 Add consent-aware touchpoints, source mapping, spend imports, windows, and currency/timezone rules.
- [ ] 6.2 Reconcile provider reports with Marketing Qualification/Sales Conversion/Outcome and optional permitted Billing references.
- [ ] 6.3 Report cost per Lead/qualified Lead, response time, overdue follow-up, stale data, and attribution coverage.
- [ ] 6.4 Add permitted conversion feedback with deduplication and explicit tenant approval.
- [ ] 6.5 Complete tenant quotas, queue fairness, health, dead-letter review, and operational alerts.
- [ ] 6.6 Verify tenant backup/restore, retention, redaction, credential rotation, and private file access.
- [ ] 6.7 Run browser acceptance for list/Show/upsert, all applicable buttons, responsive widths, and keyboard access.
- [ ] 6.8 Complete automated checks, migration upgrade evidence, client pilot, and operational documentation.
- [ ] 6.9 Record deployment separately after explicit release authorization.
- [ ] 6.10 Add optional minimized Ecommerce, TConnect, and Sportsclub source adapters only after their owner backlog and consent gates pass.

Exit evidence: reconciled reports, tenant recovery drill, operational review, and a complete approved client journey.

## Deferred scope

- Separate Super Admin app for audited cross-client management.
- Advanced visual workflow builder after bounded templates prove useful.
- AI assistance through Zetro with explicit grants and action confirmation.
- Full advertisement creation and automatic budget/optimization actions after separate planning.

## Verification procedure for receiving agents

For this planning revision: format PLAN/TASK, check component documents, and validate local links and task/E2E references.
Do not run application E2E, builds, migrations, setup, browser actions or provider calls for this no-code request.

After implementation authorization:

1. SUP records fixtures, grants, trusted setup, before-counts and expected source receipts.
2. Workers run the smallest relevant owner checks. Contract/data changes also need applicable boundaries and database tests.
3. QA runs `node --import tsx --test tools/e2e/marketing-isolation.e2e.ts`.
4. For the existing fixture browser, set `CODEXSUN_MARKETING_BROWSER=1` in that command's process.
5. Treat `marketing-consent.e2e.ts` as the isolation suite's helper. The existing browser fixture covers Brand/Consent only.
6. Add or extend actual signed-Platform E01-E15 coverage. Do not invent a command for a suite that does not exist.
7. Verify changed-owner typecheck/lint, applicable boundaries/builds and migration upgrades when their boundary changed.
8. Keep full root checks/builds as explicit release/repository-wide gates under Fast Work Default.
9. Run provider tests only with separate live-action authorization. Mocks cannot close R06/E23.
10. SUP reviews the diff, repeats the composed flow, and records failures before accepting a phase.

| Evidence field        | Required entry                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Assignment            | Task/E2E IDs, owner, scope and file lease                                                         |
| Baseline              | Date/time, branch/HEAD, pre-existing dirty paths, contract revision                               |
| Fixtures              | Disposable tenant/company/Brand/principal IDs, synthetic sources, no secrets                      |
| Operation             | Exact command or signed-browser steps, expected/actual result and exit status                     |
| Persistence/isolation | Correct database receipt/count, denied foreign effect, stable retry, preserved unrelated data     |
| UI artifacts          | CRM comparison plus list/Show/upsert screenshots at named widths/themes under ignored root `dist` |
| Limitations           | Untested behavior, missing dependencies/readiness, concrete failure and next owner                |
| Acceptance            | Independent SUP/QA evidence or explicit rejection/blocker                                         |

## Phase completion decision

- [ ] SUP confirms applicable E01-E15 evidence or a documented domain-specific exception for every Phase 1 task.
- [ ] QA passes the signed journey: tenant -> Brand -> Campaign -> source -> Submission -> Marketing Lead -> Qualification -> Sales Conversion -> Outcome.
- [ ] QA repeats tenant B and denies cross-tenant/company/Brand operations and stale browser caches.
- [ ] UI parity, validation/navigation, persistence, identity, consent, restart/revocation, export and retention boundaries pass.
- [ ] SUP records pending live/account gates and keeps unsupported execution disabled.
- [ ] No commit, push, version bump, deployment or external action occurred without its own user authorization.

## 25-10-2026 planning review

Reviewed current Assist, Design System Helper, CRM Enquiry UI, Marketing contracts and existing test harnesses.
The subsequent user correction assigns the entire Lead-to-Outcome lifecycle to Marketing and freezes CRM edits/integration.
Rewrote the active handoff with supervisor/sub-agent leases, contract dependencies and E01-E23 acceptance.
Historical states and evidence below remain historical. No code, schema, runtime setting or customer record changed in this planning revision.
No application E2E, live provider check, activation or deployment was performed.

## Local implementation and verification log

Earlier records are retained verbatim below. Their CRM ownership/integration wording is superseded by the current Marketing-owned scope. They are not fresh acceptance of the revised plan.
Earlier Phase 0 references describe the original checkpoint. The current source/gap map is in PLAN.

## Evidence log

### 2026-10-23 Phase 0 planning reconciliation

- Reviewed CRM, Core, Sites, Mail, Chat, Platform, Billing, Ecommerce, TConnect, Sportsclub, Frappe, and Zetro documentation and relevant source surfaces.
- Replaced planned CRM Campaign CRUD with a Marketing lookup/reference and generic CRM Consent with sales/service contact policy.
- Preserved existing CRM Contact Preferences, Sites SQLite/D1 intake, Ecommerce promotions, TConnect/Sportsclub business records, and Frappe transfer scope.
- Corrected Telegram planning to reflect existing account-session polling and a separate future Chat-owned Bot API adapter.
- Recorded SMTP shared-fallback risk, missing email safety contracts, source-aware Frappe export gate, and no-write Zetro runtime constraints.
- Added owner-specific implementation backlog and Phase 0 contract, gap, permission, dependency, readiness, and fixture specifications.
- No app source, migrations, runtime rules, package configuration, client connections, or live data changed in this planning task.
- `npm run check:component-docs`: passed, 33 owners with four required files each.
- `npm run test:component-docs`: passed, 2 tests.
- Prettier check: passed across the 30 updated owner documents.
- Marketing local file links: checked 10 targets with no missing files.
- Reconciliation scan found no remaining CRM Campaign-build or generic campaign/service Consent ownership wording in CRM/Marketing plans.
- `git diff --check` passed for the selected tracked documents. Marketing remains an untracked documentation directory in the existing working tree.

### 2026-10-23 documentation baseline

- Created the four component documents. No runtime code or package configuration was added.
- `npm run check:component-docs`: passed for 33 component owners, with four required files each.
- `npm run test:component-docs`: passed, 2 tests.
- Prettier check: passed for all four Marketing Markdown files.
- No API, database, browser, provider, email delivery, or deployment verification is claimed.

For later work, record phase/task, command or live scenario, tenant fixtures, date, result, and remaining limitation.
Never store credentials, recipient lists, or private message content in this evidence log.

### Earlier local implementation and verification log

### 23-10-2026: Phase 1 foundation, local work only

The user resumed local implementation after stopping cloud deployment.
No new commit, push, version bump, cloud operation, or existing customer migration was performed during this local continuation.
Unrelated CRM, Frappe, Platform, and other working-tree changes were preserved.

Implemented source:

- Tenant Marketing registration, opt-in activation, permission seeds, additive migrations, and Platform menu composition.
- Separate tenant databases, saved default-company context, creator-owned brands, and an explicit manage-all grant.
- Brands, campaigns, capture forms, and connection setup with required validation, audited status changes, and revision checks.
- Shared CRM-style list, Show, upsert, relationship lookups, status filters, pagination, direct links, and browser refresh state.
- Campaign tracking identity and inactive duplication. Duplication does not authorize publication or sending.
- Google OAuth with PKCE, session-bound single-use state, verified channel selection, encrypted grants, account claims, and local disconnect.
- Public capture bindings for verified tenant domains, source validation, bounded payloads, notice evidence, and abuse limits.
- Strict JSON import preview and resumable results. Privacy consent remains separate from promotional consent.
- Durable submission storage before queue enqueue. Queue payloads contain references, trusted tenant identity, and company scope.
- Platform handoff processor, expired-job recovery, and rotating pending scans. A revoked actor cannot permanently block later pending records.
- CRM-owned canonical Lead intake, stable source receipts, review-only identity, assignment, and one transactional follow-up task.
- CRM Lead list and Show with a link to the assigned follow-up task. No automatic Contact merge or Enquiry/Frappe export.
- Sites-owned public capture rendering and durable SQLite/D1 forwarding. Existing enquiry ownership and source receipts remain unchanged.
- Framework request telemetry omits query values. Shared Tailwind scanning includes Marketing source.

Local evidence:

- Disposable MariaDB tests ran against two separate databases and removed only the verified disposable database names.
- Tested persisted records, company/brand scope, tenant swaps, foreign identifiers, denied grants, and strict forged payload rejection.
- Tested duplicate source replay, changed-payload conflict, pending intent after enqueue failure, and one CRM Lead/follow-up result.
- Verified Marketing intake created no CRM Enquiry or Frappe sync queue row.
- Tested OAuth session mismatch, callback replay, unverified account selection, encrypted storage, and disconnect with a simulated provider.
- Tested public origin rejection, token tampering, unavailable tenant context, inactive parent, duplicate receipt, and stale-edit conflict.
- Eight focused Sites tests passed for SQLite/D1 intake, durable forwarding, retry, safe rendering, forged scope/origin rejection, and Worker scheduled execution context.
- Framework query-redaction and Marketing desk-route regression tests passed.
- Cross-tenant provider account collisions and another tenant's release attempt were rejected in a disposable registry fixture.
- Full `npm run check` passed: component documentation, cleanup, boundaries, add-ons, synchronized Docs, 113 typecheck/build prerequisite tasks, and 59 lint tasks.
- Docs synchronization verified 574 pages across 29 groups. Added references cover the new Marketing and CRM Lead modules.
- Dependency layout passed. The Git HEAD remained `37310270` throughout this local continuation.
- Marketing, CRM, Platform, and Sites API/web typechecks passed at the recorded checks.
- Marketing, CRM, Sites, Framework, and Platform API lint passed. Platform web lint passed after the Lead render composition correction.
- Marketing, CRM, Sites, and Platform API builds and the Platform web production build passed locally.
- Module boundary and root dependency-layout checks passed.
- The Chrome fixture journey exercised the real Brand workspace against its disposable database API: validation, create, Show, refresh, Edit, Cancel, and a 390-pixel viewport without document overflow.

Coverage limits and remaining Phase 1 acceptance:

- The browser fixture is not a signed Platform-login or entitlement-activation test. Verify the complete authenticated desk separately.
- Repeat browser acceptance across Campaign, Capture, Connection, Submission, and CRM Lead workflows and configured tenant branding.
- Complete authorized export, advanced column controls, safe bulk actions, and retention/redaction acceptance under 1.4.
- Complete configurable import mapping and duplicate decisions under 1.8.
- Complete Core identity match review and CRM qualification/link decisions under 1.10.
- Complete the effective promotional eligibility contract across Marketing consent, CRM restrictions, and Mail suppression under 1.14.
- No promotional execution path is enabled. Do not interpret capture consent or imported data as permission to send campaigns.
- Complete full Platform queue restart/activation tests, browser tenant switching, and tenant suspension/revocation race tests under 1.2 and 1.11.
- Google live authorization, refresh/revocation policy, key rotation, and actual provider capability pilots remain unverified.
- Other social connectors and email campaign transport belong to their planned later phases. Setup records do not establish live connections.
- Public capture through a Sites proxy shares the proxy source-IP quota. Review this before client rollout.
- Existing customer migrations, tenant enablement, live credentials, remote D1 migration, cloud deployment, commit, and push were not performed.

Keep Phase 1 unchecked until its broader exit gates pass. Source presence and a successful build do not close those gates.

### 23-10-2026: Local app-loader and tenant desk wiring

Added Marketing to the App Catalog stack type, validation, and selection control.
The tenant desk checks Marketing activation for direct routes and uses the CRM sidebar branding treatment.
Platform health lists all five public Marketing module keys.
Loader regression tests cover opt-in activation, launcher selection, catalog validation, and all five menu destinations.

Enabled only the local development CODEXSUN tenant after verified SQL backups of its tenant database and local registry.
Backup dumps, SHA256 checksums, before/after metadata, and preservation assertions are under the ignored local directory
`dist/.cache/codexsun-marketing-loader-backup-1792758599585`.
Ran additive Marketing and CRM Lead migrations and permission seeds through public owner exports.
Added audited tenant exceptions for Marketing and the already enabled CRM dependency.
Existing enabled modules, landing app, non-Marketing module settings, and checked CRM/Core/user row counts stayed unchanged.
The other local tenant registry metadata stayed unchanged. No business sample records were created.

Signed-session checks used the actual local Platform frontend and API with the CODEXSUN tenant admin session:

- Application overview displayed Marketing and the Apps menu included Marketing.
- All five sidebar routes opened their own lists with the shared header, filters, and pagination.
- Brand, Campaign, Capture, and Connection upsert forms opened. Submission capture and import dialogs opened.
- Forms and dialogs were closed without creating customer data or initiating provider authorization.
- Authenticated list requests succeeded for all five Marketing entities and CRM Leads.
- Reloading the Connections URL preserved the signed session and selected workspace. Authenticated list requests then passed again.
- The running local health endpoint reported all five Marketing modules.
- Marketing/Platform API and Platform web typechecks passed. Focused loader/navigation tests, lint, and module boundaries passed.
- Platform web production build passed, with existing bundle-size and HRMS import warnings. Component documentation and synchronized Docs checks passed.

The prior disposable browser test remains the write/Show/Edit evidence.
This real tenant preview does not prove every signed-session write, browser tenant-switch race, live provider, or queue restart case.
A transient local API watcher restart required a list refresh during verification.
No commit, push, version bump, or deployment was performed for this wiring.

Next Phase 1 work: complete task 1.14 with Marketing-owned promotional evidence, CRM restriction checks, and Mail safety checks.
Missing or unavailable authority must deny promotional eligibility. Continue lifecycle/import/identity and queue acceptance afterward.
Keep external campaign delivery disabled until its execution and readiness gates pass.

### 23-10-2026: Promotional email eligibility and separate upsert pages

Implemented an append-only consent leaf with company/brand scope, explicit evidence, notice version, expiry, request replay, withdrawal, and stale-grant rejection.
CRM owns append-only email restrictions. Mail owns append-only complaint, hard-bounce, and delivery-policy suppression.
A public Core lookup returns all recipient identity IDs without merging records or exposing contact details.
The injected eligibility contract reads all authorities and fails closed on missing data, disabled access, permission denial, or owner failure.
A withdrawal during the check invalidates its result. Consent is read again before returning the assessment.
Eligibility does not enqueue or send email. Other channels and non-promotional purposes are rejected.

Added the Consents sidebar page, list, standalone evidence form, immutable Show/activity, and fresh eligibility action.
Brand, Campaign, Capture, Connection, and Submission upserts now render separate page views using CRM-style shared primitives.
The list is absent during form mode. Edit/create URL state and Cancel behavior remain available.
All six Marketing lists put Filters and Columns beside search. Column selections use URL state and restore through navigation.

Applied only additive consent/restriction/suppression migrations and their new permission seeds to local development CODEXSUN.
Verified full local registry/tenant SQL backups and SHA256 manifests are stored under ignored root output:
`dist/.cache/codexsun-marketing-consent-backup-1792760438027`.
Checked business row counts, module settings, enabled modules, landing settings, and other tenant registry metadata stayed unchanged.
The local Mail entitlement remains absent. A missing Mail authority must block eligibility until explicitly configured.
No customer sample records, new provider grant, external send, commit, push, version change, or deployment was created.

Local database and browser evidence:

- The disposable two-database suite passed with persisted consent, exact request replay, changed-key conflict, expiry, withdrawal, later re-consent, and stale grant rejection.
- CRM do-not-contact and legacy preference review blocked eligibility. Core identities were checked without a merge.
- Mail complaint and hard-bounce blocks survived new promotional grants. Missing CRM/Mail authority blocked checks.
- A withdrawal between owner checks blocked the result. Forged scope fields, denied grants, foreign identifiers, company changes, and another brand owner were rejected.
- The Chrome fixture passed standalone Brand/consent form validation, persisted create, Show, reload, fresh eligibility, uncached allow results, Edit, Cancel, and a 390-pixel viewport.
- The signed local CODEXSUN desk displayed the Consents list/form, required-field errors, and CRM-style search-toolbar Filters and Columns.

Remaining limits:

- Email is the implemented eligibility channel. Other social/message authorities remain in their planned phases.
- Provider feedback verification, public unsubscribe tokens, approved suppression release, campaign dispatch, and complete batch suspension races remain open.
- A manual evidence reference records an authorized operator assertion. It does not prove client notice approval or live provider permission.
- Complete the broader lifecycle, authorized exports, import mapping/duplicate decisions, identity review, and queue restart gates before closing Phase 1.

Final checks for the consent/page continuation:

- Typecheck passed for Marketing API/Web, CRM API, Mail API, Core API, and Platform API/Web.
- Lint passed for the same affected owners. Module boundaries passed for Marketing, CRM, Mail, Core, and Platform.
- Focused loader/navigation regression tests passed. Component-document checks/tests and root dependency layout passed.
- Production builds passed for Marketing API/Web, CRM API, Mail API, Core API, and Platform API/Web.
- Platform web build warnings concern existing bundle size and the HRMS static/dynamic import combination.
- Docs synchronization and coverage include the three new owner module references.
- The two-database suite also verifies exact UTC evidence/audit timestamps and a grant that expired one second before the check.
- Repositories write UTC strings and UTC audit values explicitly, avoiding driver-local Date conversion. Existing applied migration steps were not rewritten.
- Inactive brands reject grants but still accept authorized withdrawals.
- Signed-session checks opened all six standalone forms without a list behind them. Brand column selection survived a full reload through URL state.
- Real customer business records were not used for the browser write journey. Its generated screenshots use disposable test data under root `dist`.
- Full monorepo `npm run check`, live provider feedback, public unsubscribe, campaign dispatch, browser tenant switching, and full batch suspension tests were not repeated or completed for this slice.

Next Phase 1 priority: controlled import mapping and explicit duplicate/provenance decisions under 1.8, followed by remaining identity and lifecycle acceptance.
