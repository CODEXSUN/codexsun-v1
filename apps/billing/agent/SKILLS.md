# Billing working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing Billing.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

Tenant billing entries, quotations, purchases, sales, receipts, payments, opening balances, and outstanding reports.

Keep company and financial-year scope explicit. Draft reservations do not settle balances. Preserve allocation, tax, lifecycle, and accounting reconciliation rules.

## Implementation rules

- Inspect the affected source and public contracts before editing.
- Keep concrete business behavior in its owning leaf or package.
- Preserve authoritative validation, permission checks, and data ownership.
- Add worker, event, or sync roles only when they contain real implemented behavior.
- Keep secrets, generated files, and local runtime data out of source control.
- Run npm commands from the repository root. Write generated output under root `dist`.
- Update this owner documentation when scope, contracts, or supported operations change.

## Review and evidence

For a small change, inspect the affected code and use at most one focused check when useful.
Inspection can suffice for a trivial edit. Add checks when the actual risk requires them.
The commands below are options for full verification, not a checklist for every prompt.

- `node tools/check-module-boundaries.mjs billing`
- `npm run typecheck -w @codexsun/billing-api`
- `npm run lint -w @codexsun/billing-api`
- `npm run build -w @codexsun/billing-api`
- `npm run typecheck -w @codexsun/billing-web`
- `npm run lint -w @codexsun/billing-web`
- `npm run build -w @codexsun/billing-web`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.

## Data Bridge dashboard refresh, 25 October 2026

Platform calls the public Billing dashboard projection service after each successful Data Bridge queue processor.
Business, mapped, and common imports rebuild every target company/financial-year context before the queue job completes.
The host resolves the exact active MariaDB target from the tenant registry.
A projection failure rejects the job so its queue retry can rebuild again.
Repeated imports do not require new business rows to repair a stale snapshot.
Sources and imported document statuses remain unchanged.
