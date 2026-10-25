# cxmobile tasks and acceptance evidence

## Worktree Reset: 1.1.67

Active app checkout: `D:\workspace\codexsun-worktrees\cxmobile`, branch `codex/cxmobile`.
This replaces old worktree paths and worker leases below. Those records are historical evidence.
The integrated development baseline does not close unverified provider, device, browser, or production gates.
Fresh checkout authorization excludes npm installation and runtime startup. Wait for the next app task.


## Status rules

Implementation baseline: 25 October 2026. Implementation is ACTIVE under supervisor repair and integration loop.
Mark a task complete only after its named evidence exists on real platforms.
Distinguish Node mock tests, real Platform API integration, Android runtime, and iOS runtime evidence separately.
Do not treat Node mock unit tests or demonstration slices as device completion evidence.

## Shared-file ownership and leases

| Work package | Actual worker/task ID                | Exact file lease                                                                                         | Current baseline     | State                                              | Evidence/review                                                                                                            |
| ------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CX-W00       | c0ed0537-9967-40a3-82f6-4ac63bfca6ea | Feature ledger in `apps/cxmobile/agent/TASK.md` and `apps/cxmobile/agent/AUDIT.md`. Read-only elsewhere. | Baseline 25 Oct 2026 | Accepted                                           | Complete M0 inventory & contract analysis. Reviewed by CX-W08.                                                             |
| CX-W01       | 0311c835-54ce-44c4-9bea-2a30dfc7c61c | `apps/cxmobile/client/src/native/`, `src/session/`, `test/`. Platform auth/client bounded lease.         | Clean                | Unit-Tested / Android KeyStore Verified (iOS/Docker Authenticated Pending) | Android KeyStore AES-256-GCM token storage & native HTTP dispatcher (`performAuthenticatedRequest`); canonical path normalization & strict slash boundary (`/api/app/`); fail-closed on missing metadata; native login destination binding; bridge `setSecret`/`removeSecret` immutability lock; explicit safe `updateSessionMetadata` contract for company/context switching; token redaction to `[native-isolated]`; iOS Keychain pending physical Mac host; Docker positive business flows pending disposable fixture. |
| CX-W02       | ac7168a6-06af-4f3b-94b5-429e6913df95 | `apps/cxmobile/client/src/app/`, `src/shell/`, `src/styles/`, `src/main.tsx`, `src/slices/`, `test/`.    | Clean                | Unit-Tested / Android UI Verified (iOS Pending)   | Strict `resolveApiUrl` rejects malformed `https://`, IPv6 loopback `[::1]`, userinfo, and internal domains. Production policy precedence enforced. Rendered shared login with shadcn theme tokens, branding logo, and API 36 window insets safe areas on emulator-5554 (PID 4690). iPhone pending physical Mac host. |
| CX-W03       | 5d91d830-536e-4cd2-af49-452d38bd9d6d | `apps/cxmobile/client/src/domains/crm/`, `test/crm-parity.test.ts`.                                      | Clean                | Unit-Tested / Pending Live Docker Integration      | 24 M0 CRM routes, Contact-360 masked, local tasks. Live Docker positive authenticated CRM enquiry/comment pending disposable fixture; iPhone pending physical Mac host. |
| CX-W04       | 72f1da6b-60e0-4985-906f-9320e989bccb | `apps/cxmobile/client/src/domains/billing/`, `test/billing-parity.test.ts`.                              | Clean                | Unit-Tested / Pending Live Docker Integration      | Reuses 16 `@codexsun/billing-web` owner workspaces. Zero duplicated engines or custom balance rules. Live Docker positive authenticated quotation/totals/PDF pending disposable fixture; iPhone pending physical Mac host. |
| CX-W05       | caa3de91-cc4d-4db0-bd7c-d39960f99e7e | `apps/cxmobile/client/src/domains/chat/`, `test/chat-parity.test.ts`.                                    | Clean                | Unit-Tested / Pending Live Docker Integration      | Channels, DMs, broadcast, attachments, same-second cursor tracking. Live Docker positive authenticated Chat socket messages pending disposable fixture; iPhone pending physical Mac host. |
| CX-W06       | 406f3f93-5846-49f6-ad01-86ee6cda9d55 | `apps/cxmobile/client/src/domains/ecommerce/`, `test/ecommerce-parity.test.ts`.                          | Clean                | Unit-Tested / Pending Live Docker Integration      | Catalog, attributes, collections, storefront components, isolated preview. Live Docker positive authenticated draft/publishing pending disposable fixture; iPhone pending physical Mac host. |
| CX-W07       | f76230b2-8b1d-448e-ba6a-0b34ec31747c | `apps/cxmobile/client/src/native/`, `test/native-capabilities.test.ts`.                                  | Clean                | Stalled (Step 238; replaced by W07-R)              | 9 plugins synced. `camera.ts`, `filesystem.ts`, `network.ts`, `push.ts`, `share.ts`. Replaced to prevent deadlock.        |
| CX-W07-R     | fd6b8f4e-0ea7-43bd-9713-9b5c1753a3fa | `apps/cxmobile/client/src/capabilities/`, `test/native-capabilities.test.ts`.                            | Clean                | Unit-Tested / Android Verified (iOS Pending)       | Verified 6/6 native capability tests passing. Real Capacitor plugins synced. iOS pending physical Mac host.                 |
| CX-W08       | 7af2d98d-493d-43d9-acb0-28d6b5957a2d | Read-only inspection across repository. Disposable test execution.                                       | Baseline 25 Oct 2026 | Full Pass / Acceptance Sign-Off                   | Independent Reviewer verified all native transport, destination scope, and metadata mutation remediations: 127 tests pass, 0 typecheck/lint errors, boundaries & hygiene passed, KeyStore native transport, slash boundary, and safe context update confirmed.|
| CX-W09       | Release Candidate                    | `dist/apps/cxmobile/candidates/`                                                                         | Clean                | Candidate Produced (iOS Blocked)                   | Candidate APK `cxmobile-android-debug-v1.1.61.apk` (15,405,888 bytes, SHA256: `D8A41C50B6CB79D483B60486A3146CFDD9E9F5A4FA4BC5E08E35C69F369D38D5`) running on emulator-5554 (PID 4690). iOS host blocked. |

