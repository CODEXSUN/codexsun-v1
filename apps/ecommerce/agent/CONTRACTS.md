# Ecommerce contract register

Status: frozen 2026-10-24 by EC-T00 against revision
`fec76ade4adb787c8bf3f2bc812d564bd5d7e807` plus the dirty baseline recorded in
`dist/ecommerce-scratch/baseline/`. The tree later advanced to `61710dd9` (unrelated commit); the
independent reviewer re-verified the frozen claims at that revision.
A frozen entry states exactly what the provider exports today. It is not a proposal and it does not
claim an export that does not exist. `MISSING` entries block their dependent task until a provider
change is reviewed and accepted.

Evidence sources: `dist/ecommerce-scratch/inventory/core-framework.md` (Core/Framework),
`billing-crm.md` (Billing/Accounts/CRM), `platform-ui.md` (Platform/Mail/Chat/UI/Ecommerce).

| ID     | Revision | Status   | Blocking consequence                                         |
| ------ | -------- | -------- | ------------------------------------------------------------ |
| EC-C01 | v1       | FROZEN   | Core references partially consumable; see gaps.              |
| EC-C02 | â€”      | MISSING  | Blocks EC-T07, EC-T09, EC-T13 customer/vendor principals.    |
| EC-C03 | v1       | PARTIAL  | HTTP-only Billing handoff exists; no order/refund contract.  |
| EC-C04 | v1       | FROZEN   | No stock authority exists; Ecommerce must own a bounded one. |
| EC-C05 | v1       | FROZEN   | Tenant storage root is provided; no shared write adapter.    |
| EC-C06 | v1       | PARTIAL  | Migration ledger exists; outbox/inbox/queue wiring does not. |
| EC-C07 | v1       | FROZEN   | CRM intake is HTTP + tenant session only.                    |
| EC-C08 | â€”      | MISSING  | No injectable Mail/Chat delivery for Ecommerce.              |
| EC-C09 | v1       | PARTIAL  | Client-only SEO; no raw-HTML metadata contract.              |
| EC-C10 | â€”      | MISSING  | Blocks vendor settlement.                                    |
| EC-C11 | â€”      | DEFERRED | Frappe transfer; local acceptance gate not reached.          |

---

## EC-C01 â€” Product/contact/company/year lookups (Core â†’ Ecommerce) â€” v1 FROZEN

Provider: `@codexsun/core-api` (single `.` export barrel, `apps/core/api/package.json:6-8`).

Consumable today (all take `databaseName: string`; Core resolves the handle; invalid names and the
master database are rejected by `core-database.ts:159-166`):

| Export                                                 | Behavior                                                 |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `getActiveContactForDatabase(db, id)`                  | `{name}` or `null`; `status='active'` only               |
| `findContactIdentityByIdForDatabase(db, id)`           | `{id,code}` or `null`; excludes soft-deleted             |
| `findContactIdentityForDatabase(db, code)`             | same, by code                                            |
| `contactIdsForEmailPolicy(db, recipient)`              | ids matching primary/child emails, case-insensitive      |
| `resolveOrCreateCustomerForDatabase(db,{name,mobile})` | `{id,name}`; validates active `Customer` type; conflicts |
| `getCompanyForDatabase(db, id)`                        | full company row incl. `isActive`; no status filter      |
| `getOrganisationOptionsForDatabase(db)`                | `{companies, financialYears, defaults}`; active only     |
| `getDefaultCompanyForDatabase(db)`                     | singleton default company                                |
| `getApplicationCompanyBrandingForDatabase(db)`         | branding only while default company is active            |

Consumer rules (frozen):

- Ecommerce calls these with the Platform-verified tenant database name from
  `getEcommerceTenantDatabaseName()`; never with a browser value.
