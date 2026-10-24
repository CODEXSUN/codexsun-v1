# Platform tasks

## Future staged deployment routing

Planning only. No production routing or container change is included in this work.

- [ ] Create an isolated staging environment with its own Tunnel, router, databases, Redis, media storage, secrets, and sandbox integrations.
- [ ] Add a Traefik router behind Cloudflare Tunnel. Keep Cloudflare Tunnel as the public edge and preserve incoming custom-domain hosts.
- [ ] Add Blue/Green composed Platform API, Web, and Shop slots with immutable image-digest promotion, readiness checks, controlled upstream switching, and rollback records.
- [ ] Separate queue worker execution before running concurrent Blue and Green application slots.
- [ ] Require expand-contract migration review, backup verification, staging evidence, and production smoke checks before a slot switch.

## Data Bridge combined import queue

- [x] Compose the Data Bridge bulk import processor through its public owner contract, with tenant/run context validation and a fixed Queue Manager payload for database and BullMQ backends.
- [x] Verify the authenticated Common Tables button creates a real database queue job that completes with a persisted 31-table success report for local SUKRAA. BullMQ dispatch uses the same contract; live Redis execution was not tested.

## Marketing integration backlog — 2026-10-23

Planning alignment is complete. The following implementation tasks remain open.
See [Marketing contracts and gaps](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), G07.

- [ ] Plan Marketing registration, entitlement, permissions, ordered migration/seed composition, and bounded automation principal.
- [ ] Design tenant-safe provider account claim registry, OAuth state, callback mapping, file projections, and secret rotation.
- [ ] Specify queue fencing, cancellation, tenant fairness, activation dependencies, suspension, and forged-context tests.

Acceptance requires the owner contract, denied-access cases, retry behavior, and exact evidence in this task log.
No implementation or live validation is claimed by this planning update.

## Inbound-only Frappe scheduling — 2026-10-23

- [x] Schedule full enquiry history when no successful source checkpoint exists.
- [x] Schedule incremental imports from that checkpoint with a replay overlap.
- [x] Suppress scheduled enquiry exports and enquiry outbox dispatch in inbound mode.
- [x] Preserve old queued outbound work without sending it in inbound mode.
- [x] Keep manual inbound history imports separate from optional explicit exports.
- [x] Test inbound policy and actual database queue retry behavior with retained source records.
- [ ] Verify continuous scheduling and Redis delivery after deployment.

## CRM Frappe verification authorization — 2026-10-22

- [x] Authorize Frappe call-log verification with the CRM call-log read permission, while retaining connection management authorization and server-side tenant/connection checks.
- [x] Keep the existing Frappe export policy as the final gate; verification does not authorize outbound call-log export.
- [x] Provide tenant-scoped latest verification status lookup for up to 100 records, with per-kind CRM read authorization and tenant database matching.
- [x] Verify Platform API typecheck, lint, build, and CRM/Platform module boundaries.

Release 1.1.43 is deployed from commit `4007dfd66f089157a3c92f6b5cee93b185ad2398`. Container and public route checks passed. No database migration was required.

## Custom-domain login without Corporate ID — 2026-10-21

- Login context hides Corporate ID for active, verified custom-domain mappings; the existing web form uses this API flag.
- Login and recovery select the mapped tenant on the server. Shared hosts still require Corporate ID; unknown hosts, inactive tenants, changed mappings, and mismatched supplied IDs are rejected.
- Tenant login accepts either email or an optional unique username; the tenant user form supports creating and changing usernames. Email remains required for password recovery.
- Existing tenant databases receive a nullable unique username column through an idempotent Platform runtime migration.
- Added disposable MariaDB login/recovery target regression coverage; tests do not send mail or create live users.
- Deployment and live browser proof are pending.

## CRM own-record role composition — 2026-10-21

- Composed CRM's administrator ceiling into active tenant permission resolution; stale broad grants cannot widen enquiry/task scope for non-admin roles.
- Added the editable Team Head role without assigning users. Existing custom labels survive reseeding.
- Hid Contact 360 permission/assignment entries from Access Control lists and permission pickers through the CRM public contract.
- Platform typecheck/lint and Platform/CRM/Core boundaries passed. Disposable MariaDB tests verify active role resolution, revoked roles, custom labels, and hidden permission lists.
- TECHMEDIA access repair and API hotfix are live. Team Head has zero assigned users; Admin tenant-wide reads remain allowed and User tenant-wide reads are denied. Business rows and other tenant access assignments were not changed.

## Frappe identity audit composition — October 20, 2026

- [x] Expose the read-only Frappe identity audit through the tenant Frappe navigation and page registry.
- [x] Retain the Frappe connection permission check and permit audits after the initial import lock without bypassing import restrictions on any other route.
- [x] Keep audit calls tenant-scoped and use the saved verified connection; no secrets are exposed to the web client.
      Local package typechecks and CRM/Frappe tests passed. Authenticated browser and production verification remain open.

## Main-menu CRM reminder notifications — October 20, 2026

- Removed the separate CRM header bell and routed CRM due reminders into the Platform main-menu notification control.
- Added a Platform notifications adapter that reads and acknowledges reminders through the CRM scheduler's public API; CRM remains the persisted source of truth.
- Selecting a notification opens its linked CRM record or module. No separate notification store or external delivery channel is created.
- Added explicit Platform Vite aliases for the CRM scheduler module and service public entries after `dev:web` exposed unresolved scheduler imports.
- Checks passed: Platform, CRM, and UI typecheck/lint; Platform and CRM module boundaries; CRM scheduler and notification-link tests (6 passed).
- Browser/runtime E2E verification was not run.

## Sports Club multi-tenant composition & Tenkasi Sports integration — October 19, 2026