## External Review Repairs (XR01-XR08)

| Repair ID | Owner / Area             | Scope & Lease                                                        | Description                                                                                   | State    | Evidence / Verification                                                                                         |
| --------- | ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| XR01      | Native Session / Storage | `apps/cxmobile/client/src/native/storage.ts`, `src/native/http.ts`, `NativeSecureStoragePlugin.java` | Hardware KeyStore isolation (AES-256-GCM); native-owned token/transport boundary; zero localStorage/Preferences secrets | Active / Verified on Android (iOS pending) | Android KeyStore AES-256-GCM encrypts at rest; `NativeSecureStoragePlugin.performAuthenticatedRequest` binds destination to native session origin/base-path, enforces canonical normalization & strict slash boundary (`/api/app/`), denies foreign origins & path escapes, fails closed on missing scope metadata, locks native-owned keys against bridge `setSecret`, denies caller header overrides, disables redirects, filters sensitive response headers (`Set-Cookie`, `Authorization`), redacts tokens in `getSecret` to `[native-isolated]`, and executes HTTP natively in Java memory without decrypted token crossing the JS bridge. iOS Keychain remains open gate pending Mac host. |
| XR02      | Shell / Workspaces       | `apps/cxmobile/client/src/shell/mobile-shell.tsx`, `src/app/`        | Wire actual CRM, Billing, Chat, and Ecommerce parity workspaces into mobile navigation        | Verified | Shell mounts `CrmMobileWorkspace`, `BillingMobileWorkspace`, `ChatMobileWorkspace`, `EcommerceMobileWorkspace`. |
| XR03      | Native Transport / Auth  | `apps/cxmobile/client/src/session/`, `src/native/`                   | Preserve API prefix (/api/app), require server session slot & accessToken, fix sockets        | Verified | Fails closed on missing slot. Preserves `apiBaseUrl`. Universal WebSocket adapter.                              |
| XR04      | Billing Parity           | `apps/cxmobile/client/src/domains/billing/`                          | Remove duplicated calculation/permission engines; reuse @codexsun/billing-web contracts       | Verified | Mounts 16 official `@codexsun/billing-web` workspaces. Removed duplicated calculations & custom balance rules.  |
| XR05      | Native Capabilities      | `apps/cxmobile/client/src/native/`, `test/`, root `package.json`     | Install real Capacitor plugins (Camera, Filesystem, Share, Network, Push), sync Android & iOS | Verified | 9 plugins synced. `camera.ts`, `filesystem.ts`, `network.ts`, `push.ts`, `share.ts`. 6 capability tests pass.   |
| XR06      | Supervisor / Ledger      | `apps/cxmobile/agent/TASK.md`, `AUDIT.md`                            | Reopen unverified gates, distinguish Node mocks from device proof, record exact evidence      | Verified | Ledger updated. Real Android emulator execution & candidate APK recorded separately from Node mocks.            |
| XR07      | Session Permissions      | `apps/cxmobile/client/src/app/native-session-provider.tsx`           | Separate app activation from resource permissions, fail closed on missing permissions         | Verified | `isAppEnabled` and `hasPermission` separated and fail closed. Verified with test coverage.                      |
| XR08      | Styling & Resilience     | `apps/cxmobile/client/vite.config.ts`, `src/styles/`, `src/main.tsx` | Add Tailwind/UI CSS bundle, real connectivity status, fail closed without local fallback      | Verified | `@tailwindcss/vite` generates 395 kB CSS bundle. `NetworkMonitor` wired to status bar.                          |

## Local Docker Acceptance Contract (`LOCAL-DOCKER-ACCEPTANCE.md`)

