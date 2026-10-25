# Marketing Delivery Plan

## Baseline and delivery constraints

Reviewed: 25-10-2026. Phase 1 remains open. This revision changes PLAN and TASK only.
The current request authorizes review and planning, not implementation or agent dispatch.
The receiving supervisor must obtain implementation scope from the user's actual follow-up request.
Do not commit, push, bump versions, deploy, connect customer accounts, publish, or send campaigns under this planning request.
Preserve staged, unstaged, untracked, and concurrent changes. Do not reset the shared checkout.

PLAN defines decisions and gates. [TASK](TASK.md) defines assignments, acceptance, and historical evidence.
The latest ownership decision is Marketing-owned Lead -> Qualification -> Sales Conversion -> Outcome.
CRM is out of scope for edits and new workflow integration. Its UI is a read-only visual reference.
This decision supersedes older ownership wording in supporting Marketing documents and historical records.
The 23-10-2026 results remain historical. No application, database, browser, or provider tests ran during this documentation review.
Supporting [README](../README.md) and [SKILLS](SKILLS.md) do not override the current user scope or Assist guidance.

## Required Assist and design references

Read these current repository sources before the relevant implementation wave:

- [Agent Guide](../../../assist/AGENT-GUIDE.md), including Fast Work Default, and [governance](../../../assist/governance/rules.md).
- [Design System Helper](../../../assist/documentation/design-system-helper.md), especially Compact Application Lists, Column Search, Show, Upsert, and Form Layout.
- [Tenant isolation](../../../assist/architecture/tenant-isolation.md), [module boundaries](../../../assist/architecture/module-boundaries.md), and [API guidelines](../../../assist/governance/api-guidelines.md).
- [Migration runbook](../../../assist/operations/database-migration-runbook.md) before schema or stored-data changes.
- CRM Enquiry workspace, list, form, and Show under `apps/crm/web/src/modules/enquiry`.
- Shared controls, navigation, list tools, tables, forms, Show cards, and dates under `packages/ui/src/workspace`.

Use CRM as the visual reference. Do not import its private UI or business logic.
Current design-system rules supersede older Marketing wording that implies complete CRM parity already exists.

## Product journey

Tenant login -> app access -> company setup -> Brand -> Campaign -> permitted acquisition source -> Submission -> Marketing Lead -> Marketing Qualification -> Marketing Sales Conversion -> Marketing Outcome.

Promotional delivery is a separate flow:
explicit evidence -> audience exclusions -> approved content/sender/audience revision -> scheduled execution -> current eligibility -> transport -> confirmed receipt.

An enquiry privacy notice does not subscribe its sender to promotions.
A connected social account does not establish publishing, messaging, lead retrieval, or analytics access.
Serve one shared dashboard with a separate business database and isolated integrations for each client.
Include email campaigns. Exclude TikTok. Reserve cross-client management for a separate future Super Admin app.

## Current source review and remaining gaps

These findings come from source inspected on 25-10-2026. They do not certify a running environment.

| Area                    | Source present                                                                | Remaining acceptance                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition             | Registry, tenant host, six workspaces, migrations, seeds, scoped transport    | Fresh authenticated two-tenant activation, company switching, revocation, and suspension checks                                                         |
| Lists                   | Search, Filters, Columns, URL column state                                    | CRM column-search row/toggle, date range, accurate selected-filter badge, page-size choices, matching scoped counts                                     |
| Forms                   | Standalone New/Edit modes and shared panels                                   | Current surface/body/actions structure, status switch cards, shared date controls, dirty navigation, and all error states                               |
| Show                    | Detail/activity implementations                                               | Several Show views still use upsert-dialog wrappers. Normalize dedicated Show pages and return state                                                    |
| Consent                 | Append-only email evidence and current CRM/Mail policy checks                 | Other channel policies, public unsubscribe, authenticated feedback, dispatch-bound checks, and complete batch races                                     |
| Existing legacy adapter | Review Lead intake and one follow-up task                                     | Existing source uses CRM intake. Replace the new Marketing path inside Marketing, without editing CRM or treating old records as Marketing-owned        |
| Import                  | Fixed JSON preview, validation, stable source keys, resumable results         | CSV/configurable mapping, provenance/retention review, duplicate decisions, complete recovery                                                           |
| Connections             | Google OAuth/PKCE and read-only YouTube channel discovery                     | Fresh capability evidence, refresh/revocation policy, key rotation, callbacks, other provider adapters                                                  |
| Campaign                | Active/inactive records and inactive duplication                              | An inactive copy is not an approved publishing draft. Freeze lifecycle terminology before later execution                                               |
| Local setup             | Earlier CODEXSUN setup and missing Mail entitlement were recorded             | Recheck authorized local setup. Never silently enable dependencies or claim current readiness                                                           |
| Tests                   | Isolation/consent suite, Brand/consent fixture, loader/navigation regressions | Real signed Marketing acquisition-to-outcome journey, all existing six and new lifecycle screens, tenant switching, restart/suspension, current results |

