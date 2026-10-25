# Thirumurugan migration: execution notes and repeat procedure

Recorded: 2026-10-25, Asia/Calcutta.

## Purpose and current scope

Use this guide for older databases with renamed tables, accounting-period companies, and incomplete foreign-key relationships.
It records the approved Thirumurugan work and the checks needed for another client.
Client names, table names, field names, and numeric IDs below describe this case. They are not universal migration rules.

This work ran against a local Docker target. It did not migrate Thirumurugan to the cloud.
Do not treat these notes as permission to import another client or deploy to production.

Read [cxapp-v2.md](cxapp-v2.md) for the shared operating safeguards.
Read [thirumurugan-legacy.md](thirumurugan-legacy.md) for the original schema and preparation design.
That earlier document describes the preparation phase. Its historical no-import statements do not describe the later execution recorded here.

## Database boundaries

| Role | Thirumurugan database | Rule |
| --- | --- | --- |
| Original source | `thirumurugan_db`, native local MariaDB, port 3306 | Read only. Do not change rows, schema, users, or audit fields. |
| Raw Docker restore | `codexsun_bridge_thirumurugan_legacy`, local port 13306 | Read only. Compare its contents with the original source. |
| Normalized staging | `codexsun_bridge_thirumurugan_stage_1792910661053` | Derived working collection. Apply approved transformations here, then freeze it during execution. |
| Business target | `thirumurugan_v2_local`, local Docker MariaDB | Only this business database received the approved imports. |
| Earlier disposable target | `codexsun_bridge_thirumurugan_target_1792910661053` | Preparation fixture. Do not confuse it with the business target. |

The selected Data Bridge source was connection 3. The selected local tenant was tenant 14.
These registration IDs are case references. Resolve the current connection and tenant again before another run.

The final source checks covered 43 tables and 23,890 rows.
These counts describe the inspected snapshot. Compare hashes as well as counts when resuming work.

## Completed work and open work

| Stage | Verified local result | Remaining boundary |
| --- | --- | --- |
| Core common references | 99 inserts and 24 existing matches across 14 selected tables. Repeat inserted zero rows. | Ambiguous geography remains held. |
| Core masters | Reused company ID 1. Added 2,063 rows, including contacts, products, addresses, channels, and historical years. | Eight contact addresses and three products remain held. |
| Billing sales | Added 1,660 confirmed invoices and all 5,301 associated item rows. Repeat inserted zero rows. | Held 223 complete invoice aggregates and their 903 children. |
| Receipts | Prepared 683 receipts and 683 source detail rows. | No receipt import occurred. All receiving-ledger mappings remain unresolved. |
| Receipt allocations | Prepared three explicit allocations against existing target invoices. | No allocation import occurred. Do not invent links for the other 680 details. |

Do not describe the full client migration as complete. Invoice mismatches and receipt decisions remain open.

## Execution methods actually used

Core common references and Core masters used the existing authenticated Data Bridge transfer API and BullMQ worker.
An isolated temporary worker used the existing application image when the main API worker was disabled.
Its allowlist restricted execution to this target tenant and recorded transfer runs.
The temporary worker containers were removed after their evidence was copied out.
Do not enable unrelated shared workers or consume another task's jobs to repeat this procedure.

The approved Billing subset used a guarded local SQL transaction for all headers and children together.
It used the unchanged repository decimal helpers and checked parent IDs before execution.
This was a local data operation. It was not a new Data Bridge queue feature or a generic UI import implementation.
Do not claim that these Billing rows have Data Bridge queue job records.

Application code and the original source were not changed for these execution steps.
Do not reuse private operational scripts blindly against another database.
Use the normal supported import path for future work. Review any required transaction exception before execution.

## Repeat procedure for another legacy database

