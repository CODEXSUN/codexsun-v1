# Frappe tasks

Repository source: `apps/frappe/agent/TASK.md`

Source SHA-256 (LF line endings): `a6831d5f7e464b75779eaa13d0d4b0d3647eb0903ed9ff6402196a751d2a6050`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# Frappe tasks

## Frappe daily server hours and offline queue holds - 2026-10-25

- [x] Add a tenant Server availability settings page, timezone, daily hours, and explicit live connection check.
- [x] Add tracked availability-v11 storage and a shared health-probe lease with offline cooldown.
- [x] Gate scheduled and immediate dispatch before queue creation. Hold existing jobs before claiming attempts.
- [x] Keep the same BullMQ delivery delayed until recovery. Preserve checkpoints and stable retry identities.
- [x] Verify schedule boundaries, daylight saving, offline cooldown, lease sharing, duplicate-safe recovery, and queue attempts in disposable databases.
- [x] Verify real BullMQ/Redis hold and recovery on the isolated local clone with one job, zero held attempts, one completion, and no failures.
- [x] Replay the migration in four local clone tenants. Preserve TECHMEDIA's 2,083 enquiries and existing numbers.
- [x] Verify saved hours after browser reload and the local Super Admin waiting display. Preserve historical failed jobs.
- [x] Verify the cloned scheduler at 21:30: zero probes, zero jobs, and unchanged last schedule/checkpoint.
- [x] Final Platform API and web builds pass. The local clone uses a verified patch of affected modules on its captured API image.
- No VPS change, commit, push, mobile build, or remote Frappe write is part of this stage.

## Tenant Frappe switch audit - 2026-10-25

- [x] Hide CRM Frappe columns, detail indicators, and verification actions when tenant live sync is off.
- [x] Check app activation before reading optional Frappe settings. Scope web capability caching by tenant and database.
- [x] Gate immediate jobs, relays, manual requests, and queued worker execution. Preserve pending events and source identities.
- [x] Give deferred deliveries a fresh generation so re-enabling sync can resume pending work.
- [x] Verify disposable-database switch and queue behavior, tenant-scoped table rendering, and existing duty persistence/retry behavior.
- [ ] Live browser and remote Frappe verification: intentionally not performed in this local-only task.
- No version change, commit, push, or deployment is authorized for this task.

## Bidirectional delivery and visible failures — 2026-10-23

- [x] Support a one-minute inbound interval and immediate post-save enquiry/contact-mobile queue dispatch.
- [x] Apply reverse updates to linked CRM enquiries in bidirectional mode, preserving local identity and audit fields. Block unsent local enquiry changes.
- [x] Preserve first delivery errors during pending retries for contacts, enquiries, duties, and reports.
- [x] Keep Tasks local with **Not configured**, as explicitly selected by the user.
- [x] Verify immediate database queue dispatch, a lost Mobile Contact create response, duplicate-free retry, and a new edit after completion in an isolated database.
- [x] Pass checkpoint/history, enquiry outbox, duty retry, unit, type, lint, build, component-doc, dependency-layout, and owner-boundary checks.
- [x] Apply CRM queue v2 and Frappe v10 locally. Enable CODEXSUN bidirectional mode at one minute; preserve 56 existing enquiries.
- [x] Deploy 1.1.47, verify production Redis transfer/retry behavior against ERP1, and fix legacy comment-key collisions. See [release evidence](RELEASE-1.1.47.md).
- [ ] Verify browser interaction separately.

Remote responses in the isolated queue tests are controlled. The release evidence records the
separate production write/readback. This work does not promise a hard one-minute completion
deadline during outages or claim new mobile UI delivery.
Contact export remains the existing Mobile Contact-only contract with an exact Customer/Supplier ID.

## Marketing integration backlog — 2026-10-23

Planning alignment is complete. The following implementation tasks remain open.
See [Marketing contracts and gaps](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), G12.

- [ ] Review CRM intake against enquiry outbox generation, import echo rules, and tenant sync direction.
- [ ] Specify source-origin export blocking and approved opt-in policy without changing current record behavior.
- [ ] Test Marketing intake cannot trigger unapproved remote transfers or use Frappe as a campaign/contact-consent read source.

Acceptance requires the owner contract, denied-access cases, retry behavior, and exact evidence in this task log.
No implementation or live validation is claimed by this planning update.