| Item | Requirement                                      | Target / Contract                                              | Status   | Concrete Evidence                                                                                                   |
| ---- | ------------------------------------------------ | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| DA01 | Live Docker Platform API Gateway Health          | `http://127.0.0.1:18010/api/app/health`                        | Verified | HTTP 200 with modules `crm.enquiry`, `billing.quotation`, `billing.sales`, `chat`, `ecommerce.catalog.product-information`. |
| DA02 | Docker Tenant Login Context & Corporate ID       | `http://127.0.0.1:18010/api/app/auth/tenant-context`          | Verified | Loopback host reports `mode: shared_domain`, `corporateIdRequired: true`. NativeSessionManager enforces Corporate ID. |
| DA03 | Docker Auth Gateway Rejection (Fail Closed)      | `http://127.0.0.1:18010/api/app/auth/login`                   | Verified | Rejects invalid credentials; no token leakage, no account fabrication, session manager stays unauthenticated.      |
| DA04 | Operation URL & Logout Path Preservation         | `http://127.0.0.1:18010/api/app/auth/logout`                  | Verified | `/api/app` preserved on all operations including `/auth/logout`; never stripped or dropped to origin.               |
| DA05 | Native WebSocket URL Construction                | `ws://127.0.0.1:18010/chatb/realtime`                          | Verified | Query params contain `companyId`, `sessionSlot`, `tenantId`. Zero secrets in query params; zero fake cookies.       |
| DA06 | Real Provider Permission Enforcement (No Role Bypass) | `evaluateSessionPermission` in `native-session-provider.tsx` | Verified | Role label `"admin"` strictly fails closed without explicit permission grant in session permissions array.          |
| DA07 | Memory Secure Storage Contract (Node) & Native KeyStore | `NativeSecureStorage` / `InMemorySecureStorageAdapter` (Node)  | Verified | Node contract proves isolation from web storage; device proof verified on Android KeyStore plugin.                   |
| DA08 | Platform Web Login Page Presentation Reuse              | `LoginPagePresentation` extracted from `@codexsun/platform-web`| Verified | Reuses `AuthLayout`, `@codexsun/ui` controls/tokens/branding. Removed hardcoded demo credentials and custom dark box. |
| DA09 | Semantic Theme Token Inheritance                        | `@codexsun/ui` shadcn CSS variables                            | Verified | Replaced hardcoded slate/dark box with `var(--background)`, `var(--foreground)`, `var(--card)`, `var(--border)`.    |
| DA10 | Binary-Safe Screenshots                                 | 320px, 390px, 430px viewports & Android emulator              | Verified | Valid PNG magic bytes `89 50 4E 47 0D 0A 1A 0A` on all 4 captured screenshots. Zero UTF-16 corruption.              |

> **Note on Docker Platform Acceptance Scope**:
> - Smoke checks (`/health`, `/auth/tenant-context`, and `/auth/login` negative rejection on shared domain) prove live Docker connectivity and fail-closed posture.
> - Full positive authenticated business acceptance (live CRM enquiry/comment, Billing quotation/totals/PDF, Chat messaging/realtime, Ecommerce draft item/image, and server-enforced role/tenant denials) requires an approved disposable positive-login test fixture.
> - **Exact Prerequisite for Positive Live Business Acceptance**: An approved disposable test tenant (Corporate ID, financial year, test user credentials, and pre-seeded database records) provisioned in the local Docker MariaDB database. Work proceeds boundedly without touching customer data or inventing unverified credentials.

## Visual Proof & Binary Screenshots

| File Path                                                             | Target / Viewport           | Size (Bytes) | Magic Bytes (Hex) | Format & Render Validation                                                        |
| --------------------------------------------------------------------- | --------------------------- | ------------ | ----------------- | --------------------------------------------------------------------------------- |
| `dist/apps/cxmobile/candidates/cxmobile-viewport-320.png`             | Browser Viewport 320x640    | 51,381       | `89504e470d0a1a0a`| Valid binary PNG. Rendered mobile shell & login page (5,882 chars HTML).          |
| `dist/apps/cxmobile/candidates/cxmobile-viewport-390.png`             | Browser Viewport 390x844    | 67,014       | `89504e470d0a1a0a`| Valid binary PNG. Rendered mobile shell & login page (5,882 chars HTML).          |
| `dist/apps/cxmobile/candidates/cxmobile-viewport-430.png`             | Browser Viewport 430x932    | 69,221       | `89504e470d0a1a0a`| Valid binary PNG. Rendered mobile shell & login page (5,882 chars HTML).          |
| `dist/apps/cxmobile/candidates/cxmobile-android-running.png`          | Android Emulator 1080x2400  | 122,708      | `89504e470d0a1a0a`| Valid binary PNG. Rendered login form with branding logo, API 36 window insets safe areas, and bottom status bar (PID 4690).|

## Test Suite Execution Evidence

- Total tests: **135** passed, **0** failed
  - Node / TypeScript Integration Tests: **127** passed, **0** failed (34 suites, duration: 8.3s via `npm test -w @codexsun/cxmobile-client`)
  - Java JVM Unit Tests: **8** passed, **0** failed (executed in Gradle via `./gradlew testDebugUnitTest` in `apps/cxmobile/client/android`, exercising `NativeSecureStoragePluginTest.java` directly on Dalvik/JVM classes with real JSON parsing)