1. Confirm the exact source, staging, target, and tenant registration.
2. Inventory source tables, keys, column types, lifecycle flags, and business relationships.
3. Inspect the current target schema and owner contracts.
4. Back up the target before any write.
5. Verify the backup checksum and compressed-file integrity.
6. Restore a separate raw source copy for local analysis.
7. Compare every raw table with the original source.
8. Create disposable staging tables with current repository owner migrations.
9. Prepare Core references in parent order.
10. Review missing and ambiguous relationships before importing Core.
11. Prepare company, year, contact, and product collections against verified target parents.
12. Save an explicit approval record for corrections and seed reuse.
13. Import only approved masters, then verify them independently.
14. Prepare each invoice with every child row.
15. Hold the whole invoice when any required relationship or financial check fails.
16. Import the approved invoice subset with complete children.
17. Repeat the same approved subset to check duplicate prevention.
18. Rebuild and verify the affected Billing dashboard projections.
19. Prepare receipts separately from invoices.
20. Import receipts and allocations only after their accounting decisions are approved.
21. Recheck source hashes, target relationships, totals, and held-row exclusions.
22. Retain the approval record, backups, crosswalks, and final reports.

Never disable foreign-key checks or truncate existing client tables to make an import pass.
Never use equal source and target numeric IDs as evidence of a business match.

## Source collections and target ID resolution

Keep each original source row with its source database, table, and primary key.
Keep normalized values separately from the original JSON.
Record the target entity, target ID, parent mappings, decision, and verification result.

Resolve a foreign key in this order:

1. Read the source parent row.
2. Obtain its business name, code, and required parent context.
3. Apply a reviewed alias when needed.
4. Find exactly one target parent through that identity.
5. Save the resolved target ID in the prepared collection.
6. Hold missing or ambiguous matches.

Resolve city identity through district and state, not city text alone.
Resolve a pincode through its city and other identity fields, including area where applicable.
Resolve an invoice through company, financial year, invoice number, and customer checks.

Do not predict new target IDs before insertion.
Keep child-parent dependencies explicit until the parent insert returns its actual target ID.

The guided transfer selector requires an integer primary key named `id` and supported declared parent relationships.
Legacy keys such as `PARTY_ID` need a normalized staging representation.
Do not rename keys or add constraints to the original source to satisfy this requirement.

## Core common references

The dependency order used here was country, state, district, city, and pincode.
Other selected references included contact types, product types, units, HSN codes, sales types, taxes, ledger groups, ledgers, and currency.
Read the actual foreign-key graph for another client. Do not assume this list covers every target dependency.

Approved location decisions in this case:

| Source label | Reviewed target meaning |
| --- | --- |
| `TAMILNADU` | Tamil Nadu under India, state code 33 |
| `TIRUPUR` | Existing Tiruppur city |
| `AVINASHI (T.K), TIRUPUR` | Existing Avinashi city |
| `MUMBAI` | Mumbai City district under Maharashtra |
| Localities naming Tiruppur | Keep distinct locality labels where approved. Resolve their district to Tiruppur. |
| Currency absent from invoice schema | Use the explicitly approved INR target record. |

Gujarat and Kerala appeared as city labels. A Ludhiana/Punjab label appeared under Tamilnadu.
Those geography rows remain held. Do not apply guessed corrections to their dependent addresses.

Approved unit aliases were `Mts` to Meter, `Ltr` to Litre, and `Kgs` to Kg.
Reuse canonical `pcs` and `nos` records.
The target hyphen unit at ID 1 remained unchanged.
For another tenant, verify the actual unit records and existing references before making any seed decision.

## Core master field patterns