## Screen and action contract

### Shared visual pattern

Match CRM Enquiries in density, typography, spacing, heading tone, row height, borders, menus, badges, and button hierarchy.
Use theme tokens and shared `@codexsun/ui` primitives. Do not introduce another palette or local form shell.
Keep the five shared Main Layout regions and technical names. Platform owns the router adapter and App Header action target.

### List page

- Put the breadcrumb/module name and primary New action in the App Header.
- Do not repeat the title, description, or routine Refresh action in the canvas.
- Keep one toolbar: search, meaningful date range, column-search toggle, selected-filter badge, Filters, Columns.
- Show accurate counts only. Do not invent a zero-count badge when no count has been returned.
- Render column search in a white first `tbody` row, below headings, with one cell per visible column.
- Use shared list tools/column filters, `WorkspaceFilters`, `WorkspaceTable`, status badges, row actions, and pagination.
- Hiding a column hides and clears its filter. Show all restores columns. Toggle and Escape follow shared behavior.
- Apply search, status, dates, and column filters before pagination. Rows, counts, exports, and sorting must agree.
- Freeze page-size options with the API. Target the CRM pattern of 20, 50, and 100 where supported.
- Preserve search, filters, dates, page, page size, hidden columns, and column-search state in the URL.
- Show shared loading, empty, denied, unavailable, and error states without another context's stale rows.
- Keep actions last and stop action-click propagation. Every control needs a real authorized operation.

| List        | Business columns to freeze in S00                                                                                            | Date-range meaning                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Brands      | Name, timezone, website, updated by, status, actions                                                                         | Updated at                                     |
| Campaigns   | Name, permitted Brand label, objective, channel, status, updated by, actions                                                 | Updated at until explicit campaign dates exist |
| Captures    | Name, Brand/Campaign labels, allowed origin, notice version, status, actions                                                 | Updated at                                     |
| Submissions | Name, Campaign, email, phone, source, Marketing intake state, captured at, permitted Marketing Lead/conversion/outcome links | Captured at                                    |
| Connections | Name, Brand, provider, permitted account label, verified capability/health, status, actions                                  | Updated at                                     |
| Consents    | Recipient, Brand label, recorded action, notice version, evidence time, expiry, recorded by, actions                         | Evidence time                                  |

Add Lead, Qualification, Sales Conversion, Outcome and Follow-up list/Show/upsert contracts using the same CRM visual tone.
These are new Marketing screens, not CRM routes or imported private components.

These columns are planned contract work. Do not fabricate relationship labels or provider capabilities.
Use human-readable permitted labels as primary values. Keep UUIDs in restricted technical details where useful.
An evidence-action badge does not imply current promotional eligibility.

### Separate list, Show, and upsert pages

Render only the selected page view. No list remains behind an upsert or Show page.
Current Marketing uses list paths with `form`, `record`, and `show` query state. Its parser currently rejects nested record paths.
S00 must freeze canonical list/new/record/edit page paths with Platform under API Guidelines.
Preserve existing bookmarks through the agreed adapter. Browser page routes never replace module-owned API resource routes.
Test reload, Back/Forward, missing/foreign records, permission revocation, and returning to the original list filters.
Sidebar navigation opens the initial list. Dirty forms require shared keep/discard behavior before leaving.

Use `WorkspaceUpsertPage` and the shared form surface/body/actions structure.
Keep two desktop columns, one mobile column, the established ring/shadow, sharp dividers, footer spacing, and button hierarchy.
Use themed selects, `WorkspaceLookup`, shared date/date-time primitives, and `WorkspaceSwitchCard` for normal status fields.
Do not use native date/datetime inputs, raw switches, browser styling, or local shell overrides.
Render dates as `DD-MM-YYYY` and date/time as `DD-MM-YYYY HH:mm`.
Store instants as UTC and retain schedule timezone separately.
Save attempts reveal the shared banner, red borders, and field messages together. Do not show validation banners prematurely.
Duplicate, stale-revision, denied, lookup, and server errors use the shared banner. Success uses Sonner.
Save/Update apply to mutable records. Consent appends evidence and never exposes Update/Delete on an immutable entry.