## Inbound-only enquiry live sync — 2026-10-23

- [x] Add an inbound-only direction, with an explicit bidirectional option.
- [x] Import history before incremental polling. Advance the site checkpoint only after complete success.
- [x] Preserve complete source documents and comment revisions. Expose paged source fields through record visibility checks.
- [x] Keep New/Normal defaults, empty optional assignments, and CRM-only email. Block invalid mappings and local-edit conflicts.
- [x] Serialize selected and queued imports. Preserve Q/ENQ identities when serials collide.
- [x] Update imported comments without duplicate rows and retain reply parents.
- [x] Pause automatic outbound dispatch and old queued work in inbound mode. Retain pending events for later delivery.
- [x] Verify database queue retries, partial failure, successful checkpoints, source history, and concurrent import denial in a disposable database.
- [x] Read Q930 and installed metadata as Vijay. Confirm Job Comments wildcard reads. No remote writes.
- [x] Apply v9 locally to CODEXSUN. Preserve all 10 existing enquiries and the enabled, unpaused, five-minute settings.
- [ ] Apply the additive migration and enable the desired settings on a deployed tenant.
- [ ] Verify deployed Redis workers, continuous scheduling, and browser interaction.

Final local queue verification passed after an upgrade from the v8 schema and a repeated migration run.
It also verifies fractional source timestamps, unchanged local business counts, and source history after mapping failure.
The configured local checkpoint remains empty until the first successful historical import.

Migration notes: `frappe_live_sync_settings` gains direction, source URL, and successful checkpoint columns.
`frappe_enquiry_sync` gains a separate source-modified timestamp with millisecond precision.
`frappe_enquiry_snapshots` stores append-only source content revisions with stable content keys.
The new step uses additive schema changes. No existing business rows are deleted.
Expected work is four added columns and one empty source table. There is no historical backfill inside the migration.
Validate the new columns, migration ledger step v9, and source revision counts after deployment.
Use the database migration runbook and verified backup for production deployment.

## Approved queued enquiry comments and Vijay access — 2026-10-23

- [x] Grant the local Vijay account a dedicated `frappe-sync-vijay` role containing `frappe.connection.manage` and `crm.enquiry.frappe-sync.view`; verify authorization and write the Platform access audit. No shared role was expanded.
- [x] Queue opening comments, new comments, and replies atomically with local writes; dispatch after commit. Imported comments do not enqueue exports.
- [x] Process `comment-add` through the enquiry worker and Job Comments API. Preserve parent links and stable explicit document names derived from site/outbox identity.
- [x] Preserve pending comments when enquiry updates coalesce. Forward mobile request IDs for web/mobile retries. Skip inbound echoes of locally posted Job Comments.
- [x] Verify live local HTTP POST → durable database queue → registered worker → LogicX HR as Vijay. Local enquiry `12` exported as `Q935`; jobs `159`–`163` delivered the enquiry, opening comment, parent comment, lost-response retry, and reply. Three local comments matched three remote Job Comments. Repeated web/mobile submissions reused one comment. A lost response after committed remote creation recovered the same remote identity.
- [x] Enforce ordering at the event claim as well as at relay selection. A second live run sent the opening-comment job before its enquiry: it waited safely, then completed after the enquiry export. Local enquiry `13` → `Q936`; jobs `166`–`171` completed, with exactly one remote enquiry and three local/remote comments. Lost-response and request-ID retries again reused their identities.
- [x] Pass 183 combined CRM/Frappe regression tests, four additional comment retry/parent tests, three isolated database suites, and the outbox ordering/coalescing database suite. CRM/Frappe API typecheck, lint, build, module boundaries, dependency layout, and component documentation checks passed.

The test uses a signed test token for the real local account and checks current grants. It registers owner HTTP routes and consumes only its own persisted jobs through QueueManagerService. Browser login, continuous scheduler operation, Redis delivery, and VPS deployment are separate checks. Marked fixtures and queue history remain for inspection. A prior run created local enquiry `11` / remote `Q934` before the opening-comment gap was corrected.

## Live enquiry sync verification as Vijay — 2026-10-23

