# Provider Readiness & Cutover Assessment

- Date: 2026-10-25
- Role: Integration Worker (INT)
- Supervisor: marketing-supervisor
- Tasks: Wave 1A / Task 1.5, 1.12, 1.13, R01-R06
- Leased Files:
  - `apps/marketing/api/src/modules/connection/connection.google.ts`
  - `apps/marketing/api/src/modules/connection/connection.types.ts`
  - `apps/marketing/agent/PROVIDER-READINESS.md`

---

## 1. Executive Summary

This assessment establishes the technical inventory and integration foundation for the Marketing application within CODEXSUN:

1. **Cutover Inventory Verification (Task 1.12, 1.13)**: Verified that all legacy submission records linking to CRM Lead IDs remain immutable, un-replayed, and un-migrated. The cutover path guarantees zero writes or modifications to CRM or Frappe, and strictly prevents reinterpretation of CRM UUIDs as Marketing Lead UUIDs.
2. **Connector Foundation & OAuth Security (Task 1.5)**: Verified the implementation of RFC 7636 PKCE (`S256`), strict session identity binding (`session.uuid` + actor email + company ID), 10-minute expiry state validation with database row locking (`FOR UPDATE`), single-use replay protection, AES-256-GCM authenticated grant encryption with tenant/company/connection AAD, and cross-tenant collision prevention using opaque SHA-256 account hashing that leaks zero foreign metadata.
3. **Provider Readiness Assessment (R01–R06)**: Completed an in-depth review of Phase 2 channels (Meta Lead Ads, Google Ads webhook, Facebook Page publishing, Instagram Professional publishing) and Phase 3 channels (Mail campaigns, verified sender domain, bounce/complaint suppression), documenting dated capabilities, official API endpoints, scopes, app review gates, quotas, and supported local fallbacks.

---

## 2. Legacy Marketing-to-CRM Cutover Inventory & Verification

### 2.1 Legacy Submission Record State & Structure

In the previous implementation architecture, submissions captured via landing pages or Sites forwarded into `marketing_submissions` in the tenant database:

- **Table**: `marketing_submissions`
- **Identity & Public Reference**: `id INT AUTO_INCREMENT PRIMARY KEY`, `uuid CHAR(8) NOT NULL UNIQUE`.
- **Legacy Lead Linkage Column**: `lead_uuid CHAR(8) NULL`. Under legacy processing, this column stored the 8-character hex UUID of a CRM Lead created via `@codexsun/crm-api` (`acceptMarketingLead`).
- **Processing Status**: `status VARCHAR(24) NOT NULL DEFAULT 'pending'`, transitioning to `'delivered'` upon handoff completion, with `delivered_at DATETIME NULL`.

### 2.2 Proof of Immutability

Submission records are protected against mutation through database constraints and repository logic:

1. **Unique Key Constraint**:
   ```sql
   UNIQUE KEY submission_source (company_id, capture_uuid, source_key)
   ```
2. **Payload Hash Integrity Check**:
   In `SubmissionRepository.accept(...)`:
   - Computes `hash = sha256(JSON.stringify(input))`.
   - Executes `INSERT ... ON DUPLICATE KEY UPDATE id=id`.
   - Validates that `existing.payload_hash === hash`.
   - If a submission with the same `source_key` arrives with differing content, it throws `AppError.conflict("Submission key was reused with different content.")`.
   - If the payload matches, the existing record is returned without modification.
3. **No Update Routes**:
   The HTTP route surface (`apps/marketing/api/src/modules/submission/submission.routes.ts`) exposes only `GET /marketing/submissions`, `GET /marketing/submissions/:uuid`, and `POST /marketing/submissions` (creation). There is no `PUT` or `PATCH` route for submissions.

### 2.3 Proof of Un-Replayed and Un-Migrated Status

1. **Queue & Polling Exclusion**:
   - The handoff sync query in `submission.sync.ts` explicitly filters:
     ```sql
     SELECT id, uuid, company_id AS companyId, created_by AS actorEmail
     FROM marketing_submissions
     WHERE status='pending' AND id > ?
     ORDER BY id LIMIT 100
     ```
   - Delivered submissions (`status = 'delivered'`) are never returned by this query and are therefore never re-enqueued.