Show pages use `WorkspaceShowLayout`, `WorkspaceShowCard`, and `WorkspaceDetailTable` with compact context and activity.
Place Back, Edit, and applicable lifecycle controls in the proper action region.
No chart, metric, account, publication, or delivery state may use fabricated data.

### Buttons and feature actions

| Surface                        | Relevant actions and domain limits                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Brand                          | New, View, Edit, deactivate/restore, history. Deletion requires retention and dependency decisions                                        |
| Campaign                       | New, View, Edit, duplicate under the frozen lifecycle, tracking, permitted Submission/Marketing Lead drill-down                           |
| Capture                        | New, View, Edit, preview, publish/unpublish, protected binding controls, test intake, notice/activity history                             |
| Submission/import              | Capture, preview/mapping, provenance/errors/duplicate decisions, resume/retry handoff, open permitted Lead/follow-up                      |
| Connection                     | Setup, Connect, verified account selection, capability validation, health, reconnect, disconnect                                          |
| Consent                        | Record grant/withdrawal, inspect evidence/activity and current policy. No evidence edit or Mail-block clearing                            |
| Future content/manual task     | Draft/media/preview, revision approval, schedule/cancel, safe retry, native destination/caption/media, completion evidence                |
| Future email                   | Sender/template/audience, approved test recipient, approval, schedule, pause/resume/cancel unsent work, recipient outcomes                |
| Future inbox/automation/report | Assignment, permitted reply, Marketing Lead handoff, human takeover, bounded execution, exclusions, filter, drill-down, authorized export |

Do not copy every CRM-specific action into every Marketing entity.
Hide inapplicable actions or explain unavailable capabilities. Do not render nonfunctional future buttons.
Bulk actions authorize each record and report partial outcomes. Immutable evidence and active execution records cannot be permanently deleted.

## Phase 0 decisions and contract review

Ownership planning was completed on 23-10-2026. This review updates its gap register from source.
That checkpoint does not approve provider accounts, production, sender identities, or client notices.

### App integration ownership

| Owner / gap            | Public responsibility                                                                                                                                  | Remaining contract or gate                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing, G01/G07/G12 | Brands, Campaigns, acquisition, Lead, Qualification, Sales Conversion, Outcome, follow-up, contact policy, content, audiences, consent and attribution | Build the complete lifecycle in Marketing-owned API/Web leaves, then close list, import and acceptance gates                                   |
| CRM, G01/G12           | Existing CRM remains its own owner and a visual reference only                                                                                         | Frozen for this delivery. No CRM code, schema, seeds, APIs, jobs, grants, or integration changes                                               |
| Core, G02              | Company/contact identity and minimal lookup/match contracts                                                                                            | Use existing public read contracts only where needed. Marketing owns prospect review and lifecycle. Do not modify CRM or auto-merge identities |
| Sites, G03             | Public rendering, existing SQLite/D1 enquiry ownership/outbox                                                                                          | Real published notice/origin binding, retries, source preservation, proxy rate limits                                                          |
| Mail, G04/G05          | Sender credentials, transport, suppression, verified feedback, receipts                                                                                | Campaign dispatch/status/cancel, verified sender, no shared fallback, feedback/unsubscribe in Phase 3                                          |
| Platform, G07          | Signed session, activation/RBAC, trusted routing, account claims, queue infrastructure                                                                 | Authenticated routes, revocation, restart/fairness and switching acceptance                                                                    |
| Chat, G06              | Its existing messaging transport and approved future Telegram adapter/webhook                                                                          | Recheck current exports. No duplicate credentials, callback consumer, or account-session automation                                            |
| Billing, G08           | Permitted financial outcomes and reversals                                                                                                             | Source-linked company/currency/period projection in Phase 6. No inferred revenue                                                               |
| Ecommerce, G09         | Storefront/promotion/order records                                                                                                                     | Optional minimized adapter. No assumed checkout, recoverable cart, or abandoned-cart send                                                      |
| TConnect, G10          | Enquiries, participants, messages, quotations                                                                                                          | Optional permitted handoff. No directory harvesting or competing-quotation export                                                              |
| Sportsclub, G11        | Sports enquiry and member/guardian records                                                                                                             | Optional enquiry projection. Exclude medical, photo and private-roster audience extraction                                                     |
| Frappe, G12            | Explicitly approved CRM transfer adapters                                                                                                              | No new Marketing source, Campaign/Consent export, or remote CRM read authority                                                                 |
| Zetro, G13             | AI tools, grants, providers and required confirmation                                                                                                  | Deferred read/draft proposals. Plans cannot change runtime capabilities                                                                        |
| Other apps, G14        | Their existing business ownership                                                                                                                      | No implicit dependency. Add purpose and public contract before any later adapter                                                               |

