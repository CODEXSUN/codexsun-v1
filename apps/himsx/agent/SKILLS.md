# HIMSX working skills

## Front Office handoff rules

The active assignment is the supplied Front Office document, analyzed in [REQUIREMENTS-ANALYSIS](REQUIREMENTS-ANALYSIS.md).
Use [SUPERVISOR-PROMPT](SUPERVISOR-PROMPT.md) and [WORKER-TASKS](WORKER-TASKS.md) for supervisor/subagent execution.
The planning task does not establish runtime completion or an independent audit.
Read the active Front Office section of PLAN before the retained foundation guidance.

- Reuse shared owner records through public contracts. Hospital-only fields belong in linked `himsx_<module>` extension tables.
- Core keeps generic contact identity, locations, and companies. Never add patient fields to Core tables by default.
- Platform keeps users, sessions, roles, grant authority, role copy, and shared access reports.
- HRMS keeps existing departments/designations. Missing public exports need owner-side tasks, not duplicate masters.
- Billing keeps all financial authority. Freeze the transaction-aware integration before registration payment code.
- CRM keeps IP enquiry workflow data. Extend its record through `himsx_enquiries` without a second entry workflow.
- Clinical treatment, beds, diagnostics, pharmacy, payroll, and native-mobile work remain outside this Front Office assignment.
- Match current CRM Enquiry list/Show/upsert through `@codexsun/ui` and managed theme tokens.
- Enforce sensitive patient access on generic owner paths, reports, exports, print, and lookups.
- Keep hospital history and sensitive audit tenant-local. Use explicit UTC instants and hospital-local calendar rules.
- Use domain transitions for registrations/admissions. Never apply generic force-delete behavior to posted hospital transactions.
- Do not interpret hospital Super User as Platform super-admin.
- Resolve hospital-specific MHC and policy decisions explicitly. Do not invent definitions or legal requirements.
- ABHA needs an approved integration contract and real provider acceptance. Redirects and mocks are insufficient.
- Use exact worker leases, independent review, tracked repairs, and current evidence before acceptance.
- Keep unavailable inputs open while continuing independent work. No fabricated readiness, records, or worker identities.
- This handoff permits local work only. Production operations, real patient exchange, provider enrollment, commits, and deployment need separate authorization.

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing HIMSX.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

The tenant hospital-management app foundation and its authorized overview.

The current overview foundation is not a complete clinical system. Do not fabricate patient, treatment, payroll, or medical records to make a screen appear implemented.

## Implementation rules

- Inspect the affected source and public contracts before editing.
- Keep concrete business behavior in its owning leaf or package.
- Preserve authoritative validation, permission checks, and data ownership.
- Add worker, event, or sync roles only when they contain real implemented behavior.
- Keep secrets, generated files, and local runtime data out of source control.
- Run npm commands from the repository root. Write generated output under root `dist`.
- Update this owner documentation when scope, contracts, or supported operations change.

## Review and evidence

- `node tools/check-module-boundaries.mjs himsx`
- `npm run typecheck -w @codexsun/himsx-api`
- `npm run lint -w @codexsun/himsx-api`
- `npm run build -w @codexsun/himsx-api`
- `npm run typecheck -w @codexsun/himsx-web`
- `npm run lint -w @codexsun/himsx-web`
- `npm run build -w @codexsun/himsx-web`

Check affected consumers and relevant tests. Report skipped or blocked checks explicitly.
Documentation and prompts never replace backend authorization or deployment approval.
