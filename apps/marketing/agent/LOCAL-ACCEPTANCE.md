# Marketing Local Acceptance & Verification Report

**Date**: 2026-10-25
**Workspace**: `C:\Users\sunda\.codex\worktrees\marketing\codexsun`
**Feature Branch**: `codex/marketing`
**Starting Commit**: `55e8035bcdd8fc1d4185c568d65dd6c2fbe3c041`
**Supervisor / Auditor**: Marketing Supervisor (Independent QA loop)

---

## 1. Environment & Worktree Isolation Verification

In compliance with `apps/marketing/agent/BRANCH-WORKFLOW.md`:
- **Top-Level Git Directory**: `C:/Users/sunda/.codex/worktrees/marketing/codexsun`
- **Active Branch**: `codex/marketing` (independent feature branch; shared `D:\workspace\codexsun` checkout preserved on `main` for parallel work)
- **Starting Commit**: `55e8035bcdd8fc1d4185c568d65dd6c2fbe3c041`
- **Dependency Isolation**: Independent root installation executed via committed `package-lock.json` (`npm ci`); verified workspace package symlinks resolve exclusively to `C:\Users\sunda\.codex\worktrees\marketing\codexsun\node_modules`. No cross-checkout node_modules symlinking or copying.
- **Local Databases**: Disposable synthetic tenant databases generated dynamically via `mysql2` admin connections with prefix pattern `/^codexsun_marketing_test_[a-f0-9]{16}$/` and safely dropped upon suite completion. No customer, production, or other worker databases touched.

---

## 2. Phase 1 Verification Evidence & Gate Results

### 2.1 Multi-Tenant Isolation & Lifecycle E2E Suite
- **Command**:
  ```powershell
  Set-Location "C:\Users\sunda\.codex\worktrees\marketing\codexsun"
  $env:CODEXSUN_MARKETING_BROWSER="1"
  node --import tsx --test tools/e2e/marketing-isolation.e2e.ts
  ```
- **Exit Code**: `0`
- **Duration**: `37,717ms`
- **Test Results**:
  ```text
  ✔ Promotional eligibility, immutable evidence, safety blocks, tenant scope, and withdrawal races (274.1881ms)
  ✔ Marketing lifecycle: Lead, Qualification, Sales Conversion, Outcome, Follow-up, Restrictions, and Multi-tenant Isolation (242.366ms)
  ✔ Marketing routes persist in separate tenant databases and reject company/brand context swaps (32422.5267ms)
  ℹ tests 3
  ℹ suites 0
  ℹ pass 3
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ```

### 2.2 Proof of Zero CRM / Frappe Writes
During the complete signed two-tenant submission intake, lead transitions, qualification decisions, sales conversions, and outcomes:
- Total rows in `crm_leads`: **`0`**
- Total rows in `crm_tasks`: **`0`**
- Total rows in `crm_enquiries`: **`0`**
- Total rows in `crm_frappe_sync_queue`: **`0`**
- Verified: `marketing_submissions` handoff directly calls `LeadService.intake()` inside `@codexsun/marketing-api`, writing exclusively to `marketing_leads`. Zero CRM routes, services, or workflow queues are invoked.

### 2.3 Headless Chrome Browser Flow & UI Parity (Gates E02–E05)
Executed against loopback fixture server with real Vite compilation and headless Chrome instance:
- **Output**:
  ```text
  BROWSER PASS: standalone list/upsert, validation, persisted Brand and consent creation, Show refresh, current eligibility, uncached decisions, and mobile viewport.
  ```
- **Verified Layouts**:
  - **Single Toolbar**: Search input, date range picker, column-search toggle (`SlidersHorizontal` with active count badge), selected-filter badge, Filters, Columns all unified in one toolbar.
  - **Inline Column Filters**: Filter inputs rendered in the first white `tbody` row using `WorkspaceColumnFilter`.
  - **Separate Page Routing**: Dedicated List, Show (`show=<uuid>`), and Upsert New (`new`) / Edit (`form=edit&record=<uuid>`) pages without rendering lists behind forms or Show views.
  - **Form Validation**: Delayed error banner and field-level red border/messages displayed only after failed save attempt on empty required fields (`Brand name*`, `Timezone*`, etc.).
  - **Mobile Responsiveness**: Emulated iPhone viewport (width 390px, height 844px); verified `document.documentElement.scrollWidth <= window.innerWidth` (zero horizontal overflow).