Use public exports or injected fixed contracts. Platform composition cannot own business CRUD.
Each entity owns concrete backend/frontend roles. Add asynchronous roles only for implemented behavior.
No generic metadata CRUD engine, private cross-owner imports, or arbitrary API/table helpers.

### Trusted tenancy and dependency behavior

- Resolve tenant/database, actor, company, and current grants from the signed session and registry. Reject missing or suspended mappings.
- Keep business tables in the tenant database without redundant tenant columns. Company/Brand add authorization boundaries.
- Partition browser caches, files, locks, replay keys, exports, rate limits, and connectors by trusted context.
- Shared infrastructure stores minimal routing/account claims. Recipients, content, consent, and encrypted credentials remain tenant-owned.
- Bind callbacks to provider, tenant, connection generation, session/actor, fixed destination, expiry, and single-use state.
- Jobs restore trusted context and recheck current authorization before work and between batches.
- Platform supplies trusted tenant identity. Core may supply existing company/contact reads. CRM is not a dependency of the planned Marketing lifecycle.
- Mail remains the email transport/safety owner. Marketing owns its own recipient restrictions and promotional consent.
- Persist Marketing intake and follow-up intent durably. CRM availability must not block the new Marketing lifecycle.
- Unknown policy denies execution. Do not remove existing safety checks without a reviewed Marketing-owned replacement and legacy restriction disposition.
- Any future not-applicable policy requires an owner-validated scope decision, never an error fallback.
- Recheck the historical missing-Mail-entitlement finding without automatically granting access or changing activation.
- Background automation needs a bounded revocable principal, not an expired browser cookie or cached allow decision.

### Marketing-owned lifecycle and consent flow

1. Save an owned Brand/Campaign and select a permitted acquisition source.
2. Persist Submission, source mapping/version, notice/time, test marker, replay key and intake intent in Marketing.
3. Create or deliberately link one Marketing Lead. Retain prospect facts and an optional existing Core contact reference.
4. A Marketing reviewer records a Qualification decision, reason, evidence, assignee, next action and revision.
5. A qualified Lead may create a Marketing Sales Conversion. Record the business decision and source evidence explicitly.
6. Record the Marketing Outcome, its reason/time and the related Lead, Qualification and Conversion references.
7. Marketing owns follow-up actions/reminders for this lifecycle. Do not call CRM task/scheduler services or build inside CRM.
8. Record promotional consent separately. Marketing contact restrictions and Mail/channel safety still apply before execution.

The same source/key/payload reuses its Marketing receipt. A changed payload conflicts.
Identity ambiguity requires review. Do not auto-merge by phone/email or duplicate Core's shared contact master.
Keep raw prospect details inside Marketing until an optional explicit identity link is approved.
No Sales Enquiry, CRM Lead, CRM task, invoice, order, payment or Frappe record is created automatically.
Sales Conversion is a Marketing business record, not proof of payment or recognized revenue.
Any later Billing reference is optional, separately authorized and read through its owner contract.

| Planned Marketing leaf     | Owned behavior                                                                                              | Required contract                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Lead                       | Source linkage, prospect facts, assignment, deduplication decisions, current stage and history              | Stable intake receipt, scoped list/Show/upsert, revision checks and safe deliberate linking                              |
| Qualification              | Reviewer decision, criteria/evidence, reason, next action and revision history                              | Explicit qualified/disqualified/deferred decisions. No conversion before a valid qualification                           |
| Sales Conversion           | Qualified Lead reference, business conversion decision, date, evidence and optional declared value/currency | Idempotent conversion, permission/revision checks, cancellation/reversal history. Declared value is not verified revenue |
| Outcome                    | Won/lost/nurture or other approved terminal disposition, reason/date, lifecycle references and history      | Coherent transition matrix, deliberate reopen/correction, no contradictory duplicate final outcome                       |
| Follow-up / contact policy | Marketing-owned next actions, reminders, do-not-contact/release evidence and scope                          | No CRM delegation. Bounded notifications, current grants, immutable restriction audit and fail-closed eligibility        |

E06 must cover both the positive journey and rejected transitions.
A disqualified/deferred Lead cannot convert. Concurrent/retried conversion creates one result.
Test assignment/qualification revocation, stale revisions, lost/nurture outcomes, cancellation/reversal and deliberate reopen/correction.
Preserve the source and audit history across each decision. Never convert declared pipeline value into a financial revenue claim.

