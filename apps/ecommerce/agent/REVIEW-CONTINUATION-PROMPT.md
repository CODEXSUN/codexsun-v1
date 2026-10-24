# Ecommerce review repair and completion prompt

Use this prompt in one supervisor session. The human explicitly authorizes supervisor and subagent implementation.
Saving this file does not start agents or prove completion.

```text
You are the single Ecommerce supervisor and integration owner for D:\workspace\codexsun.

The human authorizes you to complete EC-R01 through EC-R09, fix every applicable review finding, test and independently review the repairs, then continue the remaining local Ecommerce tasks through verified release readiness. Do the implementation, not another planning-only pass.

READ FIRST
Read AGENTS.md, assist/AGENT-GUIDE.md, assist/governance/rules.md, assist/architecture/module-boundaries.md, assist/architecture/tenant-isolation.md, assist/governance/api-guidelines.md and assist/documentation/design-system-helper.md.
Read apps/ecommerce/README.md and apps/ecommerce/agent/PLAN.md, TASK.md, SKILLS.md, E2E-PLAN.md, EXECUTION.md, CONTRACTS.md and DECISIONS.md.
Read apps/ecommerce/agent/DELIVERY-REVIEW-2026-10-24.md in full. Its EC-R01–EC-R09 register defines the repair scope.
Read the original EC-T00–EC-T17 packets under apps/ecommerce/agent/tasks and SUPERVISOR-PROMPT.md.
This continuation takes precedence over stale task acceptance claims. Current repository rules and verified source take precedence over historical summaries.
Read each affected component's README.md and agent/TASK.md, PLAN.md and SKILLS.md before changing that owner. Apply the code-style skill.

FIRST ACTIONS
Capture the current revision, dirty baseline, changed files, existing worker activity and available tools. Preserve unrelated edits.
Recheck the findings against current source because another agent may have changed it. If a finding is already repaired, verify it and record evidence rather than duplicating work.
Perform EC-R06 ledger reconciliation first. Retain historical evidence but establish one unambiguous current status per task.
Reopen EC-T02 against the original local-only requirement until EC-R01/EC-R02 pass. Qualify EC-T01 as tenant-boundary evidence, not complete portal authorization.
Record actual models and host capabilities. Do not silently substitute models, invent worker sessions, or claim unavailable tools ran.

SUPERVISOR AND SUBAGENTS
Keep exactly one supervisor. Use supported native subagents for independent producer and reviewer assignments.
Start conservatively with two implementation workers plus a reviewer when resources allow. Increase only when write scopes and tests are independent.
Each dispatch contains the task/subtask ID, accepted prerequisites, contract revision, base revision, exact allowed paths, reserved paths, lease generation/expiry, budget, tests and stop conditions.
Do not grant overlapping write leases. Workers must not spawn more workers without a separate supervisor assignment.
The supervisor owns shared manifests, lockfile, public exports, routes/menu composition, shared styles, migration registration, contract/decision changes and task statuses.
Serialize dependency installation, shared builds, migration integration and fixture cleanup. Never create nested node_modules, lockfiles or build output.
Workers report changed paths, exact commands/results, migration impact, evidence, and remaining issues. They cannot accept their own work.
Assign an independent reviewer. Integrate repairs, rerun affected checks on the combined source, and only then mark accepted.
If native subagents are unavailable, disclose that limit and preserve the same implementation/review gates. Do not fabricate independent review.

REPAIR SCOPE
EC-R01: Make normal published catalog reads local-only, even with legacy Frappe provider selections and a healthy connection. Preserve imported data, enabled flags, UUIDs, source links, media and settings. Keep transfer operations explicit and separately authorized. Review dependent labels and image resolution without silently dropping imported records.
EC-R02: Add zero-remote-call regression tests for every public feed. Record failure against the old implementation and success after the fix. Tests must reject every remote read, not only snapshot/pull operations. Keep explicit transfer tests separate.
EC-R03: Test the actual /cart route with cart-specific assertions. Require exact product identity and controls. A catalog fallback or generic body text must fail the expected-page test.
EC-R04: Add populated disposable fixtures for product, variants, gallery and homepage sections. Required product/image coverage cannot silently skip. Wait for required images and verify loaded bytes, containment, text fit, navigation, staff persistence and paging. Separate empty-store smoke checks from acceptance checks. Verify 1440/768/390/320 layouts and raw-HTML SEO accurately.
EC-R05: Create real foreign-tenant assets and positive controls before asserting cross-tenant denial. Verify exact authorized records/counts. Distinguish tenant isolation from company/customer/vendor record scope. Add actual portal-principal tests when those contracts exist. Keep single-mode and DNS-verification gaps explicit until tested.
EC-R06: Reconcile current TASK/EXECUTION/README claims, historical tables and acceptance limits. Preserve reviewer history. Record exact source revisions, test file lists and effective models. Keep concise durable evidence in tracked packets and raw artifacts under root dist.
EC-R07: Turn technical provider gaps into concrete compatible contract-review tasks for portal principals, Billing idempotency/handoff, queue/outbox, Mail/Chat and marketplace finance. Record impact before changing another owner. Resolve routine technical choices autonomously. Escalate only genuine unresolved business/security decisions with concrete options. Continue independent ready work.
EC-R08: Repair legacy Ecommerce E2E entry points with disposable configuration. Preserve safety guards. Do not edit production .env to pass tests. Guard computed cleanup paths using resolved-root containment, ownership and symlink/junction checks. Prove failure cleanup without deleting pre-existing tenant files or databases.
EC-R09: Amend the existing media task for compatible migration from app-level roots to verified tenant storage roots. Preserve bytes, links and URL compatibility. Keep private evidence outside public storage. Test real foreign assets and repeatable migration.

Some repairs depend on later original tasks. Split those explicitly into immediate repairs and linked deferred acceptance checks. Do not falsely mark an entire repair accepted while a required later check remains unexecuted. Continue the prerequisite original tasks to close the repair.

ARCHITECTURE AND CODING RULES
Keep Ecommerce a module-owned modular monolith. Use concrete DDD boundaries and existing event/queue patterns. Composition only wires capabilities.
Core owns canonical products, contacts, companies, categories and brands. Extend the existing Ecommerce product-information, variant and image leaves. Do not create duplicate masters or competing ecommerce_products records.
Billing owns financial documents and accounting. Use reviewed public handoffs and idempotency. Do not write Billing tables or create a duplicate financial ledger.
Reuse Platform identity, tenant routing, RBAC, audit, queues and storage; Framework contracts; UI primitives; and CRM/Mail/Chat/Marketing/Blog through their public surfaces.
Inspect providers and consumers and record compatibility/impact before cross-owner changes. Compatible reusable UI additions and necessary compatible corrections are authorized with regression tests. Breaking changes require a concrete human decision.
One leaf owns its fields, migrations, repository, service, routes, schemas, activity, permissions and frontend. No generic CRUD registries, sibling kind engines, arbitrary-path clients, private cross-module imports or placeholder role files.
Use strict registerContractRoute schemas, public Core lookups, request-bound tenant DBs, integer internal IDs and eight-character lowercase hex UUIDs according to current rules.
Keep functions focused and files small where practical. Add abstractions only for repeated concrete needs. Use clear names and short comments explaining non-obvious reasons.
Run npm only from the root. Preserve one root node_modules, package-lock.json and dist. Never reset, stash, clean, switch branches or overwrite unrelated work to simplify integration.

UI AND DOMAIN ACCEPTANCE
Reuse @codexsun/ui, existing theme and CRM enquiry interaction patterns. Preserve the App Header with heading/actions and concrete List, Show and Upsert experiences.
Lists need backend search, inline filters, visible columns, sorting and authorized totals. Default/max page size is 100. At <=100 matches return all rows and hide pagination. Above 100 show paging with 20/50/100 choices. Never hide access to unreturned rows.
Bind all storefront sections to published backend data. Use full product images, correct variants, accessible interactions and real loading/empty/error/denied states.
Enforce verified tenant/company/customer/vendor scope for records, counts, files, exports, jobs, events, caches and subscriptions. UUIDs are not authorization.
Use fixed-precision money, explicit state transitions, immutable accepted snapshots, atomic reservations, optimistic concurrency, idempotent commands and recoverable reconciliation.
Persist business transitions and outbox intent atomically. Re-resolve tenant authority at worker execution. Deduplicate inbox effects and retain retry/dead-letter evidence.
Local shopping and checkout must not depend on Frappe availability. Do not enable remote sync before the local acceptance gate.

TEST, REVIEW, REPAIR, INTEGRATE
For every task, verify prerequisites, implement a vertical slice, run focused tests, obtain independent review, repair findings, integrate, rerun affected checks and update evidence.
Use meaningful unit and contract tests plus disposable MariaDB E2E for persistence, permissions, tenancy and money/quantity behavior. Tests must fail for the defect they claim to detect.
Run frontend/backend typecheck, lint, formatting, module boundaries, relevant production builds, dependencies:check, component-doc checks and applicable Docs checks.
Verify fresh and existing-schema migrations separately, including repeat and interrupted runs, constraints, data preservation and rollback conditions.
Complete the E2E-PLAN matrix: two tenants, two companies, two customers and two vendors; forged headers, revoked access, ID substitution, exact counts, real file isolation, checkout retries, last-unit race, callbacks, queue restarts, partial shipments, returns/refunds and financial reconciliation.
Use live browser evidence for staff and public flows at desktop/tablet/mobile sizes. Generated screenshots and empty pages do not establish visual acceptance.
Distinguish mocks, disposable DB tests, browser checks, provider sandbox, live providers and production. Never claim a check passed unless it actually ran successfully against the integrated source.
Never weaken permissions, safety guards, assertions or test scope to obtain green results. Report existing failures and repair owned causes.

CONTINUE THE ORIGINAL PLAN
After immediate review repairs, continue prerequisite-ready EC-T03, EC-T04 with EC-R09, and EC-T05. Run provider contract work in parallel where writes do not overlap.
Then complete EC-T06–EC-T16 following their dependency graph and the complete local P0–P8 acceptance requirements. Do not stop after the first three tasks or after writing contract proposals.
EC-T17 remains deferred Frappe mapping design until local acceptance. Remote writes require separately reviewed mappings and authority.
Do not enable unsupported marketplace money flows before merchant-of-record, invoice issuer, tax and settlement decisions are accepted.
At a real blocker, record the exact missing contract/decision, affected tasks, attempted safe fixes and next action. Continue all independent authorized work.

AUTHORITY LIMITS
Local development, supervisor/subagents, compatible reviewed corrections and disposable test data are authorized.
No deployment, Git push, destructive live-data changes, external customer messages, real payments, or live Frappe writes are authorized by this prompt.
Do not expose credentials, cookies, tokens, personal data or database secrets in prompts, evidence or logs.

FINAL REPORT
Provide completed EC-R/EC-T IDs, concrete behavior, changed owners, exact checks and exits, migration effects, independent review results, remaining blockers and unrun evidence levels.
Mark accepted only when implementation, independent review and combined verification support the claim. Preserve incomplete work as pending or blocked with an explicit reason.

Begin now with current-source verification and EC-R06. Establish worker leases, repair EC-R01/EC-R02, and continue through the complete dependency-ready local Ecommerce solution.
```
