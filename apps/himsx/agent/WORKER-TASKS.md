# HIMSX supervisor and worker assignments

Use with [SUPERVISOR-PROMPT](SUPERVISOR-PROMPT.md), [PLAN](PLAN.md), [TASK](TASK.md), and [AUDIT](AUDIT.md).
This is a prepared task split. All implementation assignments remain unassigned.

## Roles and task graph

| Role | Task packages | Candidate ownership | Dependencies and return |
| --- | --- | --- | --- |
| Contract analyst | H-00, child field/API/permission specs | Leased HIMSX specification files. Read-only source elsewhere | Complete source-step ledger, D01-D14, exact parent references, state transitions, owner contracts, fixture plan. |
| Hospital backend worker | H-01, H-03-H-09 | Exact concrete leaves under `apps/himsx/api/src/modules` | Complete types, schema, migration, repository, service, routes, seed, public index, tests and critical audit. No shared owner edits without separate lease. |
| Hospital UI worker | H-03-H-13 | Matching concrete leaves under `apps/himsx/web/src/modules` | Accepted typed API. CRM design parity, exact fields, list/Show/upsert, query invalidation, denied/error/loading states and actual browser proof. |
| Owner integration worker | H-02, H-06, H-12, H-14, H-15 | Named owner leaf/public-contract files assigned individually | Core privacy/contact, HRMS reuse, Billing facade, CRM enquiry extension, Platform reports/role copy, ABHA adapter. One owner contract per child task. |
| Scheduling worker | H-11 | doctor-schedule, doctor-leave, appointment API/web leaves | Accepted H-04 plus D11. Conflict/leave/backup/reservation rules, transaction locking and booking UI. |
| Independent reviewer | Every wave and H-16 | Read-only implementation. Explicit test/evidence lease if needed | Inspect source and runtime. Reproduce negative cases. Return findings and recheck repaired gates. Cannot accept own implementation. |
| Supervisor | All waves and H-16 | TASK/AUDIT, composition, root/shared configuration, integration queue | Assign leases, freeze contracts, inspect diffs, serialize shared operations, accept evidence, schedule repairs and final handover. |

Roles are responsibilities, not a request to start all workers together.
Default at most two implementation workers and one independent reviewer, within platform capacity.
Recycle completed workers and reduce concurrency when shared-checkout contention occurs.

```text
H-00 contracts + baseline independent audit
  -> H-01 lifecycle/access + H-02 shared owners
  -> H-03 minimum hospital masters -> H-04 doctors
  -> H-05 patients + H-06 tariff/Billing
  -> H-07 persisted OP slice
  -> H-08 IP/MHC/categories -> H-09 lifecycle -> H-10 documents
  -> H-12 search/enquiry + H-13 reporting
  -> H-16 integration and final handover

H-11 scheduling starts after H-04 and D11, with disjoint leases.
H-14 Platform administration starts after H-01 and D14.
H-15 ABHA starts when D12 and H-07 are ready.
Finish remaining H-03 masters before final acceptance.
For requested acceptance or risk that requires it, use independent review, repair, recheck, and ledger updates.
```

## Dispatch contract

Split large packages into small concrete leaves or one cross-owner journey.
Each backend/frontend pair must share a frozen field/API/permission contract before parallel edits.
Never dispatch an envelope with unresolved placeholders.