- Composed `@codexsun/sportsclub-api` and `@codexsun/sportsclub-web` in Platform runtime.
- Removed synthetic domain verification in `tenkasisports-tenant.ts`; domain mapping strictly requires real ownership evidence (`domainVerificationTokens`).
- Replaced dynamic import error swallowing in `tenant-app-database.ts` with direct, fail-closed invocations of `migrateSportsclubDatabase` and `seedSportsclubDatabase`.
- Bound sportsclub routes and public Cloudflare Worker portal prefix `/public/portals/tenkasisports` in `sportsclub-host.ts`.
- Enforced single database transaction (`db.transaction().execute`) on `/public/sportsclub/registration`, requiring student-selected passwords and stripping credentials before member enrollment.
- Explicitly restricted inconsistent public aliases (`/student/register`, `/sportsclub/public/enroll`, `/sportsclub/public/registration`) to fail closed with 403 Forbidden.
- Conducted read-only release audit: verified unprovisioned local `TENKASISPORTS` tenant, uncreated `codexsun_sportsclub_tenkasisports` DB, unseeded roles, and live 404 health status. Blocked deployment due to dirty concurrent working tree.
- Verified gates: `typecheck` (API + Web), `lint` (API + Web), 12 focused platform tests in `sportsclub-platform.test.ts`, and module boundaries.

## TConnect public discovery composition — October 17, 2026

- Added fixed credential list/create/update adapters to the TConnect gateway and composed its app-owned staff Credentials tab.
- Kept evidence review, publication, permissions, and persistence in TConnect.
- Platform web type checking passed. Local buyer and seller login, quotation comparison, and messaging browser journeys passed.

## Responsibility

The authenticated runtime, tenant routing, application composition, entitlements, permissions, queues, storage, administration, and Windows host.

Composition registers public app contracts. Business CRUD stays in each owner. Preserve Corporate ID resolution, signed session context, live authorization, and server-only secrets.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected Platform source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

### Data sync navigation and unified CRM schedule notices

- Moved Database Settings, Migration Mapper, and Migration Analysis under the first Super Admin Data sync group.
- Added Transfer Review as a separate Data sync page for choosing a saved migration and reviewing its saved transfer plan.
- Data Migration from Super Admin Apps opens Migration Mapper; Database Settings has no page shortcut to Migration Mapper.
- Platform notification titles use the first line of CRM schedule notes, and notification dates use the scheduled time.
- Passed the full repository check and the Platform CRM notification mapper tests. Production verification remains pending.

### Company image branding formats, 21-10-2026

- Storage Manager accepts SVG, PNG, JPEG, WebP, AVIF, GIF, ICO, and BMP Company branding images.
- The upload endpoint detects the file format from its content. It does not trust the browser filename or MIME type.
- SVG files reject scripts and external content. SVG files are limited to 640 KB. Raster image files are limited to 5 MB.
- Existing SVG asset paths remain readable during the change.
- The custom-domain login page and public home page use the Default Company name.
- Public tenant pages and their logo, dark logo, and favicon read the same-origin browser host. Only an active, verified custom domain can select its tenant. A forwarded-host request header cannot select another tenant.
- Host parsing now uses a separate module, so public routes cannot create an authentication import cycle.
- Passed: all 47 Platform API tests, Platform and Core typechecks, lint, builds, the Core and Platform boundary checks, and focused company-form tests. Live page and deployment checks remain pending.

### Tenkasi Sports targeted local provisioning and registration hardening, 19-10-2026

- Hardened canonical `/public/sportsclub/registration` to use a single tenant database transaction (`db.transaction().execute`) for both `services.member.enroll` and `context.provisionStudentIdentity`, failing closed with internal error if `db.transaction` is unavailable.
- Required a student-selected password (12–128 characters, trimmed) via `publicStudentRegistrationSchema`, stripped `password` prior to member enrollment, and eliminated random password fallback from `resolveContext`.
- Restricted inconsistent public aliases: `/student/register`, `/sportsclub/public/enroll`, and root `app` direct member enrollment fail closed with `AppError.forbidden` (HTTP 403).
- Completed safe targeted local provisioning for `TENKASISPORTS`:
  - Tenant registry: `id: 2`, `corporateId: "TENKASISPORTS"`, `slug: "tenkasisports"`, `status: "active"`, `enabledModuleKeys: ["platform.application", "sportsclub"]`, with `CODEXSUN` (`id: 1`, `codexsun_db`) fully preserved.
  - Dedicated database: created and migrated `codexsun_sportsclub_tenkasisports` with all sportsclub tables (`sportsclub_members`, `sportsclub_programs`, `sportsclub_events`, `sportsclub_sessions`, `sportsclub_masters`, `sportsclub_enquiries`, `sportsclub_activity`, `sportsclub_progress`, `sportsclub_attendance`) and tenant runtime tables.
  - Roles & Auth: seeded active roles `portal.sportsclub-student` (self-scoped, 0 backoffice perms), `sportsclub.master`, and `sportsclub.admin`. Direct portal identity creation and credential hashing verified on tenant DB.
  - Domain mapping: `tenkasisports.com` mapped to tenant in pending verification status; real token evidence required before production ownership activation.
- Canonical Fastify host & real tenant DB registration verified:
  - Injected `POST /public/portals/tenkasisports/public/sportsclub/registration` via in-process Fastify host with full student payload (name, email, phone, dateOfBirth, gender, address, emergencyContact, medicalNotes, password).
  - Reached actual Fastify handler and returned HTTP 200 with `{ corporateId: "TENKASISPORTS", userUuid, memberUuid }`.
  - Verified real DB read-back in `codexsun_sportsclub_tenkasisports`:
    - `sportsclub_members`: row persisted with `role: "student"`, `status: "pending"`, matching full student profile.
    - `app_users`: row persisted with `status: "active"` and `password_hash` encoded as standard PBKDF2 hash scheme; plain text password confirmed absent; `verifyPassword` verified hash validity.
    - `app_user_roles`: row persisted with `role_key: "portal.sportsclub-student"` and `status: "active"`.
  - Duplicate registration injection returned HTTP 409 Conflict ("You already have a club membership.") with full transactional rollback (zero partial rows created).
  - Provenance audit & fixture cleanup: confirmed baseline records (1 seeded user `admin@tenant.com`, 1 seeded member `kabilan@tenkasisports.test` from `member.seed.ts`, and 1 seeded user role) were preserved intact; carefully deleted only the test student fixture; read-back verified exactly 0 stray test records remain in `app_users`, `app_user_roles`, or `sportsclub_members`.
- Quality gates: 12 focused platform unit tests passed in `sportsclub-platform.test.ts`, `lint` (API + Web), `typecheck` (API + Web), and module boundaries passed.

### Queue worker automatic pickup, 18-10-2026