- Static Analysis: `npm run typecheck -w @codexsun/cxmobile-client` (0 errors), `npm run lint -w @codexsun/cxmobile-client` (0 errors, 0 warnings across 70 files)
- Packaging Entry Points: `build:release` (`vite build --mode production`), `build:debug` (`vite build --mode debug`)
- Boundaries: `node tools/check-module-boundaries.mjs cxmobile` (Passed), `node tools/check-root-node-modules.mjs` (Passed)
- Android Debug APK: `dist/apps/cxmobile/candidates/cxmobile-android-debug-v1.1.61.apk` (15,405,888 bytes, SHA-256: `D8A41C50B6CB79D483B60486A3146CFDD9E9F5A4FA4BC5E08E35C69F369D38D5`)
- Live Android Emulator: `emulator-5554` (API 36) running `in.codexsun.cxmobile` (PID 4690) with `adb reverse tcp:18010 tcp:18010`, `NativeSecureStoragePlugin.performAuthenticatedRequest` (XR01 token isolation & destination origin/scope binding with slash boundary `/api/app/`), system bar insets, and verified branding logo asset handling.
- Explicit External Blocker: Physical macOS host / iOS signing and device access unavailable on Windows environment; disposable positive-login Docker MariaDB test tenant fixture prerequisite for positive authenticated workflows. Bounded work continues without inventing evidence.

## P0: Planning

- [x] Record React + Capacitor as the selected stack and cxmobile as the new app owner.
- [x] Review existing owner exports, request helpers, session code, Chat realtime, and Ecommerce scope.
- [x] Record the clean client structure, ownership, feature coverage, gaps, delivery phases, and verification gates.
- [x] Create README, PLAN, TASK, and SKILLS without runtime code or native project generation.
- [x] Run component-documentation checks and record exact results below.
- [ ] Synchronize repository Docs references in a coordinated update and verify the catalog.

## P1: Documentation audit and refinement

- [x] Review current composition, request helpers, session interception, report exports, and Chat routes.
- [x] Record A01-A15 source findings and distinguish plan decisions from unimplemented runtime fixes.
- [x] Record source-based page coverage, including broadcast, optional Telegram, and both Billing summaries.
- [x] Define dependency direction, one-client composition, public exports, cache scope, and lifecycle coordination.
- [x] Add the first persisted four-app slice, measurable performance budgets, compatibility, diagnostics, and rollback requirements.
- [x] Validate all five component documents, relative evidence links, and formatting after refinement.

Audit findings remain open implementation work. These checked items describe documentation work only.

## M0: Exact feature inventory

- [x] Enumerate every active CRM route, action, permission, report, lookup dependency, and integration gate.
- [x] Enumerate every Billing document, lifecycle action, allocation, report, setting, export, and print route.
- [x] Enumerate every Chat conversation, message, membership, file, read, and realtime operation.
- [x] Enumerate every Ecommerce staff page, publishing action, catalog integration, and storefront workflow.
- [x] Map current API prefixes, aliases, public exports, runtime values, and private contract gaps.
- [x] Expand the ledger template below for every supported workflow before app integration starts.
- [x] Select matching Capacitor/plugin majors and record Android/iOS build requirements and native capability support.
- [x] Resolve the opening-balance entry point and other source-only or hidden module classifications from AUDIT.
- [x] Record a minimum supported API/client capability contract and prerequisites for macOS and physical-device proof.

## M1: Authentication and native transport gate

- [ ] Prove protected native cookie storage without exposing secrets through JavaScript or bridge headers.
- [ ] Prove login, Corporate ID, verified hosts, session restore, expiry, logout, and server revocation.
- [ ] Prove native JSON requests, cancellation, timeout, envelope handling, multipart upload, binary download, and media loading.
- [ ] Prove authenticated socket upgrade, reconnect, session expiry, and logout without secret query parameters.
- [ ] Verify denied cross-tenant requests, wrong hosts, forged selectors, and delayed responses after account changes.
- [ ] Run these cases on both real Android and iPhone targets. Record any plugin or native-adapter gaps.
- [ ] Reject arbitrary bridge destinations, cross-origin credential redirects, and foreign file paths.
- [ ] Verify session/account isolation across app restart, company/year changes, and delayed request completion.

Exit: all M1 items pass before claiming reusable owner screens are integrated securely.

## M2: Client and native hosts

- [ ] Create the root-managed client workspace and real root scripts from PLAN.
- [ ] Configure bundled Vite assets, Capacitor native projects, root build/cache output, and release metadata.
- [ ] Expose and consume the public Platform client/session contract without private desk imports.
- [ ] Integrate shared AppLayout, app switcher, owner navigation, permissions, company/year, and session cleanup.
- [ ] Integrate native back, safe areas, keyboard, approved links, error boundaries, resume, and network states.
- [ ] Install Android and iOS debug apps and verify packaged startup with no development server dependency.
- [ ] Complete the first integrated slice in PLAN: enquiry/comment, quotation/PDF, message/attachment, item draft/image, and account cleanup.
- [ ] Measure baseline startup, shell bundle, route activation, requests, timers, sockets, and memory on named devices.
- [ ] Verify runtime configuration loads before owner service imports and that the client excludes unrelated application bundles.

