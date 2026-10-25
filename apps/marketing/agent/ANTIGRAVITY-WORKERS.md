# Marketing worker assignments

Use with [the supervisor prompt](ANTIGRAVITY-HANDOFF.md), [PLAN](PLAN.md), and [TASK](TASK.md).
Every worker inherits the supervisor's local-only, preservation, tenancy, design, and ownership constraints.
No worker may commit, push, deploy, contact customers, connect accounts, or send/publish live content.

## Dispatch envelope

Copy this envelope into each actual worker task. Replace every bracket before dispatch.

```text
Role: [MKT / UI / INT / QA]. Supervisor: [actual parent task ID].
Workspace: C:\Users\sunda\.codex\worktrees\marketing\codexsun.
Required branch: codex/marketing. Verify actual cwd and branch before edits.
Wave/task IDs: [exact IDs].
Objective: [one bounded deliverable and expected behavior].
Read: root AGENTS, Assist guide/governance, applicable architecture/design references,
Marketing ANTIGRAVITY-HANDOFF, PLAN/TASK, and [affected source/public contract].
Prerequisite: [frozen contract version and dependency results].
Exclusive write lease: [exact files or new leaf paths].
Read-only dependencies: [paths/public APIs]. No writes outside the lease.
Exclusions: CRM/Frappe changes, unrelated dirty work, live providers, production,
commits/push/version/deployment, permission bypasses, fake records or readiness.
Fixture: [synthetic local fixture and allowlisted databases].
Acceptance: [exact behavior, negative cases, E01-E23 IDs, required checks/artifacts].
Stop condition: report contract conflicts or missing prerequisites. Continue independent leased work.
Return: changed paths, contract/schema effects, commands with actual results,
artifact paths, unresolved failures, and preservation notes. Do not claim unrun checks.
Report to the named supervisor through available task tools.
```

## MKT: backend and lifecycle

- Lease concrete leaves under `apps/marketing/api`. Exclude adapter files leased to INT.
- Implement source/intake, Lead, Qualification, Sales Conversion, Outcome, Marketing follow-up and restrictions.
- Own database schemas, strict contracts, services, audit, validation, permissions, and idempotent worker behavior.
- Enforce qualification rules, conversion uniqueness, cancellation/reversal, outcome correction, and history.
- Implement list filters/counts/paging and relation labels within tenant/company/Brand authority.
- Keep legacy CRM-linked records intact. Never call CRM/Frappe to implement the new path.
- Reconcile consent policy with Mail safety through frozen public interfaces.
- Return migration replay/recovery evidence and E06-E11/E13-E15 coverage for the assigned wave.

## UI: lists, Show, and upsert

- Lease concrete frontend leaves under `apps/marketing/web`.
- Read CRM Enquiry components only for visual comparison. Use shared UI primitives.
- Cover the six existing screens and new lifecycle screens in bounded batches.
- Keep each entity's types/schema/services/hooks/list/form/workspace inside its own leaf.
- Implement standalone pages, one search toolbar, column filters, URL state, paging, Show, and complete validation states.
- Match action hierarchy, form surface/body/actions, dates, switch cards, and responsive behavior.
- Return E02-E05 artifacts and actual browser results. Do not decide authorization in the frontend.

## INT: source, connector, and owner contracts

- Lease exact Marketing adapter files, disjoint from MKT. Return Platform wiring requests to SUP.
- Use only approved public Core/Mail/Sites/Chat/Billing contracts. CRM/Frappe remain excluded.
- Implement Marketing-side legacy cutover without old record mutation or automatic replay.
- Keep OAuth, accounts, credentials, scopes, callbacks, media, receipts, and queue payloads tenant-isolated.
- Prepare supported providers and email in PLAN order. Research official capabilities and record dated evidence.
- Use mocks locally. Keep unavailable capability disabled with a tested supported fallback.
- Do not enable app dependencies, modify grants, or create credentials as setup shortcuts.
- For each later wave, return applicable E12/E16-E22 proof and open R01-R06 prerequisites.

## QA: independent audit and acceptance

- Replace an idle/completed implementation worker. Do not exceed three simultaneous workers.
- Lease test files and evidence documents only. Report production fixes for reassignment.
- Review actual diffs, owner boundaries, schema consistency, legacy cutover, and tenant authority.
- Run actual signed Platform browser flows against separate local databases.
- Inspect rendered screenshots. Confirm nonblank data, toolbar/forms, theme, responsive layout, and keyboard behavior.
- Test invalid/stale transitions, replay/restart races, revocation, consent/Mail blocks, exports/files, and cross-tenant attacks.
- Audit live execution remains blocked and no CRM/Frappe writes occurred.
- Return reproducible findings with severity, file/line, expected/actual behavior, artifacts, and failing gate IDs.
- Recheck repairs independently. Accept only gates supported by fresh evidence.

## Wave schedule

| Wave | Supervisor gate                                     | Parallel work                                                | Independent review                          |
| ---- | --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| 0    | S00/S01 contracts, states, routes, fixtures, leases | Read-only bounded gap inventory                              | SUP reconciles current source and ownership |
| 1A   | Frozen list/page contracts                          | MKT APIs, UI existing screens, INT cutover inventory         | QA E01-E05/E10                              |
| 1B   | Lifecycle schemas and transitions agreed            | MKT lifecycle, UI lifecycle, INT source/Sites path           | QA E06-E09/E11/E13/E15                      |
| 1C   | Foundation integration                              | Remaining consent, connector, recovery and migration repairs | QA applicable E01-E15 full journey          |
| 2    | Phase 1 accepted locally                            | Content/social acquisition/publishing and supported fallback | QA E16/E17                                  |
| 3    | Sender/audience/policy contract                     | Email workflows and mocked Mail execution                    | QA E18/E19                                  |
| 4    | Conversation/stop contract                          | Inbox, nurture, Marketing follow-up                          | QA E20                                      |
| 5    | Per-provider capability contract                    | Remaining approved channels and fallbacks                    | QA applicable E16/E17/E20                   |
| 6    | Data/report/operations contract                     | Outcomes, attribution, recovery and operations               | QA E21/E22, E23 stays authorization-gated   |

Promote a gate only after supervisor review and fresh verification.
Record blockers precisely and continue independent local work. Do not convert blocked live gates into passed local gates.