- `npm run test:queue-live` enabled the actual Queue Manager runtime and verified database jobs and a reports artifact complete without manual worker calls.
- The same runtime switched to BullMQ/Redis and completed a persisted queue job. Redis was required for the test; its temporary local container was removed afterward.
- The local environment uses the database backend with `CODEXSUN_QUEUE_WORKER_ENABLED=1` and a configured Redis URL for the alternative backend.
- This verifies generic queue delivery only. CRM Enquiry-to-Frappe remains deliberately stopped pending approval of the outbound-sync scope; the configured tenant DB also lacks `crm_enquiries`, so the separate CRM outbox E2E could not run here.

### Existing tenant administrator access, 17-10-2026

- User-role seeding assigns Admin to every active legacy Admin, rather than only the first matching account. Inactive users are excluded.
- Repaired the missing Admin assignment for the active TECHMEDIA administrator. Synchronized Core's existing Admin grants in TECHMEDIA and RAINBOW.
- Live backend authorization passed view, create, update, delete, and lifecycle checks for all three active TECHMEDIA administrators and the active RAINBOW administrator. Inactive users were unchanged.
- Browser retry remains to be verified. This repair does not grant Core access to the standard User role.

### Multi-tab header recovery, 17-10-2026

- API requests allow bounded 64 KiB headers. Web and shop nginx align request and upstream-response buffers.
- Invalid encrypted cookies expire without clearing valid sessions from other tabs. Successful login replaces only an explicitly selected previous session.
- Nine focused cookie/header tests passed, including real HTTP acceptance and overflow rejection. The nginx configuration passed validation and the running proxy reload completed. Final API image rollout remains pending.

### Loading release preparation, 17-10-2026

- Migration CLI skips only unprovisioned non-active tenants. Invalid active or configured targets still block release. Registry read failures no longer become an empty migration target list. Two target-selection tests pass.

- Startup reads now have a 15-second deadline without automatic write cancellation or write retries. Tenant desk code downloads alongside session verification. Authentication still gates protected rendering.
- Login and recovery pages use narrow shared UI imports. Pure app workspaces load lazily, and the host consumes the small Chat navigation contract.
- The CODEXSUN shop mapping now passed public DNS token verification. Its existing Ecommerce entitlement remains unchanged.
- Version 1.1.7 passed the full repository check, version alignment, 31 focused release tests, and 15 deployment/runtime/persistence contract tests. The local clean-all build is blocked by a Windows dist file lock. Production rollout is pending at commit preparation.

### Loading and flow review, 17-10-2026

- The global loader now imports its own small stylesheet. It preserves theme fallback colors, logo dimensions, CSS layer order, and one visible theme variant before application styles load. Local Chrome verified fixed positioning and one visible logo.
- Repository type checking completed 95 tasks. Repository lint completed 49 package tasks. Boundaries, component documentation, dependency layout, 37 focused frontend/backend tests, and the Platform web production build passed. Some repository task results used cache.
- The full repository check stopped at stale generated Docs. Bundle warnings and serial loading phases remain review findings.
- The live shop domain did not resolve to a tenant. Its bootstrap, branding, catalog, and Blog paths returned 404. No domain, entitlement, or data changes were made.
- Release operations are paused at the user request. The loader change is local only. Full findings and coverage limits are in dist/reports/codexsun-loading-review-2026-10-17.html.

### Public homepage startup deployment, 17-10-2026

- Deployed focused startup fixes to codexsun.com using an isolated production-baseline build. API, web, and the unchanged shop containers are healthy. Original images remain available for rollback. Database volumes, tenant permissions, and publication settings remain unchanged.
- Runtime configuration and application code load in parallel. The small entry loads the renderer asynchronously. Initial compressed bootstrap JavaScript fell from 72.3 KB to about 2.5 KB; the full application still loads asynchronously.
- Homepage HTML has zero blocking external stylesheets and a direct, preloaded hero image. Workspace routes use a separate 516-byte HTML document and do not download the homepage hero.
- HTML revalidates on refresh; hashed assets retain immutable caching. Normal refresh loaded the deployed entry. Previously cached tabs can require one hard refresh.
- Read-only production inspection confirmed the active CODEXSUN tenant and disabled Blog module. Public portal responses expose availability. Disabled homepage stories skip their code and requests; the Blog page displays an availability message. Canonical or verified production domain checks remain enforced.
- Browser baseline first paint was 1.72 s and initial largest-content paint was 2.71 s. The latest complete cold navigation measured 0.61 s and 0.93 s. Valid final samples ranged from 0.61–1.05 s and 0.93–2.63 s without artificial throttling. Network timing varies; these are samples, not guaranteed scores.
- Failing Blog requests fell from two to zero. Login and login refresh retained the form and route, with no homepage hero or Blog requests. Anonymous session checks can still return an expected nonblocking 401.
- The existing carousel remains. A longer sample produced a later 10.32 s LCP candidate after autoplay; initial-screen measurements do not remove that caveat. The trace did not classify long tasks or establish leak-free behavior.
- The app_modules type error is cleared in current source through the correctly typed app_module_settings query. The API production build passed. Nine focused startup, workspace-document, and Blog contract tests passed, along with Platform web type checking, lint, module boundaries, component documentation, and isolated production web builds.
- The repository dependency-layout check is currently blocked by the unrelated apps/tconnect/web/dist directory from concurrent work. No authenticated business transaction or full application regression was performed.
- Detailed measurements and remaining loading costs are in dist/reports/codexsun-startup-2026-10-17.html and its JSON companion. Stories require explicit Blog activation before publication can be served.

### Development stability and completed accessible-list audit, 17-10-2026

- Duplicate startup now defaults to abort. It leaves existing listeners and launchers running. Replacement requires an explicit takeover policy.
- Cache cleanup refuses deletion while a registered development launcher remains alive. Preview mode still works.
- Platform web prepares shared UI dependencies upfront and deduplicates React, React DOM, and React Query.
- Live duplicate web startup preserved the listener. The runtime configuration proxy returned 200 afterward.
- Fifteen startup and cleanup tests passed. Platform and Billing web typecheck and lint passed. Dependency layout passed.
- Browser checks reached every enabled CRUD list, Core Common/Master list, report, and settings page in the current tenant.
- Six reports and Opening Balances still lack the standard list toolbar. Reports retain their large headers and Refresh actions.
- Export Sales was disabled. Empty and protected lists did not provide editable records. Some API restart windows required setup retries.
- Generated results are in `dist/reports/application-list-audit-2026-10-17.json`. Earlier partial-audit notes below remain historical evidence.