- [x] Authenticate the local verified `logicx.tmnext.in` connection as `vijay@techmedia.in`; confirm the local active user and Employee mapping `HR-EMP-00001`.
- [x] Read installed Enquiry, Mobile Contact, Mobile Contact Customer, and Job Comments metadata. Verify Job Comments reads and document creation under the saved remote credentials.
- [x] Create one minimal test Mobile Contact and resolve it twice; both attempts report its missing Customer association and the remote count stays one.
- [x] Export marked test enquiries using an existing exact Mobile Contact Customer association to Customer `C9279`. `Q932` survived a normal repeat export with one matching remote record. `Q933` survived a simulated lost response after Frappe committed creation: retry matched and reused that record, with no duplicate.
- [x] Create/read Job Comments `JOBCOM8` on `Q932` and `JOBCOM9` on `Q933`. Import `JOBCOM9` twice through the CRM comment service/repository inside a rolled-back local fixture transaction; one local comment was stored.
- [x] Roll back local enquiry/comment/link/status test writes. Remote marked fixtures remain for inspection: Enquiries `Q932`/`Q933`, Job Comments `JOBCOM8`/`JOBCOM9`, and test Mobile Contact `6318614255`. Remote lifecycle hooks may also have generated Job Activity rows. No existing customer or association was changed.
- [ ] Verify the Chrome Desk view. The computer-use tool reports that local browser use is disabled in Work settings.
- [ ] Verify the authenticated local UI/queue flow as Vijay. The active local grants include enquiry create/update/view but no Frappe sync grants; no roles or permissions were expanded. The service/API checks above do not prove a permitted queued action from Vijay's local session.

Live checks used local CODEXSUN source and the existing verified remote credentials. No deployment or automatic replay of existing jobs was performed. The local fixture initially needed required status/priority IDs; that was a test setup correction, not a product defect. All demonstrated repeat operations reused their original identities. Activity exports remain subject to the existing deny policy; this check does not claim general outbound CRM comment sync is enabled.

## Outbound enquiry Mobile Contact resolution — 2026-10-23

- [x] Record explicit product approval to create the minimum Mobile Contact before new Enquiry export.
- [x] Look up the ten-digit number first, create only `mobile_number` when absent, and recover lost-response or concurrent-create outcomes through an exact read. Retries reuse the existing contact.
- [x] Resolve `mobile_customer` and `customer` from an exact association; require the connected-site customer identity when a local customer is linked. Block missing or ambiguous associations with a clear error.
- [x] Keep existing Enquiry updates and standalone Contact export policy unchanged. Do not create Customers or customer associations.
- [x] Pass eight focused regression tests for existing/new contacts, timeout recovery, competing creates, repeat retries, missing/ambiguous associations, denied writes, and invalid numbers.
      Live writes and installed-site permission checks were not performed.

## Enquiry import source names — 2026-10-23

- [x] Accept both legacy `ENQ<number>` and current `Q<number>` Frappe enquiry names.
- [x] Keep each exact remote name as the local source reference and sync link identity.
- [x] Cover the legacy `ENQ27` and current `Q930` formats in importer regression tests.
      Verification: `node --import tsx --test apps/frappe/api/src/modules/enquiry-sync/enquiry-sync.service.test.ts` passed all 12 tests. No live Frappe records or CRM behavior were changed.

## Enquiry timeline via Job Comments — 2026-10-23

- [x] Replace enquiry timeline reads from the `Enquiry.enquiry_messages` child table with standalone `Job Comments` records linked by `job_type = Enquiry` and `job_id = <remote enquiry name>`.
- [x] Use the documented Frappe v2 `frappe.client.get_list` method for reads and the v2 `Job Comments` document API for approved create/update exports.
- [x] Update enquiry live views, inbound enquiry sync, and activity import/export to use `Job Comments`; retain reply links through `parent_comment`.
- [x] Confirm LogicX source DocType permissions: TM User has read/create/write and TM Admin has read/create/write/delete at permission level 0. The old child table has an explicit migration to `Job Comments`, so no runtime fallback is retained.
- [x] Preserve the existing outbound write gate; Job Comments writes require explicit export authorization.
      Verification: 175 CRM/Frappe unit tests and three isolated database E2E checks passed. API typecheck, lint, build, and module boundaries passed. APIs and declared permissions were confirmed from the LogicX source and REST examples; installed-site permissions remain unverified. No live record was read or changed. Activity exports remain blocked by the existing export policy.

## Consolidated Frappe sync queue — 2026-10-23

