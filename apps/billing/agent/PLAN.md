# Billing plan

## Marketing integration planning — 2026-10-23

Status: design only. No runtime capability or provider access is added.
See [Marketing Phase 0](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), gap G08, delivery phase 6.

Billing remains the sole owner of financial facts. Marketing never creates sales or settlements to complete attribution.
Existing outstanding and period reads do not establish a campaign-linked revenue contract.
Add a minimal explicit-source outcome projection with company, financial year, currency, source UUID, version, and reversal evidence.
Require Billing permission independently of Marketing report access. Do not match revenue by contact/date alone.
Keep refunds, cancellations, receipts, and invoice outcomes distinct and reconciled.

## Scope

Tenant billing entries, quotations, purchases, sales, receipts, payments, opening balances, and outstanding reports.

## Ownership contract

Keep company and financial-year scope explicit. Draft reservations do not settle balances. Preserve allocation, tax, lifecycle, and accounting reconciliation rules.

The root Agent Guide and governance rules remain authoritative.
Keep one root dependency installation, lockfile, and generated output tree.
Keep business roles inside their owner and compose other components through public contracts.

## Current source surfaces

- `api/src/modules`: `dashboard`, `export-sales`, `opening-balance`, `payment`, `purchase`, `quotation`, `receipt`, `reports`, `reports/customer-statement`, `reports/customer-summary`, `reports/gst-statement`, `reports/stock-statement`, `reports/supplier-statement`, `reports/supplier-summary`, `runtime-persistence`, `sales`, `settings`.
- `web/src/modules`: `dashboard`, `export-sales`, `opening-balance`, `payment`, `purchase`, `quotation`, `receipt`, `reports/customer-statement`, `reports/customer-summary`, `reports/gst-statement`, `reports/stock-statement`, `reports/supplier-statement`, `reports/supplier-summary`, `sales`, `settings`.

Source presence is not release evidence. Confirm executable behavior before describing a capability as complete.

## Delivery sequence

1. Read [TASK.md](TASK.md), [SKILLS.md](SKILLS.md), and the affected public entry points.
2. Inventory the current Billing implementation and its consumers.
3. Define the requested change and acceptance criteria within the scope above.
4. Resolve stored-data and public-contract compatibility before changing behavior.
5. Implement the change in its owner and update legitimate composition points.
6. Verify the owner, denied-access paths where relevant, and dependent applications.
7. Record evidence and remaining work in [TASK.md](TASK.md).

## Verification gates

- `node tools/check-module-boundaries.mjs billing`
- `npm run typecheck -w @codexsun/billing-api`
- `npm run lint -w @codexsun/billing-api`
- `npm run build -w @codexsun/billing-api`
- `npm run typecheck -w @codexsun/billing-web`
- `npm run lint -w @codexsun/billing-web`
- `npm run build -w @codexsun/billing-web`

Use `npm run check:component-docs` and the relevant root checks.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.

## Data Bridge derived projections

Data Bridge imports must finish with a target Billing dashboard rebuild through the public Billing service.
Verify the live scoped dashboard against confirmed sales and posted vouchers, excluding drafts and deleted entries.
Preserve source data. Verify idempotent repeat imports and their queue status independently of the report status.