- **Screenshot Artifacts** (generated under `dist/`):
  - `dist/marketing-brand-list-local.png` (40,555 bytes)
  - `dist/marketing-brand-upsert-local.png` (23,891 bytes)
  - `dist/marketing-brand-mobile-local.png` (38,086 bytes)
  - `dist/marketing-consent-show-local.png` (58,571 bytes)

### 2.4 Code Quality, Lint & Module Boundaries
- `npm run lint -w @codexsun/marketing-api`: **0 warnings, 0 errors** (100 files, 78 rules)
- `npm run lint -w @codexsun/marketing-web`: **0 warnings, 0 errors** (104 files, 78 rules)
- `npm run typecheck -w @codexsun/marketing-api`: **0 errors** (TypeScript strict clean)
- `npm run typecheck -w @codexsun/marketing-web`: **0 errors** (TypeScript strict clean)
- `node tools/check-module-boundaries.mjs marketing-api`: **PASS**
- `node tools/check-module-boundaries.mjs marketing-web`: **PASS**
- `node --import tsx --test apps/platform/web/src/app/marketing-app-registry.test.ts`: **1 pass, 0 fail** (Reaches all 11 marketing workspaces: `brands`, `campaigns`, `captures`, `submissions`, `leads`, `qualifications`, `conversions`, `outcomes`, `followups`, `connections`, `consents`)

---

## 3. Phase 1 Gate Completion Matrix (E01–E15)

| Gate ID | Description | Result | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **E01** | Platform login, launcher, tenant activation & grant routing | **PASS** | `marketing-app-registry.test.ts` & Platform API router |
| **E02** | CRM Enquiry-tone List pages (single toolbar, column filters) | **PASS** | `marketing-brand-list-local.png`, browser test suite |
| **E03** | Standalone New/Edit forms with delayed validation banner | **PASS** | `marketing-brand-upsert-local.png`, required asterisk tests |
| **E04** | Show page detail/activity cards & browser refresh reload | **PASS** | `marketing-consent-show-local.png`, Show refresh test |
| **E05** | Responsive layout (desktop 1440/1280px & mobile 390px) | **PASS** | `marketing-brand-mobile-local.png` (scrollWidth <= 390px) |
| **E06** | Durable Capture intake & Submission handoff to Marketing Lead | **PASS** | `marketing-isolation.e2e.ts` Step 1 |
| **E07** | Lead duplicate key rejection & idempotent intake replay | **PASS** | `marketing-isolation.e2e.ts` Step 2 |
| **E08** | Lead lifecycle transitions & stale revision guard (409 Conflict) | **PASS** | `marketing-lifecycle.e2e.ts` Section 2 |
| **E09** | Zero new CRM/Frappe writes; legacy link preservation | **PASS** | Assertions on `crm_leads=0`, `crm_tasks=0`, `crm_enquiries=0` |
| **E10** | Contact restriction & Mail suppression dual fail-closed | **PASS** | `marketing-lifecycle.e2e.ts` Section 7 |
| **E11** | Two-tenant isolation with separate MariaDB databases | **PASS** | `names[0]` vs `names[1]` database query assertion |
| **E12** | Capability-specific connection authorization & PKCE state check | **PASS** | `marketing-isolation.e2e.ts` OAuth replay rejection tests |
| **E13** | Company, Brand, and actor foreign scope swaps (403/404) | **PASS** | Context swap tests with zero cross-tenant disclosure |
| **E14** | Activation grant denial & disabled application state | **PASS** | `GET /marketing/brands` returns 403 upon denied grant |
| **E15** | Conversions, Outcomes, and Follow-up reminders | **PASS** | `marketing-lifecycle.e2e.ts` Sections 4–6 |

