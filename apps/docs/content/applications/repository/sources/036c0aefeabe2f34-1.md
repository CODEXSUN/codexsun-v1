# CXApp to CODEXSUN migration pattern

Repository source: `devkits/data-bridge/agent/cxapp-v2.md`

Source SHA-256 (LF line endings): `56e985b7e6794d47c1c7fa03e14b28bb4f81906d1500aba541a72d480903748d`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# CXApp to CODEXSUN migration pattern

## Scope

Use this guide for future client migrations through Data Bridge.
It describes schemas, mappings, safeguards, and verification. It contains no client migration result summaries.
Inspect live metadata and current owner contracts before using any field example below.

Business data moves in this order: Common → Masters → Billing.
Exclude permissions, system configuration, queues, provider commands, caches, and migration history from business transfer.
User copying is a separate authenticated operation. Discovery does not authorize writes.

## Owners and entry points

- Data Migration owns saved external database credentials.
- Data Bridge owns mapping, preparation, source collections, conflicts, queued transfer records, and reports.
- Core owns common tables, companies, financial years, contacts, products, units, and their supported corrections.
- Billing owns invoice schemas, lifecycle, children, and dashboard projections.
- Platform resolves registered tenants, verifies the operator, dispatches queue jobs, and composes user/media transfers.
- Storage Manager owns validated image reads, uploads, and storage-object registration.

Use Database Connection, then the group's Table Mapping, Field Mapping, Import Preparation, Confirm Import, and Results tabs.
Use the ordered business operation only after every required mapping and parent decision is verified.

## Establish the source and target

1. Resolve both connections through saved server contracts. Confirm different databases and the exact target tenant.
2. Keep source SQL and media read only. Never run target migrations or seeds against the source.
3. Inspect table engines, columns, types, defaults, nullability, unique keys, foreign keys, and schema versions.
4. Create consistent private backups. Check compression integrity and checksums, then verify an isolated restore.
5. Fingerprint source tables before writes. Compare full fingerprints afterward.
6. Inventory existing target records. Preserve extra target data and conflicting records unless a specific correction is approved.
7. Use repository-owned migrations and seed contracts for the target. Do not drop a client database to resolve conflicts.

Keep dumps, raw collections, passwords, tokens, password hashes, and connection secrets outside Git.
Keep generated verification files under root `dist/verification` and durable backups outside build-clean output.

## Identity and audit columns

| Column pattern                                              | Migration rule                                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                        | Generate the target identity. Keep the source key in the private migration crosswalk. Never assume equal IDs mean equal records. |
| `uuid`                                                      | Use the target default or a supported unique generator. Preserve an existing target UUID during approved seed reuse.             |
| `created_by`, `updated_by`, confirmation/cancellation users | Inspect the real type. Text audit actors and foreign keys to `app_users` require different handling.                             |
| `created_at`, `updated_at`                                  | Use owner defaults unless retaining source timestamps is an explicit mapping choice. Do not invent historical timestamps.        |
| `deleted_at`, `status`                                      | Preserve reviewed lifecycle meaning. Inactive, deleted, cancelled, and draft are different states.                               |
| Foreign `*_id`                                              | Resolve the source parent, obtain its business identity, and match exactly one target parent.                                    |
| Generated/default fields                                    | Omit them when the target supplies a valid default. Verify all remaining required columns before preparation.                    |

The current guided selector requires one integer primary key named `id`.
Parent resolution also requires primary `id` fields and supported declared relationships to `id`.
Different business field names are supported. Arbitrary primary-key names and expressions are not automatically supported.
For older schemas, prepare a separate normalized staging database. Never rename original source columns to satisfy the selector.

## Common parents

Read the actual foreign-key graph. Do not use alphabetical table order.

