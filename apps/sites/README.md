# Sites — Site Studio

Site Studio manages client portfolio websites, public profiles, page sections, blogs, local previews, and Node/SQLite deployment packages.
All application code belongs under `apps/sites`. Platform supplies identity, tenant selection, activation, and shared infrastructure through public contracts.

## Source and ownership

| Folder    | Purpose                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| `api`     | Site registry, page drafts, blog posts, publications, activity, and local startup    |
| `web`     | Client cards, creation form, client workspaces, editors, and typed API gateways      |
| `clients` | LogicX, Ramu Tex, standard portfolio template, and public content readers            |
| `agent`   | [TASK.md](agent/TASK.md), [PLAN.md](agent/PLAN.md), and [SKILLS.md](agent/SKILLS.md) |

This README is the only Markdown file outside `agent` in this application.
The page and blog child leaves own their API and Web implementations. The site module composes their public contracts.
The obsolete source-only Studio inventory has been removed.

## Tirupur Connect client

Tirupur Connect is a named Sites client with slug `tirupurconnect`, template `portfolio-tirupurconnect`, and local port 7040.
Its public UI lives in `clients/src/clients/tirupurconnect`. Public assets live in `clients/public/tirupurconnect`.
The local Studio registry contains this client. Studio Start verifies its identity before opening the saved port.
Its layout is code-owned. Public copy, images, banners and contacts use the saved Sites Page publication.
Business listings, products, associations, community articles, registrations, and enquiries use TConnect's public contracts.
Private buyer and seller workspaces remain in TConnect and open on `https://codexsun.com`.

The public site remains `https://tirupurconnect.com`. Its Worker lives in `clients/cloudflare/tirupurconnect.mjs`.
Deploy with `wrangler deploy --config apps/sites/clients/cloudflare/wrangler.tirupurconnect.jsonc --keep-vars`.
Build with `npm run build:tirupurconnect -w @codexsun/sites-clients`. Development uses `dev:tirupurconnect` in the same workspace.

Repository CI creates a marked synthetic publication through `tools/ci-sites-publication-fixture.ts` for build verification only. This output is not published or deployed.
Production builds still require the authenticated publication export described below. The builder has no automatic fixture fallback.
The former TConnect development command forwards to this Sites client. All output stays under root `dist/apps/sites/clients/tirupurconnect`.

Public business data must come from Corporate ID `TIRUPURCONNECT`. The fixed upstream is `https://codexsun.com/api/platform`.
The Worker verifies the registration context before returning records or forwarding account creation.
Another tenant never becomes fallback content. While the backend reports CODEXSUN, the site shows its sourcing guide and setup state.
The separate VPS task must configure the dedicated tenant binding. No VPS configuration was changed for this move.
Studio registry creation was verified locally. This does not confirm a matching registry record in the remote Studio database.

The CMS-enabled production JavaScript bundle is about 429 kB, compared with the previous 642 kB bundle before the Sites build.
Typography uses a self-hosted Geist font. This comparison is an artifact measurement, not a Core Web Vitals score.
Artwork and standards provenance are in `agent/tirupurconnect-assets.md` and `agent/tirupurconnect-standards.md`.
Run `tools/e2e/tconnect-frontend-live.e2e.mjs` for read-only public layout checks and `tools/e2e/tconnect-worker.test.mjs` for tenant guards.


## Tirupur Connect content management — October 17, 2026

Open Sites → Tirupur Connect → Manage. Client details edits branding and public contacts. Pages → Textile edits hero imagery, category copy and images, directory and community headings, the sourcing guide, the closing banner, pending-state copy and public page introductions. Hero, Page & SEO, and Footer have their own sections. Individual category images use full crops. Image sheets use a 3 by 2 crop. Use deployed local image paths or public HTTPS JPG, PNG or WebP URLs. File upload is not included.

Save draft keeps edits private. Publish page creates the public version using existing permissions and revision checks. Start connects the local preview to this client's publication. Business records, credentials, account access, enquiries and conversations remain TConnect-owned and require TIRUPURCONNECT. CMS content never changes that tenant selection.