2. **Worker Short-Circuit**:
   - In `submission.worker.ts` (`processSubmissionHandoff`):
     ```typescript
     if (row.status === "delivered") {
       return { uuid, leadUuid: row.leadUuid, status: "delivered" };
     }
     ```
   - If a duplicate job is processed by a worker, it short-circuits immediately without calling the intake function, ensuring zero duplicate lead creation.
3. **Sites Outbox Forwarding (Task 1.13)**:
   - When Sites replays outbox batches or recovers from a network interruption, it uses deterministic `source_key` identifiers.
   - The tenant database recognizes the existing submission, confirms the matching payload hash, and returns the existing delivered receipt without triggering a new intake action.

### 2.4 Cutover Invariants & Rules

To preserve database and boundary integrity during and after cutover to the new Marketing-owned sales lifecycle:

- **No Direct CRM/Frappe Writes**: Marketing code, workers, and migrations must not write to `crm_*` tables or Frappe adapters.
- **No Lead UUID Relabeling**: A CRM Lead UUID stored in `marketing_submissions.lead_uuid` must never be queried against `marketing_leads`. It remains permanently as historical evidence of legacy handoff.
- **No Retroactive Migration**: Legacy delivered records must not be converted, cloned, or imported into the new `marketing_leads` table. New Marketing Leads originate only from new submissions processed after cutover.
- **Idempotent Cutover Switch**: When `marketing-host.ts` switches the queue handler `marketing.submission.handoff` from `acceptMarketingLead` to the internal Marketing Lead intake service, all existing `delivered` rows remain untouched because the worker skips them.

---

## 3. Connector Foundation & OAuth Security Verification

### 3.1 RFC 7636 PKCE Implementation

- **Code Verifier**: 32 bytes of cryptographically secure randomness generated via `randomBytes(32).toString("base64url")`.
- **Code Challenge**: Computed via `createHash("sha256").update(verifier).digest("base64url")` with `code_challenge_method = "S256"`.
- **Verifier Storage**: The verifier is encrypted using AES-256-GCM (`sealConnection`) before insertion into `marketing_connection_oauth.verifier_secret`.
- **Exchange Verification**: During OAuth callback completion, the verifier is decrypted (`openConnection`) and submitted to the token endpoint (`code_verifier: verifier`) in `connection.google.ts`.

### 3.2 Session Identity Binding & Anti-Replay State Validation

In `ConnectionAuthorizationService` (`connection.oauth.ts`):

1. **OAuth Begin Phase**:
   - Generates state: `state = uuid + "." + randomBytes(32).toString("base64url")`.
   - Computes `stateHash = sha256(state)`.
   - Records session context in `marketing_connection_oauth`:
     - `company_id`: Authenticated tenant company ID.
     - `actor`: Authenticated user email (`context.actorEmail`).
     - `session_identity`: Active session UUID from signed token (`request.authContext.session.uuid`).
     - `state_hash`: Hex-encoded SHA-256 hash.
     - `expires_at`: `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)`.
2. **OAuth Complete Phase**:
   - Queries `marketing_connection_oauth` inside a database transaction with `FOR UPDATE`:
     ```sql
     SELECT id, verifier_secret FROM marketing_connection_oauth
     WHERE connection_uuid = ?
       AND company_id = ?
       AND actor = ?
       AND session_identity = ?
       AND state_hash = ?
       AND expires_at > UTC_TIMESTAMP()
       AND used_at IS NULL
     FOR UPDATE
     ```
   - Validates that the callback request originates from the **exact same session**, **exact same actor**, **exact same company**, and **exact same connection**.
   - Atomically updates `used_at = UTC_TIMESTAMP()`. Any subsequent attempt to use the same state is rejected with `AppError.forbidden("Authorization state is expired, reused, or belongs to another session.")`.
3. **Account Selection Phase**:
   - Validates that `selection_at IS NULL` and sets `selection_at = UTC_TIMESTAMP()`.
   - Verifies that the chosen account ID exists within the verified accounts list returned by the provider.

