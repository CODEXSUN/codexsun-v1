# Ecommerce

Ecommerce is a tenant owned app composed into the Platform API on port 7010. Its staff desk opens in Platform at `/app/ecommerce` on port 7020. The public storefront uses the same Ecommerce modules at `/shop` on port 7030.

## Run locally

Run commands from the repository root. Set `PLATFORM_API_PORT`, `PLATFORM_WEB_PORT`, `CODEXSUN_ECOMMERCE_WEB_PORT`, `CODEXSUN_UIUX_WEB_PORT`, and `CODEXSUN_PROJECT_MANAGER_WEB_PORT` in the root `.env`. The example uses ports 7010, 7020, 7030, 7040, and 7050.

```bash
npm install
npm run dev
```

`npm run dev:ecommerce` starts the public Ecommerce web app at `/shop`. Its other paths redirect to the Platform staff desk. `npm run dev:storefront` starts that same web app. It proxies `/api/platform` to the Platform API. Enable Ecommerce for the tenant through Plan Access before using either app.

The Ecommerce app header checks the local storefront every 10 seconds. It shows **Start storefront** when stopped and **Starting storefront…** during startup. Green **Storefront live** requires the server identity, `/shop` HTML, and successful branding/catalog API responses through the storefront proxy. Checks include the current browser cookies so oversized-header failures do not show green. Failed page or tenant API checks show **Storefront unavailable** with Recheck. This does not verify every browser interaction or asset. Both local launch paths allow 64 KiB request headers, consistent with Platform development servers.

Runtime controls require a loopback browser session and a non-production API. Starting requires `ecommerce.storefront.manage`, the source checkout, and root development dependencies. Status requires `ecommerce.overview.view`. The API starts only the fixed storefront development server and closes its child process during shutdown. Existing external storefront processes remain independently managed. These controls do not deploy or start production services. No database migration is required.

## Modules

The Ecommerce sidebar groups pages under Catalog, Storefront UX, and Settings. Overview remains first. Catalog links to Ecommerce item extensions, variants, and images, plus Core-owned categories and products. Storefront UX links to Home Slider, Trusted Strip, Promotion Cards, Brands Strip, Featured Cards, Season Strip, Campaign Events, and Service Banner. Settings contains Organisation, Storefront Profile, and Data Source.

The homepage section order matches the requested `cxshop` reference: hero, trust, promotions, brands, featured cards, season, catalog, campaigns/events, service banner, journal, and closing action. Existing Ecommerce routes and tenant APIs remain authoritative. Brands Strip edits Core brand logos and storefront visibility. Local Campaign Events and Promotion Cards share promotion records, as in the reference. Their section visibility controls remain separate. Empty or disabled brand/campaign feeds do not fall back to unrelated homepage content.

The hero slider uses the supplied SoftAurora with a broad, soft band at 65% opacity. Product images fit without cropping inside rounded white bases with a subtle shadow. Slide controls sit below the image base. It keeps random color pairs per page load, respects reduced motion and page visibility, and does not intercept slide controls. MagicRings has been removed.

Seasonal offers use separate image and copy areas, with complete product images, saved titles, descriptions, and product links. Their assurance row uses the storefront company name and the proof points saved in Storefront Profile. The cards stack on mobile. The homepage catalog uses two columns on phones and one below 360 pixels. Hero text can wrap without clamping, and image badges have reserved space so they do not cover products.

The staff desk owns product information, variants, images, catalog data sources, matching, sliders, promotions, featured cards, season strips, announcements, and the storefront profile. Core owns the underlying product, category, and brand records. Ecommerce reads those through its tenant database and keeps its own published storefront content. The staff UI is available from the Ecommerce menu in Platform.

The local brand strip uses Core Brand logos and storefront visibility. Edit those fields in Core Brands; Ecommerce reads the published brand display data without duplicating the brand record. The Core Brand migration adds these fields to existing tenant databases with visible defaults.

Frappe connection settings and credentials belong to the Frappe app. Configure and verify the tenant connection there. Ecommerce's Data Source page chooses Local or Frappe per catalog module; the choice stays in Ecommerce's tenant table. Public catalog reads are always local: they never pull from Frappe, never refresh a remote cache, and never fall back to a remote operation because a Frappe selection exists. A remote read happens only through an explicit authenticated Data Source action or the staff Frappe item picker, and it stops when Frappe is unconfigured or unavailable. Pull and Push run only from the authenticated Data Source actions; Pull updates the local projection, Push sends the local catalog to Frappe. Ecommerce does not save or verify credentials or seed demo records into Frappe.
The current Platform activation contract requires CRM and Frappe to be enabled together for Frappe routes and migrations.