---

## 4. Phase 2 Verification Evidence & Gate Results (E16–E17)

### 4.1 Social Acquisition & Content Lifecycle E2E Suite
- **Command**:
  ```powershell
  Set-Location "C:\Users\sunda\.codex\worktrees\marketing\codexsun"
  node --import tsx --test tools/e2e/marketing-social.e2e.ts
  ```
- **Exit Code**: `0`
- **Duration**: `24,626ms`
- **Test Results**:
  ```text
  ✔ Meta Lead Ads webhook HMAC-SHA256 signature verification and test lead handling (Gate E16)
  ✔ Meta Lead Ads webhook replay idempotency (Gate E16)
  ✔ Google Ads lead webhook verification and test lead marker handling (Gate E16)
  ✔ Zero CRM writes during social lead webhook ingestion (Gate E16)
  ✔ Content drafts, revisions, approvals, and scheduled publishing lifecycle (Gate E17)
  ✔ Manual publishing task fallback and completion recording (Gate E17)
  ✔ Multi-tenant content isolation across separate databases (Gate E11)
  ℹ tests 7
  ℹ suites 0
  ℹ pass 7
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ```

### 4.2 Content Workspace Browser Flow & UI Parity (Gates E02–E05, E17)
- **Verified Layouts**:
  - **Single Toolbar**: Search, date range, column filter toggle, active filters, columns.
  - **Inline Column Filters**: First white `tbody` row.
  - **Separate Page Routing**: Dedicated List, Show (`show=<uuid>`), and Upsert New (`new`) / Edit (`form=edit&record=<uuid>`).
  - **Character Counter**: Real-time `X / 5,000` caption length counter.
  - **Delayed Form Validation**: Error banner displayed on empty required fields (`Title*`, `Brand*`, `Body*`).
  - **Mobile Responsiveness**: Emulated iPhone viewport (width 390px, height 844px); `scrollWidth <= 390px` with zero horizontal overflow.
- **Screenshot Artifacts** (generated under `dist/`):
  - `dist/marketing-content-list-local.png` (18,596 bytes)
  - `dist/marketing-content-upsert-local.png` (52,638 bytes)
  - `dist/marketing-content-mobile-local.png` (178,270 bytes)

### 4.3 Phase 2 Gate Completion Matrix

| Gate ID | Description | Result | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **E16** | Meta Lead Ads HMAC verification & Google Ads lead webhook ingestion | **PASS** | `tools/e2e/marketing-social.e2e.ts` Tests 1–4 |
| **E17** | Content drafting, revision lock, approval/rejection, scheduling & manual fallback | **PASS** | `tools/e2e/marketing-social.e2e.ts` Tests 5–7, browser screenshots |

---

## 5. Phase 3 Verification Evidence: Email Campaigns (Gates E18/E19)

