# CXApp to CODEXSUN migration pattern

Repository source: `devkits/data-bridge/agent/cxapp-v2.md`

Source SHA-256 (LF line endings): `56e985b7e6794d47c1c7fa03e14b28bb4f81906d1500aba541a72d480903748d`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
` int(11) nullable, `district_name` varchar(191) nullable, `city_id` int(11) nullable, `city_name` varchar(191) nullable, `pincode_id` int(11) nullable, `pincode_name` varchar(80) nullable, `is_default` tinyint(1) required [default], `sort_order` int(11) required [default].

### `core_units`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `name` varchar(255) required, `status` varchar(24) required [default], `sort_order` int(11) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_hsn_codes`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `code` varchar(255) required, `description` varchar(255) required, `status` varchar(24) required [default], `sort_order` int(11) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_taxes`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `rate_percent` double required, `description` varchar(255) required, `status` varchar(24) required [default], `sort_order` int(11) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_products`

`created_by` varchar(191) required [default], `id` int(11) required auto_increment, `uuid` char(8) required [default], `name` varchar(191) required, `product_type_id` int(11) nullable, `product_category_id` int(11) nullable, `hsn_code_id` int(11) nullable, `unit_id` int(11) nullable, `gst_tax_id` int(11) nullable, `opening_qty` double required [default], `opening_price` double required [default], `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default], `deleted_at` datetime nullable.

### `core_companies`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `code` varchar(80) required, `name` varchar(191) required, `legal_name` varchar(191) nullable, `type_id` int(11) nullable, `type_name` varchar(191) nullable, `group_id` int(11) nullable, `group_name` varchar(191) nullable, `primary_phone` varchar(80) nullable, `primary_email` varchar(191) nullable, `gstin` varchar(40) nullable, `pan` varchar(40) nullable, `msme_no` varchar(80) nullable, `msme_category` varchar(80) nullable, `tan_no` varchar(80) nullable, `tds_available` tinyint(1) required [default], `tcs_available` tinyint(1) required [default], `website` varchar(255) nullable, `description` text nullable, `logo_path` varchar(255) nullable, `logo_dark_path` varchar(255) nullable, `favicon_path` varchar(255) nullable, `industry_id` int(11) nullable, `industry_name` varchar(191) nullable, `status` varchar(24) required [default], `emails_json` longtext nullable, `phones_json` longtext nullable, `addresses_json` longtext nullable, `bank_accounts_json` longtext nullable, `social_links_json` longtext nullable, `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default], `seed_placeholder` tinyint(1) required [default].

### `core_financial_years`

`created_by` varchar(191) required [default], `id` int(11) required auto_increment, `uuid` char(8) required [default], `name` varchar(120) required, `start_date` date required, `end_date` date required, `is_current` tinyint(1) required [default], `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default].

### `core_default_company_settings`

`uuid` char(8) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `singleton_key` tinyint(4) required [default], `company_id` int(11) required, `financial_year_id` int(11) required, `landing_app` varchar(80) required, `status` varchar(24) required [default], `created_at` datetime required [default], `updated_at` datetime required on update current_timestamp() [default], `seed_placeholder` tinyint(1) required [default].

### `billing_sales`

`id` int(11) required auto_increment, `uuid` char(8) required [default], `company_id` int(11) required, `financial_year_id` int(11) required, `line_number` int(11) required, `invoice_number` varchar(80) required, `customer_id` int(11) required, `billing_address_id` int(11) required, `shipping_address_id` int(11) required, `work_order_id` int(11) nullable, `ledger_id` int(11) nullable, `tax_type` varchar(24) required [default], `currency_id` int(11) required, `issued_on` date required, `subtotal` decimal(18,2) required [default], `tax_amount` decimal(18,2) required [default], `round_off` decimal(18,2) required [default], `amount` decimal(18,2) required [default], `terms` text nullable, `notes` text nullable, `status` varchar(24) required [default], `created_by` int(11) nullable, `updated_by` int(11) nullable, `confirmed_by` int(11) nullable, `confirmed_at` datetime(3) nullable, `cancelled_by` int(11) nullable, `cancelled_at` datetime(3) nullable, `created_at` datetime(3) required [default], `updated_at` datetime(3) required on update current_timestamp(3) [default], `deleted_at` datetime(3) nullable.

### `billing_sales_items`

`status` varchar(24) required [default], `created_by` varchar(191) required [default], `id` int(11) required auto_increment, `uuid` char(8) required [default], `sales_id` int(11) required, `line_number` int(11) required, `product_id` int(11) nullable, `description` text required, `hsn_code_id` int(11) nullable, `po_no` varchar(120) nullable, `dc_no` varchar(120) nullable, `colour_id` int(11) nullable, `size_id` int(11) nullable, `quantity` decimal(18,4) required, `unit_id` int(11) required, `rate` decimal(18,4) required [default], `tax_id` int(11) nullable, `tax_rate` decimal(7,4) required [default], `taxable_amount` decimal(18,2) required [default], `cgst_amount` decimal(18,2) required [default], `sgst_amount` decimal(18,2) required [default], `igst_amount` decimal(18,2) required [default], `tax_amount` decimal(18,2) required [default], `line_total` decimal(18,2) required [default], `created_at` datetime(3) required [default], `updated_at` datetime(3) required on update current_timestamp(3) [default].
```
