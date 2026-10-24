# Ecommerce end-to-end delivery plan

Date: 2026-10-24.
Status: proposed delivery design, based on a local source review. No runtime changes or completed implementation are claimed.
Owner: `apps/ecommerce`. This document supplements [PLAN.md](PLAN.md) and [TASK.md](TASK.md).

## 1. Outcome and delivery rule

Build a complete, locally authoritative commerce application inside the existing modular monolith.
Use the existing storefront, staff shell, design system, tenant database routing, and owner contracts.
Support one merchant first, then multiple vendors within that merchant's tenant.
Support configurable industries without separate copies of the application.

Complete local catalog, shopping, checkout, orders, fulfillment, returns, refunds, and portals before Frappe synchronization.
Local means the CODEXSUN tenant database is authoritative. It does not imply offline checkout or browser-only persistence.
The app must work without Frappe activation, credentials, connectivity, or background sync.
External payment and carrier providers are optional integrations, not alternative commerce databases.

Do not duplicate Core identity, Billing financial documents, Mail transport, Chat delivery, Platform authentication, or Framework infrastructure.
Do not modify another app or package without first documenting its existing behavior and the proposed impact.
Reusable UI additions and compatible corrections are permitted after that review and consumer regression checks.
Breaking changes require an explicit decision before implementation.

## 2. Source baseline and evidence limits

The review covered the Ecommerce component documents, module composition, product migrations, data-source service, and public exports.
It also covered CRM enquiry UI and sync patterns, owner documentation, shared event/storage contracts, and Billing exports.
This is a source review. It does not certify live databases, deployed providers, mobile behavior, or production readiness.

| Area                  | Source evidence                                                                                                                           | Planning consequence                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Product extension     | `api/src/modules/product-information/product-information.migration.ts` owns `ecommerce_product_information`, linked to `core_products.id` | Extend this owner. Do not create a second `ecommerce_products` aggregate with duplicate records.       |
| Existing variants     | `product-variant` owns SKU, three option pairs, price adjustments, weight, and product links                                              | Preserve IDs and SKUs. Plan an additive option migration when richer attributes are required.          |
| Existing media and UX | Product images, sliders, promotions, featured cards, seasons, profile, announcement, and organisation modules exist                       | Retain usable UI and routes. Verify each feed and publication rule.                                    |
| Current runtime       | Local and Frappe providers coexist in `CatalogDataSourceService`; pull can replace cached catalog data                                    | Phase 1 removes remote dependency from normal local reads without deleting imported data.              |
| Storefront commerce   | README explicitly describes a browser basket without order, payment, or stock reservation                                                 | Treat transactional commerce as new work, not an established checkout.                                 |
| Staff UI              | CRM enquiry workspace uses shared table controls, inline filters, visible columns, and default page size 100                              | Reuse interaction patterns and UI primitives, not CRM business components or private hooks.            |
| CRM reliability       | Enquiry outbox and relay persist delivery work before remote calls                                                                        | Reuse the durable delivery pattern. Do not reuse CRM tables or assume every CRM entity syncs.          |
| Financial ownership   | Billing owns sales, purchases, payments, receipts, reports, and financial settings                                                        | Design a Billing handoff. A stock report or payment table does not prove a reservation or gateway API. |
| Infrastructure        | Framework exports API, database, events, queue, storage, and module contracts                                                             | Compose these contracts. Event publication alone does not prove durable delivery.                      |
| Messaging             | Chat documents participant-scoped work messages. Mail documents transport and suppression limits                                          | Contract-test portal access and delivery policy before wiring commerce messages.                       |

Current file and route names can change. Each implementation task must recheck its exact owner surfaces.
Historical task evidence remains historical. Preserve existing checked tasks and unrelated working-tree changes.

## 3. Ownership and reuse contracts