| Source example | Target entity or field | Rule |
| --- | --- | --- |
| `company_tbl.COMPANY_ID` | Company and financial-year crosswalk | One legacy company key can identify both a legal company and an accounting period. |
| Company name, display name, contact and registration details | `core_companies` | Compare legal identity before consolidating rows or reusing a seed company. |
| Company streets | `core_companies_addresses` | Map only supported columns. Retain unsupported location context in provenance. |
| Accounting year start/end | `core_financial_years` | Check actual document dates and duplicate periods before saving. |
| `party_tbl.PARTY_ID` | `core_contacts` | Keep a stable source-key namespace, such as the reviewed legacy contact code. |
| Party type | Contact type ID and label | Resolve the target type through business identity. |
| Party streets and geography | `core_contacts_addresses` | Resolve all target geography IDs. Do not invent a required street. |
| Party phones and email | Primary fields and supported child tables | Preserve distinct channels and check invalid values. |
| `product_tbl.PRODUCT_ID` | `core_products` | Match product identity and preserve the source crosswalk. |
| Product type, HSN, unit, and current tax | Product foreign IDs | Resolve each parent through its target business identity. |
| Opening quantity and price | Supported product fields | Preserve decimal meaning and validate target precision. |

Retain unsupported fields in the private source collection.
Examples include purchase prices, selling prices, credit days, legacy user IDs, and source-only notes.
Do not force them into unrelated target fields or claim they were transferred to unsupported columns.

### Approved company and year decisions

The seven source company rows represented one legal company across accounting periods.
The user approved reuse of the verified target seed company at ID 1.
The update preserved its ID, UUID, creator, and existing references.
It did not create seven legal companies.

The user approved these target period corrections:

| Target period | Approved dates |
| --- | --- |
| FY 2017-18 | 2017-04-01 through 2018-03-31 |
| FY 2023-24 | 2023-04-01 through 2024-03-31 |

The latter source company row still contained the previous year's dates.
Its invoice dates supported the reviewed correction.
The source values were not edited.
The existing target current/default FY 2026-27 and default-company settings remained unchanged.

Do not apply these company IDs or date corrections to another client without a fresh review.

### Held master records

Eight contact addresses remain held.
Four lack street line 1. Three depend on unresolved cities. One has a state/city conflict.
Their source party keys are 1, 3, 17, 28, 30, 76, 89, and 114.

Products with source keys 643, 662, and 1560 remain held for incomplete current GST components.
Do not create artificial 6% or 9% tax records from incomplete halves of a GST pair.
Another 160 products had unspecified current GST. Their target current-tax reference stayed NULL, not zero-rated.

## Audit actors and identity

Inspect each target audit column before mapping it.
Text audit columns and foreign keys to `app_users` are different contracts.

| Target record | Approved actor handling |
| --- | --- |
| New Core rows | Text `created_by = 'old:sync'` |
| Reused seed company | Preserve its existing creator and identity |
| Sales headers | Integer `created_by`, `updated_by`, and `confirmed_by` reference the approved target user |
| Sales items | Text `created_by = 'old:sync'` |
| Prepared receipt headers and allocations | Text `created_by = 'old:sync'` where the inspected schema supports it |

The local target initially had no users.
The user approved provisioning the standard `admin@tenant.com` account.
The existing tenant-user and tenant-user-role seeders created it and linked the admin role.
The standard configured password was hashed by the owner seeder. Credentials were not logged.
No separate `old:sync` user was created.

Never coerce `old:sync` into an integer column or copy an administrator ID from another database.
Do not reset an existing target user's password to repeat a migration.
Confirmation timestamps recorded the import time. Original invoice dates remained in `issued_on`.

## Sales invoice and item mapping