| Target           | Important business columns and identity                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core_countries` | Country name/code according to its owner schema. Keep valid country defaults rather than inventing a placeholder country.                        |
| `core_states`    | Country parent, name, and state code. Resolve the country first.                                                                                 |
| `core_districts` | State parent and district name. Confirm ambiguous districts explicitly.                                                                          |
| `core_cities`    | Required `district_id`, `name`, optional/default `sort_order`, `status`. Unique identity is `(district_id, name)`.                               |
| `core_pincodes`  | Resolve its actual location parents and code through the current contract. Postal text alone may be ambiguous.                                   |
| `core_units`     | `name`, `sort_order`, `status`. Match the declared unit name, with supported case/whitespace normalization.                                      |
| `core_taxes`     | `rate_percent`, `description`, `status`, `sort_order`. Current unique business key is `rate_percent`.                                            |
| `core_hsn_codes` | HSN business code and owner-required fields. Keep numeric-looking codes as text where the schema requires text.                                  |
| Other lookups    | Contact/product types, categories, groups, colours, sizes, address types, currencies, transports, ledgers, and banks follow their own contracts. |

On a new empty unit table, the owner reserves hyphen `-` at ID 1 and adds missing defaults, including `pcs` and `nos`.
On an existing table, never move IDs or replace another unit at ID 1. Preserve existing references.
Do not equate hyphen, Nos, pieces, metres, or kilograms without a reviewed alias rule.
The placeholder product's unit must represent the source business meaning. It does not always use the hyphen unit.
Repair an existing placeholder only through a narrowly approved target correction with before/after verification.

## Source collection and target reference mapping

For each selected stable source key:

1. Extract only the selected business columns and required context.
2. Follow its declared parent relationships and collect their names, codes, and scoped identity values.
3. Resolve each parent recursively in the target using a complete unique key or an unambiguous full-business match.
4. Save original source keys, business identity, resolved target keys, and prepared values separately.
5. Display the source collection and prepared target values before confirming writes.
6. Mark each record ready, existing, conflicting, or blocked. Preserve existing conflicts as warnings.

For example, resolve a product's unit name, category identity, HSN code, and tax rate before assigning target foreign IDs.
The source numeric IDs are evidence for tracing source rows, not destination values.
Never choose the first matching row, use fuzzy names, or silently create a missing parent.
Persist mapping decisions so retry and repeat operations resolve the same identities.

## Companies and financial years

| Target                          | Important columns and behavior                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `core_companies`                | Match business identity, registration values, and location. Preserve target IDs, UUIDs, creation metadata, and references. |
| `core_financial_years`          | Match name and real start/end dates. Check invoice dates belong to the intended year.                                      |
| `core_default_company_settings` | Resolve `singleton_key`, `company_id`, `financial_year_id`, `landing_app`, and `status` through verified target context.   |
| `billing_company_settings`      | Compare `(company_id, settings_key)` and selected values. Preserve differing target settings as explicit warnings.         |

Count source companies before deciding reuse.
Prefer an exact existing target company. For one genuine unmatched source company, reuse only one verified untouched owner seed.
Require the owner seed marker and pristine signature. ID 1 or a familiar name does not prove seed eligibility.
Recheck seed eligibility, target snapshot, source identity, and source count at execution.
Multiple unmatched source companies or customized targets require reviewed mapping. Do not create duplicate companies as a fallback.
Older systems may store one company row per accounting period. Separate legal-company identity from financial-year identity before migration.

Do not change current-year flags to force matching. Use an approved Core action and retain the intended default-company year.
A current-year flag and the default-company selected year are separate settings.

## Contacts, addresses, and products

| Target                    | Important columns and preparation                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core_contacts`           | `code`, `name`, `legal_name`, type/group references and names, primary phone/email, GST/PAN, opening balance, credit limit, website, description, status. Generate a stable collision-checked business code when absent. |
| `core_contacts_addresses` | `parent_id`, address type, `address_line1`, `address_line2`, location IDs/names, `is_default`, `sort_order`, status. Resolve the contact and location before import.                                                     |
| Contact phones/emails     | Preserve separate phone/email values through the contact owner's child tables when needed. Do not discard a second telephone value.                                                                                      |
| `core_products`           | `name`, product type/category, HSN, unit, GST tax, opening quantity/price, status. Resolve every selected reference before creating a product.                                                                           |