```text
Role: HIMSX [backend/UI/integration/scheduling/analyst].
Task ID: [H-xx-child]. Actual supervisor ID: [real identifier].
Workspace: D:\workspace\codexsun.
Objective: [one bounded observable behavior].
Source requirements: [step and subsection, each field/action covered].
Accepted dependencies and decisions: [task IDs, contract versions, D IDs and evidence].
Exact write lease: [specific existing files/new leaf directories].
Explicit exclusions: [shared and sibling files not leased].
Dirty baseline: [snapshot/diff reference and concurrent owner].
Public contracts: [package export or fixed API, permissions, transaction and error contract].
Schema: [owned tables, parent IDs, migrations, indexes and upgrade implications].
UI: [list/Show/upsert routes, CRM reference, applicable shared primitives].
Fixture: [allowlisted disposable databases, synthetic records, cleanup owner].
Acceptance: [E IDs plus exact positive, negative, boundary, race and persistence cases].
Checks: [real existing commands or exact test files to add, browser journey and artifacts].

Read root AGENTS, Assist guide/governance, HIMSX SKILLS/PLAN/REQUIREMENTS-ANALYSIS,
and the affected owner source/public contracts. Load applicable implementation skills.
Preserve unrelated and concurrent edits. Run npm from root only. Outputs go under root dist.
Keep module-owned concrete roles. Do not create generic CRUD engines, placeholder roles, private imports,
duplicated shared masters, hospital fields in Core tables, or frontend-only enforcement.
Use linked himsx_<module> tables for hospital fields on shared records.
Use shared CODEXSUN UI and active theme, matching CRM Enquiry list/Show/upsert interactions.
No root/shared changes outside the lease. Request the exact missing owner contract through the supervisor.
No production data, real patient data, provider calls, messages, deployment, commit/push, or version changes.
Do not auto-enable apps, grant yourself permissions, or weaken backend authorization.
Finish the task and relevant repairs. Do not approve your own change or change shared TASK states.
Return evidence to the supervisor through the available subagent mechanism.
```

## Worker return contract

1. State the implemented behavior and source requirements covered.
2. List changed files and their difference from the assigned dirty baseline.
3. List schema, public-contract, permission, and compatibility changes.
4. Provide exact commands, actual exit/results, fixture identity, and evidence paths.
5. Describe browser journeys, persisted readback/restart checks, and negative/race cases that actually ran.
6. List unrun checks, unresolved dependencies, proposed follow-up, and known limitations.
7. State any lease conflict or preserved pre-existing failure.

An evidence path must exist. A planned command, screenshot of a skeleton, or mock response is insufficient.
Do not copy sensitive patient payloads, tokens, or credentials into the return.

## Independent reviewer prompt

```text
Act as the independent HIMSX reviewer for [task/commit or captured diff].
You did not implement this increment. Your write lease is [test/evidence paths or none].
Read the source requirements, frozen contract, PLAN gate definitions, assigned diff and worker evidence.
Verify actual source and runtime behavior instead of relying on the worker summary.
Review ownership, public contracts, schema upgrades, permission/activation/department scope,
patient privacy across generic owners, transaction/audit atomicity, idempotency and race handling.
Check CRM list/Show/upsert parity, theme, responsive/keyboard behavior, error states and URL navigation.
Test the assigned positive, denied, stale, rollback, restart and history cases on synthetic local fixtures.
Return every finding with severity, exact path/line, requirement/E gate, reproduction,
expected and observed result, evidence, and suggested owner.
Separate implementation defects from unavailable hospital/provider inputs.
Do not change production code or accept your own prior work.
Recheck assigned H-REPAIR tasks against fresh evidence and state whether the original case is fixed.
```

## Single writer and evidence rules

The supervisor controls root package files, package exports, Platform host wiring, migration composition, and shared UI changes.
A worker may prepare an exact patch request but cannot mutate those files without a revised lease.
The supervisor serializes migrations, seed mutations, shared browser fixtures, and root builds.
If another agent changes a leased file, stop writes to that file and reconcile the baseline through the supervisor.
Continue independent work that does not depend on the conflict.
Never reset, stash, clean, or terminate unrelated processes to remove contention.

Use `dist/apps/himsx/evidence/<task-id>/` for logs, screenshots, test results, and sanitized fixture manifests.
Keep durable requirement contracts and acceptance summaries inside the HIMSX agent documents.
Test artifacts do not belong inside Assist or shared source modules.

## Repair envelope

```text
Repair ID: H-REPAIR-[number]. Parent task and failing gate: [IDs].
Severity: [critical/high/medium/low]. Owner: [concrete leaf].
Finding and reproduction: [exact current evidence].
Expected behavior and source requirement: [specific rule].
Exact write lease and baseline: [paths and captured state].
Required regression cases: [original failure plus affected boundaries].
Independent recheck owner: [actual reviewer ID].
Return fresh evidence. Leave acceptance open until independent recheck passes.
```