### List browser audit and shared form context, 17-10-2026

- Platform web resolves the shared UI package to one source directory and excludes it from dependency prebundling. Inline forms and the application header now use the same navigation context.
- Chrome confirmed Financial Years opens inline and sidebar navigation offers Keep editing and Discard changes.
- Browser checks covered the five access lists, Company, Financial Years, the five enabled Billing entry lists, five location lists, two account lists, four contact common lists, and Product Groups. Search, column search, filters, badges, columns, and New-form navigation were exercised. Existing editable records also retained Edit mode after refresh.
- Billing entry lists were empty. Ledger Groups and Ledgers exposed protected records only. Edit checks for those lists remain unverified.
- Product Categories later passed New/Edit refresh and Keep/Discard after browser recovery. Product Types failed to load before testing. The web server then refused connections again.
- The remaining product, work-order, other common, master, report, and settings screens remain unverified.
- Some development-module downloads failed during refresh and required another reload. This audit does not certify an error-free full browser run.
- Platform and Core web typecheck and lint, nine startup contract tests, and dependency layout checks passed. No business records or permissions were saved.

### Development launcher recovery, 17-10-2026

- Preflight checks for previous service launchers before accepting a free port. A launcher remains the owner during API startup and restart gaps.
- Existing takeover policy and graceful shutdown apply before the replacement starts.
- Live startup stopped the previous API launcher while port 7010 was free. The replacement served runtime configuration, development login, and session validation successfully.
- Nine development-stack contract tests, script syntax, dependency layout, and whitespace checks passed.

### Browser login recovery, 17-10-2026

- Session checks preserve browser session metadata when the API is unavailable and offer Retry on the current page.
- An expired-session redirect stops development auto-login from starting another automatic round trip.
- The expiry interceptor handles only Platform API responses and ignores responses from an older browser session selector.
- Platform web typecheck, lint, and six focused session tests passed. Regression coverage includes API outages, external responses, and stale session responses.
- Chrome verified that an API outage kept the workspace URL, Retry restored the workspace, and refresh kept the authenticated overview. The expired-session page stayed on login; a normal login visit still completed default development sign-in.

### Development login header recovery, 17-10-2026

- Default-user development login reuses one cookie slot per user, tenant, and host.
- It removes obsolete cookies for that identity and invalid session cookies. Valid other-user and other-tenant cookies remain available.
- Normal login keeps separate tab slots. Development login still requires the existing environment and tenant checks.
- Local development servers accept 256 KiB headers so old cookies can reach cleanup without HTTP 431.
- Passed 16 cookie and development-startup regression checks, including 100 repeated development logins without cookie growth.
- Passed Platform API lint, Platform module boundaries, component documentation checks and tests, and the root dependency layout check.
- Initial Platform API typecheck and build passed. A later full rerun stopped at a concurrent `tconnect-host.ts` nullable Corporate ID type error.
- Chrome recovered an HTTP 431 tab through default-user login and opened Application overview. A full refresh restored that same page without HTTP 431.
- A second default-user automatic login returned to Application overview. Browser evidence: `codexsun-http431-recovered.png` in the local temporary directory.
- No database schema, production login, or permission checks changed.

### Application overview refresh, 16-10-2026

- The overview uses the current company, financial year, landing app, tenant name, and available app list.
- Application, Access Control, and Organisation shortcuts open their existing workspaces.
- Available apps and add-ons open their own workspaces. The obsolete fixed two-app count was removed.
- The overview uses light surfaces and responsive cards in a separate desk component.
- Platform web typecheck, lint, and Platform boundaries passed. Authenticated browser appearance remains unverified.
- No API, permission, or database contract changed.

### API startup migration imports, 16-10-2026

- Tenant runtime composition imports sibling migration files directly instead of loading module indexes with services and routes.
- This removes the startup cycle that accessed `tenantMigration` before initialization.
- `npm run dev:api` completed database bootstrap and started the API on port 7010.
- `/public/runtime-config` returned HTTP 200.
- Platform API typecheck, lint, Platform boundaries, component documentation checks, and dependency checks passed.
- Migration keys and database statements did not change. No database migration is required for this fix.

### Tenant Settings app cards, 16-10-2026

- New and edit Settings show all tenant apps from the registry. Admin-only developer tools remain excluded.
- Registry updates refresh the cards without replacing the current toggle choices.
- Application, CODEXSUN, and Billing appear first. Cards use a light background.
- Super Admin overview cards use the Settings icon, title, and description pattern. Each card still opens its own details.
- Formatting, lint, Platform boundaries, component documentation checks, and dependency checks passed.
- The build stopped at an unrelated Ecommerce Storefront Organisation type error for missing `displayName` and `logoFileName`.
- Authenticated browser verification remains pending. No database migration is required.

### Super Admin submenu list reset, 16-10-2026

- Sidebar navigation starts a new workspace instance, including repeated clicks on the active submenu.
- List workspaces return to their initial list instead of retaining an open detail or form.
- Navigation clears record search parameters and preserves the selected Zetro tenant context.
- Passed: Platform web typecheck, lint, and Platform boundary check.
- Authenticated browser verification remains pending. No database migration is required.

### Super Admin overview app catalog, 16-10-2026

- The overview keeps the Platform runtime card and adds database-backed app cards from `/admin/apps`.
- Application, CODEXSUN, and Billing appear first. Notes and Chat appear under Add-ons.
- Each app card opens its own details through `/sa/app-operations?app=<appId>`.
- Cards and details use the app color. Details show registry settings and shared Platform service health.
- Details do not grant tenant access or report independent service health.
- Passed: Platform web typecheck, lint, build, Platform boundary check, component documentation checks, and dependency layout check.
- Browser verification reached the Super Admin login screen after session expiration. Authenticated layout verification remains pending.
- No database migration is required.

