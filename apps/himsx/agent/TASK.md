# HIMSX tasks

## Active Front Office handoff dated 25 October 2026

Planning status: Prepared. Implementation status: Not started by this planning task.
The source Word document remains unchanged. Original foundation checklist states below remain unchanged.
Read [REQUIREMENTS-ANALYSIS](REQUIREMENTS-ANALYSIS.md), [PLAN](PLAN.md), [WORKER-TASKS](WORKER-TASKS.md), and [AUDIT](AUDIT.md).

| ID | Work package | Dependency | Acceptance | State |
| --- | --- | --- | --- | --- |
| H-00 | Baseline, exact field/API/permission/requirement ledger, D01-D14 decisions and fixtures | None | E01, E02 | Open |
| H-01 | Tenant persistence, lifecycle registration, trusted context, permissions, owner public contracts | H-00 | E02-E04 | Open |
| H-02 | Reuse Core location/contact/company and Platform access screens, HRMS department/designation adapters | H-00, H-01 | E02-E05, privacy D07 | Open |
| H-03 | Concrete hospital masters, department groups, units/locations, user-department mappings | H-02 | E03-E05, all source steps 1-4 | Open |
| H-04 | Doctor directory and explicit specialty/qualification/department/unit/location mappings | H-03 | E03-E05, source step 3 | Open |
| H-05 | Patient extensions, duplicate-review policy, sensitive access and block primitives | H-02, H-03, D04/D07 | E03-E06, generic-owner privacy denial | Open |
| H-06 | Effective tariffs and Billing transaction/payment/refund contract | H-01, H-03, D08/D09 | E02-E04, E07, financial owner regressions | Open |
| H-07 | Persisted OP registration vertical slice, payment, Show and bill/receipt | H-04-H-06 | E03-E07, E11 | Open |
| H-08 | IP/MHC registration, categories, admission/discharge/doctor history | H-07, D01/D05/D10 | E06-E08 | Open |
| H-09 | Same-day OP/IP cancellation, approval/refund, corrections and block/unblock | H-08 | E04, E07, E08 | Open |
| H-10 | Case sheet, registration label, MRD label, patient ID card, bill copy and reprints | H-07-H-09, D13 | E05, E09 | Open |
| H-11 | Doctor schedules, leave/backup, slots, reserved rules and actual booking UI | H-04, D11 | E04-E06, E10 | Open |
| H-12 | Patient search and CRM-linked IP enquiry/report/conversion | H-08/H-09, accepted CRM contract | E04/E05, E08/E09/E11 | Open |
| H-13 | OP/IP detail and day/month/year visit matrices, grouping, exports/print | H-08-H-10 | E04/E05, E08/E09 | Open |
| H-14 | Platform access/menu/session reports and atomic permission-safe role copy | H-00, H-01, D14 | E04/E05, E12 | Open |
| H-15 | ABHA consent, approved workflow adapter, handoff/callback/error handling | D12, H-07 | E04/E06, E11. Live provider evidence still required | Open, external prerequisites |
| H-16 | Composed integration, independent final audit, repair loop and handover | H-01-H-15 | E01-E13, no mandatory unresolved finding | Open |

Large packages must split into child IDs such as `H-03-blood-group` before dispatch.
The supervisor assigns one concrete leaf or bounded journey per child task.
Completion requires exact checks and independent review, not a worker's completion claim.

## Requirement and decision ledger

H-00 creates the executable coverage ledger before implementation.
Use one row per source subrequirement, not just one row per step.

| Requirement locator | Field/action | Owner leaf and table | API and permission | UI route | Task | Test and artifact | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Source steps 1-22 | See REQUIREMENTS-ANALYSIS | Proposed, freeze under H-00 | Not implemented | Not implemented | H-00-H-16 | No implementation evidence | Open |

Record D01-D14 with chosen policy, rationale, source/approver, affected tasks, and remaining question.
Do not invent a hospital policy decision or approval. Keep dependent acceptance open when the input is missing.

## Worker leases

Only the supervisor changes this table and shared task states.

| Task | Actual worker ID | Exact write lease | Baseline | State | Independent reviewer | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Unassigned | None | None | Capture before dispatch | Open | None | None |

## Evidence ledger

Record command, working directory, target revision/baseline, fixture, actual result, artifact path, and reviewer for each gate.
Store generated runtime evidence under root `dist/apps/himsx/evidence/<task-id>/`.
Use synthetic patient information. Do not put production patient data or credentials in source or evidence.

| Gate/task | Command or journey | Result | Evidence | Review |
| --- | --- | --- | --- | --- |
| Planning analysis | Read Word text/tables and inspect source/public exports | Planning comparison prepared | REQUIREMENTS-ANALYSIS, PLAN, WORKER-TASKS, SUPERVISOR-PROMPT, AUDIT | Self-review only |
| Planning documentation | `npm run check:component-docs` from repository root | Passed, 37 owners | Captured tool output, 25 October 2026 | Planning agent |
| Planning documentation | `npm run test:component-docs` from repository root | Passed, 2 tests | Captured tool output, 25 October 2026 | Planning agent |
| Planning consistency | Local Markdown link/source-step check | Passed, 8 files, 37 local links, 22 source-step rows | Captured tool output, 25 October 2026 | Planning agent |
| Planning diff | `git diff --check -- apps/himsx` plus whitespace check of new Markdown files | Passed | Captured tool output, 25 October 2026 | Planning agent |

These documentation checks do not satisfy implementation gates.
No app builds, database tests, browser journeys, provider verification, or deployment checks ran in this planning turn.
The receiving supervisor records fresh runtime results here.

## Final handover checklist

- [ ] Every source step and subrequirement has accepted evidence or a named blocker.
- [ ] All mandatory masters and complete OP/IP/MHC workflows exist, not only the first slice.
- [ ] All E01-E13 gates have current evidence and independent reviewer acceptance.
- [ ] All valid critical/high findings are repaired and rechecked. Other findings have explicit disposition.
- [ ] Schema, public API, permission, menu, configuration, test, and local deployment instructions match source.
- [ ] Patient privacy, tenant isolation, Billing consistency, historical reports, and scheduling races pass.
- [ ] ABHA live acceptance is proven or remains explicitly incomplete with precise prerequisites.
- [ ] No unrelated dirty changes, real patient mutations, external messaging, or production deployment occurred.
- [ ] Final report distinguishes implemented, locally verified, externally blocked, and deployed states.

## Retained foundation checklist

## Responsibility

The tenant hospital-management app foundation and its authorized overview.

The current overview foundation is not a complete clinical system. Do not fabricate patient, treatment, payroll, or medical records to make a screen appear implemented.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected HIMSX source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

- `node tools/check-module-boundaries.mjs himsx`
- `npm run typecheck -w @codexsun/himsx-api`
- `npm run lint -w @codexsun/himsx-api`
- `npm run build -w @codexsun/himsx-api`
- `npm run typecheck -w @codexsun/himsx-web`
- `npm run lint -w @codexsun/himsx-web`
- `npm run build -w @codexsun/himsx-web`

Use `npm run check:component-docs` for this documentation contract.
Run applicable tests before marking implementation work complete.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.