### 3.3 Encrypted Grant Storage

In `connection.secrets.ts`:

- **Cipher Algorithm**: AES-256-GCM with a 12-byte initialization vector (`randomBytes(12)`).
- **Key Derivation**: SHA-256 hash of `"codexsun.marketing.v1:" + secret`.
- **Authenticated Additional Data (AAD)**: Explicitly set to the composite identity:
  ```typescript
  identity = tenantId + ":" + companyId + ":" + connectionUuid;
  ```
- **Envelope Structure**: `"v1." + nonce.base64url + "." + authTag.base64url + "." + ciphertext.base64url`.
- **Security Guarantees**:
  - Encrypted grants cannot be decrypted or transplanted into another tenant, company, or connection without causing a GCM authentication tag verification failure.
  - Plaintext tokens (access tokens, refresh tokens) are never persisted in unencrypted database columns or application logs.

### 3.4 Cross-Tenant Account Collision Checks (Zero Leakage)

In `apps/platform/api/src/modules/app-registry/app-registry.account-claims.ts`:

- **Collision Boundary Table**: `provider_account_claims` in the Platform database.
- **Account Identity Hashing**: `account_hash = sha256(provider + ":" + account)`. The external account identifier is never stored as plaintext in shared platform tables.
- **Claim Enforcement**:
  ```typescript
  await sql`INSERT INTO provider_account_claims(uuid, account_hash, provider, tenant_uuid, connection_uuid)
    VALUES(..., ${hash}, ${provider}, ${tenant}, ${connection})
    ON DUPLICATE KEY UPDATE account_hash=account_hash`.execute(this.database);

  const row = await queryClaimByHash(hash);
  if (!row || row.tenant_uuid !== tenant || row.connection_uuid !== connection) {
    throw AppError.conflict("This provider account cannot be attached to this connection.");
  }
  ```
- **Privacy & Security Guarantee**:
  - If Tenant A has connected a provider account, Tenant B attempting to connect the same account receives an opaque conflict error.
  - The error message does not disclose which tenant, organization, or connection holds the claim, preventing cross-tenant reconnaissance.

---

## 4. Phase 2 & Phase 3 Provider Readiness Assessment (R01–R06)

### 4.1 R01–R06 Framework Definition

- **R01 (Account Ownership & Identity)**: Client-selected Brands/accounts, verified account ownership evidence, and designated authorized operators.
- **R02 (Official Capabilities & Review Gates)**: Documented official API capabilities, required scopes, App Review approval gates, rate limits, and cost quotas.
- **R03 (App Configuration & Lifecycle)**: Provider developer application setup, privacy/data deletion callback URLs, domain verification, and credential rotation/revocation plans.
- **R04 (Bulk Transport & Safety)**: Verified bulk transport provider, sender domain reputation, bounce/complaint feedback loops, and volume caps (Mail).
- **R05 (Notices & Governance)**: Business-approved consent wording, sender branding, controller scope, provenance tracking, and data retention schedules.
- **R06 (Authorized Pilot)**: Per-tenant capability evidence and authorized controlled pilots prior to general operational release.

---

### 4.2 Phase 2: Meta Lead Ads (Task 2.1)

#### Technical Capabilities & Specification

- **Capability Key**: `meta.leadgen.receive`
- **Architecture**: Inbound webhook notification (`leadgen` topic) combined with Graph API retrieval of lead field data.
- **Official Endpoints**:
  - Webhook subscription endpoint: `POST /marketing/public/webhooks/meta-leadgen`
  - Subscription handshake: `GET /marketing/public/webhooks/meta-leadgen` (`hub.mode`, `hub.verify_token`, `hub.challenge`)
  - Page app subscription: `POST https://graph.facebook.com/v21.0/{page_id}/subscribed_apps?subscribed_fields=leadgen`
  - Lead detail retrieval: `GET https://graph.facebook.com/v21.0/{leadgen_id}`
  - Form schema inspection: `GET https://graph.facebook.com/v21.0/{form_id}`

#### Required Permissions & Scopes

