# HIMSX Front Office delivery plan

## Active planning contract dated 25 October 2026

This section expands the foundation plan below for the supplied Front Office requirements.
The current turn creates planning and handoff documentation only. It does not start implementation workers.
The receiving implementation agent uses [SUPERVISOR-PROMPT](SUPERVISOR-PROMPT.md) and [WORKER-TASKS](WORKER-TASKS.md).
The user requests a supervisor, implementation workers, independent audit, repair, testing, and final handover.
The handoff covers local implementation. It does not authorize production mutation, deployment, commits, or external patient-data exchange.

Read [REQUIREMENTS-ANALYSIS](REQUIREMENTS-ANALYSIS.md) for all 22 source steps, current-source findings, reuse decisions, and D01-D14 prerequisites.
Read [TASK](TASK.md) for acceptance IDs and current states. Read [AUDIT](AUDIT.md) for initial risks and repair tracking.
All implementation phases remain Open at this planning baseline.

## Ownership and app boundaries

HIMSX owns only hospital Front Office business behavior and extension tables.
Core owns shared locations, contact identity/address, operating companies, branding, currency, and financial years.
HRMS owns existing department/designation identities. Platform owns users, roles, permissions, sessions, and app composition.
Billing owns invoices, receipts, allocations, balances, posting, refunds, and financial corrections.
CRM owns existing IP enquiry workflow data. HIMSX adds hospital references through `himsx_enquiries`.
Framework and UI provide business-neutral infrastructure and themed components.

Hospital fields extend shared identities through `himsx_<module>` tables, such as `himsx_contacts`.
Do not add hospital columns to shared Core tables or create replacement contact/user/location/Billing masters.
An owner-side generic defect or missing public contract is a separate leased task in that owner.
Do not import private repositories, services, types, or forms across owners.
Public dependency availability and permissions must remain explicit. Never auto-enable HRMS, CRM, or Billing to make a screen work.

## Delivery waves

| Wave | Dependencies | Work and exit condition |
| --- | --- | --- |
| H0 Contracts and baseline | None | Capture dirty-state baseline, source-step coverage, fields, API/permission map, D01-D14 decisions, migration order, and fixtures. Independently review privacy and financial boundaries. |
| H1 Owner integration and hospital masters | H0 contracts accepted | Register tenant DB lifecycle and access. Compose Core/Platform/HRMS owners. Build concrete hospital master leaves and doctor/user mappings. Validate FK/lifecycle/permissions and repeatable seeds. |
| H2 Persisted OP vertical slice | H1 minimum masters, D03/D04/D07/D08/D09 | Create/select patient, detect possible duplicates, save OP, quote effective tariff, post linked bill/payment, reload Show, and print bill/receipt. Prove failure recovery and two-tenant denial. |
| H3 IP MHC and special handling | H2, accepted D01/D05/D10 | Unified registration modes, minimal admission/discharge history, categories, primary doctor changes, partial/credit policies, and MHC fields. Verify sensitive access and historical facts. |
| H4 Corrections cancellation blocks and documents | H3, D10/D13 | Audited modifications, hospital blocks/emergency overrides, same-day cancellation/refund, five document types, versioned print/reprint. Posted history remains intact. |
| H5 Doctor availability and appointments | H1 doctor contracts, D11 | Recurring availability, reservations, leave/backup, minimal booking, concurrent conflict protection, and registration alerts. Recheck H2-H4 doctor selection behavior. |
| H6 Search enquiry and reports | H3/H4 history, CRM contract | Patient search, CRM-linked IP enquiries and conversion, exact OP/IP detail, filter/sort/group/export/print, and matrices. Reconcile aggregates and as-of status. |
| H7 Shared access gaps and ABHA | H0 owner contracts, D12/D14 | Platform role copy/access/session reports. ABHA local consent/provider adapter and approved integration verification when prerequisites exist. Other independent waves can continue while ABHA is blocked. |
| H8 Integration acceptance and handover | H1-H7 accepted or explicitly blocked | Full requirements trace, independent security/UI/database audit, repairs and rechecks, supported workflow acceptance, configuration/deployment runbook, and honest completion report. |

