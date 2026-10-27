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

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs billing`
- `npm run typecheck -w @codexsun/billing-api`
- `npm run lint -w @codexsun/billing-api`
- `npm run build -w @codexsun/billing-api`
- `npm run typecheck -w @codexsun/billing-web`
- `npm run lint -w @codexsun/billing-web`
- `npm run build -w @codexsun/billing-web`

Use component and root checks when the change or full verification requires them.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.

## Data Bridge derived projections

Data Bridge imports must finish with a target Billing dashboard rebuild through the public Billing service.
Verify the live scoped dashboard against confirmed sales and posted vouchers, excluding drafts and deleted entries.
Preserve source data. Verify idempotent repeat imports and their queue status independently of the report status.

## Billing readiness review, 25 October 2026

Status: reviewed, not fixed by this audit. Passing regression tests do not close the findings below.
Review scope: Billing API/web, direct Core references, Platform permissions and queue composition, Data Bridge projections, Accounts integration, and Mail/PDF entry tools.
No production provider submission, deployment, or customer financial write was part of this review.

### Confirmed defects and implementation gaps

| ID  | Priority | Finding and impact                                                                                                                                                                  | Evidence                                                                                                                                                                                                                                                  | Required work                                                                                                                                                                                         |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 | P1       | Export Sales amounts still use INR formatting. Party/month totals combine currencies. Export invoice words still say Rupees. Receipt formatting has the same INR assumption.        | `web/src/modules/export-sales/export-sales.services.ts`, `export-sales.print.tsx`, `web/src/shared/document/document-totals-report.tsx`, `web/src/modules/receipt/receipt.services.ts`. Rendering reproduction combined USD 100 and INR 100 into INR 200. | Format each document in its stored currency. Group or select currencies before totals. Carry currency identity into totals records. Add list and print regressions.                                   |
| B02 | P1       | Saved vouchers can return an error when later event, queue, numbering, or dashboard work fails. Save retries can conflict or create another document through automatic renumbering. | `api/src/modules/payment/payment.service.ts`, `sales/sales.service.ts`, `dashboard/dashboard.service.ts`. Fault injection confirmed one payment save before an event-store error escaped.                                                                 | Commit the voucher and required outbox records together. Process projections separately with recovery. Add request idempotency and committed-save failure tests.                                      |
| B03 | P2       | Duplicate Sales numbers are replaced even when automatic numbering is disabled.                                                                                                     | `api/src/modules/sales/sales.service.ts`, `resolveNextSaleNumber`. A stopped-before-persistence reproduction selected SAL-0001 for MANUAL-DUP with automatic numbering disabled.                                                                          | Reject duplicate manual numbers. Reserve automatic retry for automatic-number mode. Verify the same policy for create and edit.                                                                       |
| B04 | P2       | General Billing posting/activity jobs are stored pending, but no runtime reader or dispatcher was found. This is separate from the working compliance queue.                        | `api/src/modules/runtime-persistence/runtime-persistence.repository.ts`; repository-wide references to `billing_outbox_jobs` only showed producers, definitions, and tests. Payment/Purchase/Quotation worker helpers have no runtime callers.            | Register an owner-approved dispatcher and real processors with claims, retries and completion states, or remove unsupported capabilities. Do not equate these jobs with completed accounting posting. |
| B05 | P2       | Invoice comments, tags, assignments and attachment names disappear after reload. Attachment selection does not upload file bytes.                                                   | Sales, Purchase, Quotation and Export Sales show pages use local React state. Sales comments have a table but no wired comment route in the reviewed owner.                                                                                               | Add owner APIs, stored file references and permissions. Load saved collaboration state and genuine activity history.                                                                                  |
| B06 | P2       | Standard voucher audit rows omit actor identity. Sales show-page creation/update labels use the current viewer.                                                                     | `sales/sales.repository-support.ts` inserts activity without actor columns. `sales/sales.repository.ts` omits creator/updater fields. `sales/sales.show.tsx` labels local activity with the signed-in viewer. Compliance jobs do preserve actor email.    | Write authenticated actor and request/correlation identity in financial transactions. Render persisted actor history instead of the viewer.                                                           |
| B07 | P2       | Stock Statement reuses global Core product opening quantity in every selected company/year. Only movements are scoped.                                                              | `api/src/modules/reports/stock-statement/stock-statement.repository.ts`, `stockRows`.                                                                                                                                                                     | Introduce reviewed company/year stock openings and carry-forward rules before treating this as an inventory ledger. Keep Inventory ownership explicit.                                                |
| B08 | P2       | Print QR account details can be saved, but no print renderer reads the option. This is the account/payment QR setting, not the working signed e-invoice QR.                         | `web/src/modules/settings/settings.billing-workspace.tsx`; references to `printQrAccountDetails` only appear in settings contracts and controls.                                                                                                          | Implement account/payment QR rendering with tests, or hide the unsupported option.                                                                                                                    |

P1 means financial correctness or save reliability. P2 means incomplete behavior or a condition-dependent correctness risk.
B01, B02 and B03 have executable, isolated reproductions under root `dist/billing-audit` for this review.
B04 through B08 are source-verified findings. No production failure is claimed.

### Missing workflow features

- Foreign-currency export compliance is blocked by `export-sales.whitebooks-payload.ts`. Add explicit INR tax conversion, stored exchange-rate evidence and rounding reconciliation before enabling it.
- Credit notes, debit notes, sales/purchase returns and their settlement/reversal links are absent from the reviewed Billing routes and document types.
- Invoice due dates, payment-term based overdue ageing, and reason-required write-offs/adjustments remain missing. Unallocated receipt/payment amounts already exist and must not be reported as missing advances support.
- A financial close/lock and reviewed next-year carry-forward workflow is still needed for full year-end operation.
- Accounts owns journals and books. No automatic Billing-to-Accounts posting or reversal consumer was found. Billing remains usable as a standalone outstanding workflow, not a complete integrated accounting ledger.
- GST Statement supplies calculations and manually entered filing references. It does not implement automatic GST return submission or purchase-return matching.
- Stock Statement derives quantity movement from Billing documents. It does not provide warehouse transfers, valuation/costing, or a full stock ledger.
- Statement and Stock screen hooks fetch all report pages for local filters. Add server-side filter support and a stable export snapshot for larger datasets.
- Reporting currency remains a tab/company/year preference in session storage. It is not a company-wide published setting. Preserve that documented behavior unless persistent defaults are requested.

These are separate delivery choices. Accounts, Inventory, automated GST filing and multi-taxpayer setup are not prerequisites for every standalone Billing deployment.

### Production gates

- The inspected configuration remains WhiteBooks sandbox with the known test taxpayer. Production taxpayer authentication was not performed.
- WhiteBooks configuration is process-wide. A shared deployment needs company/GSTIN-bound credentials if multiple taxpayers must generate compliance.
- Verify deployment migrations against a restored target database, tenant/company/year isolation, permission denial, worker restart/lease recovery and the selected queue backend.
- Reconcile deployed financial totals after imports. Data Bridge now calls the public Billing projection rebuild in current source.
- Verify populated invoice/report flows and persisted collaboration after implementation. Physical printing and phone-based QR scanning were not repeated here.

### Verification and delivery order

Passed on 25 October 2026:

- All 20 Billing unit tests and all three disposable MariaDB stages.
- Billing API/web type checks and lint, plus Billing module boundaries.
- Isolated fault-injection and rendering reproductions for B01, B02 and B03. They confirm defects, not successful fixes.

The database stages use disposable databases and do not certify production data or every related app.
No new end-to-end browser pass, production authentication, Redis restart test or production deployment ran during this audit.

Recommended order: B01/B02, B03/B04/B06, B05/B08, then the required export, collection, closing and integration features.
Keep all items open until their implementation and focused acceptance tests pass.
