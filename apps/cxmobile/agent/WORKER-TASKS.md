# cxmobile supervisor and worker task split

## Coordination contract

Read [BRANCH-WORKFLOW.md](BRANCH-WORKFLOW.md) before executing a task.
All cxmobile work now uses branch `codex/cxmobile` in the isolated worktree named below.
Verify the absolute working directory and branch before making changes.

The supervisor owns sequencing, shared contracts, integration, review decisions, and final acceptance.
Workers own bounded implementation tasks and return inspectable evidence.
Only the supervisor updates shared TASK state and releases file leases.
No worker may approve its own implementation.

Task IDs below describe work packages. The supervisor must record actual Antigravity task/chat IDs when creating them.
All implementation packages start Open. This handoff is not evidence that a worker has run.
Use at most two implementation workers and one read-only reviewer unless actual capacity requires fewer.

## Dependency graph

```text
CX-W00 inventory/contracts + CX-W08 read-only baseline review
  -> CX-W01 native session/transport proof
  -> CX-W02 production client foundation + four-app integrated slice
  -> CX-W03 CRM parity
  -> CX-W04 Billing parity
  -> CX-W05 Chat parity
  -> CX-W06 Ecommerce staff parity

CX-W07 native capabilities/push starts after W01 contract acceptance.
W03-W06 may overlap only after W02 and with non-overlapping owner leases.
W08 independently reviews every accepted increment and the final integration.
CX-W09 final packaging/acceptance follows W03-W08 completion.
```

The arrows express contract dependencies, not permission to start all listed workers simultaneously.
Review and repair tasks occur between every implementation step.
Native platform proof remains required even when owner UI work can continue independently.

## Work packages

| ID     | Worker responsibility                       | Candidate lease, assigned by supervisor                                                                                                        | Dependencies and acceptance                                                                                                                                          |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CX-W00 | Inventory and contract analyst              | cxmobile feature ledger documentation. Read-only inspection elsewhere.                                                                         | Enumerate every route/action/API/permission, dependencies, alias mapping, plugin/toolchain support, source-only features, and A01-A15 mapping. No runtime edits.     |
| CX-W01 | Native session and transport engineer       | Explicit session/native adapter files under cxmobile. Platform auth/client changes only through an approved bounded lease.                     | W00. Prove native secret handling, login/revoke, HTTP/socket/media, redirects, account cleanup, and two-tenant denial on Android and iPhone.                         |
| CX-W02 | Client foundation and integration engineer  | cxmobile bootstrap, routing, shell, providers, styles, and native source. Root/shared edits through supervisor only.                           | W01 contract. Bundle real assets, preserve AppLayout, initialize public transport, install both clients, and complete the six-step M2 slice.                         |
| CX-W03 | CRM mobile parity engineer                  | Affected CRM web leaf files and public exports. CRM API only where a specific contract gap is assigned.                                        | W02. All supported CRM routes/actions, record scope, integrations, reports, masters, attachments, and persistence pass. Tasks remain local.                          |
| CX-W04 | Billing mobile parity engineer              | Affected Billing web leaf files and public exports. Billing API only through explicit assigned gaps.                                           | W02. All documents/reports/settings, allocations, totals, context, print/PDF/share, negative permissions, and persistence pass.                                      |
| CX-W05 | Chat mobile parity engineer                 | Chat owner web/API leaves and public realtime integration points under a bounded lease.                                                        | W02 plus accepted W01 socket contract. Direct/group/channel/broadcast, optional Telegram, files, cursor/reconnect, membership denial pass. Coordinate push with W07. |
| CX-W06 | Ecommerce mobile parity engineer            | Ecommerce owner web leaves/public exports. Core and API changes need separate leases.                                                          | W02. All staff catalog/publishing/source workflows and isolated storefront preview pass. No implicit new checkout/payment implementation.                            |
| CX-W07 | Native capabilities and push engineer       | cxmobile capability adapters. Platform device-registration/push leaf and owner notification event hooks only through explicit separate leases. | W01. Camera/pickers/files/share/links/network/resume and required notification behavior pass on both platforms. Preserve owner recipients and cleanup.               |
| CX-W08 | Independent audit and acceptance reviewer   | Read-only source/runtime inspection. Assigned disposable test execution. Findings returned to supervisor.                                      | Starts with W00, reviews each increment. Verify claims, boundaries, tenant isolation, UI behavior, persistence, resource/performance budgets, and regressions.       |
| CX-W09 | Release candidate and finalization engineer | Assigned build/signing/metadata source and documentation. Secrets stay outside source.                                                         | W03-W08. Build artifacts, platform install/signing evidence, API compatibility, release checks, privacy requirements, and final open-blocker report.                 |