| Owner             | Reuse                                                                                                          | Ecommerce-owned extension                                                                           | Contract gap or restriction                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform          | Tenant registry, verified domains, sessions, app activation, RBAC, audit, queue operations, storage management | Commerce permissions, actor scopes, and app menu composition                                        | Customer/vendor principals need a reviewed integration. Never grant staff privileges to portal accounts.                                     |
| Framework         | Request-bound DB, contract routes, errors, events, queue and storage adapters                                  | Domain transactions, durable outbox/inbox, commerce workers                                         | Optional tenant event fields must become mandatory in commerce validation without changing shared behavior.                                  |
| UI and UIUX       | Main layout, App Header, tables, lookup, show, form, pagination, feedback, tokens                              | Commerce screens and reusable domain-neutral missing primitives                                     | Add generic primitives only. Register gallery examples and regression tests.                                                                 |
| Core              | Product, category, brand, contact, company, year, address and other verified masters                           | Product publication, merchandising, customer preferences, vendor commerce profile                   | Validate references through public contracts. No private repository imports or new duplicate masters.                                        |
| Billing           | Financial document numbering, invoices, receipts, payments, tax and balances where supported                   | Checkout intent, order price snapshot, payment-attempt/provider references and reconciliation links | Public order-to-invoice, financial reversal, pricing/tax and payment-posting contracts need review. Do not assume exports provide them.      |
| Accounts          | Existing accounting functions where verified                                                                   | Links and reconciliation views                                                                      | No second ledger in Ecommerce. Verify actual capabilities before dependency decisions.                                                       |
| CRM               | Enquiry, lead intake, follow-up and authorized customer service links                                          | Commerce source references and order-to-enquiry actions                                             | Sales qualification stays in CRM. Contract availability and assignment scope must be checked.                                                |
| Mail              | Delivery transport, credentials, delivery records, applicable suppression checks                               | Commerce template content and notification intent                                                   | Existing SMTP sends do not automatically consume every safety policy. Require explicit integration tests.                                    |
| Chat              | Channels, membership, messages and approved participant work-message contract                                  | Authorized order/support conversation links                                                         | Internal work messages do not establish public customer chat. Design restricted portal participant support.                                  |
| Marketing         | Acquisition campaigns, promotional consent, nurturing and attribution                                          | Promotion presentation and optional campaign UUID link                                              | An order or account is not promotional consent. No automatic abandoned-cart campaign.                                                        |
| Blog              | Published journal content and article views                                                                    | Storefront composition and links                                                                    | Optional app. Unavailable Blog must not block shopping or checkout.                                                                          |
| Frappe            | Verified connection, encrypted credentials, remote adapters                                                    | Later commerce mappings, sync policy, link/conflict views and local outbox intent                   | No live remote read in the local purchase path. No additional CRM export authorization is implied.                                           |
| Other repo owners | Verified public capabilities only                                                                              | Minimal typed adapter or relation                                                                   | Search owners such as Billing and ERP before adding inventory, shipping, approvals, or file behavior. Source presence alone is insufficient. |

For each cross-owner contract, record provider, consumer, version, exact fields, actor, company scope, errors, and idempotency.
Include timeout, unavailable-app behavior, permissions, compatibility, and consumer tests.
Use injected public capabilities at the legitimate composition point or fixed public APIs.
Do not import sibling private services, repositories, internal schemas, or frontend state.

### Change-impact protocol

1. Read the target owner's README, TASK, PLAN, SKILLS, public exports, implementation, and consumers.
2. Describe the missing capability and why existing contracts cannot satisfy it.
3. List exact changes, migrations, permissions, consumers, compatibility, and rollback conditions.
4. Implement the smallest compatible owner change only after the impact is recorded.
5. Run provider and consumer regressions. Report unresolved behavior before declaring the dependency ready.

Missing external capabilities remain visible blockers. Never create a silent duplicate service to bypass them.

## 4. Data and domain boundaries

Use tenant-local `ecommerce_*` tables. Keep internal integer IDs and unique eight-character lowercase hexadecimal `uuid` values.
Generate UUIDs with collision-safe retry and database uniqueness. Public URLs and cross-boundary references use UUIDs.
Existing integer contracts require a compatibility plan before replacement. Never expose a database selector in public payloads.
Within one tenant database, validated internal foreign keys may reference Core records where the established contract permits them.
Cross-owner access still uses a public contract. A foreign key is not permission to write another owner's tables.

Do not repeat tenant IDs in business rows when database selection is the established tenant boundary.
Use company and storefront scope where the domain requires them. Background envelopes carry verified tenant identity explicitly.
All repositories require request-bound or worker-bound database context. No implicit default database is allowed.

Store timestamps in UTC. Use explicit business timezone for cutoffs and delivery dates.
Use fixed-precision money and decimal quantities. Never calculate financial totals with floating-point arithmetic.
Store currency, rounding policy, tax basis, and price versions with accepted order snapshots.

### Proposed bounded contexts and leaf modules

These are domain work packages, not permission to create a generic CRUD engine.
Each persistent leaf owns its concrete table, service, route, schema, UI, permissions, and lifecycle.
Use owned child tables for aggregate details rather than arbitrary JSON business records.
Validated JSON is acceptable for bounded versioned configuration or historical snapshots.