Live delivery uses an authenticated publication export, not a development API or public management endpoint. Export through the existing client publication control. Set `CODEXSUN_SITES_TIRUPURCONNECT_SNAPSHOT` to the absolute exported JSON filename. Run `npm run build:tirupurconnect -w @codexsun/sites-clients`, then `wrangler deploy --config apps/sites/clients/cloudflare/wrangler.tirupurconnect.jsonc --keep-vars`. The builder verifies checksum, slug, domain and pinned site UUID `e303865e`. It embeds only the published content and blogs, without delivery keys or private drafts. The deployed site reads that version through a read-only same-origin endpoint. Subsequent Studio publication needs another export/build/deploy; automatic remote delivery is not implemented.

No SQL column migration is required for the optional textile content field. Existing publications remain valid. Existing Tirupur Connect generic drafts need approved content initialized before export. The local CMS integration check verifies draft isolation, publish, stale saves, unsafe-image rejection and export. Unit checks cover deployment identity and safe embedding. VPS configuration and a remote Studio registry remain separate.

## Tenkasi District Sports Club client

Tenkasi District Sports Club is the public brand for the named Sites client `tenkasisports`. Sivakalai Gurukulam is its home association. The local port is 7134.
Its public UI lives in `clients/src/clients/tenkasisports`. Public assets and authentic handbook media live in `clients/public/tenkasisports`.
The local Studio registry contains this client with pinned site UUID `c0de0006`. Studio Start verifies its identity before opening port 7134.
Its layout is code-owned and responsive across mobile (320px, 390px, 430px) and desktop viewports with authentic Tamil and English content from the handbook.
The sticky header shows the club name and links to Home, About, Syllabus, Classes, Masters, Gallery, Articles, Contact, Students, and Alumni.
The top banner shows `9843930300` as a call link on the left. The language switch and member portal link sit on the right.
The header, footer, and gallery use optimized WebP sizes of the supplied club logo from `clients/public/tenkasisports/club-logo.jpg`.
The home page uses a three-slide, two-column hero modeled on the Platform static page: bilingual copy, local training photos, arrow and dot controls, touch swipes, smooth CSS transitions, and automatic rotation that pauses during interaction. The previous handbook image is no longer in the home hero.
The four club facts below the hero count up and enter with a short stagger when scrolled into view, while reduced-motion users see their final values immediately.
The three home introduction cards link to the syllabus page; the section label and heading have extra breathing room above the cards.
The three training-level cards link to their matching syllabus sections. The home page includes a five-photo gallery that scrolls horizontally on phones and five linked article cards. Article list and detail pages use code-owned Tamil and English content.
The public client uses responsive WebP images, loads inner-page JavaScript on demand, and preloads the first hero image or inner-page chunk. The Worker caches versioned JavaScript and CSS while keeping HTML fresh.
The Students page links to the existing admission and member portal flows. The Alumni page links to Contact and Gallery. Both pages show bilingual photo grids from the public Worker D1 showcase API. Three fictional child learners and three fictional adult alumni use illustrative portraits and visible sample labels. Private member records are not part of this feed. The `/programs` path remains an alias for `/syllabus`.
These page and brand changes are deployed to the live Worker. The existing Sites Studio publication remains at version 1; the club name and home metadata are owned by the client code.
Public registration, enquiry, masters, classes, and programs submit through the same-origin Cloudflare Worker proxy forwarding strictly to Platform public endpoints.

The public site is `https://tenkasisports.com` (redirecting `www.tenkasisports.com` via 308). Its Worker lives in `clients/cloudflare/tenkasisports.mjs`.
Deployed as Cloudflare Worker `codexsun-tenkasisports` (version `dca90858-da7e-406d-9ae4-e4d3d5154837`) in zone `f7c324e9ca4cac54047f84f591cb54e4` with D1 database `codexsun-tenkasisports-content` (`1fff5450-d9a8-473c-8b11-45ecad357a60`).
Wrangler configuration lives in `apps/sites/clients/cloudflare/wrangler.tenkasisports.jsonc`.
Build with `npm run build:tenkasisports -w @codexsun/sites-clients`. Output stays under root `dist/apps/sites/clients/tenkasisports`.

Public sports club data must come from Corporate ID `TENKASISPORTS`. The fixed upstream is `https://codexsun.com`.
The Worker performs live health checks against `/api/platform/public/portals/tenkasisports/health` and fails closed (503 TENANT_SETUP_PENDING) if the backend is offline or corporate ID mismatches.
Same-origin is enforced on POST requests; caller cookies and tenant headers are stripped, and outbound HMAC signature headers (`x-codexsun-public-client`, `x-codexsun-client-time`, `x-codexsun-client-signature`) are attached for canonical registration and enquiry forwarding.