A flat legacy party row can become one contact and several owned child rows.
Do not discard legacy fields without a retention decision. Keep unsupported business fields in reviewed notes or an approved extension.
Inspect target uniqueness and field lengths. Do not truncate product names, addresses, invoice numbers, or tax codes silently.

## Sales headers and children

| Target columns                                  | Required mapping                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `company_id`, `financial_year_id`               | Resolve the legal company and historical period separately.                                                           |
| `invoice_number`, `line_number`                 | Preserve the reviewed business number. Use deterministic sequencing and check target uniqueness within company/year.  |
| `customer_id`                                   | Resolve the migrated contact using its complete business identity.                                                    |
| `billing_address_id`, `shipping_address_id`     | Resolve verified target contact addresses. These are required, separate relationships.                                |
| `currency_id`, `issued_on`, `tax_type`          | Select the verified currency, retain the document date, and map tax semantics explicitly.                             |
| `subtotal`, `tax_amount`, `round_off`, `amount` | Compare saved values against decimal line and tax calculations. Respect the source's actual rounding convention.      |
| `work_order_id`, `ledger_id`, `terms`, `notes`  | Map supported business references/text. Missing optional references are not arbitrary ID guesses.                     |
| Lifecycle/audit columns                         | Use a reviewed draft/confirmed/cancelled/deleted policy. Never infer confirmation from `ACTIVE` or a lock flag alone. |

Sales header business uniqueness includes `(company_id, financial_year_id, invoice_number)`.
The header sequence also has unique `(company_id, financial_year_id, line_number)`.

| `billing_sales_items` columns                                                             | Required mapping                                                                                                                       |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `sales_id`, `line_number`                                                                 | Translate the parent invoice and retain deterministic line order. Unique identity is `(sales_id, line_number)`.                        |
| `product_id`, `description`, `hsn_code_id`                                                | Resolve the product and retain historical line meaning. A current product description is not always historical evidence.               |
| `quantity`, `unit_id`, `rate`                                                             | Parse exact decimal values and resolve the target unit. Do not use floating-point shortcuts for money.                                 |
| `tax_id`, `tax_rate`                                                                      | Resolve the applicable historical rate, including CGST/SGST versus IGST meaning.                                                       |
| `taxable_amount`, `cgst_amount`, `sgst_amount`, `igst_amount`, `tax_amount`, `line_total` | Reconstruct only from verified source formulas. Reconcile header totals and report every difference.                                   |
| `po_no`, `dc_no`, `colour_id`, `size_id`                                                  | Retain available business references and resolve selected parents. Do not copy obsolete source child IDs into unrelated target fields. |

Include all selected invoice children, compliance records, comments, allocations, and available business assets within the approved scope.
Preserve deleted history consistently when approved. Never import a child whose parent was excluded or blocked.
Do not replay E-invoice/E-way submissions, notifications, or old queued commands.
An invoice with recorded settlements needs receipt/allocation migration or an explicit exclusion warning.
Importing headers alone does not reproduce paid balances.

## Users and company assets

Use the separate authenticated missing-user operation only when authorized.
Preserve supported source password hashes exactly. Never reset an existing target user's password or overwrite its roles.
Only new accounts receive the target User-role defaults. App activation and record permissions remain enforced.
The established User policy allows applicable Core/Billing/CRM access and draft editing. Administrative edit/delete authority remains restricted.

Require verified company identity and an active translated default-company/year context before copying accounts.
A sole `landing_app` difference may remain a warning after exact source/target session verification and matching remaining values.
Reject changed sources, ambiguous rows, mismatched company/year/status, cross-tenant sessions, and constant parent mappings.
Do not copy legacy credentials whose hash format is unsupported. Never expose hash values in reports.

Company logos, dark logos, and favicons are file transfers, not portable source path strings.
Use trusted source-ID/database-bound roots in `CODEXSUN_DATA_BRIDGE_MEDIA_SOURCES` and a read-only source mount.
Copy through Storage Manager after the company commits, then save paths through Core using the audited target company ID.
Reject traversal and realpath escapes. Preserve different target images and report missing/unsafe assets.
On repeat, an identical image should be existing rather than rewritten.