## M3: CRM

- [ ] Integrate all supported CRM screens through owner public exports and the approved transport.
- [ ] Verify contacts, leads, enquiries, assignment, activities/comments/replies, work/jobs, tasks, closure, and scheduling.
- [ ] Verify all supported masters, SOPs, duties, reports, call notes, search, filters, pagination, and lifecycle actions.
- [ ] Verify assigned/created record scope, disabled features, integration visibility, and existing Frappe policy.
- [ ] Verify save/reload persistence, denied records, duplicate retries, validation, and attachments on both native platforms.

## M4: Billing

- [ ] Integrate all supported Billing workspaces, settings, reports, and dependencies through public exports.
- [ ] Verify quotations, sales/export sales, purchases, opening balances, receipts, payments, allocations, and lifecycle actions.
- [ ] Compare saved totals, taxes, numbering, posting, balances, dashboard, and reports with authoritative API/database results.
- [ ] Verify company/year/currency changes, permission denial, and stale in-flight result isolation.
- [ ] Verify native PDF preview, authenticated download, share, and supported Mail delivery without popup assumptions.

## M5: Chat and notifications

- [ ] Integrate all supported channel, membership, message, attachment, image, read, typing, and presence workflows.
- [ ] Include broadcast and optional Telegram/settings under their existing activation and authorization rules.
- [ ] Verify two-user/two-device delivery, same-second cursor behavior, reconnect catch-up, and no duplicated messages.
- [ ] Verify membership removal, denied attachments, session expiry, and account/tenant changes during socket activity.
- [ ] Implement Platform-owned device registration and token rotation with CRM/Chat-owned recipient policies.
- [ ] Verify FCM/APNs foreground, background, notification taps, denied permission, logout, token expiry, and content minimization.

## M6: Ecommerce

- [ ] Integrate all current staff catalog, matching, source selection, variant, image, and publishing workflows.
- [ ] Verify organisation/profile, sliders, trust/service sections, promotions/campaigns, featured cards, and seasonal content.
- [ ] Verify public Core lookup dependencies and existing tenant-controlled Frappe actions.
- [ ] Verify authenticated image upload, publication, reload, permissions, and foreign-tenant denial.
- [ ] Verify storefront preview through approved tenant domains without transferring staff sessions.
- [ ] Track customer identity, checkout, order/payment/refund, stock reservation, and fulfillment as new Ecommerce work.

## M7: Native capabilities and resilience

- [ ] Verify camera/photo/file selection, location/maps, dial/SMS/WhatsApp, native sharing, and capability-denied fallbacks.
- [ ] Define any biometric/scanner/barcode integration through reviewed native plugins or adapters.
- [ ] Keep unsupported call-history features unavailable with a usable manual-note alternative.
- [ ] Define owner-specific offline drafts, encryption, idempotency, conflict handling, and account cleanup before implementing replay.
- [ ] Verify offline/reconnect states, interrupted uploads, ambiguous saves, process restart, larger text, keyboard, and landscape.
- [ ] Verify 320/390/430-width journeys and shared UI desktop regressions after responsive changes.
- [ ] Verify PLAN performance budgets under fixed network/fixture conditions and investigate measured regressions.
- [ ] Verify one coordinated resume refresh and no hidden-screen polling or retained screen/listener leaks.

## M8: Release candidates

- [ ] Run applicable owner checks and root release gates with exact source/API revision evidence.
- [ ] Produce and verify signed Android APK/AAB artifacts with package identity, version, and signing evidence.
- [ ] Produce a signed iOS archive and TestFlight candidate on macOS with identity and entitlement evidence.
- [ ] Verify both physical-device feature ledgers against a staging Platform API.
- [ ] Prepare privacy/data collection disclosures, permission descriptions, support information, and release rollback procedures.
- [ ] Verify compatibility with supported installed clients, unavailable capabilities, redacted diagnostics, and staged rollout.
- [ ] Verify rollback preserves compatible APIs and does not assume immediate replacement of installed store binaries.
- [ ] Record distribution separately from store publication. Do not publish from a planning-only request.

## Feature evidence ledger

This ledger defines the exact acceptance scope for every supported workflow across Platform, CRM, Billing, Chat, Ecommerce, and Core. All entries start `Open`. Mark an entry complete only after browser, Android, iOS, and persistence/denial evidence is recorded.

### Platform Authentication & Context

| ID      | Owner / Workflow                                             | Web evidence | Android evidence | iPhone evidence | API / Persistence / Denial evidence | State |
| ------- | ------------------------------------------------------------ | ------------ | ---------------- | --------------- | ----------------------------------- | ----- |
| AUTH-01 | Corporate ID & user credential login (`POST /auth/login`)    | Pending      | Pending          | Pending         | Pending                             | Open  |
| AUTH-02 | Session restoration & expiration check (`GET /auth/session`) | Pending      | Pending          | Pending         | Pending                             | Open  |
| AUTH-03 | Session revocation & logout (`POST /auth/logout`)            | Pending      | Pending          | Pending         | Pending                             | Open  |
| AUTH-04 | Tenant domain/host resolution (`GET /auth/tenant-context`)   | Pending      | Pending          | Pending         | Pending                             | Open  |
| AUTH-05 | Company & Financial Year context selector & query scoping    | Pending      | Pending          | Pending         | Pending                             | Open  |
| AUTH-06 | User account switch, cache purge & memory cleanup            | Pending      | Pending          | Pending         | Pending                             | Open  |