Build only the minimum H1 masters needed for H2 first. Finish every required supporting master before H8.
H5 and Platform parts of H7 can overlap later waves after contracts freeze and write leases are disjoint.
ABHA provider acceptance remains a named open requirement if the provider prerequisites are missing.
“Locally verified” and “project complete” are separate states. Only the latter requires every mandatory acceptance gate.

## Screen and navigation contract

| Menu group | Screens | Presentation |
| --- | --- | --- |
| Front Office | Registration and Review, Patient Search, Patients | OP/IP/MHC share one organized registration workflow. Patient Show includes demographics, permitted blocks, visits, documents, and audit. |
| Admissions | IP admission review and history, cancellation work queue | Show current state and relevant as-of history. Cancellation is an explicit command with reason and eligibility. |
| Enquiries | Existing CRM enquiry entry/review, IP enquiry report | One enquiry workflow. Hospital fields and conversion links use HIMSX extensions. Do not duplicate CRM entry. |
| Doctors | Doctors, Appointment Schedules, Leave, Appointments | Independent concrete leaves, consistent list/Show/upsert, actual availability and conflict behavior. |
| Configuration | Hospital masters, tariffs, registration policies, print formats | Link/compose shared master owners. Expose only hospital-specific masters as new HIMSX CRUD. |
| Reports | OP, IP, matrix summaries, menu/access/session reports | Reuse owner access reports where available. Authorized filters, print, and export match detail permissions. |
| Administration | Users, roles, user-departments, role copy | Compose Platform access owners. Keep hospital department mappings in HIMSX. |

Do not publish menu entries before their backing routes and working screens exist.
Route names are proposed until H0 freezes them with Platform routing conventions.
Use `/app/himsx/<module>` with list/new/record/edit states that survive refresh and Back navigation.
Keep existing overview and guide routes working.
API routes use fixed `/himsx/<module>` collections with strict request and response schemas.
Use explicit action routes for cancel, block, unblock, correction, discharge, quote, booking, print, and provider transitions.
Do not implement arbitrary path/table-name dispatch or a generic entity-kind engine.

### Exact CRM Enquiry design reference

Read the current CRM `enquiry.workspace.tsx`, `enquiry.list.tsx`, `enquiry.show.tsx`, and `enquiry.form.tsx` read-only.
Use `assist/documentation/design-system-helper.md` and current shared primitives as the design contract.
Match layout, spacing, control height, density, action hierarchy, and interaction behavior through `@codexsun/ui`.
Do not copy CRM sales fields, Frappe integration, or owner-private components.

Every list needs these applicable features:

- Shared header actions, one search toolbar, Filters, active filter badges, Columns, and clear/reset.
- Icon-only date range before column-search toggle for dated operational records.
- Column filters in the first table body row, aligned with visible columns, including empty action cells.
- Search, sorting, hidden-column/filter cleanup, stable pagination/counts, loading, empty, retry, and API errors.
- URL state for view, filters, pagination, sort, and record navigation where applicable.
- Row View, explicit actions, and stopped event propagation for action menus.
- Permission-aware create/edit/lifecycle/print/export controls, enforced again on the server.
- No irrelevant CRM sync/status actions. Business lifecycle replaces generic delete on hospital transactions.

Show uses `WorkspaceShowLayout`, `WorkspaceShowCard`, `WorkspaceDetailTable`, and a persisted activity timeline.
Provide Back, Edit, allowed lifecycle, print/reprint, and related records with exact authorization.
Use full Show pages for patients, doctors, registrations, admissions, appointments, and enquiries.
Simple masters can use a shared detail surface when a full page adds no useful context.

Upsert uses `WorkspaceUpsertPage`, `WorkspaceFormSurface`, Body/TabbedBody, Actions, Panel, Grid, Field, and Banner.
Group registration fields into identity, contacts/address, visit/admission, doctor/location, category/payer, charges/payment, and documents.
Use progressive sections or shared tabs without losing unsaved values on type changes.
Use `WorkspaceLookup` for persisted references and shared select/date controls.
Required markers, field errors, submit-time banners, duplicate handling, and server error mapping are mandatory.
Preserve entered data after failed saves and provide unsaved-change protection for long forms.