| Context                  | Existing leaves to retain                                    | New leaves or owned child records                                                                   | Required behavior                                                                                                    |
| ------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Store administration     | Organisation, profile, announcement, overview                | Store policy, navigation, legal page, redirects, SEO settings                                       | Company/year, branding, domains, publication, order rules, and policy versions.                                      |
| Product merchandising    | Product information, variant, image                          | Attribute definitions/options, variant-option values, collections, specifications, related products | Core product link, unique SKU/options, descriptions, dimensions, digital/service flags, visibility and validation.   |
| Media                    | Existing upload/storage code                                 | Commerce asset metadata, gallery relations, renditions, authorized picker                           | Tenant paths, ownership, alt text, sort order, preview, safe replacement, deletion blockers and optimization.        |
| Home content             | Sliders, promotions, featured cards, season, profile         | Typed section placement/configuration and missing concrete section content                          | Backend-managed ordering, schedules, visibility and published projections. No arbitrary executable page definitions. |
| Pricing and promotions   | Existing product price projection and promotion presentation | Price book, price rule, coupon, redemption                                                          | Coordinate authoritative tax/price fields with Billing. Separate presentation cards from redeemable discounts.       |
| Stock allocation         | No reservation capability established by this review         | Inventory allocation and reservation only after owner decision                                      | One authoritative quantity ledger, warehouse scope, concurrency, expiry and reconciliation.                          |
| Customer commerce        | Core contacts remain canonical                               | Customer profile, saved address link, wishlist, product review                                      | Contact reference, preferences, verified ownership, moderation and consent references.                               |
| Shopping                 | Existing browser basket as migration input                   | Cart, cart item, checkout intent, checkout validation                                               | Durable tenant-scoped cart, guest transfer, quote expiry, stock/price recheck, shipping and tax.                     |
| Orders                   | New                                                          | Order, order item snapshots, status history, cancellation/rejection request                         | Order acceptance, fulfillment splits, immutable accepted amounts, numbering and explicit transitions.                |
| Money orchestration      | Billing remains financial owner                              | Payment attempt, gateway callback inbox, refund request, reconciliation link                        | Provider operations, idempotency, Billing posting references, retries and audit. No second accounting ledger.        |
| Fulfillment              | New commerce workflow                                        | Fulfillment, shipment, shipment item, tracking movement, delivery exception                         | Pick/pack, partial dispatch, carrier reference, proof of delivery and customer-safe movement history.                |
| After-sales              | New                                                          | Return request/item, return receipt, inspection, exchange link, dispute                             | Policy eligibility, partial quantities, evidence, approval, restock and independent refund tracking.                 |
| Marketplace              | Core contact/company identity reused                         | Vendor profile, vendor membership, listing offer, commission rule, settlement statement             | Vendor approval, offer moderation, vendor suborders, fees, returns allocation and Billing payout links.              |
| Service and integrations | Existing catalog matching/data source                        | Support link, notification intent, integration link, outbox/inbox and later sync policy/conflict    | Minimal references, durable events, redacted history, retries and optional integration failures.                     |
| Reporting                | Existing overview retained                                   | Commerce operational projections and exports                                                        | Sales conversion, stock allocation, fulfillment, returns, refunds and vendor statements with authorization.          |

`ecommerce_product_information` already fulfills the requested Ecommerce product extension role.
Do not rename it for cosmetic consistency. If a rename becomes necessary, plan migration, references, compatibility, and rollback explicitly.
The existing single-product uniqueness policy must be reviewed before supporting multiple storefronts per company.
Do not copy records into a second table to avoid that design decision.

### Industry behavior

Start with physical goods, configurable variants, enquiry-only products, and services without shipping.
Use explicit feature configuration for apparel size/color, electronics warranty/serials, and dimensional products.
Add batch, expiry, regulated goods, bookings, subscriptions, bundles, or digital fulfillment only behind defined domain contracts.
Hide unsupported purchase actions and explain the supported path. Never pretend a field alone implements a regulated workflow.
Attribute definitions control product data. They must not become a registry that generates unrelated module CRUD.

## 5. Staff UI and public experience

### Staff navigation

Retain the existing Overview, Catalog, Storefront UX, and Settings groups.
Add Sales, Fulfillment, After-sales, Customers, Vendors, and Reports as their capabilities ship.
Settings contains policies, shipping, pricing configuration, approved payment connections, permissions, and later integrations.
Do not display unfinished actions as working controls.

Every business module has List, Show, and Upsert experiences using the existing CRM enquiry tone.
App Header owns the heading, context, and permission-aware primary buttons. Avoid duplicate headings inside nested cards.
Show pages include summary, related records, activity, and allowed lifecycle actions.
Small masters can use shared upsert dialogs. Orders and other complex records use routed forms with deep links.

List requirements:

- Backend search, inline column filters, combined filters, allowed sorting, and column visibility.
- URL-backed search/filter/page state and tenant/company/user-scoped safe preferences.
- Default and maximum page size 100. Offer 20, 50, and 100 only for larger result sets.
- Hide the pagination panel when the filtered authorized total is 100 or less. In that case return all matching rows, up to 100.
- When the total exceeds 100, show pagination and the selected page size. Reset page on search or filter changes.
- Do not fetch 20 rows while hiding controls for an 80-row result. Test totals 0, 20, 99, 100, 101, and 250.
- Stable secondary ordering, authorized counts, per-page selection, empty/error/loading states, and protected exports.
- Permission-aware actions, safe row selection, and action clicks that do not also open Show.
- Status badges with explicit meanings. Show history and clear retry errors instead of false success indicators.

Use `WorkspaceLookup` for Core and sibling references. Never use free-text foreign IDs or hardcoded lookup rows.
Use strict frontend and backend schemas, field errors, required markers, and shared form banners.
Add domain-neutral UI primitives to `packages/ui` only after inspecting its public contracts and consumers.
Preserve existing behavior and add UIUX examples for new controls.

### Storefront and portals

Retain the existing theme, branding, Aurora slider, product images, and eleven homepage sections where suitable.
Connect each section to its owner API and published content. No frontend demo arrays or fake availability.
Sections need loading, empty, disabled, scheduled, error, and retry behavior without blocking unrelated sections.
Keep Campaign Events presentation separate from Marketing acquisition campaign ownership.

Required public pages are home, category/collection, search, product, cart, checkout, confirmation, and legal policies.
Product pages include complete gallery, variant selection, accessible specifications, truthful price/availability, delivery estimate, and policy links.
Keep full product images visible with `object-fit: contain`. Use editorial cropping only when content configuration explicitly requests it.
Provide keyboard controls, alt text, reduced motion, touch targets, and readable mobile layouts.

Customer portal includes account/contact links, addresses, wishlist, orders, invoices, shipments, movement history, returns, refunds, and support.
Vendor portal includes approved listings/offers, assigned suborders, fulfillment, return tasks, fees, statements, and payout references.
Portals use restricted principals and owner APIs. They must never expose general staff lists or unrelated Core contacts.
Guest order access requires a scoped, revocable, expiring token or verified identity. An order number is not authorization.

### SEO, performance, and media

Deliver meaningful HTML metadata per public route. Select a supported server-rendering or prerender contract during Phase 0.
Do not call a client-only title update SEO-complete. Verify raw HTML for product and collection routes.
Provide canonical URLs, sitemap, robots rules, structured product/breadcrumb data, social previews, and redirects.
Keep account, cart, checkout, search combinations, previews, and private pages out of indexing as appropriate.
Never publish fabricated reviews, stock, prices, or structured-data claims.

Use the verified storage root, with `storage/<tenant>/public/ecommerce/...` for published assets.
Use private Ecommerce storage for invoices, return evidence, vendor documents, and proof of delivery.
Preserve the existing logo path. Never accept a browser-supplied tenant folder or filesystem path.
Reuse Platform storage management and Framework adapters. Add commerce metadata/picker behavior without cloning a file manager.
Where list/delete/move or signed access contracts are missing, document a compatible provider extension first.
Validate MIME by content, size, dimensions, extension and decoded image limits. Reject traversal, unsafe SVG, and untrusted remote fetches.
Generate bounded responsive WebP/AVIF renditions where supported, with fallback originals and width/height metadata.
Strip unnecessary metadata. Reserve aspect ratios, prioritize the hero, and lazy-load below-fold media.
Garbage collection checks references and retention. Published URLs cannot serve unpublished private assets.
Set measured performance budgets after a baseline. Candidate budgets are LCP 2.5 seconds, CLS 0.1, and INP 200 milliseconds.
Report device, network, dataset, lab results, and field-data availability separately.

## 6. Transactional workflows and invariants

### Order and checkout

Recalculate prices, discounts, taxes, delivery, availability, and eligibility on the server before accepting checkout.
Bind the quote to customer/cart, company, currency, price version, expiry, and selected vendor offers.
Reject client totals and stale quotes. Keep product descriptions and policy versions as accepted snapshots.
Use a unique checkout idempotency key and atomic database transitions to prevent duplicate orders.
Handle an unknown network outcome by retrieving the original result, not creating another order.

Use independent order, payment, fulfillment, return, and refund states.
Example order flow: draft, pending acceptance, accepted, processing, completed, canceled, or rejected.
Example payment flow: unpaid, pending, authorized, partially paid, paid, failed, partially refunded, or refunded.
Fulfillment and after-sales states must remain separate. A dispatched order is not automatically paid or delivered.
Define allowed actor/state transitions and guards before implementing endpoints.
Financially accepted orders cannot be silently edited or force-deleted. Use adjustments and compensating documents.

### Inventory authority decision