## Client workspaces

- Manage opens the selected client's profile, Pages, and Blogs editors.
- Site settings changes the registry name, domain, description, template, and local port.
- Add Portfolio opens the creation form and proposes the next available registered port.
- Creating a portfolio saves its site and initial website draft in one tenant database transaction.
- New clients use `portfolio-standard`. They start with empty service, contact, and blog records where details are unknown.
- LogicX uses `portfolio-logicx` on port 7131. Ramu Tex uses `portfolio-ramutex` on port 7132. Tenkasi Sports uses `portfolio-sportsclub` on port 7134.
- Start launches the selected template on its saved port. Open visits that local website.

The current public routes are `/`, `/about`, `/services`, `/contact`, `/blogs`, `/privacy`, and `/blogs/:slug`.
Home, About, Services, and Contact share one typed website draft and one publication revision.
Pages provides section editors and links to the six standard public pages. Custom page creation remains planned.
Blog posts have separate drafts, slugs, publication revisions, withdrawal, and deletion controls.
Public page counts come from saved publication state, rather than the legacy seeded count column.

Profile fields include business name, brand, domain, tagline, location, email addresses, phones, address, GSTIN, WhatsApp number, and map query.
The Core company phone selector copies the selected company number into the website draft. It never assumes the tenant default company is the client.
Section fields include SEO, hero, focus areas, company details, process stages, services, approach, equipment, contact copy, and footer.
The standard template does not invent customers, testimonials, project history, or certification claims.
Ramu Tex's approved starting content and downloadable brochure come from the supplied company profile.
Layout, navigation structure, artwork, and PDF assets remain code-owned.

## Client enquiry inbox

Manage a client and open **Enquiries**. The inbox reads that client's SQLite database.
Search by name, email, company, or message. Filter by New, In progress, Resolved, or Spam.
View the message, consent time, reference, and activity. Save status changes with revision checks.
Delete moves an enquiry to trash. Restore returns it to the inbox before its 90-day retention period ends.
Visitor messages are immutable. Studio does not create or edit visitor submissions.
Status, trash, and restore actions record the authenticated actor in SQLite.

The API checks `sites.enquiry.inbox.view/update/delete` on each request.
Run the Sites permission seed after upgrading. It preserves disabled permission grants.
Existing SQLite stores upgrade automatically through the transactional `sites.enquiry.v2` migration.
The API enquiry leaf owns submission persistence and inbox operations. Client runtimes use its server-only public export.

Start connects the saved client to `storage/sites-data/<tenant-and-site-hash>/content.sqlite`.
Set the server-only `CODEXSUN_SITES_DATA_ROOT` to use another attached storage root.
The API selects the hash from the authenticated tenant and saved site UUID. Browser requests cannot choose a file path.
Files must remain inside their exact namespace. Symlink redirects to another client are rejected.
For a separately hosted client, mount its data directory under that namespace on the Studio host.
An arbitrary remote SQLite file cannot be read over HTTP. A remote enquiry transport and Cloudflare D1 inbox remain planned.
Manual client development commands use separate manual storage. Use Studio Start for the connected inbox.
The management CLI remains available on the client host. Email notifications are not implemented.

## LogicX Software

LogicX uses the corrected abstract green design with a tilted software panel, a four-card service carousel, and a curved approach section.
Eight service pages and the application catalogue share the same visual system.
Services cover custom software, Frappe/ERPNext, React, mobile apps, business automation, Tally integrations, websites, and ongoing support.
The application catalogue contains 23 reviewed apps and workspaces, including the shared Core and Platform capabilities.
Search and category filters lead to individual application pages. Enquiry links prefill the selected app or service.
Customer sign-in uses the authenticated Platform host. Catalogue entries do not grant access to private apps.
Foundation applications are described as foundations. Configuration and delivery scope require agreement for each customer.

Edit the catalogue under **Pages → Applications**. Edit service copy under **Services / finishes**.
Save and publish through the existing page workflow. Draft catalogue changes stay private.
Sitemaps and deployment HTML include the published application and service routes.
The local LogicX publication contains 39 routes. Ramu Tex retains its six standard routes and brochure content.