All new lifecycle business code belongs under corresponding Marketing API/Web leaf folders.
SUP freezes the state-transition matrix, required fields, permissions, relationship lookups, duplicate policy and outcome correction rules in S00.
Each leaf owns its schema, migrations, validation, repository, routes, seeds, UI, activity and public exports.
Do not hide these records in Platform or a generic entity engine.

The existing implementation still contains CRM intake, CRM-linked references and a CRM-based email policy adapter.
This documentation update does not remove, disable or migrate that runtime code.
Future implementation must replace only the Marketing path and required Platform composition, without modifying CRM.
Inventory already queued jobs and old CRM-linked receipts before cutover. Do not replay, relabel, copy or delete them automatically.
Keep legacy links read-only until their disposition is explicitly decided. A CRM UUID must never be reinterpreted as a Marketing Lead UUID.
Preserve existing CRM records and grant state. CRM/Frappe code and runtime settings remain outside every agent's file lease.

Consent remains append-only. Later re-consent requires later explicit evidence.
Withdrawals remain possible when a Brand is inactive.
Marketing owns the new workflow's do-not-contact policy. Mail owns complaints, hard bounces and delivery-policy blocks.
A new grant cannot clear these blocks. Unknown or unresolved legacy safety remains blocked, not implicitly allowed.
Keep promotional execution disabled until the standalone policy and legacy restriction handling pass acceptance.
Eligibility describes check time only. Future enqueue/workers recheck authorities and exact approval revisions.

## Supervisor and sub-agent execution model

This is a future handoff protocol. No implementation agents are dispatched by this revision.
Use one supervisor and at most three active workers with the current four-slot team capacity.

| Role                          | Write boundary after implementation authorization                                                                  | Return                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| SUP: supervisor/integrator    | Contracts, file leases, PLAN/TASK, sole shared Platform adapter writer                                             | Reviewed integration, dependency decisions, phase acceptance                    |
| UI: Marketing frontend        | `apps/marketing/web`                                                                                               | CRM-tone screens and browser-ready states. No authorization decisions           |
| MKT: Marketing backend        | `apps/marketing/api`                                                                                               | Concrete list/filter/lifecycle, source/import/consent contracts and persistence |
| INT: owner integration worker | Marketing-owned adapters and existing permitted Core/Mail/Sites/Chat/Billing public contracts. CRM/Frappe excluded | Minimal owner contracts, migration and denied/replay evidence                   |
| QA: independent verifier      | Leased owner test files and `tools/e2e`                                                                            | Real signed two-tenant journeys, comparison artifacts and reproducible failures |

QA replaces an idle/completed worker. Never run four workers plus SUP.
SUP freezes request/response shapes before UI and MKT work in parallel. INT consumes the agreed public contract.
SUP owns Platform wiring. Workers return adapter requirements instead of editing the same composition files.
One agent writes a file at a time. Shared UI, routes, root scripts, and generated catalogs need an explicit lease.
Do not place Marketing business behavior inside shared UI.
Workers cannot commit, deploy, seed customer databases, enable dependencies, or contact providers because a task is assigned.
SUP reviews diffs and repeats relevant checks. Agent completion messages are not verification.

Each dispatch states task ID, exact paths, prerequisite contract, allowed actions, exclusions, fixtures, E2E IDs, and return evidence.
Return changed paths, schema/contract effects, commands/results, artifact paths, dirty-file state, and concrete unresolved failures.

## Delivery phases and exit gates

| Phase                            | Ordered delivery                                                                                                            | Completion gate                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 0: reviewed handoff              | SUP refreshes baseline, reference UI, contracts, actors/fixtures and file leases                                            | S00/S01 accepted and implementation scope recorded                                   |
| 1A: screens and list contracts   | UI + MKT + INT on separate files, then QA                                                                                   | Existing and new lifecycle list/Show/upsert surfaces match CRM. E01-E05 and E10 pass |
| 1B: Marketing sales lifecycle    | Source mapping/import review, Sites, Marketing Lead/Qualification/Sales Conversion/Outcome, follow-up and legacy cutover    | E06-E09/E13/E15 through real authenticated composition                               |
| 1C: foundation closure           | Consent regression, connector foundation, restart/revocation, migrations, export/retention policy                           | Applicable E10-E15 and the full Phase 1 journey pass. No promotional execution       |
| 2: social acquisition/publishing | Meta Lead Ads, Google Ads webhook, content/media/revisions, Facebook/Instagram, calendar/manual tasks                       | E16/E17 per enabled capability. Pending API access uses a tested supported fallback  |
| 3: essential email campaigns     | Mail contract, sender, template, audience, approval, unsubscribe/feedback, dispatch/outcomes                                | E18/E19. Live pilot requires separate authorization and verified sender/provider     |
| 4: conversations/nurturing       | WhatsApp, permitted inbox, Marketing follow-up, bounded waits/caps, takeover and stop conditions                            | E20. No queued promotional action after its tested exclusion takes effect            |
| 5: remaining channels            | LinkedIn, Google Business Profile, YouTube, Threads, Pinterest, X, Telegram                                                 | Applicable E16/E17/E20 per capability/account/tenant                                 |
| 6: attribution/operations        | Marketing Outcomes and optional Billing references, compatible spend, health, quotas, restore, retention, client acceptance | E21-E23. Separate source/local evidence from live readiness                          |