- Ecommerce checks `isActive` itself for `getCompanyForDatabase`.
- Validation of Ecommerce's own foreign keys is Ecommerce's responsibility.
- Ecommerce keeps a private repository read of `core_products`/`core_brands`/
  `core_product_categories` for display identity only (recorded as EC-D10 debt; no new writes).

Gaps (do not build on these):

| Gap                                            | State                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `listProductCatalogLookupsForDatabase`         | EXISTS but needs a private `Kysely<CoreDatabase>`; not callable from Ecommerce |
| `listProductCategoryLookupsForDatabase`        | same handle problem                                                            |
| Brand / unit / tax / HSN / product-type lookup | `MISSING` â€” Core barrel exports none                                         |
| Public parent-validation contract              | `MISSING` â€” validation is a private Core service                             |

Unavailable behavior: an unavailable Core lookup fails closed with the owning error; Ecommerce
returns `403` for missing tenant context and `400/409` for an invalid reference. No fallback data.

## EC-C02 â€” Customer/vendor principal binding (Platform â†’ portals) â€” MISSING

Proposal: `contracts/C02-PORTAL-PRINCIPALS.md` (owner decision pending).

Current fact: Platform has `PlatformUserType = "super_admin" | "staff" | "tenant"`
(`packages/framework/src/api/tenant-access.ts:20`). There is no customer or vendor principal, no
customer-scoped session, and `access_users`/`app_users` are staff surfaces. `/storefront/*` is an
unauthenticated path and there is no guest-token contract. The Platform contract has no CSRF token
(an unrelated devkit implements its own); it relies on an encrypted `HttpOnly` `SameSite=Strict`
cookie, the `x-codexsun-session-slot` header, and an Origin/`Sec-Fetch-Site` check.

Consequence: EC-T07, EC-T09 and EC-T13 cannot be implemented without a reviewed Platform change
(new restricted principal type, membership table and scoped portal routes). The proposed contract is
recorded in DECISIONS.md EC-D04 and is **blocked pending an owner decision**. Until then no portal
route, customer login or vendor login may be presented as available.

## EC-C03 â€” Price/tax/invoice/payment/refund handoff (Billing â†’ Ecommerce) â€” v1 PARTIAL

Proposal: `contracts/C03-BILLING-HANDOFF.md` (owner decision pending).

Consumable today, HTTP only (`@codexsun/billing-api` root exports no document services):

- `POST /billing/sales` â†’ create a sales invoice; server computes totals in `buildSaleTotals`
  (`apps/billing/api/src/modules/sales/sales.service.ts:481-506`); INR is enforced in code.
- `POST /billing/sales/:id/confirm`; `POST /billing/receipts`; `POST /billing/receipts/:id/post`.
- Read model `lookupCustomerOutstanding` / `lookupLongOutstandingSales` (assistant-facing reads only).
- Auth: tenant JWT + `x-tenant-db` + `x-company-id` + `x-financial-year-id`, permissions
  `billing.application.records.*`; PUT/PATCH are admin-only.

Precision (frozen): money `DECIMAL(18,2)`, quantity/rate `DECIMAL(18,4)`, tax rate `DECIMAL(7,4)`;
JS rounds with `Math.round(x*100)/100`. Document numbers are per company/financial year and
database-unique; an empty number means auto-number. Per-line `taxRate` is caller-supplied â€” Billing
does not re-derive tax from `core_taxes` and has no place-of-supply logic.

Gaps (each blocks its dependent task):

- No commerce order/checkout document model and no commerce-orderâ†’invoice link (Billing does carry
  `billing_sales.work_order_id` as a foreign key to Core `core_work_orders`, which is a Core work
  order, not a commerce order). No external/idempotency reference column exists on
  `billing_sales`/`billing_receipts`, so a retry can double-issue.
- No credit note, debit note, refund or return capability anywhere in Billing.
- No exported (non-HTTP) invoice/receipt write contract and no consumable finance event.
- No public outstanding read for portal/customer scope.