Before stock work, inspect Billing stock calculations, Core warehouses, and every existing inventory consumer.
Choose one authoritative stock owner and document available, reserved, committed, returned, and damaged quantities.
If a suitable owner exists, add a public reservation contract there after impact review.
If none exists, define a bounded commerce allocation owner and its reconciliation boundary before creating tables.
Do not create a second enterprise stock ledger or claim Billing stock reports are a reservation service.
Use atomic reservations, expiry, release, and commit. Test simultaneous purchase of the last unit.
Supplier feeds and vendor offer quantities must not silently inflate owned physical stock.

### Payment, Billing, and refunds

Local E2E first supports an explicit manual/COD or bank-transfer policy with audited payment confirmation.
Provider sandbox E2E follows through a reviewed gateway contract. Neither proves live settlement.
Never store card PAN or CVV. Use provider tokens and hosted checkout where available.
Resolve callbacks to tenant and merchant through verified server-side connection mappings.
Verify signatures, amounts, currency, replay identity, and current state. Do not trust browser success redirects.
Persist callback inbox and state changes atomically, then publish follow-up events.
Use idempotent Billing document creation and payment posting keyed by commerce source UUID.
If Billing is unavailable, expose pending reconciliation. Do not invent an invoice number or duplicate ledger entry.
Define whether acceptance can proceed with pending invoicing before release.

Refund approval, provider refund execution, financial credit/reversal, and customer-visible refund status are distinct actions.
Reject refunds above captured amounts after prior refunds and concurrent requests.
Support partial items, delivery charge policy, coupon allocation, tax reversal, and COD/manual refund evidence.
Test timeout after provider success, duplicate callbacks, lost responses, chargebacks, and reconciliation recovery.

### Fulfillment, returns, and rejection

Support partial acceptance and explicit order rejection reasons before capture or fulfillment where policy permits.
Split shipments by vendor/warehouse with line-level quantities and authorized operations.
Track picked, packed, dispatched, in transit, out for delivery, delivered, failed, returned-to-origin, and lost exceptions.
Accept carrier events through authenticated, idempotent inboxes. Keep event time separate from receipt time.
Protect private documents and proof of delivery. Customers see only a minimized tracking projection.
Manual tracking is a complete local workflow. Carrier automation remains a separately tested capability.

Returns enforce purchased quantity, delivery date, policy snapshot, return window, reason, evidence, and previous return amounts.
Support approval, collection, receipt, inspection, restock/disposal, exchange, and refund linkage.
Returning an item does not automatically restock or refund it.
Record cancellation, rejection, reverse transport, failed delivery, and vendor liability in audit history.

### Marketplace and industry expansion

A vendor is a scoped business participant inside a tenant, not another tenant selected by browser input.
Vendor profiles reference Core contact identity and verified company relationships.
One vendor cannot read another vendor's offers, customers, fees, orders, files, or statements.
Use a parent customer order with vendor suborders and line allocations.
Commission rules and settlement statements are commerce calculations. Actual payout and accounting remain with their financial owner.
Define merchant-of-record, invoice issuer, tax responsibility, shipping charges, commissions, and refund allocation before marketplace checkout.
Do not enable automated payouts until the reviewed financial/provider contracts and reconciliation tests pass.

## 7. API, module, and event contracts

Follow the repository leaf pattern. Backend roles are migration, module, repository, routes, seed, service, types, and index.
Frontend roles are workspace, list, form, services, hooks, schema, types, and index, plus a concrete Show implementation.
Add events, worker, sync, or policy files only when executable behavior requires them.
Composition registers modules. It must not own business CRUD, shared field definitions, or generic sibling repositories.

Use `registerContractRoute()` with strict schemas and declared errors.
Staff browser requests follow `/api/app/ecommerce/...`; modules own fixed `/ecommerce/...` resource routes.
Retain existing `/storefront/*` public contracts until a documented compatible migration is approved.
Define separate minimized portal routes. Never reuse unrestricted staff responses for customer or vendor access.
List APIs return authorized totals, items, page size, page, and stable sort information.
Mutation APIs return authoritative records, version/conflict details, and action permissions where needed.
Lifecycle commands use explicit endpoints rather than allowing arbitrary status updates through Upsert.
Audit successful and rejected sensitive actions without logging secrets or payment data.

Use optimistic concurrency for edited records and conditional transitions for money and quantity operations.
Use database constraints for duplicate SKU, slug, variant combinations, source references, and retry identities.
Record actor, origin, correlation, UTC time, and reason in activity history.

### Durable events

Use the Framework event envelope and existing queue infrastructure.
Persist each business transition and its outbox intent in the same local transaction.
The relay delivers after commit. Consumers persist inbox deduplication before applying effects.
Use at-least-once delivery, exponential retry, bounded attempts, dead-letter inspection, and audited replay.
Order events per aggregate where required. Include aggregate UUID, version, event identity, and causation.
Validate a mandatory tenant, company scope, source, and actor at both publish and execution boundaries.
Do not trust a serialized database name in a job. Re-resolve the tenant registry and recheck activation at execution.