## Execution and acceptance

Use authenticated preparation and confirmation contracts, revisions, locks, bound SQL values, and schema checks.
Queue the exact approved target and saved plan through Queue Manager. Wait for each parent before dependent work.
Current commits are per table. They do not provide a single cross-table invoice transaction.
Normal mapped imports use saved source snapshots. Reprepare after source, parent, mapping, schema, or routing changes.
Correction plans use stronger fingerprint checks. Do not claim those guarantees for ordinary snapshots.

Verify persisted values independently after completion:

- Compare every header and child after foreign-ID translation, including counts, dates, tax, totals, status, and deletion state.
- Check orphan references, extra target preservation, company reuse, and unchanged source SQL/media.
- Check the persisted queue job and actual Redis delivery, including target, attempt, and run reference.
- Repeat the approved scope and require zero new business rows, zero business changes, and zero new users.
- Refresh Billing projections for imported company/year scopes and compare authenticated dashboard totals with independent SQL.
- Confirm report drilldowns retain warnings and expose no secrets.

Route health, a green job, or a cached dashboard alone does not prove migration correctness.
Keep unresolved business differences visible. Do not alter source values or target settings merely to make a report green.

## Related contracts

- [Operating skills](SKILLS.md)
- [Transfer database verification](../api/src/modules/transfer-session/transfer-session.database.ts)
- [Parent resolution](../api/src/modules/transfer-session/transfer-session.references.ts)
- [User company-context verification](../api/src/modules/business-import/business-import.users.ts)
- [Company branding transfer](../api/src/modules/transfer-session/transfer-session.branding.ts)
- [Legacy preparation pattern](thirumurugan-legacy.md)

## Inspected target column inventory

This inventory is a schema reference, not client data. Reinspect the installed owner schema before every migration.
`NOT NULL` without a default requires an explicit mapping unless the owner generates the field.

### `core_countries`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `code` varchar(80) required, `name` varchar(200) required, `sort_order` int(11) required [default], `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_states`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `country_id` int(11) required, `code` varchar(80) required, `name` varchar(200) required, `sort_order` int(11) required [default], `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_districts`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `state_id` int(11) required, `name` varchar(200) required, `sort_order` int(11) required [default], `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_cities`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `district_id` int(11) required, `name` varchar(200) required, `sort_order` int(11) required [default], `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_pincodes`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `city_id` int(11) required, `name` varchar(200) required, `area` varchar(200) required, `sort_order` int(11) required [default], `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_contact_types`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `name` varchar(255) required, `status` varchar(24) required [default], `sort_order` int(11) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_contacts`

`created_by` varchar(191) required [default], `id` int(11) required auto_increment, `uuid` char(8) required [default], `code` varchar(80) required, `name` varchar(191) required, `legal_name` varchar(191) nullable, `type_id` int(11) nullable, `type_name` varchar(191) nullable, `group_id` int(11) nullable, `group_name` varchar(191) nullable, `primary_phone` varchar(80) nullable, `primary_email` varchar(191) nullable, `gstin` varchar(40) nullable, `pan` varchar(40) nullable, `msme_no` varchar(80) nullable, `msme_category` varchar(80) nullable, `tan_no` varchar(80) nullable, `tds_available` tinyint(1) required [default], `tcs_available` tinyint(1) required [default], `opening_balance` decimal(18,2) required [default], `credit_limit` decimal(18,2) required [default], `website` varchar(255) nullable, `description` text nullable, `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default], `deleted_at` datetime nullable.

### `core_contacts_addresses`

`uuid` char(8) required [default], `status` varchar(24) required [default], `created_by` varchar(191) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default], `id` int(11) required auto_increment, `parent_id` int(11) required, `address_type_id` int(11) nullable, `address_type_name` varchar(191) nullable, `address_line1` varchar(255) required, `address_line2` varchar(255) nullable, `country_id` int(11) nullable, `country_name` varchar(191) nullable, `state_id` int(11) nullable, `state_name` varchar(191) nullable, `district_id
```