## Authoring and publication

1. Open a client through Manage.
2. Edit Client details, Pages, or Blogs.
3. Select Save draft to persist edits without changing the public website.
4. Select Publish page to publish the saved profile and website sections.
5. Publish blog posts separately. Unpublish a post before deleting it.
6. Select Start, then Open. Public clients refresh every 30 seconds and on window focus.

MariaDB stores drafts, published snapshots, revisions, and transactional activity in the authenticated tenant database.
Tables are `sites_portfolio_sites`, `sites_pages`, `sites_page_activity`, `sites_blog_posts`, `sites_blog_activity`, and `sites_publications`.
Child rows use the saved site ID. Separate tenants use separate databases.
Revision checks reject stale saves and publication. Published content excludes later draft changes.
Site identity and template changes are blocked after the site owns CMS content. Local ports cannot reuse another client's registered port.
Suspension blocks new publication and public local reads. It does not prove a remote site is disabled.

The existing Sites migration entry point creates the CMS tables when missing.
Run tenant migrations, Sites seeds, and permission seeds for each enabled tenant before using these features.
The deployment continuation adds `sites_publications` through the existing Sites migration entry point.
Run Sites migrations and permission seeds before using export. Existing draft and blog tables need no column changes.
The local registered tenant has both workspaces and published starting content. See TASK.md for verification evidence.

## Identity and local delivery

Enable Sites through Platform Plan Access and assign effective tenant permissions.
The desk starts at `/app/sites/overview`. The guide uses `/app/sites/guide`.
Registry creation requires `sites.site.registry.create`. Startup requires `sites.site.runtime.start`.
Page actions require `sites.page.content.view/update/publish`. Blog actions require `sites.blog.post.view/update/publish/delete`.
Seeds preserve disabled grants. The broader legacy registry action audit remains planned.

Start requires a loopback development API with `NODE_ENV=development` and the root Vite dependency.
Checkout discovery walks upward from the module location and API working directory. It supports source and compiled output locations.
The API verifies the client identity endpoint before reporting a running site. It closes owned processes on graceful shutdown.
No client can supply an executable command, tenant database name, or database secret.

`GET /sites/public/:slug` reads a server-bound client publication. Each slug binds through an authenticated Start.
The slug selects an existing public binding. It cannot select a tenant database.
A conflicting tenant or site cannot replace that binding. The reader rechecks activation and site status.
The client proxy at `/__sites-content` targets its own slug and sends no Studio credentials.
Clients reject another site's publication identity. Drafts and activity are never included.
After an API restart, select Start again to restore each local binding.
Named clients retain their bundled approved profile during service outages. New standard clients await their first publication.

## Deployment packages

Studio's Export deployment content action downloads the last published website and blog posts.
The backend checks `sites.site.publication.export` and records an immutable, audited export sequence.
Exports include a checksum and an opaque identity derived from the authenticated tenant and saved site.
They contain no MariaDB credentials, editor sessions, draft edits, enquiry records, or private Core company records.

Prepare a release from the repository root:

```sh
npm run prepare:deploy -w @codexsun/sites-clients -- --snapshot /absolute/path/client-publication.json
```

The output is `dist/apps/sites/releases/<client>/`. Each release contains:

- `public/`: rendered HTML for every published route, client assets, logos, and favicon files.
- `sitemap.xml`, `robots.txt`, plus `site.xml` and `robo.txt` aliases in the public directory.
- Canonical, description, Open Graph, Twitter, and Organization metadata.
- `logo.svg`, `logo-dark.svg`, `favicon.svg`, `favicon.ico`, touch icons, a social card, and a Web Manifest.
- `runtime/server.mjs`: a bundled Node server. The deployed host does not need this repository or npm dependencies.
- `publication.json`, `release.json`, `readiness.json`, and `checksums.sha256`.
- Docker Compose, Dockerfile, generated nginx configuration, systemd unit, and an environment example.

Source branding belongs in `clients/public/<client>/`. Each client's build exposes its own files at the public root.
The release generator creates branding for new standard clients from their saved brand name.
Production builds force the production environment, even when the root development `.env` selects development mode.