Candidate events include `ecommerce.order.accepted.v1`, `ecommerce.payment.confirmed.v1`, and `ecommerce.shipment.dispatched.v1`.
Also define return, refund, rejection, publication, and stock-reservation events as their owners ship.
Payloads contain minimal approved references. Resolve private customer data through authorized contracts.
An order remains accepted when an optional notification fails. Financial or stock failures follow explicit recovery states.

## 8. Tenancy and permission acceptance

Server-verified host and session context select the tenant database. Unknown or inactive hosts fail closed.
Shared staff hosts use exact Corporate ID according to Platform rules. Public storefront hosts use verified mappings.
Localhost fallback remains development-only and must not become a production tenant selector.
Single-tenant deployment mode retains tenant registry and database validation.

Use distinct staff, customer, vendor, support, and worker capabilities.
Suggested permission families are catalog, publishing, orders, fulfillment, returns, refunds, vendors, reports, and integration administration.
Give refunds, payouts, bulk exports, policy changes, and credentials separate high-risk permissions and approval thresholds.
Backend record scope combines tenant, company, principal, customer/vendor relationship, action, and app activation.
All item details, counts, search, lookups, exports, activity, files, websocket subscriptions, and jobs enforce the same scope.
UUIDs reduce accidental exposure but never replace authorization.

Partition cache keys, query keys, carts, previews, jobs, image variants, exports, and search indexes by verified tenant and scope.
Clear tab caches on tenant/principal changes. Never place private portal responses in shared public caches.
Protect state-changing cookie requests against CSRF through the existing host contract.
Rate-limit login, guest tracking, checkout, coupon attempts, uploads, and public support entry points.

## 9. Local-first migration and later Frappe sync

Phase 1 requires an inventory of existing local records, imported records, media, source links, and provider selections.
Back up the target tenant database and storage before any data migration.
Preserve existing IDs, UUIDs, SKUs, slugs, images, and public links.
Change normal catalog reads to local projections. Disable automatic remote refresh in the local mode.
Remove mandatory Frappe/CRM activation dependencies for local Ecommerce only through reviewed composition contracts.
Existing CRM and Frappe behavior must remain unchanged.
Do not delete integration history or replace tables while converting provider selection.
Provide dry-run counts, duplicate/conflict review, repeatable migrations, and rollback conditions.

After local acceptance, design per-entity pull and push mappings with the Frappe owner.
Use site-scoped remote identity, local UUID, source version, last successful checkpoint, and mapping version.
Imports run preview, validation, conflict review, staging, and approved apply.
Do not reuse wholesale cache replacement as a transactional order or product merge strategy.
Preserve local-only fields and suppress import echoes. Advance checkpoints only after successful apply.
Queue remote updates from durable local intent. Remote downtime must not fail local checkout.
Show waiting, failed, conflict, and confirmed states with authorized retry and verification.
Test duplicate remote responses, reordered updates, deleted mappings, site changes, and conflicting edits.
No Frappe order, payment, stock, or refund write is enabled until that entity's mapping and authorization pass acceptance.

## 10. Delivery phases and exit gates

Deliver vertical slices with database, backend, UI, permissions, activity, and tests together.
Frontend mock screens and route stubs do not complete a phase.