Consumer rule: Ecommerce never creates a financial document locally and never writes Billing tables.
Until an idempotency reference exists, EC-T10 cannot claim safe duplicate handling.

## EC-C04 â€” Stock allocation and reservations â€” v1 FROZEN (authority: none)

Verified: no stock ledger, movement, reservation or availability table exists in the tenant database
(301-table scan), no Billing stock service exists, `core_warehouses` stores name/status/order only,
and `core_products.opening_qty` is an opening balance. Billing's Stock Statement is a derived report,
not a reservation service. The Ecommerce README already states the browser basket does not reserve
stock. logicx-erp has no inventory module; qCafe's inventory is private, app-local SQLite.

Frozen decision (EC-D02): stock authority is a **new Ecommerce-owned** capability bounded to this app:
`ecommerce_inventory_allocation` (warehouse-scoped on-hand/reserved/committed/returned/damaged
counters) plus atomic reservation rows with expiry and commit/release, and a reconciliation view
against Billing purchase/sales quantities. It must not be described as, or become, a second
enterprise stock ledger, and it must never publish quantities it did not reserve.

Unavailable behavior: with no allocation row for a product, availability is unknown (`0` available,
`unavailable` state) and the storefront must not claim stock. No fabricated availability.

## EC-C05 â€” Asset picker and storage (Platform/Framework â†’ Ecommerce media) â€” v1 FROZEN

Consumable today:

- Platform passes `publicStorageRoot` into the Ecommerce request scope (`app.ts:2304`, `:2359`) and a
  `readCompanyLogo` callback (`app.ts:2324-2325`); `tenantPublicStorageRoot(slug)` is Platform-owned
  (`storage-manager.paths.ts:47`).
- Ecommerce validates and writes files itself with `node:fs` (`product-image.storage.ts`,
  `storefront-slider.storage.ts`, `storefront-organisation.storage.ts`).
- FACT CORRECTION (review R1): product and slider media originally resolved to the app-level
  `STORAGE_ROOT/ecommerce/<verified tenant key>/<kind>` path
  (`apps/ecommerce/api/src/env.ts:6-9,16-18`; `.env` `STORAGE_ROOT=storage/app`), not under
  `storage/<slug>/public`. EC-R09 repaired this: HTTP writes now use the Platform-provided
  `publicStorageRoot` at `storage/<tenant>/public/ecommerce/{products,sliders}`. Existing files are
  copied there idempotently on first read, preserving the public URL and record link. Organisation
  logos already used the same tenant root. Non-HTTP callers keep a legacy fallback for tests and seeds.

Missing: a Framework storage adapter (types-only, zero implementations), a public list/delete/move or
signed-URL contract, and a shared activity/audit writer.

Frozen rule: media work stays inside the provided tenant root, rejects browser-supplied tenant
folders/paths, validates MIME by content and size, and blocks deleting files that records reference.
Private evidence (return photos, proof of delivery) may not live under `public/`.

## EC-C06 â€” Durable events and jobs (Framework/Platform â†’ Ecommerce) â€” v1 PARTIAL

Proposal: `contracts/C06-QUEUE-OUTBOX.md` (technical impact review can proceed).

Consumable today:

- `runMigrationBatch`/`rollbackMigrationBatch` + `migration_schema` ledger
  (`packages/framework/src/db/migrations.ts`); Platform assembles `<app>TenantMigrations`
  (`apps/platform/api/src/database/tenant-app-database.ts:210-213`). Ecommerce is already wired.
- Event and queue _types_ only (`packages/framework/src/events/contracts.ts`, `queue/contracts.ts`).
  No publisher, no relay, no inbox.
- Platform's `QueueManagerService.enqueue` and `registerQueueJobProcessor` exist but are internal to
  `apps/platform/api`; Mail receives an injected `enqueue` dependency, which is the approved pattern.

