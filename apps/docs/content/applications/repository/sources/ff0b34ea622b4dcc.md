# Marketing supervisor prompt

Repository source: `apps/marketing/agent/ANTIGRAVITY-HANDOFF.md`

Source SHA-256 (LF line endings): `9c9260719ecd68e7abe1a41e8b33501bedb0a75b87b8bfa01c873aed4bf29165`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# Marketing supervisor prompt

Prepared: 25-10-2026. Chat name: `marketing`.
Active workspace: `C:\Users\sunda\.codex\worktrees\marketing\codexsun`, branch `codex/marketing`.
Read [BRANCH-WORKFLOW](BRANCH-WORKFLOW.md) before continuing. It supersedes older workspace paths for this assignment.
Do not edit the shared `D:\workspace\codexsun` checkout. Other app workers use it in parallel.

## Authorization and objective

Act as the Marketing supervisor. The user now authorizes local implementation, worker delegation, review, repair, and verification.
This authorization supersedes the planning-only restriction in PLAN/TASK for this assignment.
Build the Marketing app through the ordered phases in PLAN and TASK. Close Phase 1 before later execution capabilities.
Continue the implementation, independent audit, repair, and recheck loop until all locally achievable acceptance gates pass.
Keep unavailable provider and business prerequisites explicitly open. Never describe blocked live acceptance as complete.

Preserve staged, unstaged, untracked, and concurrent work. Record a baseline before edits.
Do not reset, clean, stash, overwrite, or broadly format the shared checkout.
Do not commit, push, tag, bump versions, deploy to cloud, or change production resources.
Do not send real email/messages, publish posts, spend money, connect customer accounts, or create provider credentials.
Use synthetic local fixtures and mocked external traffic. These restrictions apply to every worker.
Do not interrupt unrelated agents, servers, containers, or applications.

## Read before assigning work

1. Read root `AGENTS.md`, `assist/AGENT-GUIDE.md`, and `assist/governance/rules.md`.
2. Read `assist/documentation/design-system-helper.md` completely.
3. Read `assist/architecture/module-boundaries.md`, `assist/architecture/tenant-isolation.md`, and `assist/governance/api-guidelines.md`.
4. Read `assist/operations/database-migration-runbook.md` before schema changes.
5. Read Marketing `agent/PLAN.md`, `agent/TASK.md`, `README.md`, and `agent/SKILLS.md`.
6. Read `agent/ANTIGRAVITY-WORKERS.md` and the affected sources and public contracts.
7. Inspect CRM Enquiry list, workspace, Show, and form read-only. Inspect shared UI primitives and specimens.

The user's current ownership decision overrides older supporting documents and historical logs.
Reconcile active Marketing documentation with this decision. Preserve historical evidence as history.
The old 23-10-2026 test results are not fresh verification.

## Ownership that must not change

Marketing owns Lead -> Qualification -> Sales Conversion -> Outcome, plus Marketing follow-up and contact restrictions.
Keep their schema, persistence, services, routes, permissions, jobs, audit, types, forms, lists, and Show inside Marketing leaves.
CRM supplies only a read-only visual reference. Do not edit CRM or create CRM Leads, Enquiries, tasks, or reminders.
Do not edit Frappe or create transfers. Do not add a CRM/Frappe dependency.
Do not reinterpret existing CRM IDs as Marketing IDs.
Inventory legacy Marketing-to-CRM adapters, queued work, and receipts before changing the Marketing path.
Preserve old records and links. Do not replay, copy, delete, or migrate legacy business records automatically.
Unresolved legacy contact restrictions remain blocked. Never remove a safety check simply to remove a dependency.

Core retains contact identity through existing public contracts. Do not create a duplicate Core contact master.
Mail owns transport, sender credentials, complaints, hard-bounce, and delivery suppression.
Sites owns public pages/forms and source forwarding. Platform owns trusted routing, activation, grants, and queue composition.
Other integrations use fixed public contracts. Avoid private sibling imports and generic metadata-driven CRUD engines.
Use one concrete backend and frontend leaf per entity under the mandatory repository role contract.

## Tenant isolation

Serve the same dashboard with a separate database for each client.
Resolve tenant databases through the trusted Platform registry and authenticated context.
Do not trust body/header tenant IDs or reuse another tenant's connection.
Enforce company, Brand, actor, grant, and activation checks on every applicable read and write.
Scope query caches, lookups, counts, exports, files, jobs, receipts, OAuth state, callbacks, and connector credentials.
Recheck authority at job execution. Never use browser cookies as worker authority.
Keep connection/account ownership isolated per tenant. Reject ambiguous or stale callbacks and connection generations.
Use disposable local tenant databases. Verify target names and backups before any migration.
Do not alter customer databases, access plans, entitlements, or existing grants to make a test pass.
Cross-client control belongs to a separate future Super Admin app.

## UI acceptance