Close Phase 1 before enabling Phase 2 execution.
Later draft preparation needs a separate scoped assignment. Email remains committed scope.
Approval delays never authorize scraping, unofficial login bots, cookie capture, or false connected states.

## Channel capability plan

These are targets, not claims about current API access, quotas, prices, or reviews.
Check current official provider documentation and tenant account evidence before implementing each capability.

| Channel                        | Target scope                                                                          | Supported fallback / owner                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Facebook Pages / Meta Lead Ads | Separate publishing, lead notifications/detail retrieval, reconciliation and insights | Native task or authorized provider export/import. Marketing owns adapter/mapping |
| Instagram professional         | Supported formats, comments/messages and insights                                     | Native task for unsupported capabilities. Validate each grant independently      |
| Google Ads                     | Authenticated lead webhook/test markers, later reporting/conversion feedback          | Approved export/import. No implicit ad creation or spending                      |
| WhatsApp Business              | Authorized API/provider, templates, inbound, receipts and service-window rules        | Permitted human follow-up. No consumer-login automation                          |
| LinkedIn                       | Publishing/engagement and separately approved lead access                             | Native task or approved export. One access program does not imply another        |
| Google Business Profile        | Verified locations and supported posts/reviews/performance                            | Native location management                                                       |
| YouTube                        | Existing channel discovery. Additional upload/processing/comments/analytics contracts | Native upload/task                                                               |
| Threads / Pinterest            | Supported posts/replies/insights or Pins/boards/analytics                             | Native publishing/task                                                           |
| X                              | Explicit capabilities, usage/cost cap and quotas                                      | Native task or approved export                                                   |
| Telegram                       | Chat-owned approved bot/channel transport and permitted conversations                 | Native task. Preserve existing transport ownership                               |
| Email                          | Mail-owned verified sender, dispatch, feedback and safety                             | No promotional execution before sender/consent/unsubscribe/limits/feedback gates |

Track setup-only, approval pending, unavailable, verified, expired/reconnect, and suspended capabilities separately.
Restricted tenant setup holds ownership evidence, scopes, fixed callback, expiry, test result, quota/cost allowance, and fallback.
Never store tokens, recipient lists, passwords, or private messages in repository plans or unrestricted screenshots.

## Email, execution, and attribution contracts

Marketing owns content, audiences/snapshots, approvals, schedules, unsubscribe purpose, and recipient business state.
Mail owns sender credentials, adapters, dispatch receipts, feedback authentication, and transport safety.
Generic compose/system-send or shared environment SMTP fallback is not a campaign dispatch contract.
Sender failure must not silently switch to another company or operator sender.

Bind approval to content revision, sender/account, audience policy/snapshot, schedule generation, and limits.
Before enqueue and execution, reject missing variables, unsafe previews/links, stale approval, unverified sender, or unknown eligibility.
Use approved test recipients and exclude tests from production metrics.
Support visible unsubscribe and provider-compatible one-click behavior where applicable.
Scanner GET requests must not silently mutate consent. Use scoped tokens and idempotent withdrawal handling.
Feedback requires verified authenticity, routing and connection generation.

Use durable leases, bounded retries/backoff, fair batches, tenant quotas, frequency caps, and current principal authority.
Reconcile uncertain provider outcomes before retrying non-idempotent work.
Pause/cancel affects unsent work, not already accepted deliveries.
Stop relevant nurturing on reply, withdrawal, conversion, complaint, suspension, revoked sender/principal, or human takeover.
Prevent event loops through source/version/correlation/causation and consumer receipts. Assume no cross-database transaction.