- `leads_retrieval`: Permission to read form submission data.
- `pages_show_list`: Permission to list user-managed Facebook Pages.
- `pages_read_engagement`: Permission to read page events and webhook metadata.
- `pages_manage_metadata`: Permission to install the webhooks application onto the Page.

#### App Review & Access Tiers

- **Development / Standard Access**: Allows retrieval of test leads created via the Meta Lead Ads Testing Tool by registered app administrators, developers, or testers.
- **Production / Advanced Access**: Requires Meta App Review approval for `leads_retrieval`.
- **Prerequisites**: Meta Business Verification (legal business name, address, phone verification), Privacy Policy URL, and User Data Deletion callback URL.

#### Security & Signature Verification

- Inbound webhooks must verify the `X-Hub-Signature-256` HTTP header:
  ```typescript
  const expectedSignature =
    "sha256=" + createHmac("sha256", appSecret).update(rawPayload).digest("hex");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw AppError.forbidden("Invalid Meta webhook signature.");
  }
  ```
- Replay prevention: `leadgen_id` mapped to `source_key` with unique database constraint.

#### Quotas & Rate Limits

- Graph API User / Page request limits: 200 calls per hour per ad account/page.
- Webhook delivery SLA: Near real-time (typically under 5 seconds from submission on Facebook/Instagram).

#### Supported Local Fallback

- **Manual Import**: Export leads as CSV/XLSX from Meta Business Suite (Leads Center) and upload via Marketing CSV import.
- **Synthetic Testing**: Local synthetic webhook payload generator simulating Meta `leadgen` event with mock Graph API server.

#### R01–R06 Readiness Summary

| Item    | Status | Verification Detail                                                                       |
| :------ | :----- | :---------------------------------------------------------------------------------------- |
| **R01** | Open   | Client must link Facebook Page to Marketing Brand and designate authorized Page Admin.    |
| **R02** | Ready  | Graph API v21.0 endpoints and scopes documented; App Review required for live data.       |
| **R03** | Ready  | OAuth callback, privacy policy, and data deletion URLs defined in platform specification. |
| **R04** | N/A    | Applies to email transport (see Section 4.6).                                             |
| **R05** | Open   | Client must configure form privacy policy and consent notice version in Meta Lead Form.   |
| **R06** | Open   | Requires sandbox pilot using Meta Lead Ads Testing Tool prior to live ad spend.           |

---

### 4.3 Phase 2: Google Ads Lead Webhook (Task 2.2)

#### Technical Capabilities & Specification

- **Capability Key**: `google.ads.leads.webhook`
- **Architecture**: Inbound webhook pushed directly from Google Ads Lead Form extension to tenant capture endpoint.
- **Official Inbound Endpoint**: `POST /marketing/public/captures/:uuid/google-ads`
- **Documentation**: Google Ads Lead Form Webhook Overview (`https://developers.google.com/google-ads/webhook/docs/overview`).

#### Authentication & Payload Verification

- **Shared Webhook Key**: Configured in Google Ads Lead Form extension as `key`.
- **Payload Verification**: Marketing verifies `body.google_key === capture.webhook_secret`.
- **Test Submissions**: Google provides a "Send Test Data" button in the Ads UI which transmits `is_test: true`.
- **Test Data Policy**: Submissions with `is_test: true` are recorded with a synthetic flag, enabling full end-to-end pipeline verification without polluting production metrics.

#### Scopes & Permissions

- Push webhook requires **no OAuth scopes** or Google Cloud credentials for lead reception.
- If bidirectional synchronization or offline conversion upload is added later, requires OAuth scope `https://www.googleapis.com/auth/adwords` and a Google Ads Developer Token.

#### Payload Structure & Limits

- Payload contains `lead_id`, `form_id`, `campaign_id`, `gclid`, and `user_column_data` array.
- Supports up to 10 standard and custom questions (e.g. `FULL_NAME`, `EMAIL`, `PHONE_NUMBER`, `COMPANY_NAME`, `POSTAL_CODE`).

#### Supported Local Fallback