| Phase                           | Scope and dependencies                                                                                                                                                    | Exit gate                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0: contract and readiness      | Inventory all owners and existing data. Decide stock authority, pricing/tax, Billing handoff, portal identity, SEO rendering, and marketplace financial responsibilities. | Approved contract/impact matrix, schema diagram, transition tables, migration plan, and task breakdown. Unresolved choices are explicit blockers. |
| P1: local foundation            | Request/worker tenancy, local catalog mode, Core lookups, permissions, organisation scope, migration safety and test fixtures.                                            | Ecommerce runs without Frappe. Two-tenant reads/writes and denied requests pass. Existing records and CRM behavior remain intact.                 |
| P2: catalog and media           | Extend product, variants/options, gallery, collections, file picker, pricing/availability projections and staff List/Show/Upsert.                                         | Staff saves reload from DB. Published product pages show real data, complete images, correct variants, and unpublished denial.                    |
| P3: storefront and discovery    | All homepage sections, navigation, search/filter, SEO, legal policies, accessibility and customer identity/wishlist.                                                      | Backend edits appear publicly only after publication. Desktop/mobile and raw HTML metadata checks pass.                                           |
| P4: single-merchant transaction | Durable cart, checkout quote, stock reservation, order creation, manual/COD payment policy and Billing handoff.                                                           | Concurrent last-unit, duplicate checkout, stale price, restart recovery, invoice reconciliation and customer order history pass.                  |
| P5: fulfillment and after-sales | Shipping policy, partial shipment, tracking, cancellation, rejection, returns, exchange and manual refund workflow.                                                       | Full and partial order-to-return/refund journeys pass with quantity and amount reconciliation.                                                    |
| P6: providers and service       | Sandbox gateway, callback recovery, Mail intents, Chat support scope, CRM enquiry links and operational reporting.                                                        | Provider failures cannot lose accepted work. Sandbox payment/refund and duplicate-delivery tests pass. External sending follows owner policy.     |
| P7: marketplace and industries  | Vendor onboarding/portal, moderated offers, suborders, commission, statements, Billing payout contracts, approved industry features.                                      | Two-vendor isolation, mixed basket, partial rejection/refund and settlement reconciliation pass.                                                  |
| P8: local release hardening     | Load/security/accessibility, migrations from current schemas, storage recovery, backup/restore drill and deployment runbook.                                              | Complete local E2E matrix passes. Live providers and production deployment remain separately reported.                                            |
| P9: Frappe integration          | Explicit pull/push mappings, outbox adapters, conflict UI, reconciliation and site-scoped verification.                                                                   | Local suite still passes with Frappe offline. Approved entity round trips and retry/conflict cases pass.                                          |

P0 through P8 define the complete local delivery target. P9 is deferred integration, not a prerequisite for local completion.
Independent catalog and content tasks can proceed after their contracts are fixed. Money and stock tasks cannot bypass P0 decisions.

## 11. E2E and regression test matrix

Use disposable MariaDB tenant databases and isolated storage roots. Do not run destructive tests against customer databases.
Fixtures include tenants A/B, two companies in A, staff roles, two customers, two vendors, and guest principals.
Use identical product names, SKUs where tenant-local, contact names, and UUID fixtures across different databases to expose scope errors.
Run the same contracts in single and multi tenancy modes where applicable.

| Test family        | Required scenarios                                                                                                     | Evidence                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Host/session       | Verified A/B hosts, shared host, unknown host, suspended tenant, revoked session, forged headers, forwarded-host spoof | Route result and actual selected database. No fallback data.                        |
| Scope              | Cross-tenant UUID/ID, company switch, customer/vendor substitution, role revoke, disabled app                          | List/count/detail/export/file/activity and subscription denial.                     |
| Persistence        | Create/edit/show, process restart, transaction rollback, duplicate requests, concurrent updates                        | DB readback, immutable references, activity and explicit conflict.                  |
| Catalog            | Inactive Core parent, missing variant, duplicate SKU/options, draft publication, slug redirects, scheduled content     | Staff and public projections agree without leaking private fields.                  |
| Lists              | Search/filter/sort combinations, columns, authorized totals 0/20/99/100/101/250                                        | All rows reachable. Pagination rules match section 5.                               |
| Media              | Oversized files, MIME spoof, traversal, private URL access, cross-tenant file ID, referenced deletion                  | Rejection, ownership, protected bytes, safe renditions and no crop.                 |
| Checkout           | Guest/member, cart merge, changed price, invalid coupon, wrong currency, expired quote, last unit race, double submit  | One accepted order and correct reserved quantities/amounts.                         |
| Money              | Pending/failed/partial capture, wrong signature, duplicate callback, success timeout, invoice retry, partial refund    | One provider/Billing effect with exact reconciliation.                              |
| Fulfillment        | Split shipment, over-dispatch attempt, duplicate/out-of-order tracking, failed delivery, return-to-origin              | Correct line quantities and minimized customer timeline.                            |
| After-sales        | Window expiry, repeat return, partial inspection, rejected refund, concurrent refunds, restock failure                 | Policy snapshot and independent quantity/money invariants.                          |
| Vendor             | Mixed-vendor order, offer moderation, vendor suspension, cross-vendor reads, refund commission reversal                | Suborder isolation and settlement statement balance.                                |
| Events             | Crash before/after commit, relay outage, duplicate delivery, poison event, replay, tenant suspension before execution  | Durable recovery without duplicate mail, stock, or financial effects.               |
| Optional owners    | Blog/CRM/Chat/Mail unavailable, Billing contract unavailable, Frappe disabled                                          | Explicit degraded states. No fabricated success or unwanted remote sends.           |
| Browser            | Desktop 1440, tablet 768, phones 390 and 320, keyboard and reduced motion                                              | Live screenshots, no horizontal overflow, complete product images and usable forms. |
| SEO/performance    | Raw HTML, canonical/sitemap, private noindex, structured data, cache boundaries, realistic catalog load                | Measured results with dataset and environment.                                      |
| Migration/recovery | Fresh schema, existing schema/data, repeat run, interrupted upgrade, storage backup/restore                            | Before/after counts, checksums, FK validity and recovery record.                    |
| Future sync        | Pull/push/retry, source conflicts, no echo, site change, remote outage                                                 | Per-entity mappings and successful local behavior during outage.                    |