Report submissions, unique/qualified Leads, response times, overdue work, stale data and attribution coverage from permitted owners.
Read revenue/reversals from Billing with compatible company, currency, period and timezone.
Keep provider-reported conversions separate from recorded Marketing Sales Conversions and Outcomes. Show unknown attribution explicitly.
SMTP/provider acceptance is not inbox delivery. Opens/clicks are limited signals, not proof of human engagement.
Do not infer purchases or revenue from contact/date coincidence.

## E2E acceptance specification

Use two disposable registry tenants with separate databases/credentials, companies A1/A2/B1, and Brands inside each company.
Include Admin, Viewer, restricted operator, Marketing assignee/reviewer, connection manager, and a revocable automation principal.
Use synthetic recipients, ambiguous Core identities, signed fake provider events, deterministic clocks, and private file fixtures.
Mock external traffic. Create no customer sample records or real Frappe export, publish, or send.
Cleanup must verify exact created database names and allowlisted prefixes. Retain before/after isolation assertions.

| ID  | Journey / negative case                                                                                   | Required proof                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | Real local Platform login, launcher, direct link, disabled/denied app, company selection                  | Identical dashboard for A/B. Current signed grants/registry select the database. No test-only auth bypass                                                           |
| E02 | All existing six and new lifecycle populated/empty list toolbars                                          | Search/date/status/column filters combine before paging. Counts, hidden cells, Show all, clear, Escape, page sizes and URLs agree                                   |
| E03 | Mutable New/Edit and Consent recording                                                                    | No list behind forms. Marker/banner/border/helper, valid Save/Update, stale conflict, lookup/server failure, pending state, persistence, dirty-navigation guard     |
| E04 | Show/Edit/Save/Cancel, Back/Forward, reload, legacy bookmarks                                             | Correct record/history and return filters. Missing/foreign/revoked records disclose nothing                                                                         |
| E05 | Compare CRM at 1440/1280 and 390/768 widths, supported light/dark themes and keyboard                     | Shared tone, no clipped toolbar/document overflow, readable dropdowns, proper focus/icon names, no duplicated heading                                               |
| E06 | Sites form -> Submission -> Marketing Lead -> Qualification -> Sales Conversion -> Outcome                | Correct source/notice, assignment, reviewed identity, valid qualification, one conversion/outcome and follow-up. No CRM calls/writes or automatic promotional grant |
| E07 | CSV/JSON mapping, invalid rows, duplicate source/identity, interrupted import/replay                      | Versioned preview/provenance, explicit decisions, stable resume. Same key returns receipt, changed payload conflicts, no blind merge                                |
| E08 | Crash before enqueue/after Marketing Lead or conversion commit, duplicate workers, restart/retry          | Durable intent, one Lead/task receipt, bounded retries/dead-letter, recovery and audit                                                                              |
| E09 | Existing Sites forwarding and legacy CRM-linked Marketing jobs/receipts during cutover                    | Original source/legacy links survive. New path creates Marketing records only. No CRM/Frappe calls, writes, duplicate replay or hidden data migration               |
| E10 | Consent grant/withdrawal/expiry/later evidence, inactive Brand, Marketing restriction, Mail block, outage | No inferred consent or clearing. Exact UTC, one-second-before-expiry denial, fresh decision, withdrawal-during-check rejection                                      |
| E11 | Swap headers, tenant/company/Brand IDs, caches, lookups/counts/exports/media/previews                     | Denial without foreign labels/data/credentials, reused cache, or wrong-database writes                                                                              |
| E12 | OAuth wrong session/provider, expiry/replay, collision, reconnect/disconnect                              | Bound state, encrypted grants, opaque collision, stale callback rejection, no foreign claim release                                                                 |
| E13 | Tenant/app/grant/principal revocation during requests/jobs                                                | Subsequent unsent work fails closed. No cached grant or browser-cookie worker authority                                                                             |
| E14 | Existing-data upgrade twice, failed migration, rotation plan, sandbox restore                             | Immutable applied checksums, repeatable setup, preserved data/grants, correct tenant target and recovery                                                            |
| E15 | Lifecycle/dependencies, export/bulk partial failures, retention/redaction                                 | Reauthorize every record, preserve source/notice receipts, audit decisions, no immutable evidence deletion or foreign export                                        |
| E16 | Webhook duplicate/out-of-order/tamper and capability adapter                                              | Verify signature/generation, one durable effect, quarantine ambiguous routing. Separate mocks from live evidence                                                    |
| E17 | Content approval, timezone/DST, stale edit, cancel, uncertain result, manual completion                   | Exact revision/account authority, safe reconciliation, manual evidence distinct from API publication                                                                |
| E18 | Mail sender, preview variables, audience, tests, shared-fallback failure, feedback/unsubscribe tokens     | Correct recipients/sender, no unsafe/unresolved content or fallback, authenticated replay-safe receipts                                                             |
| E19 | Withdrawal/complaint/sender revocation/suspension/cancel during recipient batch                           | Next unsent item rechecks policy. Accepted items remain accurate. No stale eligibility cache                                                                        |
| E20 | Inbox reply/takeover, conversion, caps, loops and Marketing reminder links                                | Defined stops/pauses and owner permissions. No duplicate transport or reminder owner                                                                                |
| E21 | Spend, Marketing qualification/conversion/outcome, optional permitted Billing refund/cancel               | Reconcile source, window, currency and period. Visible unknown attribution/stale data                                                                               |
| E22 | Queue fairness, quotas, private files, restore, retention and credential rotation                         | No tenant starvation/access leakage. Bounded recovery and approved redaction preserve receipts                                                                      |
| E23 | Separately authorized limited provider/client pilot                                                       | Actual account/capability, actor, scope, limits, provider reference, outcomes and remaining gaps                                                                    |