These candidate paths are not automatic leases. The supervisor names exact files before implementation begins.
Split large packages into smaller tasks while preserving their ID prefix and acceptance scope.

## Shared-file ownership and leases

Record this table in TASK before a worker writes files:

| Work package | Actual worker/task ID | Exact file lease | Current baseline | State | Evidence/review |
| ------------ | --------------------- | ---------------- | ---------------- | ----- | --------------- |
| Unassigned   | None                  | None             | To capture       | Open  | None            |

The supervisor serializes root package.json/package-lock, shared transport contracts, Platform public exports, shared UI primitives, native sync, and root build scripts.
Root npm installs and all shared build/migration operations use a single execution lane.
Native project generation and native source edits cannot overlap the same platform directory.
Core ownership changes require a separate subtask and Core guidance, not an opportunistic edit by a business worker.

If a leased file is already dirty, compare it with the captured baseline and preserve existing edits.
If another task changes it during work, stop writes to that file and ask the supervisor to reconcile the conflict.
Do not reset, stash, clean, or stage unrelated work. Do not use destructive cleanup as a build repair.
Keep runtime evidence under `dist/apps/cxmobile/evidence/<task-id>`.

## Worker prompt template

The supervisor fills every bracket before dispatch. Do not submit the template with unknown paths or acceptance criteria.

```text
You are a cxmobile implementation worker reporting to the supervisor.
Task ID: [CX-Wxx-subtask].
Actual supervisor task/chat: [identifier].
Workspace: C:\Users\sunda\.codex\worktrees\cxmobile\codexsun.
Branch: codex/cxmobile.
Objective: [one bounded behavior or integration].
Dependencies accepted: [task IDs and evidence].
Exact write lease: [files/directories and explicit exclusions].
Public contracts to use: [owner exports, fixed APIs, session/native interface].
Acceptance criteria: [observable workflows, denial cases, persistence, and platform expectations].
Required checks: [smallest sufficient tests/build/browser/native actions].

Read root AGENTS, Assist guide/governance, cxmobile SKILLS/PLAN/AUDIT, and the affected owner guidance.
Inspect current source and dirty changes before writing. Preserve unrelated work.
Use root npm only. Keep outputs under root dist. Do not edit root manifests or shared files outside your lease.
Keep business logic in its owner. Use public contracts and shared UI.
Do not weaken backend authorization, tenant boundaries, cookie/origin checks, or financial rules.
Do not use fake records or mocked results as persistence/native evidence.
If a required file is outside your lease, return the exact dependency to the supervisor before editing it.
Do not perform production data operations, external messaging, deployment, store publication, version bumps, commits, or pushes.
Complete the bounded task, repair relevant failures, and return the evidence contract below.
Do not mark the shared task ledger complete or approve your own work.
```

## Independent reviewer prompt

```text
Review [task ID] independently against its exact acceptance criteria and current diff.
Read the owner contracts and cxmobile AUDIT. Treat the worker report as claims to verify.
Your source lease is read-only. Run authorized disposable checks without changing customer data.
Check module ownership, native session transport, permissions/tenancy, context caches, lifecycle cleanup,
screen usability, actual persistence, applicable Android/iPhone evidence, and desktop regressions.
Return actionable findings with priority, file/location, reproduction, expected behavior, and evidence.
State unverified areas explicitly. Do not approve a task merely because typecheck or a mock passed.
The supervisor assigns repair tasks and makes the final acceptance decision.
```

## Worker return contract

Return the following in a concise report:

1. Task ID, actual worker ID, and baseline/source revision.
2. Changed files and why each edit belongs to this owner.
3. Implemented behavior and acceptance criteria satisfied.
4. Commands/checks with exact pass/fail results and evidence paths.
5. Browser, API/database, Android, and iPhone status separately.
6. Persistence or denied-access observations, including role/tenant/device context.
7. New dependency/contract changes requiring supervisor integration.
8. Existing failures, unverified behavior, and concrete blockers.
9. Confirmation that unrelated changes and lease boundaries were preserved.

No report may declare implementation complete while a required acceptance item lacks evidence.
The supervisor must inspect actual files and re-run representative checks before accepting the report.

## Repair loop and stop conditions

Use stable repair IDs such as `CX-W04-R01` and link each to a reviewer finding.
Reassign only the affected lease. Re-run checks justified by the repair.
Repeat implement, integrate, review, repair, and verify until the package passes or a precise external blocker remains.
Do not retry the same missing credential, unsupported toolchain, or unavailable iPhone check without new evidence.
Continue independent ready work. Keep blocked gates and final completion limits visible.

Final acceptance requires the full PLAN definition of done, not just completion of these worker reports.