- **CSV Export**: Direct download of leads from Google Ads UI -> Marketing CSV import.
- **Local Fixture**: Test endpoint accepting mock Google Ads JSON payload with `is_test: true`.

#### R01–R06 Readiness Summary

| Item    | Status | Verification Detail                                                                        |
| :------ | :----- | :----------------------------------------------------------------------------------------- |
| **R01** | Open   | Client must configure Google Ads account and assign lead form management role.             |
| **R02** | Ready  | Lead form webhook payload and key verification contract frozen and documented.             |
| **R03** | Ready  | Webhook URL and shared secret generation handled via Marketing Capture settings.           |
| **R04** | N/A    | Applies to email transport.                                                                |
| **R05** | Open   | Google Ads lead form requires explicit business privacy policy link.                       |
| **R06** | Open   | Verify test lead payload delivery via Google "Send Test" feature prior to campaign launch. |

---

### 4.4 Phase 2: Facebook Page Publishing (Task 2.5)

#### Technical Capabilities & Specification

- **Capability Key**: `facebook.pages.publish`
- **Architecture**: Graph API Page Feed and Media publishing.
- **Official Endpoints**:
  - Text & link post: `POST https://graph.facebook.com/v21.0/{page_id}/feed` (`message`, `link`)
  - Image post: `POST https://graph.facebook.com/v21.0/{page_id}/photos` (`url`, `caption`, `published: true`)
  - Post inspection: `GET https://graph.facebook.com/v21.0/{post_id}?fields=id,created_time,shares,reactions`

#### Required Permissions & Scopes

- `pages_manage_posts`: Required to create, publish, or delete posts.
- `pages_read_engagement`: Required to read post engagement metrics.
- `pages_show_list`: Required to obtain Page IDs and exchange user tokens for Page Access Tokens.

#### Token Management

- The user grants permissions via OAuth -> Marketing retrieves Page Access Token via `GET /me/accounts` -> Page Access Token is encrypted and stored in `marketing_connection_grants`.
- Never use user-level access tokens directly for page feed publication.

#### Quotas & Limits

- Rate limit: 200 posts per page per 24 hours (operational safety recommendation: max 25 scheduled posts/day).
- Media specifications: Images up to 10MB; minimum resolution 200x200px; JPEG/PNG.

#### Supported Local Fallback

- **Manual Publishing Task**: System generates a calendar task containing the approved post copy, media download links, and direct link to Facebook Page Composer. Operator clicks "Mark as Published" and records post URL.

#### R01–R06 Readiness Summary

| Item    | Status | Verification Detail                                                              |
| :------ | :----- | :------------------------------------------------------------------------------- |
| **R01** | Open   | Client must provide Page ID and admin identity.                                  |
| **R02** | Ready  | Graph API v21.0 publishing parameters and Page token exchange verified.          |
| **R03** | Ready  | OAuth flow and callback registered under CODEXSUN Meta App configuration.        |
| **R04** | N/A    | Applies to email transport.                                                      |
| **R05** | Open   | Approved brand guidelines and disclaimer policies for social posts.              |
| **R06** | Open   | Test draft post on restricted unpublished test page before live feed publishing. |

---

### 4.5 Phase 2: Instagram Professional Publishing (Task 2.6)

#### Technical Capabilities & Specification

- **Capability Key**: `instagram.content.publish`
- **Architecture**: Asynchronous two-step container-based publishing via Instagram Graph API.
- **Official Endpoints**:
  - Step 1 (Create Container): `POST https://graph.facebook.com/v21.0/{ig_user_id}/media`
    - Photo: `image_url={url}&caption={text}`
    - Reels video: `media_type=REELS&video_url={url}&caption={text}&share_to_feed=true`
    - Carousel: `media_type=CAROUSEL&children={c1,c2}`
  - Step 2 (Check Status): `GET https://graph.facebook.com/v21.0/{container_id}?fields=status_code,status` (must reach `FINISHED`).
  - Step 3 (Publish Container): `POST https://graph.facebook.com/v21.0/{ig_user_id}/media_publish?creation_id={container_id}`

#### Required Permissions & Scopes