Security tests include customer order enumeration, mass assignment, stored XSS in content, upload abuse, and SSRF through media URLs.
Use controlled provider fakes for deterministic tests, then real sandbox contracts. Label each evidence level clearly.
No financial, stock, tenant-isolation, or portal feature is complete on unit tests alone.

## 12. Agent task template and definition of done

Create implementation tasks in [TASK.md](TASK.md), grouped by phase and leaf owner.
Do not replace completed historical tasks or create a parallel global task registry.
Each task must contain:

1. Task ID, phase, owner, goal, dependencies, and concrete user journey.
2. Current source evidence and exact files/public contracts to reuse.
3. Domain fields, table ownership, Core references, uniqueness, indexes, and migration compatibility.
4. List/Show/Upsert routes, schemas, validation, lifecycle commands, activity and permission matrix.
5. Staff/public/portal UI states, App Header actions, responsive behavior and accessible interactions.
6. Transaction boundaries, concurrency, idempotency, events, retries and compensation behavior.
7. Cross-owner impact record, consumer contracts and behavior-preservation tests.
8. Two-tenant/company/customer/vendor denial cases and positive persistence checks.
9. Exact verification commands, fixture cleanup, screenshots where relevant, and observed results.
10. Remaining blockers, deployment requirements, rollout/rollback conditions, and explicit completion criteria.

Use root npm commands and the shared installation/output layout.
Run relevant owner typecheck, lint, build, focused tests, module boundaries, dependency and documentation checks.
Add Docs reference/catalog entries for new leaf modules according to the current documentation workflow.
Run affected consumer checks after any public contract or shared UI correction.
Record fresh-schema and existing-schema results separately.
Report source checks, database E2E, browser verification, provider sandbox, live provider, and production deployment separately.

Local release completion requires all P0–P8 journeys, operational recovery, and the multi-tenant matrix to pass.
Record explicit exclusions for later industry packs and Frappe mappings. Never label planned routes or mocked provider settlement as live capability.

## 13. First implementation task pack

- EC-P0-01: Inventory existing schema, public exports, consumers, tenant data, and migration history.
- EC-P0-02: Approve Core product/contact/company references and extension compatibility.
- EC-P0-03: Resolve stock authority and Billing price/tax/invoice/payment/refund contracts.
- EC-P0-04: Define customer/vendor identity and record-scope contracts with Platform.
- EC-P0-05: Define media picker/storage contracts and SEO rendering approach.
- EC-P0-06: Define state transitions, event envelopes, outbox/inbox and provider callback policy.
- EC-P0-07: Define merchant-of-record, vendor settlement, industry baseline and deferred feature flags.
- EC-P1-01: Build disposable two-tenant test harness and boundary-denial fixtures.
- EC-P1-02: Migrate Ecommerce to local-authoritative reads while preserving imported data and other apps.
- EC-P1-03: Establish company/storefront scope, permission seeds, actor binding, and worker context validation.
- EC-P2-01: Complete one product-extension List/Show/Upsert vertical slice with gallery and published product page.

Start with these tasks. Split later phases only after their contracts and acceptance criteria are stable.

## 14. Current runnable suites after EC-R01-EC-R08 (2026-10-24)

| Suite                     | Command                                                                                               | Evidence                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Fixture tenancy + browser | `ECOM_TENANCY_BROWSER=1 node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts`         | A1-A11 boundary/catalog checks plus R04 fixture browser at 1440/390/320. |
| Tenancy only              | `npm run test:e2e:ecommerce-tenancy`                                                                  | A1-A11; no Chrome needed.                                                |
| Forced cleanup drill      | `ECOM_TENANCY_FORCE_FAILURE=1 node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts`   | Exit 1 after fixtures; databases and generated storage must be gone.     |
| Live-tenant browser smoke | `npm run test:e2e:ecommerce-browser`                                                                  | Route/image smoke only; an empty tenant catalog is reported as a limit.  |
| Media root migration      | `node --import tsx --test apps/ecommerce/api/src/modules/product-image/product-image.storage.test.ts` | Legacy product/slider copy, survival, cross-tenant denial.               |

`tools/e2e/ecommerce-access.e2e.ts` and `tools/e2e/ecommerce-modules.e2e.ts` are retired shims; their
coverage moved to tenancy A1-A6/A10. The root npm aliases invoke the tenancy harness. Do not report a
green tenancy run as transaction, portal, or production acceptance.