- `node tools/check-module-boundaries.mjs platform`
- `npm run typecheck -w @codexsun/platform-api`
- `npm run lint -w @codexsun/platform-api`
- `npm run build -w @codexsun/platform-api`
- `npm run typecheck -w @codexsun/platform-web`
- `npm run lint -w @codexsun/platform-web`
- `npm run build -w @codexsun/platform-web`
- `npm run typecheck -w @codexsun/windows`
- `npm run lint -w @codexsun/windows`
- `npm run build -w @codexsun/windows`

Use `npm run check:component-docs` for this documentation contract.
Run applicable tests before marking implementation work complete.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.

## Billing compliance queue host, October 16, 2026

- Platform relays Sales and Export Sales tenant outboxes through Queue Manager. Payloads contain trusted registry database names and operation identifiers; invoice snapshots and credentials stay out of queue payloads.
- Dispatch validates the active registry tenant, database match, enabled owner module and current actor compliance permission. Billing owns provider submission, recovery, cancellation and invoice locks.
- Queue claims use conditional updates. Stale Billing queue jobs expire for owner reconciliation. API close stops the relay.
- Passed Platform API type check, lint and build, Platform boundaries, and the full Platform web build. Browser sandbox generation/cancellation exercised the database queue backend. Redis recovery remains unverified.

### Role permission Access Control page, 17-10-2026

- Application navigation places Access Control after Role Permissions. Both pages remain available.
- The role-permission owner provides the role selector and grouped permission checkboxes, using the Techmedia page as a visual reference.
- Checkboxes save immediately through existing tenant role-permission APIs. Select all and Clear all skip protected assignments and inactive permissions.
- Existing inactive assignments reactivate instead of creating duplicate rows. Clearing a permission deactivates its assignment.
- Backend authorization, tenant isolation, protected records, and audit behavior remain unchanged. No database migration is required.
- Bulk changes run individually. On failure, the page reports completed changes and reloads authoritative data.
- Passed: Platform API and web typechecks, web lint and production build, Platform boundaries, component documentation checks, and dependency layout checks.
- The new navigation regression passed. The menu test file has an unrelated Frappe expectation failure for Live sync entries.
- Authenticated browser appearance and live database mutation verification remain pending.

### Access Control permission filters, 17-10-2026

- Searchable App and Module lookups appear above the permission groups.
- Options come from loaded permission keys. Module options follow the selected app, and changing App clears Module.
- Select all shown and Clear all shown affect only filtered permissions. The enabled count reflects the filtered list.
- Existing role selection, protected assignments, backend authorization, and immediate persistence remain unchanged.
- Passed: Platform web typecheck, lint, production build, Platform boundaries, component documentation checks, and dependency layout check.
- Authenticated browser verification remains pending. No database migration is required.

### Access Control module cards, 17-10-2026

- Each permission module has one card with its available action checkboxes arranged together.
- Cards use a responsive grid instead of horizontal app columns. Update actions display as Edit.
- Permission keys supply the actions. The UI does not add actions absent from the backend permission list.
- App and Module filters, immediate saves, protected assignments, and filtered bulk actions remain available.
- Passed: Platform web typecheck, lint, build, Platform boundaries, component documentation checks, and dependency layout check.
- Browser verification remains pending. No API or database change is required.

### Module Select all checkbox, 17-10-2026

- Each module card includes a Select all checkbox. It enables or disables the module's editable permissions through existing audited APIs.
- The checkbox shows a mixed state for partial selection. Protected assignments and inactive permissions remain unchanged.
- Cards without editable permissions disable the module checkbox.
- The top page title, description, and Refresh button were removed. App and Module filters remain available.
- Passed: Platform web typecheck, lint, build, Platform boundaries, component documentation checks, dependency layout check, and diff whitespace check.
- Authenticated browser and live permission mutation checks remain pending. No API or database change is required.

### Browser verification and checkbox-only module action, 17-10-2026

- Module headers show only the right-aligned checkbox. Accessible names and tooltips remain available.
- Browser verification used the unassigned Access Control Browser Check role on the local tenant.
- CRM Contact Create, View, Edit, and Delete all enabled from the module checkbox and remained enabled after a full reload.
- All four disabled from the module checkbox and remained disabled after a second full reload.
- Re-enabling existing inactive assignments passed. Disabling Edit showed the mixed module state. Clicking the mixed checkbox enabled Edit again.
- The test ended with all four permissions inactive. The unassigned verification role was suspended through the Roles UI.
- Admin protected assignments and their module checkbox remained disabled. Existing users and their role assignments were unchanged.
- Passed Platform web typecheck, lint, Platform boundaries, component documentation checks, and dependency layout checks.

### Access Control panel header cleanup, 17-10-2026

- Removed Select all shown and Clear all shown buttons, the role permissions heading, and its description.
- App and Module lookups are the first controls in the permission panel. Role selection and module checkboxes remain available.
- Passed Platform web typecheck, lint, and Platform boundaries. No API or database change is required.

### Compact Application lists and navigation, 17-10-2026

- Users, Roles, Permissions, User Roles, and Role Permissions render New actions in the application header. List titles, descriptions, and Refresh actions were removed from the canvas.
- Application and Core breadcrumbs show the module directly. Common Masters and Organisation use the same header action target.
- Search, status, page, page size, hidden columns, and column searches use ordinary query strings. The five access forms now have /new and /:id/edit paths.
- Sidebar navigation resets the list, including repeated clicks. New/Edit routes and changed forms use the existing Keep editing / Discard changes dialog.
- Browser checks visited all 41 access, Organisation, Master, and Common Master list URLs. Each exposed New in the header, the column-search toggle, Filters, and Columns, without a canvas list title.
- Browser checks confirmed Roles column search, Columns, a counted status badge, and persistence after refresh. Permissions search survived refresh. Sidebar clicks cleared list queries.
- Roles New and Auditor Edit routes survived refresh. Keep editing retained the unsaved text. Discard changes returned to a clean list. Country New used the application header and route-owned form panel. No business records or permission assignments changed.
- Passed: Platform web/API typechecks, web lint and build, Platform boundaries, four router/query tests, component documentation checks, and dependency layout check.
- No API, authorization, or database schema changed. No migration is required.

### TConnect composition, 17-10-2026