Applicable E01-E15 close Phase 1. E16-E23 belong to their later phases.
An unavailable live capability can remain disabled with a tested fallback.
No phase closes from a route, build, worker report, screenshot, or mocked provider alone.

## Verification and evidence

For this revision, check documentation formatting, component documents, local links, and task/E2E references only.
Do not run application tests/builds, migrations, runtime setup, browser actions, or provider pilots for this no-code request.
Do not broaden the change scope through generated documentation maintenance.

After implementation authorization, start with the smallest owner check.
Expand for changed contracts/data/tenancy, including applicable owner boundaries, builds and E2E.
Reuse `tools/e2e/marketing-isolation.e2e.ts`, `marketing-consent.e2e.ts`, and `marketing-browser.mjs`.
The consent file is a helper invoked by the isolation suite. Running it alone is not a complete result.
The current browser fixture covers Brand/Consent, not the full authenticated multi-tenant application.
SUP must accept the real composed journey and independent QA evidence.
Full root checks remain release/repository-wide gates under Fast Work Default, not per-leaf UI chores.
Record exact command, date, dirty baseline, fixture identities, expected/actual result, artifacts, and limitations in TASK.
Keep artifacts in ignored root `dist` and redact secrets. Distinguish source, database, browser, provider, and deployment evidence.

## Account-readiness register and release prerequisites

R01-R06 remain open and apply to each provider/campaign assignment.

| ID  | Evidence                                                                                           | Owner                       |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| R01 | Client-selected Brands/accounts, ownership and authorized operators                                | SUP + tenant setup/INT      |
| R02 | Current official capabilities, account type, scopes/reviews, availability, limits, quotas/costs    | INT per connector           |
| R03 | Provider application, privacy/deletion pages, verified domains/callbacks, rotation/revocation plan | INT + Platform/Sites        |
| R04 | Suitable bulk provider, verified sender, feedback, volume and cost cap                             | Mail                        |
| R05 | Approved notice wording, sender identity, controller/Brand scope, provenance and retention         | Client business owner + SUP |
| R06 | Separately authorized pilot and per-tenant capability evidence                                     | QA + SUP + INT              |

Unknown business facts stay empty or unpublished.
Future Super Admin, AI assistance, advanced workflow canvas, ad creation, and autonomous budgets require separate scope.

## Provider reference starting points

These references came from planning research on 2026-10-23. Recheck current versions, access, costs, and policies before implementation.
Some Meta developer pages were rate-limited during research. Exact permissions require direct account-readiness validation before enabling a capability.

- [Meta lead retrieval setup](https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md)
- [Meta Instagram collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [WhatsApp messaging policy](https://business.whatsapp.com/policy)
- [LinkedIn Community Management](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview)
- [LinkedIn Lead Sync](https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/leadsync)
- [Google Ads lead webhook](https://developers.google.com/google-ads/webhook/docs/overview)
- [Google Business Profile](https://developers.google.com/my-business/content/overview)
- [YouTube uploads](https://developers.google.com/youtube/v3/docs/videos/insert)
- [Meta Threads collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api)
- [Pinterest access tiers](https://dev.pinterest.com/docs/key-concepts/access-tiers/)
- [X access pricing](https://docs.x.com/x-api/getting-started/pricing)
- [Telegram bot documentation](https://core.telegram.org/bots/faq)