- `instagram_basic`: Read profile identity and account ID.
- `instagram_content_publish`: Create and publish media containers.
- `pages_show_list`: Enumerate linked Facebook Pages.

#### Account Pre-requisites & Rules

- Must be an **Instagram Professional Account** (Business or Creator). Personal Instagram accounts cannot publish via API.
- Must be linked to a Facebook Page within Meta Business Suite.
- The media URL must be hosted on a public HTTPS server reachable by Meta's crawlers during container ingestion.

#### Publishing Limits & Constraints

- Hard Limit: **50 API-published posts per rolling 24-hour period** per Instagram account.
- Aspect Ratios:
  - Photos: Between 4:5 (portrait) and 1.91:1 (landscape). Recommended square (1:1).
  - Reels: 9:16 vertical video only, duration 3 seconds to 15 minutes, max file size 1GB.

#### Supported Local Fallback

- **Mobile Push / Desktop Calendar Task**: Scheduled task with one-click copy of caption/hashtags, one-click asset download, and notification to mobile operator for native Instagram publication.

#### R01–R06 Readiness Summary

| Item    | Status | Verification Detail                                                                    |
| :------ | :----- | :------------------------------------------------------------------------------------- |
| **R01** | Open   | Confirm Instagram account is Professional and linked to Page in Meta Business Suite.   |
| **R02** | Ready  | Two-step container API flow, 50 post/day cap, and aspect ratio constraints documented. |
| **R03** | Ready  | Managed under Meta Developer App configuration alongside Facebook Page integration.    |
| **R04** | N/A    | Applies to email transport.                                                            |
| **R05** | Open   | Marketing asset guidelines and required hashtag disclosures defined by Brand.          |
| **R06** | Open   | Sandbox container creation and publish test on staging Instagram account.              |

---

### 4.6 Phase 3: Mail Campaigns & Dedicated Bulk Transport (Tasks 3.1–3.12)

#### Technical Capabilities & Specification

- **Capability Key**: `mail.campaign.send`
- **Architecture**: Transport managed strictly via `@codexsun/mail-api`. Marketing defines audiences, templates, and schedules, while Mail enforces sender authentication and delivery safety.
- **Zero Shared-Sender Fallback**: Campaigns must never fall back to platform default SMTP or shared system accounts. Every campaign must bind to an authenticated, verified tenant sender.

#### Deliverability & Domain Authentication Prerequisites

1. **SPF (Sender Policy Framework)**:
   - Tenant sending domain must include provider SPF record:
     `v=spf1 include:spf.mailprovider.com ~all`
2. **DKIM (DomainKeys Identified Mail)**:
   - Minimum 2048-bit DKIM key published via DNS CNAME/TXT records.
   - Header: `DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d={sending_domain}; ...`
3. **DMARC (Domain-based Message Authentication, Reporting & Conformance)**:
   - Published at `_dmarc.{sending_domain}`:
     `v=DMARC1; p=reject; rua=mailto:dmarc-reports@{sending_domain}; pct=100`
   - Alignment: From address domain must align with SPF and DKIM domains.
4. **Custom Return-Path (Bounce Domain)**:
   - Subdomain (e.g. `bounces.mail.{domain}`) configured with CNAME to mail provider for automated bounce detection.

#### Unsubscribe Compliance & RFC 8058 Support

- Visible unsubscribe link in HTML body and plain-text alternative.
- Mandatory RFC 8058 / RFC 2369 email headers:
  ```text
  List-Unsubscribe: <https://app.codexsun.com/mail/unsubscribe?token={token}>, <mailto:unsubscribe@{domain}?subject=unsubscribe>
  List-Unsubscribe-Post: List-Unsubscribe=One-Click
  ```
- **Bot-Safe Unsubscribe**: Inbound GET request to the unsubscribe URL renders a confirmation prompt (preventing automated security scanners from inadvertently opting users out). The POST action or user button click executes the actual opt-out.

#### Rate Limiting, IP Warmup & Cost Caps

- **Dedicated IP Warmup Ramp**:
  - Days 1–2: 50 emails/day
  - Days 3–4: 200 emails/day
  - Days 5–6: 500 emails/day
  - Days 7–8: 1,500 emails/day
  - Week 2: 5,000 emails/day
  - Week 3+: Scaled to contracted volume.
