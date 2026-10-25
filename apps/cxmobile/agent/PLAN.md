# cxmobile implementation plan

## Decision and delivery status

Create a new CODEXSUN client under `apps/cxmobile/client` using React and Capacitor.
Target Android phones and iPhones, with responsive tablet support through the same web layouts.
Reuse existing web code and the composed Platform API.
This change records the plan only. All implementation phases remain open.

The [audit](AUDIT.md) records source evidence and unresolved implementation risks.
The [task ledger](TASK.md) records execution status. This plan defines architecture and acceptance, not completion claims.

The scope covers every supported CRM, Billing, Chat, and Ecommerce staff workflow.
Delivery phases determine order. They do not remove advanced screens, reports, settings, or lifecycle actions from final acceptance.
An entitlement or permission denial is expected behavior, not a missing feature.

## Source review baseline

Reviewed on 25 October 2026. Source presence is not deployed or device-tested evidence.
[AUDIT](AUDIT.md) owns the source evidence map, route baseline, capability matrix, and A01-A15 findings.

Platform rewrites `/api/app`. Some Ecommerce services still use `/api/platform`.
Inventory active aliases and normalize approved origins and prefixes without changing business endpoint semantics.
Platform's public client export, owner transport integration, and native session behavior remain implementation requirements.

## Application structure and reuse