- Added the TConnect app registry contract, tenant migration composition, public tenant resolver, API host, and staff workspace.
- TConnect owns all business records. Platform supplies sessions, active app checks, and authorization.
- Final verification evidence is recorded in `apps/tconnect/agent/TASK.md`.

### TConnect member identity and desk, 17-10-2026

- Added public, transaction-compatible tenant-user, tenant-role, and role-permission contracts for restricted portal provisioning.
- The TConnect host injects a fixed portal role policy. Registration payloads cannot choose privileges.
- Added a dedicated Platform member desk and TConnect login destination. The member entry skips development admin auto-login.
- Existing Corporate ID checks, password hashing, session cookies, per-tab slots, and normal desk login behavior remain authoritative.
- TConnect owns all member records and company, product, affiliation, and enquiry checks.
- Verification evidence is recorded in `apps/tconnect/agent/TASK.md`.

### TConnect buyer composition, 17-10-2026

- Added a separate fixed buyer role and signed-user buyer scope in the TConnect host.
- Shared login selects the dedicated buyer shell with `app=tconnect&account=buyer`.
- Session expiry retains the buyer login destination. Platform owns shell composition; TConnect owns business forms.
- Browser buyer login and live buyer/member E2E suites passed. Platform API/web builds, typechecks and lint passed.
- Aliased TConnect source and excluded it from development dependency prebundling to avoid stale app exports.

### TConnect quotations and messages, 17-10-2026

- Added fixed participant conversation, message, and quotation grants to the buyer and seller portal roles.
- Added desk navigation and fixed transport adapters for the app-owned workspaces.
- TConnect retains all source relationships, sender identity checks, pricing calculations, and participant privacy.
- API/web builds, typechecks, and lint passed. Live and browser negotiation E2E passed with separate signed buyer and seller sessions.

### CRM development imports, 17-10-2026

- Resolve CRM web imports directly to the owning source folder after specific subpath aliases.
- This avoids stale Vite modules under the ignored workspace junction in node_modules.
- Browser verification: enquiry #4 and its Closure approvals tab loaded without the missing-export error.
- Platform typecheck, lint, and module boundaries passed.

### Tenant registry visibility, 17-10-2026

- Removed tenant-company lookups from the Super Admin tenant list. Blank connection fields no longer fail the entire list.
- Regression test passed for active and inactive registry entries without connection settings.
- Verified the authenticated public tenant API returns 200 with 14 records and the browser at `/sa/tenants` shows all 14 rows.
- The 11 imported records remain inactive with blank connection fields. No tenant provisioning or connection changes were performed.

## CRM mobile work composition - 17-10-2026

- [x] Register the CRM work-report API and inject transactional Chat delivery into enquiry, task, duty assignment, and duty report workflows.
- [x] Resolve Chat's default company through Core's public contract and validate the selected active company.
- [x] Platform API typecheck and lint passed locally. CRM/Chat workflow and denied-access checks are recorded in their owner task files.
- [ ] Production rollout.

### Container loading performance, 17-10-2026

- Updated the three CodexSun application images with parallel startup loading, early hero discovery, non-blocking homepage styles, and explicit HTML cache policy.
- Public runtime configuration uses a private 60-second browser cache. Authentication and tenant business responses do not use this policy.
- Browser cold-load sample: first content 612 ms and load event 2085 ms, without startup errors. The earlier audit measured 2144 ms and 3903 ms; timings vary with network conditions.
- Browser Super Admin sign-in passed and every previously imported tenant remained visible. Both CXApp container start times were unchanged.
- UI/API/web typechecks, focused lint, UI build, Platform boundaries, and component-documentation checks passed. The root dependency check remains blocked by the existing `apps/tconnect/web/dist` folder.

### Tenant page loading and build layout, 17-10-2026

- Load Project Manager only when its workspace opens. Start tenant-page module loading alongside session validation.
- Import UI components through their public subpaths to avoid loading the editor through the root export.
- Preserve registry-only tenant listing. These changes do not provision or connect tenant databases.
- Moved the obsolete TConnect web cache from `apps/tconnect/web/dist` into the root `dist/.cache` folder. No cache content was deleted.
- The earlier dependency-check blocker is resolved. TConnect build, dependency layout, and version checks passed.

### Deployment with tenant database hold, 17-10-2026

- Chat, CRM, and Frappe tenant sync scans now honor `CODEXSUN_QUEUE_WORKER_ENABLED`, together with queue processing.
- Set this existing worker option to `0` during a deployment that must avoid background tenant database scans.
- Keep default tenant seeding and database reset disabled. App availability can be configured in the master registry without tenant provisioning.

- VPS Git pull completed at `1b66316`, version 1.1.6. Preserved deployment and page-loading fixes.
- Built and deployed API, web, and shop as `1.1.6-1b66316`. Staged API readiness passed before replacement.
- Public Super Admin sign-in, all 15 tenant rows, and CODEXSUN effective access to 20 tenant workspace apps passed.
- Added 18 tenant entitlement exceptions and refreshed the existing TConnect grant. Existing plan access remains unchanged.
- CXApp image IDs and start times, tenant connection settings, and the database schema list remained unchanged.
- Public web and shop frontend assets and health endpoints returned 200. Shop bootstrap returned 404 because its domain binding remains disabled and unverified.
- Full repository check, Platform API typecheck, lint, and module boundaries passed. Tenant role and data-backed workspace checks remain deferred.

## 2026-10-17: Live CRM workspace acceptance

Verified live Techmedia and Rainbow Application overview access. Login/session role display uses active persisted role assignments. Task permission classification delegates to the CRM Task owner, including normal-user closure requests.

## Queue verification age boundary - 2026-10-18

- Queue verification age is calculated by the Platform queue database using its own timestamp, avoiding timezone reinterpretation between SQL `DATETIME` values and the API host clock.
- Browser CRM-to-Frappe Contact export completed one queued job with 1 exported and 0 failed after this change; live Mobile Contact readback and fixture cleanup passed.
- Platform API typecheck, lint, and production build remain required for final validation.

## Sportsclub multi-entity navigation, app catalog wiring, and tenant isolation evidence — October 19, 2026

### Follow-up: launcher and legacy tenant app editing