- [x] Keep one Frappe navigation entry, **Live sync queue**, for both active worker jobs and retained CRM enquiry sync events.
- [x] Show live BullMQ jobs and their existing manual re-sync controls in the Live jobs tab.
- [x] Preserve status filters, pagination, auto-refresh, and event details for the legacy enquiry outbox in the Enquiry event history tab. Retry remains disabled because the API rejects sending these retained events.
- [x] Remove the queue page title and description, reduce page spacing, and keep view controls together. Live jobs has one Re-sync menu and its refresh action; enquiry history has only its own refresh action beside the status filters.
- [x] Default enquiry history pagination to 200 rows and align the API default and maximum with the web client. The route regression test confirms the 200-row request reaches the repository.
- [x] Redirect the former `/app/frappe/enquiry-sync` page URL to Live sync queue.
- [x] Pass Frappe/Platform web typechecks and lint, the Frappe navigation test, Frappe module-boundary checks, and component documentation checks.
- [ ] Verify both views in an authenticated browser.

Behavior review: `/frappe/live-sync/jobs` reads tenant-filtered BullMQ sync/import jobs. `/frappe/enquiries/sync-queue` reads retained CRM enquiry outbox rows; they are separate data sources with different status/progress details, so the page keeps them in distinct tabs. The queue API now defaults and caps page size at 200. No database storage or migration state changes.

## Frappe queue failure diagnosis and manual policy guard — 2026-10-23

- [x] Apply the approved outbound-export policy before manual live-sync job creation, preventing predictable Contact and Call Log failures from entering the queue.
- [x] Show per-record errors in Live sync jobs and label completed jobs with record failures as needing attention.
- [x] Make CRM Task Frappe state explicitly read-only and not linked; no Task-to-Frappe mapping or outbound transfer contract exists.
- [x] Inspect local CODEXSUN queue and outbox state without changing records. Enquiry export failures are missing Frappe Employee mapping for creator `admin@tenant.com`; inbound import failures are source serial incompatibility for Frappe enquiry `Q930`.
- [ ] Resolve the missing creator Employee mapping using the target tenant's verified mapping before retrying affected exports. The importer now accepts the `Q930` source-name format for future inbound attempts.

Local evidence at the time of the audit: queue jobs 22/26 were Contacts/Call Logs rejected by outbound policy; jobs 23/29 reported four Enquiry failures each due to missing creator Employee mapping. Inbound jobs 31/42 reported one failure, `Q930` missing a compatible CRM serial; the importer now accepts this name format, but no failed job was retried. Local queue backend is `database`; Redis is configured but not selected. The local connection points to `logicx.tmnext.in`, but the local registry does not include the production tenant shown by the user, so no production or authenticated browser verification was performed.

## TechMedia sync flow audit as Vijay — 2026-10-23

- [x] Read the active TechMedia tenant, queue backend, Frappe connection state, Vijay's user mapping and role grants, and recent Frappe job outcomes on the VPS.
- [x] Confirm the live queue backend is BullMQ + Redis and recent worker jobs were consumed. Latest enquiry export batch results are recorded as completed jobs with per-record HTTP 530 failures; inbound imports exhaust three attempts and fail with HTTP 530.
- [x] Confirm Vijay is an active Admin mapped to Frappe Employee `HR-EMP-00001`. Active grants include `frappe.connection.manage`, `crm.contact.view`, `crm.call-log.view`, and `crm.enquiry.frappe-sync.view`.
- [x] Confirm the saved verified Frappe URL `https://erp1.techmedia.in` currently returns HTTP 530 from the VPS. No authenticated request or secret was sent to the alternate `logicx.tmnext.in` host; it returned HTTP 200 for a public ping only.
- [x] Remove the extra `admin@tenant.com` email gate from Enquiry sync status; the status column/history now follows the server-checked `crm.enquiry.frappe-sync.view` permission.
- [ ] Re-run authorized read verification and end-to-end Enquiry import/export after the TechMedia Frappe hostname/origin is restored and reachable. Do not change the saved site URL or replay failed business jobs until the target Frappe site identity is confirmed.

Live scope: read-only tenant, role, queue, and connection checks only. No queue retries, connection edits, remote writes, or business-record changes were made. The browser surface could not be opened because local browser use is disabled; Super Admin Queue Manager remains restricted to Super Admin sessions and Vijay's tenant Admin role does not grant that global console.

## CRM record verification indicators — 2026-10-22