Use the structure in [README](../README.md#planned-client-structure).
Proposed package identity: `@codexsun/cxmobile-client`.
Proposed native identifier: `in.codexsun.cxmobile`. Check ownership and store availability before signing.
Use the root version source for client metadata. Native build numbers must increase for each distributed build.
Keep existing Flutter clients intact during this plan. Replacement and retirement need separate acceptance evidence.

cxmobile owns bootstrap, providers, navigation, native adapters, and app composition.
Platform owns a small public client/session interface, exposed through a declared package entry point.
CRM, Billing, Chat, and Ecommerce retain their own public exports and fixed business resource operations.
Shared UI owns reusable responsive primitives. Business-specific compact layouts stay in the owner module.

Prefer adapting existing screens over writing duplicate mobile screens.
Add a module-owned mobile presentation only when the existing presentation cannot support the workflow clearly.
Keep the same schemas, fixed services, permission checks, and mutation behavior.
Measure reuse after integration. Do not promise an unsupported reuse percentage.

Load the four apps lazily. Include Core lookup and shared-record dependencies through public contracts.
Bring in required Mail or Frappe UI only through explicit public contracts and existing tenant activation.
Do not bundle unrelated apps merely because Platform Web currently imports them.

### Dependency direction and scaling pattern

Use one installed client and one composed Platform API.
The dependency direction is cxmobile composition to public owner UI, then owner services to Platform transport.
Owner APIs resolve permissions and call their own services and repositories.
Native adapters sit below transport and device capabilities. They do not contain business rules.

Expose the Platform client through a narrow declared subpath such as `@codexsun/platform-web/client`.
This is a proposed interface, not an existing export.
Keep the entry independent of the web router, desks, module registry, desktop bridge, and unrelated application imports.
Initialize runtime configuration and transport before importing owner services with module-level configuration reads.
Do not copy the browser's global fetch interceptor into the native host as its session contract.

Use explicit route composition and reviewed public exports for each app.
Navigation metadata may describe labels, route keys, and permissions. It must not define business fields, CRUD paths, or schemas.
Add a new app through its public routes, transport requirements, capabilities, and acceptance ledger.
Do not add a plugin marketplace, remote module loader, generic repository, or microfrontend runtime for four bundled apps.
Create another shared package only after a real repeated infrastructure need and boundary review.

Use one React root, router, query client, transport instance, and session coordinator per running client.
Mount only the active app workspace. Keep navigation state without retaining hidden live screen trees.
Split native adapters by implemented capability. Avoid one device-service file that accumulates unrelated responsibilities.
Do not create unused adapter files or abstract factories before a concrete operation needs them.

## Mobile shell and navigation

Use the existing `AppLayout` contract and its five technical regions.
Keep `main.topMenu`, `main.sideBar`, `main.AppHeader`, `main.workspace`, and `main.StatusBar` identifiable.
Present the side menu as a drawer on phones. Keep the app header separate from each workspace header.
Provide a permission-filtered app switcher for CRM, Billing, Chat, and Ecommerce.
Provide app-specific navigation and a compact navigation control that does not hide secondary modules.
Show the active tenant, company, and financial year where applicable.

Preserve searchable lists, filters, pagination, details, create/edit, lifecycle actions, activity, and reports.
Adapt wide tables with shared column priority, controlled horizontal scrolling, or owner-defined compact rows.
Handle safe areas, keyboard insets, Android back, iOS navigation, unsaved forms, orientation, and larger text.
Use shared validation banners, required markers, relationship lookups, error states, and retry controls.
Display dates as `DD-MM-YYYY` and date-times as `DD-MM-YYYY HH:mm`.

Deep links select only approved typed routes and public record identifiers.
Authenticate before resolving a protected destination. Recheck record access after login and on notification taps.
Do not accept database names, arbitrary API hosts, roles, or navigation scripts from deep links.

Retain canonical `/app/{app}/...` page shapes where owner screens depend on those routes.
Implement mobile back and link handling through public route contracts rather than desktop pathname hacks.
Support one active account at a time initially. Tenant changes require explicit sign-out and a fresh authorized login.
Keep simultaneous multi-account sessions outside the initial client contract.

## Platform API and native session design

The release contains bundled assets. Production `server.url`, cleartext networking, and arbitrary navigation are forbidden.
Resolve requests against an explicit approved HTTPS API origin and path prefix.
The initial shared deployment uses the canonical shared Platform host and Corporate ID login.
Support verified tenant custom hosts through a reviewed configuration policy, not unrestricted API URL input.
Never spoof the request Host or use tenant headers as authorization.

Preserve the existing encrypted, host-only, revocable Platform session model.
Preferred implementation: native HTTP and a native-owned protected cookie jar, with only non-secret session context in JavaScript.
Use platform-protected storage when persisting native secrets. Do not expose cookies through a JavaScript get-cookie bridge.
Do not store JWTs, session secrets, passwords, or push-provider credentials in localStorage, Preferences, or plain files.
Do not copy the older Flutter password-retention behavior.

This cookie-jar design is a target, not a confirmed property of the default Capacitor plugins.
Prove HttpOnly handling, restart behavior, origin enforcement, and socket sharing on Android and iOS in phase M1.
Strip protected response headers before data crosses the native bridge.
If standard plugins cannot meet this contract, implement a narrow native adapter or review an explicit native-session backend contract.
Do not weaken browser origin checks, cookie settings, host binding, or server session validation to pass the gate.
Bearer delivery exists in the current login source. Its presence alone does not define an approved native session architecture.

The transport interface covers request cancellation, timeouts, envelopes, multipart upload, binary download, and session expiration.
Keep business paths in the owner services. Only infrastructure resolves approved origins and attaches session context.
Preserve the selected session slot and the validated company/year context.
Treat client company/year values as selectors that the backend must validate.
Bind every in-flight request and cache entry to the current session generation.

Restrict the native bridge to approved HTTPS origins and permitted operations.
Reject credential forwarding across redirects, arbitrary filesystem paths, and unrelated native network destinations.
Scope native cookie jars and private files by API environment and active account.
Exclude native secrets and private temporary records from device backup where platform APIs support that policy.
Never label an embedded build value as a secret. Client configuration contains public connection and capability metadata only.

Logout, expiry, tenant changes, and endpoint changes must close sockets and cancel requests.
Clear query caches, thumbnails, queued uploads, and temporary private files before another account can use the client.
Separate 401 expiration from 403 permission denial. A denied record must not trigger an endless login loop.
Recheck permissions and enabled apps on resume. Cached permissions never authorize a server action.

### Cache and lifecycle contract

Use the scope tuple: API environment, session generation, tenant UUID, user identity, company, and financial year.
Owner query keys also include the resource, record/filter identity, and report currency when relevant.
Central infrastructure publishes context. Owner hooks retain their own resource keys and invalidation rules.
Client context carries no database credentials. Tenant database routing remains server-owned.

On company/year changes, cancel scoped requests and reject late results before activating the new context.
Close company-scoped sockets and reset their subscriptions and cursors.
On account changes, revoke the selected session and purge every private scope before another login completes.
Preserve unrelated browser tabs and other installations.
If a release changes a persistent draft schema, migrate or discard it explicitly before opening the workspace.

Resume performs one coordinated session refresh, then bounded visible-screen refresh and socket catch-up.
Prevent a refresh storm from each mounted app starting its own bootstrap request.
Treat an expired session, denied permission, disabled app, unavailable API, and malformed response as distinct states.

## Feature coverage contract

[AUDIT's source baseline](AUDIT.md#source-based-feature-baseline) records concrete page keys and their current classification.
Phase M0 expands each entry into exact route/action/API/permission coverage.
Record web, Android, and iPhone evidence for every action.
An overview screen, route key, or exported component does not establish workflow completion.

| Area                | Final staff parity scope                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform            | Login/recovery, session lifecycle, permitted tenant/company/year context, profile, app activation, permissions, notifications.                                      |
| CRM                 | Daily work, enquiries, leads, contacts and supported submodules, tasks, activities, closure, schedules/reminders, duties, reports, masters, permitted integrations. |
| Billing             | Quotations, sales/export sales, purchases, payments/receipts, allocations, supported opening balances, six reports, dashboard, settings, print/PDF/share/Mail.      |
| Chat                | Direct/group/channel/broadcast, members/admins, messages, files, reads, typing/presence, reconnect, push, optional Telegram/settings.                               |
| Ecommerce staff     | Catalog, matching, variants/images, Core dependencies, explicit data-source actions, organisation/profile, all publishing sections, storefront preview.             |
| Shared dependencies | Core lookup and required create/edit flows, company/year, and optional Mail/Frappe contracts.                                                                       |

Keep CRM own-record scope and administrator ceilings. Hidden unfinished Contact 360 stays hidden.
Tasks remain local. Preserve existing approved enquiry/comment integration policy and tenant capability gates.
Billing retains numbering, tax, posting, allocations, balances, audits, and company/year/currency rules.
Chat retains membership, author/admin rules, read cursors, and attachment authorization.
Ecommerce retains Core identity ownership, server-held Frappe credentials, and published-only public catalog reads.

Resolve opening-balance and other API-only or source-only entry points during M0.
An unavailable UI or backend remains an explicit task, not a disabled success state.
Keep desktop development-server controls outside the installed client.

Customer storefront preview uses an approved verified host without staff session transfer.
Customer identity, checkout, orders, payments/refunds, stock reservation, and fulfillment require new Ecommerce contracts.
Track these through EC1 when complete customer purchasing forms part of product acceptance.
Existing basket behavior is not evidence of complete commerce.
The staff parity release requires every supported staff action and isolated storefront preview to pass.

## Realtime, push, and files

Chat keeps its frame schema, membership checks, read cursors, and record authorization.
Use an authenticated native socket adapter when WebView cookies cannot authenticate the upgrade safely.
Do not put session secrets in WebSocket query strings.
Prove socket logout, revoked membership, session expiry, reconnect, and missed-message catch-up.
Use foreground polling only as a documented fallback. Close or pause it when the app backgrounds.

Platform owns device registration and push-token lifecycle infrastructure.
CRM and Chat own event eligibility, recipients, record access, and notification semantics.
Add tracked migrations only when implementing device registrations or delivery records.
Use FCM on Android and APNs on iOS, with server-held provider credentials.
Bind device registrations to the authenticated tenant, user, session, installation, and environment.
Handle token rotation, logout, account changes, revoked access, duplicates, and invalid-token cleanup.
Minimize notification content. Fetch protected record data after the app revalidates access.
The official push plugin does not supply general background execution or iOS silent push support.

Use native camera, photo/file pickers, file transfer, private temporary storage, file opening, and share adapters.
Preserve owner API size limits, MIME validation, upload permissions, and server-owned storage paths.
Resolve protected image and attachment URLs through authenticated native transport when WebView cookies are unavailable.
Do not place secrets in media URLs or leave financial documents in public device storage by default.
Stream large transfers through file APIs. Avoid large base64 payloads through the JavaScript bridge.

Dial, SMS, WhatsApp, maps, location, biometrics, scanner, and barcode features need explicit platform capability checks.
Biometrics unlock local session access. They do not grant a server role or bypass session expiry.
Do not promise iPhone call-history access or background tracking from an Android implementation.
Use manual call notes where call-log access is unavailable. Review Android store permissions before adding call-history access.
Printer hardware integrations require an explicit device/protocol inventory before commitment.

## Offline behavior

Initial delivery is online-authoritative, with clear disconnected and retry states.
Never present a failed save as successful. Prevent duplicate creates after an ambiguous network timeout.
Do not replay financial posting, payment, stock, approval, or destructive actions automatically.

Later offline drafts require an encrypted, account-scoped store and owner-specific sync contracts.
CRM drafts, Chat pending messages, and Ecommerce cart state need separate retry and conflict rules.
Use stable idempotency identities only where the backend contract supports them.
Preserve the same identity across retry and recheck authorization before upload.
Billing can retain a clearly labeled local draft only after its owner defines the contract.
Offline drafts never count as posted invoices, settled payments, confirmed orders, or server-approved actions.

## Delivery phases

- **M0:** Exact feature ledger, public-export map, API alias map, toolchain/plugin matrix Evidence: Every requested module has route/action coverage and an explicit owner.
- **M1:** Minimal native proof harness, session/HTTP/socket/media validation Evidence: Android and iPhone prove login, protected requests, upload/download, socket auth, revocation, and cross-tenant denial.
- **M2:** Production client foundation and one end-to-end slice from each app Evidence: Both native installs complete the four persisted journeys defined below without a development server.
- **M3:** CRM complete supported workflow parity Evidence: Each CRM checklist action passes browser and both native platforms, including negative authorization cases.
- **M4:** Billing complete supported workflow parity Evidence: Saved financial records, allocations, balances, tax totals, scope, reports, and document sharing match authoritative API results.
- **M5:** Chat parity, reconnect, push delivery Evidence: Two-device messaging, cursor correctness, revoked membership, foreground/background notification, and account changes pass.
- **M6:** Ecommerce staff parity and isolated storefront preview Evidence: Catalog saves, variants, images, publication, Core dependencies, and anonymous tenant isolation pass.
- **M7:** Platform device features, permitted drafts, resilience, accessibility Evidence: Target-device feature matrix, interrupted network recovery, cache isolation, and mobile UX pass.
- **M8:** Signed Android and iOS candidate distribution Evidence: Signed AAB/APK and iOS archive/TestFlight evidence, physical-device journeys, privacy metadata, and rollback procedure.
- **EC1:** Complete customer purchasing, if included in product acceptance Evidence: Ecommerce-owned customer access, checkout/order/payment/stock/fulfillment contracts pass before a commerce-complete claim.

Do not skip M1 because a browser preview works.
Run common native foundations once. Track each owner's parity independently.
Publication, production migrations, and store submission are separate operations from this planning request.

M1 may create the minimum temporary or retained native host needed for proof after implementation is authorized.
It does not require the production shell or full app integrations from M2.
Mac access and a test iPhone are required before M1 can pass. Simulators provide supplementary evidence.

### First integrated slice and task dependencies

M2 proves these workflows against disposable staging records on both native platforms:

1. Sign in, resolve the tenant, and select a permitted company/year.
2. Create a CRM enquiry, assign it, add a comment, and reload it.
3. Create a Billing quotation, reload totals, and share its PDF.
4. Send a Chat message and attachment to a second user, then verify unread and read state.
5. Save an Ecommerce item draft and image, then reload its unpublished state.
6. Sign out and verify that the next account receives no previous account data.

Keep billing test records unposted until the owner-specific financial acceptance phase.
M3 through M6 expand these slices into complete feature coverage.
Shared Core lookup and create flows are prerequisites for any slice that needs them.
Push infrastructure can proceed after M1, but Chat push acceptance must use authorized Chat recipients.
Do not delay basic Chat delivery until every CRM or Billing screen is complete.

## Performance and resource plan

These are proposed acceptance budgets, not measured results.
Confirm or revise them with recorded reasons during M2 using a named midrange Android device and supported iPhone.
Keep test tenant size, API environment, connection profile, and client revision fixed during comparisons.

- **Initial JavaScript:** At most 500 KiB gzip before loading an owner app Evidence: Build graph separates shell from lazy owner chunks. Native startup also records uncompressed parse cost.
- **Cold launch:** Usable login or cached shell within 3 seconds at p95 Evidence: At least 20 cold starts per named device. Protected data loading is measured separately.
- **Active list usability:** Within 2.5 seconds at p95 under 150 ms RTT and 10 Mbps Evidence: At least 30 route activations with a documented production-like fixture.
- **Active subscriptions:** One authorized Chat connection and one coordinated session refresh Evidence: Instrument listener, socket, and bootstrap counts through 20 app switches.
- **Background work:** No unnecessary screen polling after background transition Evidence: Observe stopped screen timers and reconnect catch-up after resume.
- **Large transfers:** Stream within owner upload limits without base64 bridge copies Evidence: Record peak memory and cancellation behavior at the maximum supported file size.

Split heavy PDF, report/chart, rich editor, image tooling, and optional integration code at the route or action boundary.
Prefer public leaf entry points when broad barrels pull unrelated code into the bundle.
Do not preload all four application trees after login.
Prefetch only a likely next screen when the network and current workload allow it.
Avoid duplicate detail requests from list cards. Fetch detail on demand with owner query reuse.
Keep list and search APIs paginated. Cancel superseded searches and bound image thumbnail sizes.

Preserve owner freshness rules for financial data. Do not hide stale balances behind long global cache times.
Use realtime events for targeted invalidation and one bounded foreground polling fallback where required.
Suspend hidden-screen queries without losing their filter/navigation state.
Measure before adding virtualization, a new state library, or a generalized synchronization engine.
Track memory over repeated app switches and reject sustained growth from leaked listeners or retained screens.

## Compatibility, operations, and release safety

Store-installed clients can outlive the API version deployed when they were built.
Platform must define a minimum supported client/capability contract before the first public release.
Prefer additive API changes. Retire fields only after supported installed clients no longer depend on them.
Handle unsupported capabilities with a clear update-required state, without attempting partial financial mutations.
Keep Android/iOS build numbers monotonic even when the API is rolled back.

Record app version/build, API version, environment, request correlation ID, and redacted error category in diagnostics.
Never record credentials, session values, document contents, messages, or private attachments in telemetry.
Provide a bounded diagnostic export with explicit user action and tenant privacy review.
Do not start background telemetry collection or external uploads through a UI error handler.

Use environment-specific package configuration and push credentials. Never cross staging and production device registrations.
Pin native dependency resolution according to the selected Android and iOS toolchains.
The single root npm lockfile rule still applies. Native toolchain lockfiles are not replacement JavaScript package-manager lockfiles.
Review native dependency changes, permissions, privacy manifests, and app entitlements with each release candidate.
Use packaged store releases initially. Remote executable updates require a separate signed-update design and policy review.

Release rollback disables affected capabilities server-side where supported and preserves compatible API behavior.
An installed store binary cannot be assumed to roll back immediately.
Do not make a destructive migration a prerequisite for a mobile client update.
Migrate new Platform device-registration data through tracked, backward-compatible migrations with scoped verification.

## Proposed toolchain and commands

At implementation, select one supported Capacitor major and matching official plugin majors.
Recheck its Node, Android, Java, Gradle, macOS, Xcode, and minimum OS requirements.
Use the repository's root npm and TypeScript conventions. Assess community plugin maintenance before adoption.

Proposed root scripts, not implemented in this plan:

```text
cxmobile:dev
cxmobile:typecheck
cxmobile:lint
cxmobile:test
cxmobile:build
cxmobile:sync:android
cxmobile:sync:ios
cxmobile:android:debug
cxmobile:android:release
cxmobile:ios:archive
cxmobile:e2e
```

Only create a script when it performs the named operation.
Use a fixed root web output and native `webDir`. Build first, then sync the native assets.
Inspect the packaged assets and dependency graph for secrets, unrelated apps, and development endpoints.
Do not use `server.url` as a substitute for packaging the client.

Windows can support web development and Android builds. Native iOS build/test/signing needs a Mac or macOS CI runner.
Account access, signing identities, push entitlements, and physical devices are release prerequisites.
Do not commit keys, provisioning profiles, generated caches, local SDK paths, or credentials.

## Verification and definition of done

Record evidence with source revision, API revision/environment, tenant fixtures, role, device/OS, action, and persisted result.
Use two isolated test tenants, multiple users, company/year changes, and enabled/disabled app fixtures.
Test forged headers, wrong host, foreign record IDs, revoked sessions, denied permissions, and delayed responses after account changes.
Verify read-after-write after reload or process restart. A mock response is not persistence evidence.

Test 320, 390, and 430 CSS-pixel widths, landscape, keyboard, safe areas, touch controls, and larger text.
Use Chrome for browser behavior and native Android/iOS devices for WebView, plugin, push, file, and lifecycle behavior.
Do not equate desktop browser emulation with iPhone acceptance.

Run affected owner boundaries, typechecks, lint, builds, and focused API/database checks when implementation changes.
Run root component-documentation checks when documentation changes.
Synchronize repository Docs references during a coordinated documentation update and verify the catalog.
Run repository-wide release checks for a release, not as a substitute for native acceptance.

Completion requires all four staff app ledgers, secure session proof, native file/realtime proof, and both signed platform candidates.
Record open backend commerce work separately. Report built, installed, verified, distributed, and published as distinct states.

## Official design references

- [Capacitor setup and native toolchains](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Configuration and bundled web assets](https://capacitorjs.com/docs/config)
- [Native HTTP and large-file guidance](https://capacitorjs.com/docs/apis/http)
- [iOS cookie constraints](https://capacitorjs.com/docs/apis/cookies)
- [Push setup and background limits](https://capacitorjs.com/docs/apis/push-notifications)

References were checked during planning. Device tests must verify the chosen implementation.
