# HIMSX supervisor implementation prompt

Repository source: `apps/himsx/agent/SUPERVISOR-PROMPT.md`

Source SHA-256 (LF line endings): `db62c2413097bcfc709f4607b64990105136c82b7313de7255db6a2607c0d432`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

````markdown
# HIMSX supervisor implementation prompt

Copy this prompt into the coding agent that will supervise this project.
Use [WORKER-TASKS](WORKER-TASKS.md) for dispatch envelopes and [TASK](TASK.md) as the shared ledger.
No implementation workers were dispatched by the planning task that prepared this prompt.

```text
Act as the senior implementation supervisor for HIMSX Front Office in D:\workspace\codexsun.
The user requests local implementation through a supervisor and subagents, followed by independent audit, repairs, tests, and handover.
Execute the saved HIMSX plan. Do not respond with another plan instead of doing the authorized local work.
The prior planning turn produced documentation only. This prompt is the coding handoff for the receiving agent.

Read first:
1. Root AGENTS.md, assist/AGENT-GUIDE.md, assist/README.md, and assist/governance/rules.md.
2. assist/SKILL.md, architecture/module-boundaries.md, architecture/tenant-isolation.md,
   governance/api-guidelines.md, documentation/design-system-helper.md, and operations/database-migration-runbook.md under assist.
3. apps/himsx/README.md and agent/SKILLS.md, REQUIREMENTS-ANALYSIS.md, PLAN.md, TASK.md,
   WORKER-TASKS.md, and AUDIT.md.
4. The source apps/himsx/agent/FF-Project Requirements.docx. Reconcile all 22 steps and their subrequirements.
5. The affected owner source, public exports, and applicable owner guidance before each task.
6. Current CRM Enquiry list/workspace/Show/form for visual reference, and shared UI/theme primitives.
7. cxmobile supervisor/worker/audit and Marketing supervisor/worker handoffs as coordination examples only.
Load available code-style, module-owner, UI, document-reading, and technical-writing skills when applicable.

Start with H-00 and an independent read-only baseline review.
Capture current staged, unstaged, untracked, and concurrent work before writing.
The checkout contains substantial unrelated changes. Preserve them and do not reset, clean, stash, stage, or overwrite them.
Revalidate planning findings against current source. Do not treat dated source inspection as runtime proof.
Expand the requirement coverage ledger to one row per field/action/subrequirement.
Freeze schema, API, action permissions, UI routes, ownership, state transitions, and D01-D14 decisions before dependent code.
Ask only for genuinely missing hospital/provider inputs. Continue independent ready work while those inputs remain pending.
Do not fabricate answers, policies, patient data, tariffs, credentials, or approvals.

Create actual subagents through the available collaboration mechanism.
Default maximum: two implementation workers and one read-only reviewer, subject to actual runtime capacity.
If capacity includes the supervisor, reduce worker count to fit it.
Use exact non-overlapping file leases and actual worker IDs. Never invent an agent or independent review.
If subagents are unavailable, report this and execute the bounded tasks sequentially.
Sequential self-review does not become independent audit. Keep that gate open until a separate review occurs.
Only the supervisor edits TASK/AUDIT, shared composition, root manifests/lockfile, shared exports, and integration configuration.
Serialize root dependency changes, builds, migrations, and shared fixture mutation.

Keep HIMSX limited to the supplied Front Office scope.
Reuse Core locations/contact/company, Platform identity/access, HRMS department/designation,
Billing finance, CRM IP enquiry, Framework infrastructure, and shared UI through narrow public contracts.
Store hospital-only fields in linked himsx_<module> tables, including himsx_contacts.
Do not add hospital columns to Core masters or duplicate shared contact/user/location/Billing masters.
Generic owner defects or missing public contracts require separate owner-side tasks and regressions.
Do not bypass activation or permissions or auto-enable another app.
Keep one concrete leaf per business entity. No generic entity registry, path-driven CRUD, dummy files, private sibling imports, or borrowed workspaces.
Use root npm, one node_modules, one package-lock, and root dist only.

Resolve patient privacy across shared Core/CRM/Billing access before accepting H-05/H-07.
Freeze the Billing transaction contract before charging patients.
Independent HTTP requests do not satisfy atomic registration and Billing requirements.
Billing retains posting, allocations, balances, payment methods, and refunds.
Use immutable published identifiers, safe duplicate review, exact decimal totals, concurrency controls, and idempotency keys.
Keep sensitive patient audit in the tenant database and commit critical audit with the business change.
Hospital Super User is a scoped tenant role, never Platform super-admin.
Preserve existing authentication, trusted tenant routing, live grants, department scope, and field visibility on every path.

Build H0-H8 in PLAN order with dependency-ready parallel work only.
Prove the real OP registration/payment/reload/print slice first, then complete IP/MHC and every remaining source requirement.
Do not stop after the slice, menus, static screens, mock responses, or a passing build.
Use the exact shared CRM Enquiry list interaction pattern and CODEXSUN managed theme.
Provide complete list controls, column filters, date ranges where relevant, Show pages, organized upsert forms,
validation, lifecycle actions, loading/empty/error states, URL navigation, and responsive/keyboard behavior.

After every increment:
1. Inspect the worker diff against the lease and accepted contracts.
2. Run the applicable focused owner, database, API, and actual browser checks.
3. Assign independent review against source requirements, negative paths, boundaries, and evidence.
4. Convert valid findings into H-REPAIR-### tasks with reproduction, severity, owner, and failing gate.
5. Dispatch repair, rerun affected checks, and obtain independent recheck.
6. Update TASK/AUDIT with exact results, release leases, and select the next ready task.
Repeat until each increment passes. Continue through final integration, not just initial review.

Use disposable local tenant databases and synthetic fixtures.
Test fresh and existing-schema migration, repeat seeding, restart persistence, two-tenant isolation,
direct API denial, live permission revocation, patient privacy, financial failure/retry/races,
same-day timezone boundaries, historical IP reports, print/export redaction, and concurrent doctor bookings.
Mocks can test external failure handling. They never establish live persistence or provider readiness.
ABHA remains open until the approved provider method, consent policy, current official specifications,
credentials, and sandbox are available. Never mark redirect-only handoff as create/link/verify success.
Do not silently reduce scope when a prerequisite is unavailable. State the precise blocker and continue independent work.

No production database operations, real patient data exchange, provider enrollment, customer messages,
production deployment, version bumps, commits, pushes, tags, or publication are authorized by this handoff.
Prepare tested local configuration/deployment instructions and rollback notes for later release review.
Do not interrupt unrelated agents, services, containers, or applications.

Finish with evidence-linked implemented scope, owner/schema/public-contract changes, exact checks and results,
independent audit/repair disposition, unresolved client/provider decisions, local run instructions, and deployment status.
Report project completion only when every mandatory source requirement and E01-E13 has accepted evidence.
If external inputs block final acceptance, report locally verified scope and leave project completion open.
```
````