- [x] Reuse the existing queued remote verification API for enquiry, contact, and call-log row actions. The action only uses `mode: verify`; export policy remains unchanged.
- [x] Keep outbound Contacts, Call Logs, Activities, and Tasks blocked. No new Frappe document mapping or transfer was introduced.
- [x] Keep verified connections and remote credentials server-side; verification outcomes are returned through tenant-scoped export job status and batch record-status routes.

The live VPS smoke test exercised the shared BullMQ + Redis queue with the non-business `queue.probe` job. It completed successfully. It did not create or verify a live Frappe document. Release 1.1.43 is deployed; public route checks passed, but authenticated browser behavior remains unverified.

## Queued CRM enquiry upserts — 2026-10-21

- [x] Process CRM enquiry create/edit outbox events using the tenant's verified Frappe connection and existing export policy.
- [x] Keep CRM writes fast by dispatching after local commit; preserve durable queue retry and relay recovery behavior.
- [x] Pass automated regression checks, the queue E2E, and isolated database E2E verification before release. Browser verification was not run. No live tenant records were changed.

## Inbound enquiry title normalization — 2026-10-21

- [x] Normalize Frappe Quill/HTML titles before showing import previews or saving imported enquiries in CRM.
- [x] Preserve the original rich `Enquiry Details` HTML, including embedded image references.
      Evidence: regression coverage in `enquiry-sync.service.test.ts`; all 162 CRM/Frappe unit tests and three isolated database E2E suites passed. No live Frappe or tenant data was changed.

## Outbound enquiry title normalization — 2026-10-21

- [x] Convert CRM Quill title markup, entities, and whitespace to readable plain text before Frappe export.
- [x] Use the same normalized title when matching an existing remote enquiry.
- [x] Keep `enquiry_details` unchanged so rich text and embedded image content remain intact.
      Evidence: live TECHMEDIA `ENQ2023` shows Quill markup in Title while Enquiry Details render as text. The new normalization tests and the 162-test CRM/Frappe unit suite passed. The combined isolated CRM/Frappe suite passed all three database E2E checks. No live Frappe record was changed.

## Deterministic identity audit and actor attribution — 2026-10-20

- [x] Add the Frappe Identity audit page and read-only API endpoint for local/Frappe User and Employee mapping fields.
- [x] Report matched, mismatched, and unmapped users, including stale connection hashes, disabled or wrong-type Frappe users, email mismatches, inactive or duplicate Employees, and missing Employee references.
- [x] Make imported activity and call-log creators resolve through saved mappings; preserve the remote owner if no local mapping exists.
- [x] Correct CRM enquiry comments and task comments to show mapped user names instead of email-domain fragments.
- [x] Keep import-generated initial enquiry events attributed to the mapped enquiry creator while later sync updates remain system-attributed.
      Verification: 148 CRM/Frappe tests passed, including two identity-audit cases; local isolated CRM Duty, mobile customer, and Core contact-upsert E2E tests passed. API/web typechecks passed before final docs. Production/browser verification was not run.

## Enquiry creator and assignee reconciliation — 2026-10-20

- [x] Resolve imported enquiry creator from the source `user_employee` Employee mapping; fall back to the mapped Frappe document owner when no unique Employee mapping exists.
- [x] Treat source `assigned_to_employee` as authoritative so removed, unmapped, or ambiguous assignments cannot leave a stale local assignee.
- [x] Flag Employee codes assigned to multiple local users in the read-only identity audit.
      Focused import and audit regression tests verify creator identity, unassignment, and ambiguous mapping detection.

## Sync direction audit - 2026-10-18

- [x] Deploy and verify TECHMEDIA Frappe enquiry import with source serials, creation/modified dates, mapped owner/assignee, site-scoped Customer identity, comments, audit history, and live Redis/BullMQ batches. Begin with a small selected-row test, then continue the queue until all current source enquiries are accounted for. Do not touch other tenant databases.

  Live evidence: selected-row import verified ENQ1–ENQ5. Redis/BullMQ jobs 14, 24, and 29 ran in creation order over all 1,984 current Frappe enquiries; final job 29 completed with 1,984 scanned and zero failures. Reconciliation verified 1,984 unique source links and matching serials, creation timestamps, and modified timestamps to MariaDB second precision. All 14 of 15 distinct Frappe owners mapped; the remaining owner’s source email is preserved as `created_by`. A
```