### CRM (Customer Relationship Management)

| ID     | Owner / Workflow                                                                    | Web evidence | Android evidence | iPhone evidence | API / Persistence / Denial evidence | State |
| ------ | ----------------------------------------------------------------------------------- | ------------ | ---------------- | --------------- | ----------------------------------- | ----- |
| CRM-01 | Overview metrics, status counts & quick filters (`/crm/enquiries/counts`)           | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-02 | My Job enquiries assigned to current user (`assignedTo=me`)                         | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-03 | My Calls enquiries created by current user (`createdBy=me`)                         | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-04 | Marketing leads intake, listing & enquiry conversion (`/crm/leads`)                 | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-05 | All enquiries list, search, status/priority filtering (`/crm/enquiries`)            | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-06 | New customer enquiry creation & number sequencing (`POST /crm/enquiries`)           | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-07 | Enquiry details view, status update, priority change & assignment                   | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-08 | Enquiry threaded comments & file attachment uploads (`/crm/enquiries/:id/comments`) | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-09 | Enquiry job work session timer start/stop (`/crm/enquiries/:id/jobs/*`)             | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-10 | Enquiry preliminary cost estimate creation (`/crm/enquiries/:id/estimates`)         | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-11 | Enquiry WhatsApp template message delivery (`/crm/enquiries/:id/whatsapp-messages`) | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-12 | Enquiry closure request submission (`POST /crm/enquiries/:id/closure-requests`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-13 | Tasks browse, search, filters & option lookups (`/crm/tasks`, `/options`)           | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-14 | Task creation, staff assignment, due date & contact linking (`POST /crm/tasks`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-15 | Task edit, progress updating, property patch & comments (`/crm/tasks/:id`)          | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-16 | Task timed work session start/stop (`/crm/tasks/:id/jobs/*`)                        | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-17 | Task closure request submission & manager review (`/crm/tasks/closure-requests/*`)  | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-18 | Activities tenant-wide audit log timeline (`GET /crm/activities`)                   | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-19 | Closure requests queue, manager review & approve/reject (`/crm/closure-requests`)   | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-20 | Schedules calendar appointments & status updates (`/crm/schedules`)                 | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-21 | Due reminders listing & user acknowledgment (`/crm/schedules/reminders`)            | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-22 | Call logs manual phone interaction notes (`/crm/call-logs`)                         | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-23 | Standard Operating Procedures (SOPs) view & catalog (`/crm/sops`)                   | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-24 | SOP draft revision, editing & formal publication (`/crm/sop-items/*`)               | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-25 | Assigned duties view for current user (`GET /crm/duties`)                           | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-26 | Duty roster assignment, staff scheduling & deactivate (`/crm/duty-assignments`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-27 | Duty reporting submission & summary analytics (`/crm/duty-reports`)                 | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-28 | CRM management reports & pipeline conversion charts (`/crm/duty-reports/summary`)   | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-29 | CRM Contacts management & Core contact synchronization (`/crm/contacts`)            | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-30 | Masters management: Lead Sources / List In (`/crm/list-ins`)                        | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-31 | Masters management: Enquiry Statuses (`/crm/statuses`)                              | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-32 | Masters management: Enquiry Priorities (`/crm/priorities`)                          | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-33 | CRM Frappe live synchronization capability gate (`/crm/frappe-sync/capabilities`)   | Pending      | Pending          | Pending         | Pending                             | Open  |
| CRM-34 | Contact 360 unfinished verification (must remain masked and hidden)                 | Pending      | Pending          | Pending         | Pending                             | Open  |

### Billing

| ID      | Owner / Workflow                                                                           | Web evidence | Android evidence | iPhone evidence | API / Persistence / Denial evidence | State |
| ------- | ------------------------------------------------------------------------------------------ | ------------ | ---------------- | --------------- | ----------------------------------- | ----- |
| BILL-01 | Billing dashboard metrics, sales, payables & period summary (`/billing/dashboard`)         | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-02 | Quotations browse, customer search & date filters (`GET /billing/quotations`)              | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-03 | Quotation draft creation, items selection & tax calculations (`POST /billing/quotations`)  | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-04 | Quotation draft modification & item revision (`PUT /billing/quotations/:id`)               | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-05 | Quotation conversion to sales invoice (`POST /billing/quotations/:id/convert-to-sale`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-06 | Quotation native PDF preview, authenticated download & share sheet                         | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-07 | Sales invoices list, payment tracking & posting status (`GET /billing/sales`)              | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-08 | Sales invoice draft creation, line items & sequential numbering (`POST /billing/sales`)    | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-09 | Sales invoice posting to financial ledgers (`POST /billing/sales/:id/post`)                | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-10 | Sales invoice cancellation with audit justification (`POST /billing/sales/:id/cancel`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-11 | Sales invoice native PDF generation, print preview & system share                          | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-12 | Purchase bills browse, supplier entry & bill creation (`/billing/purchases`)               | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-13 | Purchase bill posting to accounts payable ledger (`POST /billing/purchases/:id/post`)      | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-14 | Purchase bill cancellation (`POST /billing/purchases/:id/cancel`)                          | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-15 | Export sales invoices, foreign currency conversion & shipping bill (`/export-sales`)       | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-16 | Export sales posting & native currency document sharing (`/export-sales/:id/post`)         | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-17 | Supplier payment voucher entry & bill allocations (`POST /billing/payments`)               | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-18 | Supplier payment voucher posting & accounts settlement (`POST /billing/payments/:id/post`) | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-19 | Customer receipt voucher entry & invoice allocations (`POST /billing/receipts`)            | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-20 | Customer receipt voucher posting & ledger settlement (`POST /billing/receipts/:id/post`)   | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-21 | Customer Statement detailed transaction report (`/billing/reports/customer-statement`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-22 | Customer Summary aggregate balance report (`/billing/reports/customer-summary`)            | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-23 | Supplier Statement detailed transaction report (`/billing/reports/supplier-statement`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-24 | Supplier Summary aggregate payables report (`/billing/reports/supplier-summary`)           | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-25 | Stock Statement inventory billed movement report (`/billing/reports/stock-statement`)      | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-26 | GST Statement tax breakdown B2B/B2C/HSN report (`/billing/reports/gst-statement`)          | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-27 | Billing Settings prefixes, default accounts & flags (`/billing/settings`)                  | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-28 | Document print settings, terms & numbering templates (`/billing/document-settings`)        | Pending      | Pending          | Pending         | Pending                             | Open  |
| BILL-29 | Opening Balances legacy assignment entry point (`/billing/opening-balances`)               | Pending      | Pending          | Pending         | Pending                             | Open  |

### Chat

| ID      | Owner / Workflow                                                                              | Web evidence | Android evidence | iPhone evidence | API / Persistence / Denial evidence | State |
| ------- | --------------------------------------------------------------------------------------------- | ------------ | ---------------- | --------------- | ----------------------------------- | ----- |
| CHAT-01 | Direct messaging 1-on-1 staff conversations (`/chat/channels?kind=dm`)                        | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-02 | Group chat multi-member channels (`/chat/channels?kind=group`)                                | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-03 | Topic channels team collaboration (`/chat/channels?kind=channel`)                             | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-04 | Broadcast channels administrative announcement feeds (`/chat/channels?kind=broadcast`)        | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-05 | Message compose, send, threaded reply & author edit (`/chat/messages`)                        | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-06 | Message soft-delete and deletion broadcast (`DELETE /chat/messages/:id`)                      | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-07 | Emoji reaction toggle & aggregate counters (`POST /chat/messages/:id/reactions`)              | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-08 | Image and file attachment uploading & native preview (`POST /chat/messages`)                  | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-09 | Read cursor synchronization & unread badge counters (`POST /chat/channels/:id/read`)          | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-10 | Channel membership administration: add member, remove member (`/chat/channels/:id/members`)   | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-11 | Realtime WebSocket lifecycle: connect, ping/pong, reconnect catch-up (`/chat/realtime`)       | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-12 | Realtime presence online roster & typing indicators fanout                                    | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-13 | Telegram gateway account connection, code verification & 2FA (`/chat/telegram/account/*`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| CHAT-14 | Telegram dialog channel linking & bi-directional message synchronization (`/chat/telegram/*`) | Pending      | Pending          | Pending         | Pending                             | Open  |

### Ecommerce (Staff Catalog & Publishing)

| ID      | Owner / Workflow                                                                              | Web evidence | Android evidence | iPhone evidence | API / Persistence / Denial evidence | State |
| ------- | --------------------------------------------------------------------------------------------- | ------------ | ---------------- | --------------- | ----------------------------------- | ----- |
| ECOM-01 | Catalog overview metrics, item counts & sync health (`GET /ecommerce/overview`)               | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-02 | Catalog health and Core master product matching overview (`/ecommerce/catalog/overview`)      | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-03 | Product information editing, specifications & AI draft copy (`/product-information`)          | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-04 | Product variants options, sizes, colors, SKUs & barcodes (`/product-variant`)                 | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-05 | Product images upload, high-res gallery & primary photo toggle (`/product-image`)             | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-06 | Catalog data source sync settings & Frappe catalog pull (`/catalog-data-source`)              | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-07 | Home slider hero carousel banners, CTA links & images (`/storefront-slider`)                  | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-08 | Trusted strip badges configuration (`/storefront-profile`)                                    | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-09 | Promotional discount cards & category badges (`/promotion-card`)                              | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-10 | Featured products card grid layout (`/featured-card`)                                         | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-11 | Seasonal promotional campaign banner strips (`/season-strip`)                                 | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-12 | Campaign events and flash sales management (`/promotion-card?type=campaign`)                  | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-13 | Customer service policy banner configuration (`/storefront-profile`)                          | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-14 | Storefront organisation profile, legal name, GSTIN & logo upload (`/storefront-organisation`) | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-15 | Storefront profile social media links & payment method badges (`/storefront-profile`)         | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-16 | Core product categories master hierarchy navigation (`/core/master/product-categories`)       | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-17 | Core base product master records navigation (`/core/master/products`)                         | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-18 | Core brands master records navigation (`/core/master/brands`)                                 | Pending      | Pending          | Pending         | Pending                             | Open  |
| ECOM-19 | Storefront live customer preview in isolated in-app browser (`/storefront/:tenant`)           | Pending      | Pending          | Pending         | Pending                             | Open  |

### Shared Core & Isolation Gates

| ID      | Owner / Workflow                                                                                | Web evidence | Android evidence | iPhone evidence | API / Persistence / Denial evidence | State |
| ------- | ----------------------------------------------------------------------------------------------- | ------------ | ---------------- | --------------- | ----------------------------------- | ----- |
| CORE-01 | Core Contact master CRUD & relationship selectors (`/core/master/contacts`)                     | Pending      | Pending          | Pending         | Pending                             | Open  |
| CORE-02 | Core Product master CRUD & category linking (`/core/master/products`)                           | Pending      | Pending          | Pending         | Pending                             | Open  |
| CORE-03 | Location masters: Countries, States, Districts, Cities, Pincodes (`/core/common/location/*`)    | Pending      | Pending          | Pending         | Pending                             | Open  |
| CORE-04 | Contact auxiliary masters: Address Types, Bank Names, Groups, Types (`/core/common/contacts/*`) | Pending      | Pending          | Pending         | Pending                             | Open  |
| CORE-05 | Accounting auxiliary masters: Currencies, Months, Payment Terms, Ledgers (`/core/common/*`)     | Pending      | Pending          | Pending         | Pending                             | Open  |
| CORE-06 | Company & Financial Year records management (`/core/organisation/*`)                            | Pending      | Pending          | Pending         | Pending                             | Open  |
| ISO-01  | Cross-tenant data isolation: foreign tenant ID or DB rejected (403/404)                         | Pending      | Pending          | Pending         | Pending                             | Open  |
| ISO-02  | Host header validation: unapproved API origin or spoofed host rejected                          | Pending      | Pending          | Pending         | Pending                             | Open  |
| ISO-03  | Administrative permission ceilings: non-admin blocked from posting/lifecycle                    | Pending      | Pending          | Pending         | Pending                             | Open  |
| ISO-04  | Expired session recovery: 401 triggers clean login without app crash                            | Pending      | Pending          | Pending         | Pending                             | Open  |
| ISO-05  | Native storage security: zero plain-text passwords or JWTs in public files                      | Pending      | Pending          | Pending         | Pending                             | Open  |
| ISO-06  | Deep link destination sanitization: arbitrary URLs rejected, typed routes only                  | Pending      | Pending          | Pending         | Pending                             | Open  |

## Previous planning validation

- Passed: the existing `ComponentDocumentationAudit` reports no failures for `apps/cxmobile` and its four required files.
- Passed: `node --test tools/check-component-docs.test.mjs`, two tests.
- Passed: Prettier formatting for component documents.
- Passed globally: `node tools/check-component-docs.mjs` reports all 37 owners and four required files verified with zero failures.
- Pending: repository Docs reference synchronization. A read-only check found 111 stale reference/catalog entries, including these four new originals.
- Keep synchronization as a coordinated follow-up because the shared checkout contains other active documentation edits.

No client build, native install, browser journey, live API write, database migration, or store operation was performed.

## Refinement audit validation

- Passed: scoped component audit reports no cxmobile failures across the required documentation structure.
- Passed: local evidence links in all five Markdown documents resolve to existing files.
- Passed: component-documentation checker tests, two tests.
- Passed: Prettier formatting check for all five documents.
- Global component check now passes with all 37 owners verified.
- Repository Docs references remain stale, including cxmobile references. Global synchronization remains a coordinated follow-up.
- A01-A15 record implementation risks. Their runtime resolution remains open.

## M0 inventory validation

- Passed: 68 active routes, endpoints, actions, and permissions enumerated across Platform, CRM, Billing, Chat, Ecommerce, and Core.
- Passed: Feature evidence ledger expanded to 110 explicit verification rows covering all staff capabilities and security gates.
- Passed: All 71 referenced repository source files verified to exist on disk.
- Passed: Capacitor 7 and official plugins selected with matching Android SDK and iOS toolchain requirements.
- Passed: API prefix rewriting (`/api/app`, `/api/platform`), proxy aliases, and scope headers mapped.
- Passed: Source-only (Billing opening balances), hidden (Contact 360), and preview-only (Storefront shopping) classifications resolved.
- Passed: `node tools/check-component-docs.mjs` verified across all 37 component owners with zero failures.
- Passed: `node --test tools/check-component-docs.test.mjs` (2 tests passed).