- Sports Club stays opt-in per tenant. An existing tenant with `sportsclub` in its enabled module keys receives the launcher tile at `/app/sportsclub/overview`; a tenant without the key does not.
- The Platform web app-registry stack type, validation schema, and editor options now accept `sportsclub`, so an existing registered app can be edited without a frontend validation failure.
- Platform bootstrap seeds the Sportsclub registry row into an existing master database through the idempotent app-registry seeder. This is local source verification; no cloud seed or deployment was run.
- Focused launcher policy test, Platform web typecheck, and Platform web lint passed locally. Authenticated browser review remains open.
- Platform web production build and Platform module boundary check passed. `dependencies:check` is blocked by existing generated artifacts under `apps/sites/clients/dist` and `apps/sites/clients/cloudflare/dist`; this task did not remove those Sites files.
- The older Sportsclub API compilation blocker recorded below was resolved in the preceding local build and test pass. It does not describe the current local state.

### App Catalog & Super Admin Connections Wiring

- Verified global `platformAppRegistry` in both `apps/platform/api/src/modules/app-registry/app-registry.service.ts` and `apps/platform/web/src/app/app-registry.ts` includes `sportsclub` with `TrophyIcon`, `bg-orange-700` accent, and multi-tenant academy description.
- Guaranteed resilient rendering in Super Admin `/sa/tenants -> [TENANT] -> App connections` (`tenant.apps.tsx`) and `SaAppCatalog` (`sa-app-catalog.tsx`) by merging missing entries from `platformAppRegistry` into query results, ensuring connection toggles and catalog cards appear even before asynchronous database sync.

### Default Module Keys & Tenant Isolation

- Removed `sportsclub` from `defaultTenantModuleKeys` in both `apps/platform/api` and `apps/platform/web`. This ensures Sportsclub is NOT default-enabled for new or seeded tenants.
- Executed database persistence readback across all master database tenants:
  - `TENKASISPORTS` (`id: 2`, dedicated `codexsun_sportsclub_tenkasisports` DB): `hasSportsclubInKeys: true`, `sportsclubResolvedEnabled: true`, status `active`.
  - `CODEXSUN` (`id: 1`, `codexsun_db`): `hasSportsclubInKeys: false`, `sportsclubResolvedEnabled: false` (preserved untouched).
  - `SUKRAA` (`id: 3`, `sukraa_local_db`): `hasSportsclubInKeys: false`, `sportsclubResolvedEnabled: false` (preserved untouched).

### Sportsclub CRM-Style Desk Tone & Multi-Entity Navigation

- Registered all 8 Sports Club entities plus Overview in `PlatformAppRootPage` and `AppPage`:
  1. `sportsclub.overview` ("Sports Club" / "Overview" - `LayoutDashboardIcon`)
  2. `sportsclub.members` ("Students" - `UsersIcon`)
  3. `sportsclub.masters` ("Masters" - `ContactRoundIcon`)
  4. `sportsclub.programs` ("Curriculum" - `NotebookPenIcon`)
  5. `sportsclub.sessions` ("Batches" - `CalendarDaysIcon`)
  6. `sportsclub.attendance` ("Attendance" - `ClipboardListIcon`)
  7. `sportsclub.progress` ("Assessments" - `SparklesIcon`)
  8. `sportsclub.events` ("Events" - `TrophyIcon`)
  9. `sportsclub.enquiries` ("Admissions" - `MessageCircleIcon`)
- Side menu (`sidemenuForApp` and `appMenuItemsFor`) renders each entity as an individual direct navigation item.
- Shared App Header (`TenantMainLayout` header) carries the active page title ("Students", "Curriculum", etc.) and mounts top action buttons (`Enroll Student`, `New Master`, etc.) with form submission binding (`form="sportsclub-*-form"`).
- Desk tone: Added `activeApp === "sportsclub"` to `hideSidebarBrand` in `AppDesk.tsx`, achieving the clean CRM-style desk tone without redundant sidebar company branding headers.
- Duplicate heading/description prevention: Wrapped leaf views in `.sportsclub-desk-view` with CSS rules `[&_.flex-col.gap-3:has(.min-w-0)]:hidden` and `[&_.min-w-0>h1.text-2xl]:hidden` to suppress duplicate body headings, letting the shared AppDesk header own page title and actions.

### Contract Coordination with AGR-2 (Sportsclub Owner)

- Platform preserves strict modular monolith boundaries: Platform owns composition, desk layout, navigation routing, and role gating. Sportsclub owns leaf CRUD and form logic.
- Stable Form ID Contract:
  - Student enrollment / edit: `sportsclub-member-form`
  - Master upsert: `sportsclub-master-form`
  - Program upsert: `sportsclub-program-form`
  - Session upsert: `sportsclub-session-form`
  - Event upsert: `sportsclub-event-form`
  - Enquiry upsert: `sportsclub-enquiry-form`
- AGR-2 workspace contract: Workspaces should adopt `variant="list" title=""` on `WorkspacePage` to leverage native `WorkspaceHeaderActions` portal into `applicationHeaderTarget`.

### Quality Gates & Verification

- `npm run lint -w @codexsun/platform-web`: PASSED (0 warnings, 0 errors across 304 files).
- `npm run typecheck -w @codexsun/platform-web`: PASSED (0 errors).
- `npm run lint -w @codexsun/platform-api`: PASSED (0 warnings, 0 errors across 286 files).
- `node tools/check-module-boundaries.mjs platform`: PASSED.
- `node --import tsx --test apps/platform/api/src/sportsclub-platform.test.ts`: PASSED (13/13 tests passing).
- Git diff whitespace check: `git diff --check apps/platform` returned 0 errors.

### Deployment Status & Technical Blockers for Live codexsun.com

- **Deployment Status**: Not deployed to live `codexsun.com`. All changes built, tested, and reviewed LOCALLY per explicit user instruction.
- **Repeatable Technical Blockers Identified**:
  1. **Working Tree Isolation**: Repository contains uncommitted concurrent changes across `apps/crm/`, `devkits/data-migration/`, `apps/sites/`, and `apps/billing/` that cannot be built into production images without risking regressions.
  2. **Upstream API Compilation Errors in Sportsclub**: `apps/sportsclub/api` has compile errors in AGR-2 owned files (`projectColumns` missing from `sportsclub.pagination.ts`, and `member.service.ts` query page type mismatch). Because Platform is forbidden from modifying Sportsclub files, AGR-2 must resolve these compilation blockers before `@codexsun/sportsclub-api` can build into Docker release images.
  3. **Master DB Tenant Provisioning on VPS**: Remote VPS (`69.62.81.166` / `srv914719`) currently has 15 tenants where `id: 2` is `TECHMEDIA`. `TENKASISPORTS` and `codexsun_sportsclub_tenkasisports` do not exist on the VPS master database yet. Safe cloud release requires an audited tenant provisioning script keyed strictly by `corporate_id = "TENKASISPORTS"`.
  4. **Explicit Release Hold**: Per user rule, cloud/VPS release is held awaiting explicit user review and confirmation of local preview evidence.