Ecommerce state: `ecommerce_catalog_match_outbox` and `CatalogMatchingOutboxRelay` exist but the relay
is never started (dead code, `catalog-matching/index.ts:10-12`). Job
`ecommerce.catalog-match.semantic` is not registered in `queueManagerWorker.jobs`, so dispatch would
throw "No queue worker registered".

Frozen rule: Ecommerce owns its outbox/inbox tables and worker code. Platform must inject an `enqueue`
capability into Ecommerce registration (additive composition change, with Mail as the precedent).
Until that injection exists, Ecommerce events stay local and no queued delivery is claimed. Tenant
identity and module activation are re-validated at execution.

## EC-C07 â€” CRM support/enquiry intake (CRM â†’ Ecommerce) â€” v1 FROZEN

Consumable today, HTTP only: `POST /crm/enquiries` with `title`, `description`, `contactId`, captured
name/email/phone, `source` (â‰¤80), `sourceReference` (â‰¤191), list/status/priority, `assignedUserId`,
`enquiredAt`, `dueDate`, `closedReason`. Requires a tenant session and `crm.enquiry.create`; CRM
resolves or creates the Core contact in the same transaction. Unique key (`source`,
`source_reference`) is the idempotent link point.

Frozen rule: Ecommerce links support/enquiries with `source = "ecommerce"` and a stable
`sourceReference` (the Ecommerce record UUID). Ecommerce never copies CRM rows, never imports CRM
repositories and never creates a duplicate contact master. The storefront has no session, so a public
enquiry requires an Ecommerce-owned intake record plus a staff/authorized forward action.

## EC-C08 â€” Mail and Chat delivery (Mail/Chat â†’ Ecommerce) â€” MISSING

Proposal: `contracts/C08-MAIL-CHAT-DELIVERY.md` (customer participation policy pending).

Neither `@codexsun/mail-api` nor `@codexsun/chat-api` is a dependency of `@codexsun/ecommerce-api`,
and both are composed only in Platform. Mail's send entry is `MailService.compose` â†’ queued
`mail.send`; Chat exposes an injectable trusted DB contract `writeWorkMessage` and enforces participant
scope in its repository.

Consequence: no order, payment, shipment, return or refund notification can be delivered by Ecommerce
today. A reviewed Platform injection (the Mail `enqueue` pattern) is required. Until then Ecommerce
records notification _intent_ only and must not claim a delivered message.

## EC-C09 â€” Published content and SEO (Ecommerce/Blog â†’ storefront) â€” v1 PARTIAL

Consumable today: `/storefront/*` public JSON contract, published-only projections, host-based tenant
resolution with fail-closed 404, and optional Blog (a disabled Blog must not block shopping).
MISSING: any raw-HTML metadata contract. The storefront is a client-only Vite SPA
(`apps/ecommerce/storefront/src/main.tsx`), a static `index.html`, a manual
`window.location.pathname` switch and client-side `document.title`/meta/JSON-LD mutation
(`storefront.seo.ts`). A crawler receives the static shell only, so today's SEO is not
acceptance-grade and is not reported as such.

Frozen rule: private or scope-bearing responses are never cached in a shared store; canonical,
noindex, sitemap and redirects are Ecommerce-owned when a rendering contract exists.

## EC-C10 â€” Vendor financial allocation (Billing/Ecommerce â†’ vendor portal) â€” MISSING

Decision brief: `contracts/C10-MARKETPLACE-FINANCE.md` (business/legal decision required).

No merchant-of-record decision, no commission contract, no settlement statement, no Billing payout
reference and no refund allocation exist. Blocks EC-T13. An owner decision is required before any
vendor money calculation is implemented; no payout action may be exposed.

## EC-C11 â€” Frappe transfer â€” DEFERRED

The local acceptance gate in EC-T16 has not been reached, so no Frappe mapping was designed, no remote
read was executed and no remote write is enabled. Existing Frappe connection credentials stay owned by
the Frappe app; existing CRM sync behavior is untouched.