The public storefront reads published products and content through `/storefront/*` routes. It resolves the tenant from the verified request hostname and requires an active Ecommerce entitlement. The basket is local browser state; it does not submit orders, collect payment, or reserve stock. The Piko button has a product search fallback while the optional chat endpoint and panda sprite are unavailable.

HISTORICAL, 17-10-2026: the then-configured CODEXSUN tenant held reference content for storefront refinement (10 products and sliders, 3 promotion/campaign cards, 4 featured cards, 2 seasonal banners, 4 brands, journal articles) with product images under that tenant storage. That content belongs to that tenant at that date and is not current evidence: the local `codexsun_db` read during the 2026-10-24 delivery contained 0 `ecommerce_product_information` rows and 0 product images, and the public storefront rendered with no published products. Do not quote these counts as present-day state; re-run a tenant content query before relying on them.

The homepage journal reads published Blog articles. `/blog` lists them and `/blog/:slug` composes the pinned Blog package's public article view with the storefront header and footer. Blog must be enabled for the tenant; staff management requires `blog.manage`. Local development Blog reads can resolve the same configured localhost Ecommerce tenant, while verified-domain routing and Blog activation checks remain in place elsewhere.

Open **Ecommerce → Organisation Settings** at `/app/ecommerce/organisation` to select the default company and accounting year. Both dropdowns read active records from this tenant's Core organisation modules. Ecommerce saves its selection without changing the Application Default Company. Until saved, it uses the tenant's Default Company selection.

Set an optional **Display name** and upload a **Storefront logo** on that page. Save applies them to the top menu, footer, and default copyright through `/storefront/branding`. Blank display names use the company name. Removing the custom logo restores company logos. Uploads accept PNG, JPG, and WebP up to 2 MB. Ecommerce validates and converts them to PNG, preserves their proportions, and saves them under `storage/<tenant>/public/ecommerce/logo`. Platform supplies the storage root from the verified tenant registry. Browsers cannot choose a tenant folder or file path.

Product and slider media use the same verified tenant root: `storage/<tenant>/public/ecommerce/products` and `storage/<tenant>/public/ecommerce/sliders`. Older files written under `STORAGE_ROOT/ecommerce/<tenant-key>/...` are copied into the tenant root on first read, keeping the existing public URL and record link. The copy is idempotent; removing the old root after migration does not break the asset.

Settings reads require `ecommerce.storefront.view`. Saves and uploads require `ecommerce.storefront.manage`. The tenant migration adds organisation settings and activity tables, then display-name and logo columns. The organisation module is a synchronous singleton settings module with no list, delete, event, worker, or sync roles. Public logo routes resolve the request's tenant and require active Ecommerce access.

In local development, localhost storefront traffic uses `DEFAULT_TENANT_CORPORATE_ID` independently of `ENABLE_DEFAULT_TENANT_SEED`. Production still requires verified tenant-domain routing. Staff requests pass the server-verified tenant database name to Core lookups.

Tenant migrations preserve legacy catalog tables and recorded ledger identities. The historical cleanup step is a data-preserving no-op.
Explicit manifests support the proven 31-step `8433a8ff` lineage and 34-step `27135c9a` lineage.
The framework supplies immutable scope-ledger metadata under its migration lock. Ecommerce selects only a complete, exact known lineage before running steps.
Unknown, mixed, incomplete, failed, running, rolled-back, or duplicated histories require review and fail before migration-step writes.
Missing upgrades append at versions 32–40 for the older lineage or 35–40 for the newer lineage. Fresh installations use the newer manifest.
Applied names, versions, checksums, statuses, and timestamps remain unchanged. The checksum guard and ledger format are unchanged.
`planEcommerceTenantMigrations(ledger)` exposes the selected lineage and pending metadata without SQL or migration execution.
The seed creates Ecommerce permissions and the default storefront profile. No live migration or recovery acceptance follows from metadata planning.

Staff permissions are `ecommerce.catalog.view`, `ecommerce.catalog.edit`, `ecommerce.storefront.view`, and `ecommerce.storefront.manage`. Platform checks them before the staff routes run. Frappe catalog connection settings use the tenant's Frappe connection when that module is enabled.

