# C03 - Billing source UUID, idempotency, and invoice/receipt handoff

Status: proposed, owner decision required. Blocks EC-T08, EC-T10, EC-T12.

## Existing behavior

- Billing exposes HTTP only: `POST /billing/sales`, `POST /billing/sales/:id/confirm`,
  `POST /billing/receipts`, `POST /billing/receipts/:id/post`.
- Totals are computed server-side by `buildSaleTotals`; money is `DECIMAL(18,2)`, quantity/rate
  `DECIMAL(18,4)`, tax rate `DECIMAL(7,4)`. INR is enforced in code.
- Per-line `taxRate` is caller-supplied. Billing does not re-derive tax from `core_taxes` and has no
  place-of-supply logic.
- Auth requires a tenant JWT, `x-tenant-db`, `x-company-id`, `x-financial-year-id`, and
  `billing.application.records.*`; PUT/PATCH are admin-only.
- There is no commerce order model, no external/idempotency reference on `billing_sales` or
  `billing_receipts`, and no credit note, debit note, refund, or return capability.

## Exact gap

A retried Ecommerce checkout can issue two invoices or two receipts. There is no stable link from an
Ecommerce order/payment to the Billing document, and no reversal path for cancellation or refund.
Ecommerce cannot write Billing tables.

## Proposed contract

Add nullable, additive columns and unique keys:

```sql
ALTER TABLE billing_sales
  ADD COLUMN source_system VARCHAR(40) NULL,
  ADD COLUMN source_uuid CHAR(8) NULL,
  ADD COLUMN source_document_type VARCHAR(40) NULL,
  ADD UNIQUE KEY billing_sales_source_unique (source_system, source_uuid);

ALTER TABLE billing_receipts
  ADD COLUMN source_system VARCHAR(40) NULL,
  ADD COLUMN source_uuid CHAR(8) NULL,
  ADD COLUMN source_document_type VARCHAR(40) NULL,
  ADD UNIQUE KEY billing_receipts_source_unique (source_system, source_uuid);
```

`source_system = 'ecommerce'`; `source_uuid` is the Ecommerce document's public `uuid` (`CHAR(8)`,
eight lowercase hex), not a new commerce UUID type and not the Billing document's own `uuid`. Existing
rows keep `NULL` and are unaffected. Both tables are tenant-local, so the unique key is the
per-tenant-database idempotency authority; a duplicate submit returns the existing document (200 with
`deduplicated: true`), not a second issue.

Add an HTTP handoff under the existing Billing route family:

- `POST /billing/sales/from-commerce` accepts the Ecommerce order UUID (`CHAR(8)`), Core `company_id`
  (`INT`), `financial_year_id` (`INT`), `contact_id` (`INT`), `currency_id` (`INT`), lines (description,
  quantity, rate, caller-supplied tax rate), and a caller-computed total for verification. Billing
  re-totals and rejects a mismatch with 409; it never trusts the client total.
- `POST /billing/receipts/from-commerce` accepts the payment UUID (`CHAR(8)`), sale UUID (`CHAR(8)`),
  amount, mode, and reference.
- `POST /billing/sales/:id/credit-note` and `POST /billing/receipts/:id/reverse` accept an Ecommerce
  reversal UUID (`CHAR(8)`) and reason. They post a linked reversal; they never delete or mutate the
  original.

Every endpoint returns the Billing document UUID (`CHAR(8)`), number, status, and totals. All are
tenant-scoped and reject a company/financial-year pair that is not active for the verified tenant.

## Tax and reversal requirements

- Ecommerce sends the tax rate it charged; Billing re-computes and records the effective rate. A
  mismatch fails closed with a machine-readable code, not a silent adjustment.
- Place-of-supply and tax derivation remain Billing/Core decisions; Ecommerce must not invent them.
- A credit note references the original sale and is idempotent by reversal UUID.
- Partial refunds are allowed only against posted receipts and may not exceed the receipt amount.
- Reversal failures are retried with the same reversal UUID; no negative "new sale" workaround.

## Retries and failures

- Timeout after Billing commit: Ecommerce retries the same `source_uuid`; Billing returns the existing
  document.
- Validation failure (409/422): Ecommerce stops and surfaces the exact Billing code; it does not
  fabricate a local invoice.
- Billing unavailable: Ecommerce records a pending handoff intent and leaves the order in
  `payment_pending`; it never marks the order paid.

## Consumers and tests

Consumers: EC-T10 payment handoff, EC-T12 cancellation/returns/refunds, EC-T13 vendor settlement
reads. Tests: duplicate submit returns one row; concurrent duplicate submits yield one row; total
mismatch returns 409; credit note/reversal is idempotent; cross-tenant company/year is denied; existing
Billing suites remain green; Ecommerce never writes Billing tables.

## Repository identity conformance

- Billing documents already use `id INT NOT NULL AUTO_INCREMENT`, `uuid CHAR(8)`, and
  `status VARCHAR(24)` in `billing_sales` and `billing_receipts`; the handoff adds no new identity type.
- `source_uuid` is `CHAR(8)` and holds the owning Ecommerce record's public UUID. Ecommerce documents
  are tenant-local `ecommerce_*` rows with integer primary keys and eight-hex UUIDs.
- Company, financial year, contact, currency, ledger, and line product references are integer Core
  IDs in the same tenant database. The handoff must not send Core UUIDs where Billing expects `INT`.
- Billing's own document UUIDs returned to Ecommerce are `CHAR(8)`, not `CHAR(36)`.
- No `BIGINT`, `CHAR(36)`, or MySQL `ENUM` is introduced; statuses remain `VARCHAR(24/32)`.

## Owner decision still required

1. Who derives tax and place of supply for commerce orders?
2. Are credit notes the only refund document, or are standalone refunds required?
3. Which Billing permission gates the machine handoff (a dedicated service permission is preferred)?

Recommended default: Billing derives tax from the supplied rate and place-of-supply inputs, credit
notes are the only reversal document, and a dedicated `billing.commerce.handoff` permission is added.