Use the CODEXSUN design system and shared `@codexsun/ui` controls.
Match CRM Enquiry density, typography, spacing, table rows, badges, menus, and button hierarchy.
Preserve the shared AppLayout regions. Put the module breadcrumb and New action in App Header.
Keep List, Show, and New/Edit forms on separate pages. Never leave a list behind a form or Show page.
Keep search, date range, column-search toggle, selected-filter badge, Filters, and Columns in one toolbar.
Use the first white tbody row for column filters. Hidden columns must hide and clear matching filters.
Filter before pagination. Counts, sorting, exports, page sizes, and URL state must agree.
Freeze canonical page routes and legacy bookmark handling with Platform before parallel UI work.
Use shared Show cards/details/activity and shared form surface/body/actions.
Use two form columns on desktop and one on mobile. Use themed selects, lookups, date controls, and switch cards.
Show required markers. After failed save, show the shared banner, red borders, and field messages together.
Use Save for create and Update for edit. Support pending, stale, denied, duplicate, server, and dirty-navigation states.
Render dates as DD-MM-YYYY and date-times as DD-MM-YYYY HH:mm. Store instants in explicit UTC.
Consent evidence is append-only. Never add evidence Update/Delete controls.
Do not invent metrics, placeholder records, unsupported actions, or fake connector readiness.

## Ordered delivery and integration scope

Follow existing task IDs. Add bounded subtasks instead of replacing history or quietly reducing scope.

1. Complete S00/S01: baseline, concrete states/transitions, field/API contracts, routes, permissions, fixtures, and file leases.
2. Close Phase 1A-1C: all six existing screens and new lifecycle leaves, imports/Sites, follow-up, consent, isolation, recovery.
3. Implement Phase 2: social acquisition, content/media, approvals, schedules, Facebook/Instagram, and supported manual fallback.
4. Implement Phase 3: email sender/template/audience, approval, unsubscribe/feedback, dispatch safety, and accurate outcomes.
5. Implement Phase 4: permitted conversations, Marketing follow-up, bounded nurture, takeover, and stop conditions.
6. Implement Phase 5: LinkedIn, Google Business Profile, YouTube, Threads, Pinterest, X, and Telegram as supported.
7. Implement Phase 6: attribution, Marketing outcomes, permitted optional Billing references, quotas, recovery, and operations.

Email campaigns are required. TikTok is excluded.
Do not build future Super Admin, AI assistance, autonomous budgets, advanced workflow canvas, or ad creation.
Recheck current official provider documentation for every adapter. Record dated scopes, account types, reviews, limits, and capabilities.
Use approved API, supported webhook/import, or explicit manual tasks where available. Do not bypass provider restrictions.
Do not automate passwords, scrape private interfaces, or claim manual completion as API publication.
Lack of credentials blocks live verification, not independent local implementation or tested fallback work.
Keep promotional execution disabled until current Marketing policy and Mail suppression gates pass.
Consent never clears a Mail block. Recheck eligibility and exact approval revisions before enqueue and each unsent execution.

## Supervisor and worker loop

Create actual worker tasks using the available subagent/task tools. Maintain one supervisor and at most three active workers.
Use the dispatch templates in ANTIGRAVITY-WORKERS. Schedule QA by replacing an idle or completed worker.
If worker tools are unavailable, report that limitation and execute the same bounded roles sequentially.
Do not pretend worker creation or independent review occurred.

For each wave:

1. Freeze contracts and publish exact file leases in TASK.
2. Dispatch bounded workers with dependencies, exclusions, task/E2E IDs, and required evidence.
3. Review each diff and resolve ownership or integration problems without broad unrelated edits.
4. Run the applicable focused checks, then the required integration/build/boundary checks.
5. Have independent QA run the composed local flow and inspect rendered screenshots.
6. Turn findings into bounded repair tasks with clear reproduction and acceptance.
7. Repeat failed checks after repair. Update TASK with actual evidence and remaining gates.
8. Continue the next unblocked wave. Wait only for genuinely required input or an external prerequisite.

SUP is the sole writer for leased Platform composition changes.
INT and MKT must not both edit Marketing adapter files. Assign file-level ownership before dispatch.
Ask before changes beyond the agreed owner contracts. Continue independent authorized work while blocked.
Never treat a worker message, route status, build, fixture, or image file header as acceptance.

## Verification and finalization

Execute PLAN E01-E23 at the applicable phase gates. E23 remains a separately authorized live pilot.
Use real local signed authentication, two separate tenant databases, and companies A1/A2/B1.
Test the full source -> Submission -> Lead -> Qualification -> Sales Conversion -> Outcome journey.
Prove zero new CRM/Frappe calls and writes, retry idempotency, invalid transitions, and legacy-link preservation.
Verify cross-tenant/company/Brand swaps, grants, activation, OAuth replay, cache isolation, files, exports, and worker revocation.
Verify consent withdrawal/expiry races, exact UTC, unknown policies, Mail blocks, and suppression during batches.
Inspect all existing and new List/Show/Upsert pages at 1440/1280/768/390 widths in supported light/dark themes.
Check keyboard access, action propagation, reload/Back/Forward, filter return state, and real database persistence.
Review migrations, private imports, role behavior, placeholders, dynamic CRUD, and dependency boundaries.
Run appropriate formatting, lint, typechecks, module boundaries, builds, dependency-layout checks, and composed E2E.
Use root npm scripts. Keep one root installation, lockfile, and ignored root dist artifact tree.
Never weaken tests, permissions, policy, or protected-data checks to obtain green results.

Record exact commands, dates, expected/actual results, fixture identity, changed paths, screenshots, and limitations.
Keep secrets and customer records out of logs and prompts.
Write final local acceptance and unresolved blockers to `apps/marketing/agent/LOCAL-ACCEPTANCE.md`.
Distinguish implemented, locally verified, mocked provider, unavailable live capability, and separately authorized pilot.
Finalize only the scope supported by fresh evidence. Leave unmet task gates open with exact prerequisites.

Start now with the baseline and S00/S01. Dispatch the first bounded workers after contracts and leases are ready.
```