Theme comes from shared semantic tokens and the active Platform theme.
No new hospital palette, global CSS overrides, hardcoded branding colors, or parallel theme provider.
Verify desktop, narrow mobile, supported light/dark themes, keyboard operation, labels, focus, and readable statuses.

## Data and transaction contract

Create a field specification before coding each leaf: type, nullability, required rule, validation, visibility, owner, lookup, and historical behavior.
Create the concrete schema and fixed API/permission matrix in the same task.
Use consolidated owner migrations registered in the supported tenant lifecycle and `migration_schema` ledger.
Add new tracked upgrade steps for applied databases. Never edit an applied checksum to force compatibility.
Order shared parents before HIMSX extensions, then mappings, tariffs, patient/visit data, and dependent output/history.
Seeds contain approved configuration only. No fabricated doctors, patients, bills, or medical records in normal runtime.
Fixtures are synthetic and isolated to disposable test tenants.

Store UTC instants. Convert hospital-local dates through the configured IANA timezone.
Same-day cancellation uses that hospital calendar day. Test midnight boundaries.
Active IP as of T uses admission <= T and no discharge/cancellation effective at or before T.
Freeze inclusive/exclusive date boundaries and end-of-day report behavior in H0.
Use event history for doctor, patient type, admission, discharge, and corrections where historical output depends on them.

Use immutable published identifiers, unique operation keys, server-side decimal calculations, transaction locks, and version checks.
Retries must not duplicate patient numbers, admissions, invoices, receipts, refunds, conversions, or bookings.
Registration and financial state changes must share the accepted owner transaction contract.
If durable compensation is necessary, show pending/failed states and reconciliation. Never return completed registration with unrecorded financial failure.
Keep patient clinical/demographic history separate from posted Billing snapshots.
Current document reprints use latest valid permitted demographics and show correction/version context where needed.
Historical financial copies preserve posted facts. Do not silently rewrite them to match current patient edits.

## Access privacy and audit contract

Action permissions include view/create/edit/activate/deactivate/cancel/approve/block/unblock/override/print/reprint/export as applicable.
Tenant app activation, role permission, department/location scope, record state, and sensitive field access are server decisions.
Lookup, search, count, Show, print, export, audit, and integration paths enforce the same scope.
A hospital Super User has hospital tenant permissions. It never gains Platform super-admin or grant authority implicitly.
Role copy can only copy permitted active grants within the administrator's grant ceiling.
It never assigns users automatically and must preserve protected-role rules.

Check shared Core/CRM/Billing screens for patient PII exposure before H2 acceptance.
Shared contact access is not sufficient proof of patient confidentiality.
Define minimum shared identity and owner-side restrictions without breaking existing nonpatient consumers.
Patient-sensitive audit remains in the tenant database. The inspected master `platform_activity` is not the patient audit store.
Critical operation audit must commit with its business change, or durable equivalent evidence must exist before success.
Keep before/after access restricted. Do not log ABHA tokens, passwords, medical details, or full sensitive payloads in general logs.

## Acceptance gates

| Gate | Required proof |
| --- | --- |
| E01 Traceability | Every source step and required field/action maps to leaf, route, permission, task, test, and current state. D01-D14 are resolved or explicitly blocking. |
| E02 Owner boundaries | No duplicate shared masters/private imports. Public exports/dependencies and composition/migration order pass configured checks. |
| E03 Database | Fresh and existing-schema migration, repeat seeding, constraint failures, restart persistence, and safe recovery pass on local MariaDB. |
| E04 Access | Two real tenant databases, forged context, permission revocation, disabled app, department scope, direct API and sensitive field attacks fail safely. |
| E05 UX | CRM-reference comparison, every list feature, Show, upsert validation, theme, responsive layouts, Back/refresh and keyboard pass actual browser checks. |
| E06 Registration | OP/IP/MHC, DOB/age, duplicate review, immutable numbering, categories, leave/block alerts, unknown/emergency policy pass persisted journeys. |
| E07 Financial | Tariff precedence/effective boundaries, payment methods, partial/credit rules, duplicate/retry/race/failure rollback, cancellation/refund and totals reconcile. |
| E08 History | Correction reasons/before-after, doctor changes, discharge/cancellation, same-day cutoff and as-of IP reports preserve history. |
| E09 Output | All five documents, branding/format config, authorized reprints, export redaction, pagination and total/group/matrix reconciliation pass. |
| E10 Scheduling | Overlap, reserved slots, simultaneous booking, leave/backup, timezone/overnight boundaries and affected-booking handling pass. |
| E11 Integration | CRM enquiry no-duplicate conversion, safe Core contact linkage, Billing transaction contract, owner regression checks, ABHA success/cancel/failure where approved pass. |
| E12 Administration | Menu/access/session report isolation, real logout versus expiry semantics, atomic role copy, duplicate target and escalation denial pass. |
| E13 Final handover | Independent findings repaired/rechecked. Required source, tests, configuration/runbook, exact evidence, blockers and deployment limits delivered. |