| Source example | Target field or relationship | Check |
| --- | --- | --- |
| `INVOICE_ID` | Private crosswalk to target sales ID | Generate the target identity and return it to every child dependency. |
| `COMPANY_ID` | `company_id` and `financial_year_id` | Use the separately approved legal-company and period mappings. |
| `INVOICE_NO` | `invoice_number` | Preserve text. Check uniqueness within target company/year. |
| `INVOICE_DATE` | `issued_on` | Require a valid date inside the mapped target period. |
| `PARTY_ID` | `customer_id` | Match the imported contact crosswalk. |
| Party address | Billing and shipping address IDs | The user approved the same verified address for both in this case. |
| `TAXTYPE_ID` | `tax_type` | Resolve the source label to the supported CGST/SGST or IGST mode. |
| Stored taxable, GST, total, and rounding fields | Header financial fields | Preserve reviewed source amounts. Derive signed rounding without hiding differences. |
| `REFERED_AMT` | Settlement provenance | It is not an invoice-allocation ledger. Preserve it without inventing receipts. |
| `INVOICEITEMS_ID` | Private crosswalk to target item ID | Keep stable child order within each parent invoice. |
| Child `PRODUCT_ID` | `product_id` | Hold the whole invoice if a required product remains held. |
| Product HSN and unit | Item HSN and unit IDs | Resolve canonical target references. Source items lack historical snapshots for these fields. |
| `QTY`, `PRICE`, component tax percentages | Item quantity, rate, taxable, component GST, and total | Use the unchanged exact-decimal helpers and target precision. |
| `PO_ID`, `DC_ID` | Supported PO/DC reference text | Read source parent labels. This does not migrate PO/DC business documents. |

The user approved `confirmed` status for the reviewed invoice subset.
Do not infer confirmation from source `ACTIVE_ID` or `LOCKED` flags for another import.

Hold an invoice when any required header or child check fails.
Check child coverage, unique line order, parent ownership, date range, tax path, and every amount total.
Check cumulative children against the header before committing.
Check every saved row again after committing.

This review found 153 small tax-rounding cases and one substantive taxable-total mismatch.
Source invoice 973 differed by 60.80 in taxable amount and 5.47 in each GST component.
It also found invoices that depend on held addresses or products.
The union was 223 held invoices. Categories overlap, so do not add their counts as distinct invoices.

## Receipts and invoice allocations: preparation only

| Source example | Proposed target | Rule |
| --- | --- | --- |
| `receipt_tbl.RECEIPT_ID` | Receipt crosswalk | Do not allocate a target receipt ID before insertion. |
| Company and party keys | Company, year, currency, and customer IDs | Reuse verified business crosswalks. |
| Receipt number and date | Receipt document fields | Check uniqueness and date/year agreement. |
| Receipt type | Supported payment mode or reviewed adjustment | Cash, cheque, RTGS, UPI, and non-cash adjustments are not interchangeable. |
| `BANK_ID` | Receiving-ledger review context | A bank name does not prove the company's receiving account or ledger. |
| Cheque number and date | Reference number and date | Preserve leading zeros. Validate calendar dates and retain the raw text. |
| Receipt amount and total | Receipt financial fields | Check header/detail sums and review deductions explicitly. |
| `receiptitems_tbl.INVOICED_NO` | Invoice number within source company/year | Do not interpret this value as `INVOICE_ID`. |
| Explicit invoice detail | `billing_receipt_allocations.sales_id` | Resolve the source invoice, then its actual target ID. |
| Detail amount | `allocated_amount` | Check positivity, customer/company/currency, and cumulative outstanding limits. |

Three explicit source references matched target invoices and passed the allocation checks.
The case crosswalk is receipt 59 to target sale 90, receipt 60 to sale 81, and receipt 62 to sale 110.
These IDs are evidence from this target. They must not become defaults for another import.

The other 680 details contain 624 advances and 56 blank references.
Keep them unlinked until their treatment is approved.
Do not generate FIFO allocations or infer links from equal amounts or source invoice settled totals.

The receipt review found 31 receipts with local mismatches.
Issues include nine year/date conflicts, one malformed cheque date, two zero-value receipts, and 21 nonstandard modes.
Categories overlap. The malformed date was `10-08-20173` on source receipt 6. No correction was applied.

All 683 receipts still need approved receiving-ledger mappings.
The target has cash/bank ledger groups but no verified business receiving ledgers for this collection.
Do not substitute hyphen, General Ledger, or Transport Charges to bypass that decision.
Do not create company bank accounts from cheque issuer-bank labels without evidence.