- **Tenant Quotas**: Hourly and daily volume caps enforced at the tenant level.
- **Fail-Closed Financial Cap**: Sending halts if tenant email credits or billing thresholds are exceeded.

#### Supported Local Fallback

- Local in-memory mock transport provided by `@codexsun/mail-api` for development and testing.
- Test-recipient delivery: Send approved campaign draft to verified test address (`test@example.test`) without impacting campaign metrics.

#### R01–R06 Readiness Summary

| Item    | Status | Verification Detail                                                                 |
| :------ | :----- | :---------------------------------------------------------------------------------- |
| **R01** | Open   | Tenant must declare sending domain and designated marketing email administrator.    |
| **R02** | Ready  | RFC 8058 headers, SPF/DKIM/DMARC specifications, and warmup ramp frozen.            |
| **R03** | Ready  | Sender domain verification via DNS TXT records defined in Mail module.              |
| **R04** | Open   | Provider contract (SES, Postmark, SendGrid) and volume cap allocated per tenant.    |
| **R05** | Open   | Physical postal address and company legal disclaimer approved for campaign footer.  |
| **R06** | Open   | End-to-end warmup test with test-recipient verification prior to audience dispatch. |

---

### 4.7 Phase 3: Bounce & Complaint Delivery Safety Suppression (Tasks 3.7–3.8)

#### Technical Capabilities & Specification

- **Capability Key**: `mail.suppression.sync`
- **Architecture**: Delivery safety suppression ledger owned by `@codexsun/mail-api`.

#### Suppression Triggers & Categories

1. **Hard Bounces (Permanent SMTP 5xx)**:
   - Mailbox does not exist (550 5.1.1), domain not found, or address rejected.
   - Immediate and permanent suppression.
2. **Spam Complaints (ARF Feedback Loops)**:
   - Recipient clicks "Report Spam" in Gmail, Yahoo, Microsoft, etc.
   - Provider webhooks notify Mail -> Immediate and permanent suppression.
3. **Unsubscribe Requests**:
   - Recipient clicks unsubscribe link or uses RFC 8058 One-Click.
   - Recorded as channel-specific opt-out.

#### Dual-Gate Verification (Consent vs. Suppression)

- **Gate 1 (Marketing Consent)**: Marketing checks that the recipient has an active, unexpired promotional consent record.
- **Gate 2 (Mail Delivery Safety)**: Mail checks that the recipient is not present in `mail_suppressions`.
- **Invariance Rule**: **Consent never clears a Mail suppression.** A newly submitted consent form or re-opt-in cannot bypass a recorded spam complaint or hard bounce. Suppression records can only be cleared through an audited administrative review confirming address rehabilitation.

#### Active-Batch Withdrawal

- During multi-batch campaign dispatch, every chunk re-queries suppression status immediately before calling the transport adapter.
- If a recipient unsubscribes or files a complaint while a campaign is actively sending, all subsequent unsent messages to that recipient are immediately aborted.

#### Supported Local Fallback

- Local SQLite / MySQL suppression table fixture populated with synthetic bounced addresses for automated E2E tests (`tools/e2e/marketing-isolation.e2e.ts`).

#### R01–R06 Readiness Summary

| Item    | Status | Verification Detail                                                                |
| :------ | :----- | :--------------------------------------------------------------------------------- |
| **R01** | Open   | Tenant administrator assigned to inspect and manage bounce/complaint alerts.       |
| **R02** | Ready  | Dual-gate check contract and active-batch suppression re-query verified.           |
| **R03** | Ready  | Inbound webhook endpoints for bounce/complaint ingestion defined in Mail contract. |
| **R04** | Open   | Feedback loop (FBL) registration configured with major mailbox providers.          |
| **R05** | Ready  | Zero-tolerance policy: complaints cause permanent delivery suppression.            |
| **R06** | Ready  | Verified in synthetic local fixtures; pending live provider FBL validation.        |

---

## 5. Channel Capability & Fallback Matrix