The storefront still needs a verified tenant domain for public access outside the local development hostname. See the repository's tenant isolation and migration runbooks before applying the schema to an existing deployment.

## Component documentation

Staff catalog management, matching and publishing controls, and the public storefront.

Core owns shared product identity and Frappe owns connection credentials. Public routes return published tenant content only. A browser basket does not prove order, payment, or stock-reservation support.

- [TASK.md](agent/TASK.md): work items and acceptance evidence.
- [PLAN.md](agent/PLAN.md): scope, ownership, delivery order, and verification gates.
- [SKILLS.md](agent/SKILLS.md): component working rules and safety constraints.

### Source inventory

- `api/src/modules`: `catalog-matching`, `ecommerce-composition`, `featured-card`, `overview`, `product-image`, `product-information`, `product-variant`, `promotion-card`, `season-strip`, `storefront-announcement`, `storefront-profile`, `storefront-slider`.
- `web/src/modules`: `catalog-data-source`, `catalog-overview`, `featured-card`, `overview`, `product-image`, `product-information`, `product-variant`, `promotion-card`, `season-strip`, `storefront-profile`, `storefront-slider`.

This inventory records source presence. It does not certify a deployed feature.

### Workspace verification

Run these commands from the repository root. Use the root installation and `dist` output tree.

- `node tools/check-module-boundaries.mjs ecommerce`
- `npm run typecheck -w @codexsun/ecommerce-api`
- `npm run lint -w @codexsun/ecommerce-api`
- `npm run build -w @codexsun/ecommerce-api`
- `npm run typecheck -w @codexsun/ecommerce-storefront`
- `npm run lint -w @codexsun/ecommerce-storefront`
- `npm run build -w @codexsun/ecommerce-storefront`
- `npm run typecheck -w @codexsun/ecommerce-web`
- `npm run lint -w @codexsun/ecommerce-web`
- `npm run build -w @codexsun/ecommerce-web`
- `npm run test:e2e:ecommerce-tenancy` (disposable two-tenant isolation/denial E2E, ~5-6 minutes)
- `$env:ECOM_TENANCY_BROWSER=1; node --env-file=.env --import tsx tools/e2e/ecommerce-tenancy.e2e.ts` (fixture-backed 1440/390/320 Chrome acceptance; no live tenant content needed)
- `npm run test:e2e:ecommerce-browser` (live-tenant storefront smoke; needs the API and storefront dev servers; an empty catalog is reported as a limit, not acceptance)

Run `npm run check:component-docs` to verify the required documentation files.
Run the relevant app tests and root release gates when implementation changes.
Report database, browser, native, and deployment checks separately.

### Workspace packages

- `api`: `@codexsun/ecommerce-api`.
- `storefront`: `@codexsun/ecommerce-storefront`.
- `web`: `@codexsun/ecommerce-web`.

### Declared internal dependencies

- `@codexsun/core-api`
- `@codexsun/ecommerce-web`
- `@codexsun/framework`
- `@codexsun/frappe-api`
- `@codexsun/ui`

### Public package entry points

- `@codexsun/ecommerce-api`: `.`.
- `@codexsun/ecommerce-storefront`: `.`.
- `@codexsun/ecommerce-web`: `.`, `./modules/overview`, `./modules/overview/gateway`, `./modules/pages`, `./modules/storefront`.

## Legacy variant writer compatibility

Forward migration 41 preserves both historical migration manifests and all applied ledger identities.
It adds owner-scoped deterministic SQL normalization, JSON encoding, and signature routines plus insert/update triggers.
A default sentinel admits old inserts. Triggers replace it before the existing canonical unique index is checked.
Old updates recompute signatures and increment revision. New application validation remains unchanged.
Frozen Unicode 17 casing, final-sigma handling, ECMAScript trimming, JSON escaping, and UTF-16 pair ordering preserve the application hash contract.
The migration checks canonical duplicates and verifies SQL/application parity on existing rows before business updates.
It does not drop uniqueness, change migration history, grant privileges, or change server configuration.
Routine/trigger privileges, strict-mode SQL execution, old/new writes, collisions, and rollback need isolated MariaDB acceptance.
Use the explicit staging-only `verifyProductVariantWriterCompatibility` helper with a synthetic product.
The helper tests Unicode/escape parity, multiple legacy/new variants, duplicate refusal, and legacy updates inside a rolled-back transaction.
This helper is never run by startup or migration and does not establish data-recovery acceptance.