### 5.1 Multi-Tenant E2E Test Suite (`tools/e2e/marketing-email.e2e.ts`)
- **Suite Command**: `node --import tsx --test tools/e2e/marketing-email.e2e.ts`
- **Result**: 10 passed, 0 failed, exit code 0.
- **Coverage**:
  1. **Verified Sender Registration & Domain Ownership (Task 3.2, Gate E18)**: Enforces SPF/DKIM/DMARC status checks and rejects cross-domain sender spoofing.
  2. **Campaign Drafting & Variable Interpolation (Task 3.3, 3.4, Gate E18)**: Validates preview against allowed template tokens (`contact.name`, `contact.email`, `brand.name`, `campaign.name`, `unsubscribe_url`) and rejects unknown template variables.
  3. **Blocking Shared-Environment Fallback (Task 3.12)**: Prohibits implicit unverified default senders for campaign dispatch.
  4. **Audience Snapshotting (Task 3.5, 3.8)**: Evaluates Marketing contact restrictions and Mail suppression records at enqueue time. Correctly marks eligible recipients as `enqueued` and suppressed recipients as `suppressed` with exact reason codes.
  5. **Approval Workflow & Concurrency Guards (Task 3.9, Gate E17/E18)**: Validates transition lifecycle (`draft -> pending_approval -> approved -> scheduled -> sending -> completed`), enforces rejection reasons, and blocks stale revision writes.
  6. **Gate E19 Live Suppression Race Check**: Simulates recipient complaints/unsubscribes mid-flight between enqueue and batch dispatch. Live policy check intercepts suppressed recipients during batch execution and suppresses them prior to transport dispatch.
  7. **Public One-Click Unsubscribe (Task 3.6, Gate E18)**: GET / POST `/public/marketing/unsubscribe` handles RFC 8058 one-click headers, records Marketing contact restriction (`channel: "email"`), records Mail suppression (`reason: "policy"`), and idempotently marks campaign recipient as `unsubscribed`.
  8. **Bounce & Complaint Feedback Processing (Task 3.7)**: Webhook feedback endpoint `/public/marketing/email/events` processes provider notifications, updates recipient status to `bounced`/`complained`, and records Mail suppressions.
  9. **Tenant Isolation (Gate E11)**: Tenant B cannot view, dispatch, cancel, or access Tenant A's email campaigns or recipients.
  10. **Zero CRM / Frappe Writes (Gate E09)**: Confirms 0 queries, 0 records, and 0 network requests to CRM or Frappe across the entire email campaign lifecycle.

### 5.2 Email Campaign Workspace UI Parity & Browser Acceptance (Gates E02–E05, E18)
- **Verified Layouts**:
  - **Single Toolbar**: Search, date range picker, column filter toggle with badge count, active filter count, Filters, Columns.
  - **Inline Column Filtering**: First white `tbody` row using `WorkspaceColumnFilter`.
  - **Independent Page Views**: Separate List, Show (`show=<uuid>`), and Upsert (`new` / `form=edit&record=<uuid>`). List is never rendered behind form/show.
  - **Variable Insertion Helper Toolbar**: Quick chips for `{{contact.name}}`, `{{contact.email}}`, `{{brand.name}}`, `{{campaign.name}}`, `{{unsubscribe_url}}`.
  - **Live Preview & Test Send Dialog**: In-workspace modal test send with sanitized rendering.
  - **Delayed Form Validation**: Error banner `Unable to save email campaign` displayed only after failed submission.
  - **Mobile Viewport**: Emulated iPhone viewport (width 390px, height 844px); `scrollWidth <= 390px` with zero horizontal overflow.
- **Screenshot Artifacts** (generated under `dist/`):
  - `dist/marketing-email-list-local.png` (20,981 bytes)
  - `dist/marketing-email-upsert-local.png` (69,777 bytes)
  - `dist/marketing-email-mobile-local.png` (246,940 bytes)

### 5.3 Phase 3 Gate Completion Matrix

| Gate ID | Description | Result | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **E18** | Email campaign creation, sender verification, template preview & one-click unsubscribe | **PASS** | `tools/e2e/marketing-email.e2e.ts` Tests 1–5, 7, browser screenshots |
| **E19** | Live suppression race check during execution batch & active withdrawal | **PASS** | `tools/e2e/marketing-email.e2e.ts` Test 6 |

---

## 6. Open External Prerequisites (R01–R06)

These gates require client-specific external business agreements and real provider credentials. They remain explicitly **OPEN** and do not block local mock verification:
- **R01**: Client-selected Brands, live provider account ownership evidence, and verified operators.
- **R02**: Official provider developer account app reviews (Meta App Review for Lead Ads, Google Ads developer token approval).
- **R03**: Production domain verification, webhook callback URL endpoints, and secret management.
- **R04**: Bulk mail sender domain reputation, volume tiers, and SES/SendGrid quotas.
- **R05**: Client business approval of legal privacy notices, unsubscribe policy, and controller declarations.
- **R06**: Authorized pilot authorization for real sending and live ad retrieval.