| Channel                | Task ID | Live Capability                         | Official Endpoint / Protocol                                       | Required Permissions / Auth                                           | Supported Local Fallback                                      |
| :--------------------- | :------ | :-------------------------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------ |
| **Meta Lead Ads**      | 2.1     | Inbound lead webhook & detail retrieval | `POST /webhooks/meta-leadgen`<br>`GET /v21.0/{leadgen_id}`         | `leads_retrieval`<br>`pages_manage_metadata`<br>`X-Hub-Signature-256` | Meta CSV export import;<br>Synthetic webhook generator        |
| **Google Ads Webhook** | 2.2     | Lead form extension push webhook        | `POST /captures/:uuid/google-ads`                                  | Shared webhook secret key (`google_key`);<br>`is_test` flag handling  | Google Ads CSV export import;<br>Synthetic test payload       |
| **Facebook Pages**     | 2.5     | Feed and photo publishing               | `POST /v21.0/{page_id}/feed`<br>`POST /v21.0/{page_id}/photos`     | `pages_manage_posts`<br>`pages_read_engagement`<br>Page Access Token  | Calendar manual task with caption copy & media download       |
| **Instagram Pro**      | 2.6     | Two-step container media publishing     | `POST /v21.0/{ig_id}/media`<br>`POST /v21.0/{ig_id}/media_publish` | `instagram_basic`<br>`instagram_content_publish`<br>Max 50 posts/24h  | Push/calendar manual task with native app post                |
| **Mail Campaigns**     | 3.1–3.6 | Bulk campaign transport & delivery      | Managed via `@codexsun/mail-api`;<br>RFC 8058 List-Unsubscribe     | SPF, DKIM (2048-bit), DMARC;<br>No shared-sender fallback             | In-memory mock mailer;<br>Approved test-recipient sends       |
| **Mail Suppression**   | 3.7–3.8 | Bounces, complaints & opt-out ledger    | Mail suppression ledger;<br>Webhook feedback loops                 | ARF feedback loop;<br>Permanent fail-closed checks                    | Synthetic suppression fixture;<br>Batch withdrawal simulation |

---

## 6. Actionable Cutover Checklist

- [x] **1. Submission Immutability**: Confirmed `marketing_submissions` uses `UNIQUE KEY (company_id, capture_uuid, source_key)` and validates payload hash, preventing duplicate or mutated records.
- [x] **2. Un-replayed Legacy Records**: Confirmed handoff sync queries exclusively `status = 'pending'`, ensuring all delivered submissions with CRM-linked IDs are completely skipped.
- [x] **3. Worker Short-Circuit**: Confirmed `processSubmissionHandoff` immediately returns existing `leadUuid` if `status === 'delivered'`, executing zero CRM or external calls.
- [x] **4. Zero-CRM Modification**: Confirmed Marketing cutover requires zero edits to CRM tables, routes, services, or Frappe integrations.
- [x] **5. Sites Forwarding Idempotency**: Confirmed Sites replay retries reuse `source_key` and receive existing receipts without duplicate lead creation.
- [x] **6. Google OAuth PKCE Security**: Confirmed `GoogleChannelConnector` and `ConnectionAuthorizationService` enforce RFC 7636 PKCE (`S256`), 10-minute expiry, locked single-use state, and AES-256-GCM encrypted grant storage.
- [x] **7. Token Refresh Support**: Added typed `refresh(refreshToken)` and `revoke(token)` capabilities to `GoogleChannelConnector`.
- [x] **8. Connection Types Alignment**: Enriched `connection.types.ts` with complete provider, capability, health, and claim types across Phase 2/3 channels.
- [x] **9. Phase 2/3 Provider Readiness (R01–R06)**: Documented official API endpoints, scopes, review gates, rate limits, and supported local fallbacks for Meta Lead Ads, Google Ads webhook, Facebook/Instagram publishing, and Mail campaigns.
- [x] **10. Local Development & Verification**: Verified TypeScript compilation (`tsc --noEmit`), module boundary validation (`node tools/check-module-boundaries.mjs marketing`), and Prettier formatting on all modified files.