## Marketing local composition continuation, 23-10-2026

Platform composes Marketing tenant activation, trusted database context, saved default company, live grants, and session-bound transport.
Marketing owns its business tables and CRUD. CRM owns Lead intake. Sites owns public form rendering.
Provider account claims store hashed account identity and tenant/connection routing only. Tenant grants stay encrypted in the tenant database.
Marketing jobs contain record references and trusted context. Workers recheck activation and restored actor ownership.
Both database and BullMQ queue composition include Marketing. Pending scans rotate and expired running handoffs can recover.
The local foundation test uses separate disposable tenant databases. It does not prove complete signed-session or production activation behavior.
Platform API/web typecheck, lint, and production builds passed locally. Full authenticated browser acceptance and queue restart tests remain open.
No new commit, push, version bump, customer tenant migration, activation change, or cloud deployment was performed during this continuation.

### Marketing loader and real local tenant preview, 23-10-2026

App Catalog stack validation and selection now accept Marketing.
Tenant direct routes check Marketing activation, and Marketing follows the CRM sidebar branding treatment.
Health inventory includes the public Marketing module keys.
Only local development CODEXSUN received additive owner migrations, permission seeds, and audited Marketing/CRM tenant exceptions.
Verified local SQL backups precede activation. Existing business row counts, landing settings, other module settings, and the other tenant registry metadata were preserved.
Signed local Platform login showed the Marketing Application tile and Apps menu entry, all five lists, and their create/import surfaces.
No sample business records, provider authorization, deployment, commit, push, or version change was performed for this wiring.
Focused loader/navigation tests, Marketing/Platform API and Platform web typechecks, lint, and owner boundaries passed.
Full queue restart, suspension races, browser tenant switching, and all signed-session write workflows remain open.

## Data Bridge guided import composition

Platform composes six Super Admin routes and sidebar entries: Database Connections, Table Mapping, Field Mapping, Import Preparation, Confirm Import, and Import Results. A transfer UUID in the URL resumes the saved owner session. Platform queues `data-bridge.mapped-import` with tenant, actor, correlation, retry, and idempotency context; Data Bridge owns mapping validation, snapshots, execution, and reports. API/web typechecks and production builds passed. Authenticated Chrome and the database Queue Manager worker completed a local SUKRAA review-only session with two existing rows and no target inserts. No real-tenant missing-row import was executed for this workflow.

### Marketing consent policy composition, 23-10-2026

Platform composes Marketing consent, CRM contact restrictions, Mail suppression, and Core recipient identity lookup through public exports.
Each owner uses the trusted tenant database, active module, saved company, current actor, and its own permission check.
Disabled or unavailable policy owners block promotional email eligibility. No promotional queue or send route was added.
The tenant desk adds Consents and preserves URL form/filter/column state. Marketing upserts render separate page views.
Local CODEXSUN received additive owner schema and new Admin permission seeds after verified backups.
Its existing app activation state and checked business row counts were preserved. Mail still needs an explicit entitlement before live eligibility can allow.
No provider operation, commit, push, version change, or cloud deployment was performed.

For the consent continuation, Platform API/Web typecheck, lint, build, and boundaries passed.
Loader/navigation regression tests, component documentation, synchronized Docs, and dependency layout passed.
The real local signed session opened all six standalone Marketing forms without a list behind them; column URL state survived reload.

## Data Bridge Core Masters

- [x] Add the Super Admin Core Masters sidebar route and preserve owner-controlled table review navigation.
- [x] Reuse the existing tenant-bound Data Bridge bulk queue processor for scoped 47-table master imports.

## Data Bridge grouped navigation

The Super Admin sidebar composes five Data Bridge pages. Group pages own their five workflow tabs.
Legacy stage URLs remain hidden compatibility routes. Database credentials remain server-side.

## Redis delivery isolation — 2026-10-24

- [x] Reproduce shared legacy/default-prefix consumption against separate master databases.
- [x] Add database-specific Redis namespaces, persisted job UUID validation, and pending delivery reconciliation.
- [x] Pass real Redis isolation, duplicate publication, hostile payload, and identity regressions against temporary VPS queues.
- [x] Verify fresh Redis job 2584, zero inserts, all 137 SUKRAA invoices, unchanged source and all 70 target business tables.

See [the Redis delivery log](REDIS-DELIVERY-2026-10-24.md).
## TECHMEDIA enquiry retry delivery — 2026-10-24

- [x] Include the persisted outbox correlation generation in enquiry delivery keys.
- [x] Verify the disposable database test resets the retry budget, changes correlation, and retains the last error.
- [x] Verify key isolation across tenants, automatic attempts, manual retries, and repeated scans.
- [x] Verify normal live Retry for event 74 through Redis/BullMQ job 3009, without explicit test dispatch.

The worker returned the actual Customer mapping blocker. It created no remote enquiry and changed no local numbers or links.
This check does not claim successful export for an unresolved mapping.


## Data Bridge credential transfer — local, 2026-10-24

- [x] Add a user-owner copy contract with exact supported-hash preservation and explicit authorization/role-assignment dependencies.
- [x] Recheck the active Super Admin and registered target before copying accounts.
- [x] Preserve existing accounts, passwords, and roles. Give new accounts only the active target User role.
- [x] Apply owner-controlled Core/Billing/CRM default User access. Never copy source administrator assignments or permissions.
- [x] Keep hashes out of persisted report JSON, previews, queue payloads, and error messages.
- [x] Verify denial, supported password verification, source preservation, repeat copies, existing-account preservation, and sanitized warning reports with local disposable databases.

No cloud operation or client account import ran for this local repair.