Use Node 24 or newer with persistent disk storage. Each client gets a separate SQLite path and process.
The runtime initializes from the approved release, then serves profile, pages, and published blogs from SQLite.
Rendered responses and sitemap routes reflect the current SQLite publication. Unknown pages return HTTP 404.
The runtime rejects another site or tenant, altered content, conflicting sequences, and stale imports.
An older release does not overwrite a newer database publication. Enquiries survive application upgrades.
Do not put databases or backups inside a release or its public directory.

For a direct local check after preparation, set an absolute `CODEXSUN_SITES_DB` outside the release.
Set `CODEXSUN_SITES_ORIGIN=http://127.0.0.1:<port>` and `CODEXSUN_SITES_PORT=<port>`, then run `node runtime/server.mjs` inside the release.
For production, use the canonical HTTPS origin and the generated nginx/systemd or Docker configuration.
Use a different Compose project name for each client so its data volume remains separate.
Never remove the data volume during an application upgrade. Keep one writer process per client database.
The detailed installation, backup, and rollback steps are in [PLAN.md](agent/PLAN.md#node-and-sqlite-deployment-runbook).

This is manual, approved artifact delivery. Automatic remote sync, hosting promotion, deployment jobs, and monitoring remain planned.
The Node SQLite runtime is not a Cloudflare Worker deployment.
LogicX has a separate Worker adapter described below.
Media upload, rich text, custom page CRUD, and a visual builder also remain planned.

## Enquiries, maps, and WhatsApp

Contact forms submit to the same-origin `POST /content/v1/enquiries` endpoint.
The runtime validates fields and consent, checks origin and body size, applies a honeypot and rate limit, and saves the enquiry in that client's SQLite database.
A request key makes retries safe. Success returns an enquiry reference. No public enquiry-list endpoint exists.
Records are removed after 90 days. The operator can read or delete enquiries through the private management CLI.
Enquiry email notifications and remote enquiry transport are not implemented. Studio reads local or attached client stores directly.

```sh
node runtime/manage.mjs status
node runtime/manage.mjs enquiries
node runtime/manage.mjs delete-enquiry <reference>
node runtime/manage.mjs backup /absolute/private/path/new-backup.sqlite
```

These commands use `CODEXSUN_SITES_DB` and run on the trusted deployment host.
Protect SQLite files and backups. Do not publish enquiry exports or store backups in web directories.
Behind a reverse proxy, set `CODEXSUN_SITES_TRUSTED_PROXIES` to its exact socket IP and overwrite forwarded headers at that proxy.
Without this setting, rate limits use the proxy address rather than individual visitors.

Maps load only after the visitor chooses Load interactive map. A directions link remains available without an embedded map.
WhatsApp uses the saved override, or the client's first saved company phone in international format.
LogicX currently uses the user-approved `+91 96552 27738`. Its map searches the company name until an exact address is supplied.
Ramu Tex uses its saved company contact and brochure address. WhatsApp account availability has not been independently verified.
The privacy page describes enquiry handling and these external services.

## Development and verification

Run commands from the repository root. Use the root dependencies, lockfile, and `dist` directory.

```sh
npm run dev:api
npm run dev:web
npm run dev:logicx -w @codexsun/sites-clients
npm run dev:ramutex -w @codexsun/sites-clients
npm run typecheck -w @codexsun/sites-api -w @codexsun/sites-web -w @codexsun/sites-clients
npm run lint -w @codexsun/sites-api -w @codexsun/sites-web -w @codexsun/sites-clients
npm run build -w @codexsun/sites-api -w @codexsun/sites-web -w @codexsun/sites-clients
npm run test:cms -w @codexsun/sites-api
npm run test:runtime -w @codexsun/sites-clients
node --import tsx --test apps/sites/api/src/modules/site/site.runtime.test.ts
node --test apps/sites/clients/runtime/content/content-store.test.mjs
node tools/check-module-boundaries.mjs sites
npm run dependencies:check
npm run check:component-docs
npm run test:component-docs
```

For a standard client, set `CODEXSUN_SITES_CLIENT_SLUG` before `npm run build:portfolio -w @codexsun/sites-clients`.
Use `dev:portfolio` for manual development. Set `CODEXSUN_SITES_CLIENT_PORT` or pass `--port` to choose its port.
The authenticated Start action always uses the saved client port.
For MariaDB tests, set `CODEXSUN_SITES_TEST_MARIADB=1` with configured local test credentials.
The test creates and removes only its generated `codexsun_sites_cms_test_<hex>` database.
If the host serves an older optimized workspace bundle, restart the root Web development runner after refreshing its Vite dependency cache.

Public packages are `@codexsun/sites-api`, `@codexsun/sites-web`, and `@codexsun/sites-clients`.
Browser-safe API exports are `./page-contract`, `./page-content`, `./page-defaults`, `./blog-contract`, `./public-contract`, `./delivery-contract`, `./enquiry-contract`, and `./page-routes`.
The server-only `./delivery-integrity` export verifies publication checksums.
The server-only `./enquiry-runtime` export supplies SQLite submission persistence for the client runtimes.
Clients export the named LogicX and Ramu Tex surfaces. Web exports the overview, gateway, and site modules.
Report source checks, live database changes, browser verification, and production deployment separately.

## LogicX Cloudflare deployment

The production address is [logicx.codexsun.com](https://logicx.codexsun.com).
The dedicated Worker is `codexsun-sites-logicx` in account `a68cf61bf5bae3f83ddb7765dc29a835`.
Its custom domain manages the subdomain and TLS through Cloudflare.
Wrangler OAuth authenticates operator commands. No Cloudflare management token is shipped to the website.

The Worker serves 39 prerendered published routes and a bundled public-content projection.
It stores contact submissions in the dedicated `codexsun-sites-logicx` D1 database.
The Enquiry API leaf owns D1 persistence through the public `@codexsun/sites-api/enquiry-d1` export.
The adapter preserves consent validation, exact-origin checks, bounded bodies, honeypot handling, idempotency, and persisted rate limits.
SQLite triggers enforce the D1 insertion limit atomically. Daily cleanup enforces the 90-day retention policy.
The database identity must match the exported site UUID and opaque tenant/site key.

This is an operator deployment of a trusted Studio export. Saving or publishing inside Studio does not redeploy the Worker.
The existing Studio inbox reads attached SQLite stores. It does not read this remote D1 database.
Operators can inspect D1 through authorized Wrangler commands. There is no public inbox or administration endpoint.
No email notification or remote inbox synchronization is implemented.

Run from the repository root after obtaining a fresh authenticated LogicX deployment export:

```powershell
npm run prepare:deploy -w @codexsun/sites-clients -- --snapshot D:/path/to/logicx-export.json --origin https://logicx.codexsun.com
node --import tsx apps/sites/clients/cloudflare/prepare.mjs
npm run test:d1 -w @codexsun/sites-api
wrangler whoami
wrangler deploy --config apps/sites/clients/cloudflare/wrangler.jsonc --dry-run --outdir D:/workspace/codexsun/dist/apps/sites/cloudflare/dry-run
wrangler deploy --config apps/sites/clients/cloudflare/wrangler.jsonc
node apps/sites/clients/cloudflare/verify.mjs
```

First-time setup creates the dedicated D1 database and applies `dist/apps/sites/cloudflare/logicx/migration.sql` with `wrangler d1 execute --remote --file`.
This database and its schema were created for the initial deployment on 17-10-2026.
For future schema changes, back up D1 and review the migration before applying it.
Do not recreate or delete D1 during a site content upgrade.
Use an absolute dry-run output path because Wrangler resolves it relative to its configuration directory.
Generated files stay under root `dist`. Local Wrangler state is ignored.
The publication export remains outside the public asset directory.
Rollback uses `wrangler rollback --config apps/sites/clients/cloudflare/wrangler.jsonc` after checking schema compatibility.
Retain the prior release, export, and Worker version before future updates.

For packaged HTTP verification, prepare both named releases, set `CODEXSUN_SITES_RELEASE_TEST=1`, and run:

```sh
node --import tsx --test apps/sites/clients/runtime/runtime.test.mjs
```

Unit and packaged runtime tests use temporary databases. Live browser verification removes only its own test enquiries.
The current release packages were verified on Node 26. Docker, systemd, real TLS, DNS, and external hosting were not exercised here.

Local client previews accept request headers up to 256 KiB to accommodate shared development-host cookies. This applies to the three client dev scripts and Studio Start. Restart an existing preview after updating the scripts.


## LogicX design and marketing content

Open LogicX Manage, select Pages, then select Design & marketing.
The editor owns local hero and approach media, action labels, technology labels, featured service order, and service preview image mappings.
It also owns section headings, example workflows, industries, engagement options, FAQs, and the closing banner.
Use the Hero, About, Services, Process, Responsibility, Applications, and client profile editors for their existing shared content.
Save draft preserves changes without publishing them. Publish page updates the client projection through the existing delivery flow.

Marketing data is an optional typed field in the existing page JSON aggregate.
Existing pages and publications remain compatible. No SQL table alteration is required for this field.
Image references use the deployed LogicX asset allowlist. The editor does not upload assets or accept external image URLs.
The software panel contains labeled demonstration figures. The website makes no unsupported customer, rating, or project-count claims.

The original architectural photograph is stored as an optimized WebP under `clients/public/logicx/design`.
It was created with the built-in image generator for this project. No vendor theme photographs are embedded.
The saved visual reference and the full design plan are in `agent`.

LogicX branding uses the supplied vector geometry stored in clients/deploy/logicx-mark.svg. The branding generator creates public light/dark lockups, standalone marks, favicons, app icons, and the social image. The original master is preserved; generated assets use the approved forest green and mint palette.


The growth sections use an original generated textile-workshop WebP and the existing generated architectural image as decorative backdrops. Manage their images or hide them through Pages > Design and marketing > Section backdrops. Images stay within the client asset allowlist.


## Ramu Tex portfolio presentation

Ramu Tex uses an ivory, ink-blue, and copper palette across Home, About, Services, Contact, Journal, and Privacy.
The client owns its shared header, footer, reading pages, responsive layouts, and illustrative material images.
Existing published profile, processing, finishing, responsibility, contact, and blog data remain the content source.
The journal shows an empty state until articles are published. The template does not invent client work or company statistics.
Build with `npm run build:ramutex --workspace @codexsun/sites-clients` from the repository root.
The result is a client build. External hosting and a current published delivery export require separate verification.

## Ramu Tex and shared Cloudflare delivery

Ramu Tex is published at https://ramutex.codexsun.com with its own `codexsun-sites-ramutex` Worker.
Its D1 database is `codexsun-sites-ramutex`, ID `1e5f1379-1433-490d-9317-dd8d3d308200`.
The initial cloud release uses authenticated export sequence 19 and six published routes.
LogicX was refreshed from current source and authenticated export sequence 18.
The common Worker transport uses separate entry points, host checks, published projections, and D1 bindings.

After preparing the Ramu Tex release with `--origin https://ramutex.codexsun.com`, run:

```powershell
node --import tsx apps/sites/clients/cloudflare/prepare.mjs ramutex
wrangler deploy --config apps/sites/clients/cloudflare/wrangler.ramutex.jsonc --dry-run --outdir D:/workspace/codexsun/dist/apps/sites/cloudflare/dry-run-ramutex
wrangler deploy --config apps/sites/clients/cloudflare/wrangler.ramutex.jsonc
node apps/sites/clients/cloudflare/verify.mjs ramutex
```

For LogicX, use `prepare.mjs logicx`, `wrangler.jsonc`, and `verify.mjs logicx`.
Run `node --import tsx --test apps/sites/clients/cloudflare/worker.test.mjs` to check host isolation and route handling.
Preserve each client's D1 database during updates. Never copy an enquiry database or publication identity between clients.
The Ramu Tex brochure, artwork, fonts, canonical metadata, and public pages are included in its release.
The Studio registry label update was blocked by the local API being offline after export. Cloudflare DNS and publishing succeeded.

Ramu Tex includes a template-owned fabric guide for knitted hosiery and polyester sportswear.
Home introduces both fabric groups. Services covers ten constructions, garment applications, quality checkpoints, and sample briefs.
Contact links prefill the selected fabric. These editorial sections do not change saved publications or imply stock availability.
Four original illustrative images have 1200px and 640px WebP variants with lazy loading and responsive selection.

### Latest Ramu Tex deployment - 17-10-2026

Ramu Tex now serves the hosiery and polyester sports fabric guide with all four new images and their mobile variants.
Worker version: `477f103f-db36-4110-9e58-373ff6fb77d4`. Authenticated export sequence: 21.
All six live pages passed viewport checks at 320, 390, and 430px.
A live mobile enquiry persisted in D1. The synthetic test record was moved to recoverable trash.
The Studio domain label now matches `ramutex.codexsun.com`.
Physical mobile-device testing was not performed.