Use focused owner lint/typecheck/tests and browser checks per increment.
Use full owner builds, boundary, dependency and composed tests for cross-owner changes.
Run repository-wide release gates only when the final scope or a release requires them. Attribute pre-existing failures accurately.
Commands in the foundation plan below are existing entry points, not evidence that they ran.
Add real focused HIMSX tests under owner leaves and composed tests under `tools/e2e` when their contracts exist.
Do not invent npm script names or mark tests passed because a planned command appears in a document.

## Supervisor audit and repair loop

Use this loop for requested acceptance or when the actual risk requires independent review.
For routine work, use the fast-work rules in the repository agent guide.

1. Select one dependency-ready task and freeze its contract, exact write lease, acceptance IDs, and fixture.
2. Dispatch a real worker through the receiver's supported subagent mechanism.
3. Inspect the diff and run the required checks. Do not trust a worker summary alone.
4. Assign an independent reviewer to source, runtime behavior, evidence, and source-step coverage.
5. Record every valid finding as `H-REPAIR-###` with severity, reproduction, owner, gate, and lease.
6. Repair through an assigned worker and rerun the failing and affected regression checks.
7. Have the reviewer recheck the repair. Repeat until the increment's criteria pass.
8. Update TASK and AUDIT, release leases, and move to the next ready task.

Continue through H8. Do not stop after the first slice, menu, mock, or build.
Do not repeat unchanged blocked provider actions. Continue independent work and preserve the open requirement.
The senior audit can resume later from TASK/AUDIT evidence. This document does not create an unattended automation or another chat.

## Retained foundation plan

The original foundation checklist follows for continuity. It is not a completed implementation record.

## Scope

The tenant hospital-management app foundation and its authorized overview.

## Ownership contract

The current overview foundation is not a complete clinical system. Do not fabricate patient, treatment, payroll, or medical records to make a screen appear implemented.

The root Agent Guide and governance rules remain authoritative.
Keep one root dependency installation, lockfile, and generated output tree.
Keep business roles inside their owner and compose other components through public contracts.

## Current source surfaces

- `api/src/modules`: `overview`.
- `web/src/modules`: `overview`.

Source presence is not release evidence. Confirm executable behavior before describing a capability as complete.

## Delivery sequence

1. Read [TASK.md](TASK.md), [SKILLS.md](SKILLS.md), and the affected public entry points.
2. Inventory the current HIMSX implementation and its consumers.
3. Define the requested change and acceptance criteria within the scope above.
4. Resolve stored-data and public-contract compatibility before changing behavior.
5. Implement the change in its owner and update legitimate composition points.
6. Verify the owner, denied-access paths where relevant, and dependent applications.
7. Record evidence and remaining work in [TASK.md](TASK.md).

## Verification gates

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs himsx`
- `npm run typecheck -w @codexsun/himsx-api`
- `npm run lint -w @codexsun/himsx-api`
- `npm run build -w @codexsun/himsx-api`
- `npm run typecheck -w @codexsun/himsx-web`
- `npm run lint -w @codexsun/himsx-web`
- `npm run build -w @codexsun/himsx-web`

Use component and root checks when the change or full verification requires them.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.