Review TDS, debit entries, returns, differences, cancellation entries, and named cash types separately.
Do not turn them into bank receipts or silently assume zero deductions.
Choose the receipt lifecycle explicitly. Active source rows do not prove posted history.

The settlement report compares source receipt totals with source invoice settled amounts by company and contact.
It also lists settled groups without receipt records.
Differences are diagnostic. Advances, cross-year receipts, adjustments, and missing source history prevent direct allocation inference.
Customer outstanding balances remain incomplete until receipt and allocation work is approved and verified.

## Verification and reporting gates

- Match original-source and raw-restore fingerprints before and after each operation.
- Freeze staging during execution and confirm its fingerprints afterward.
- Check actual target IDs, unique identities, and every non-null foreign key.
- Prove held rows and their dependent invoice aggregates were excluded.
- Compare complete child sets and exact financial totals, not only row counts.
- Repeat the approved subset and require zero new inserts or unapproved updates.
- Preserve existing target company references, current-year settings, and unrelated business data.
- Rebuild affected Billing dashboards through the existing owner projection service.
- Compare historical dashboard counts and amounts with target SQL totals.
- Check the selected year when an overview shows zero. Historical imports do not make the current year contain sales.
- Report pending receipts separately from successful invoice import results.
- Show receipts, allocations, modes, ledgers, reconciliation, and decisions in separate report tabs.

## Evidence and backup locations

Private artifacts live under repository-root `dist/verification/thirumurugan-legacy/`.
They contain client data and are ignored generated output. Preserve them securely before cleaning `dist`.
Do not commit raw rows, credentials, password hashes, or database dumps with these notes.

| Folder | Main evidence |
| --- | --- |
| `preparation/` | Original schema inventory, field lists, raw/normalized collections, and preparation manifest |
| `core-review/` | Initial Core review and code fingerprints |
| `core-sync/` | Approved geography and unit decisions, mapping plan, queue transfer results, and backup metadata |
| `masters-review/` | Company/year decisions, actual target foreign IDs, and held master records |
| `masters-sync/` | Saved master verification, repeat results, queue proof, and source proof |
| `billing-review/` | Full invoice/item collection, parent crosswalk, financial mismatches, and global decisions |
| `billing-sync/` | Approved plan, transactional import results, repeat proof, saved ID crosswalk, and dashboard verification |
| `receipts-review/` | Receipt collection, three allocation candidates, ledger/mode review, and settlement reconciliation |

Each execution folder records its own backup metadata or links to it.
Verified backups reside below `D:/workspace/backups/data-bridge/` in the dated Thirumurugan stage folders.
Use the recorded database name, file path, SHA-256, and integrity result. Do not select a backup by filename guesswork.

The preparation harness is [data-bridge-legacy-prepare.ts](../../../tools/e2e/data-bridge-legacy-prepare.ts).
The normalization owner is [legacy-cxapp](../api/src/modules/legacy-cxapp/SKILLS.md).
Its execution-authorization flag is not enabled by these notes.
Do not rerun an earlier preparation phase over a reviewed collection without checking its reset behavior.

## Before applying this pattern to a live client

1. Verify the deployed application version and the actual target schema.
2. Confirm the exact remote source and target database names with the operator.
3. Prove that the source credential is read only where supported.
4. Verify tenant routing before any target write.
5. Take and validate a fresh target backup.
6. Rehearse the client's own schema and data in an isolated local restore.
7. Review missing references, company reuse, year corrections, and audit-user types again.
8. Approve the eligible subset and lifecycle separately for each business stage.
9. Check the normal worker and queue delivery path for that deployment.
10. Run the approved import with saved source-to-target crosswalks.
11. Verify rows, children, amounts, balances, dashboards, and repeat behavior against the live target.
12. Produce separate success, held-row, and accounting-warning reports.

Local success is not proof of production execution.
Do not reuse Thirumurugan's IDs, temporary containers, credentials, approval decisions, or correction lists for another tenant.
