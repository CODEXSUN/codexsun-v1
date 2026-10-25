# Data Bridge 1.1.59 cloud release and audit

Date: 2026-10-24. Execution status: deployed and verified, with one preserved settings warning per target.

## Authorized scope

Deploy the tested Data Bridge repair and use the live Data Bridge queue for both registered clients.
Preserve source sukraa_db and altex_db on cxapp-mariadb.
Registered targets are SUKRAA tenant 11, sukraa_v2_db, and ALTEX tenant 5, altexlabs_v2_db.
These identities describe this run. Resolve source and target registrations again for every future run.
Both target databases are absent at preflight. Create them through the owner provisioning workflow.
Import Common, Masters, then Billing, with target foreign-ID resolution and complete invoice descendants.
Preserve target conflicts as warnings. Repeat imports and compare saved business and user rows.

## Preflight findings

Live API and Web use separate 1.1.57 CRM patch images. Shop still uses 1.1.54.
Preserve existing CRM runtime patches while applying the scoped Data Bridge release.
Replace only CODEXSUN API, Web, and Shop. Preserve shared infrastructure and unrelated client data.
The source databases are external sources, not registered target tenant databases.
Keep destructive initialization and default tenant seeding disabled.
Keep BullMQ/Redis enabled and verify persisted job delivery and report identities.

## Recovery and proof requirements

Create a private full MariaDB backup before deployment and verify its checksum and compressed stream.
Record source row fingerprints before and after cloud execution.
Record target provisioning, owner migrations, company reuse, units, and User-role results.
Verify both first and repeated queue runs, full invoices, child rows, and all target relationships.
Record exact warnings and deployment limits. Do not infer browser proof from HTTP or service tests.

## Local baseline

Release 1.1.58 verified fresh local targets with 137 SUKRAA and 184 ALTEX invoices.
It verified 521 and 690 item rows, all other descendants, seven copied User accounts, and unchanged sources.
Both repeated local imports produced no duplicate business or user rows.
See [local verification](RELEASE-1.1.58.md). These local results do not prove cloud execution.

## Verified deployment

Runtime release: 1.1.59. Runtime code commit: 8d67a351.
The follow-up evidence commit changes documentation only and does not change deployed application code.

API, Web, and Shop images use the 1.1.59 tag and pass container health checks.
Local API and public Web health checks pass.
All shared infrastructure container identities remain unchanged.

The API image overlays 57 syntax-checked release artifacts onto the existing live API base.
This preserves the deployed CRM/Frappe/Platform patch modules byte-for-byte.
The Web build preserves three existing CRM source patches for enquiry list, enquiry types, and sync indicator.
Web and Shop builds use the committed 1.1.59 source and lockfile. Unrelated local implementations were not deployed.
Do not describe these preservation overlays as an untouched clean-archive rebuild of the entire runtime.

Both registered targets were absent before execution.
Owner setup runs 9 and 10 completed through the authenticated public Platform endpoint.
No reinstall, table drop, manual business insert, or source correction ran.

## Live Data Bridge execution

The authenticated public Data Bridge endpoints verified source and target connections.
They queued Common, Masters, and Billing imports through the same endpoint used by the frontend action.
The real BullMQ/Redis worker executed every run. No direct service runner, database fallback, or manual Run supplied this proof.

| Verification                             |       SUKRAA |           ALTEX |
| ---------------------------------------- | -----------: | --------------: |
| Target                                   | sukraa_v2_db | altexlabs_v2_db |
| Business tables audited                  |           70 |              70 |
| New business rows                        |        1,595 |           5,094 |
| Seed company rows updated in place       |            1 |               1 |
| Companies after import                   |            1 |               1 |
| Sales invoices matched                   |    137 / 137 |       184 / 184 |
| Invoice item rows matched                |    521 / 521 |       690 / 690 |
| Other invoice children matched           |           19 |               0 |
| Deleted invoices retained                |            0 |               5 |
| Missing users copied                     |            2 |               3 |
| Existing target administrators preserved |            1 |               1 |
| Credential-copy warnings                 |            0 |               0 |
| Declared relationships checked           |          177 |             177 |
| Orphan references                        |            0 |               0 |
| Repeat business inserts or updates       |            0 |               0 |
| Repeat user inserts                      |            0 |               0 |
| Preserved settings warnings              |            1 |               1 |

The SUKRAA invoice descendants include 10 e-invoice and 9 e-way-bill rows.
All foreign IDs resolve through actual target business identities.
Each company retains the seed ID and UUID. Default-company settings point to that retained business company.
Each target has hyphen at unit ID 1, pcs at ID 2, and nos at ID 3.
Five new accounts preserve their exact supported source hashes and receive only the target User role.
Existing target administrators and credentials remain authoritative. No source administrator privileges were copied into new accounts.

### First-run group totals

| Target          | Group   | Inserted | Updated | Warnings |
| --------------- | ------- | -------: | ------: | -------: |
| sukraa_v2_db    | common  |      143 |       0 |        0 |
| sukraa_v2_db    | masters |      199 |       1 |        0 |
| sukraa_v2_db    | billing |     1253 |       0 |        1 |
| altexlabs_v2_db | common  |       28 |       0 |        0 |
| altexlabs_v2_db | masters |      247 |       1 |        0 |
| altexlabs_v2_db | billing |     4819 |       0 |        1 |

## Queue and report proof

The isolated Redis prefix is codexsun-1904df46cea1f33b210aead7.
Every persisted job ID and UUID matches its completed Redis delivery. Each job completed in one attempt.

| Target          | Pass   | Report                               | Queue job |
| --------------- | ------ | ------------------------------------ | --------: |
| sukraa_v2_db    | First  | 645342e7-207a-43ae-9e72-c92d47548e33 |      3180 |
| altexlabs_v2_db | First  | 0e9a32e1-55af-4f6a-90dd-e09c036d6084 |      3181 |
| sukraa_v2_db    | Repeat | 0f2f2ba4-dde4-4d61-aa7e-6a01c5f9f01d |      3186 |
| altexlabs_v2_db | Repeat | 7364e761-00c9-4c55-9391-61f010d50158 |      3187 |

The public report API passed all 140 table drilldowns.
It returned 1,980 SUKRAA and 5,479 ALTEX business review records across their table pages.
Both invoice pages passed for each tenant. Users and Warnings results also passed their public response contracts.
No credential hashes appeared in those report responses.
These are authenticated HTTP and queue checks, not a new browser interaction test.

- [SUKRAA repeat report](https://codexsun.com/sa/data-bridge-report?kind=business&record=0f2f2ba4-dde4-4d61-aa7e-6a01c5f9f01d).
- [ALTEX repeat report](https://codexsun.com/sa/data-bridge-report?kind=business&record=7364e761-00c9-4c55-9391-61f010d50158).

## Remaining settings warnings

Both reports preserve one billing_company_settings conflict for the existing company/settings key.
The source settings_json differs from the fresh target defaults.
The importer does not overwrite that configuration. It records the difference for explicit configuration review.
All invoices and children pass. These settings warnings do not represent missing invoice data.

## Source preservation and repeat fingerprints

Full source row fingerprints match before setup, after import, and after both repeats.
Target business and user row fingerprints match exactly before and after the repeated imports.
These are row-value checks. They do not claim unchanged auto-increment counters or whole physical database files.

- sukraa_db source SHA-256: `538b0c7a2d7e1348912448ba35bf0e6894d17671c0db49dddeaaf3dc5c78b54e`.
- sukraa_v2_db repeated target row SHA-256: `985b76e0a7140ba20982cb4a7a5d2a35472920b133b24c8ce0cd722046a37710`.
- altex_db source SHA-256: `05308802692bb6ae40689b0d95511137db5ad78dfdb2c9c0609ca92c286af7ff`.
- altexlabs_v2_db repeated target row SHA-256: `fb6cf9c6748329485aaa8d7da7f7f94c5ab4093222862bd8a8c82492b8260eb6`.

## Verified recovery files

- Before: `/home/codexsun-backups/data-bridge/20261024T173832Z-1.1.59-before`. Compressed backup SHA-256: `5455dd4da6918d34bef731827d58b166e163a6495cffcd12099cb4233e48ca71`.
- After: `/home/codexsun-backups/data-bridge/20261024T175956Z-1.1.59-after`. Compressed backup SHA-256: `bd98293ee05de9c6c14de9c5719a1f75893cb3352618b19b126b9c84ca508e48`.

Both full MariaDB backups use consistent transactional dumps, private file permissions, verified SHA-256 values, and successful gzip integrity checks.
Private dumps and row-level evidence remain outside Git.
The VPS evidence directory is /home/codexsun-releases/1.1.59-data-bridge/evidence/.

## Release limitations

Imports commit per table. Full invoice verification is not a single cross-table transaction.
The shared local working tree still contains unrelated implementation work and broad-check blockers recorded in the local release log.
The deployment used the isolated committed release and preserved previously deployed CRM patches.
The Web dependency audit reports seven advisories: one low, four moderate, one high, and one critical.
No dependency upgrade or audit fix is included. Do not claim a clean security audit.

## Billing dashboard follow-up, 25 October 2026

Scope: deploy the Billing reporting-currency changes from e6572eb7 and fix post-import dashboard projections.
Use the active 1.1.60 development version. This is a scoped API/Web patch over the preserved 1.1.59 runtime.
Shop remains on 1.1.59. This rollout does not deploy unrelated CRM mobile, Ecommerce, Codeit, or container work.

### Cause and correction

The INR dashboard returned an existing empty snapshot indefinitely.
The UI Refresh action fetched that snapshot again. Data Bridge did not invalidate or rebuild it.
Platform now calls the public Billing projection service after business, mapped, and common queue imports.
Resolve the exact active target registry record and register its saved Billing connection before rebuilding.
Rebuild every target company/year context. Record event reason billing.dashboard.data-bridge-import.
A rebuild failure rejects the queue job for retry, including when the business import report is already complete.
Retrying a completed import can rebuild its derived snapshots without reinserting its business rows.

### Runtime and recovery

Images: codexsun/api:1.1.60-billing-dashboard and codexsun/web:1.1.60-billing-dashboard.
Preserve the existing API base and live CRM frontend patches. Do not replace shared services or Shop.
The Web artifact uses the preserved 1.1.59 source plus the requested Billing changes.
The API artifact overlays only Billing index, projection service, reporting-settings artifacts, and Platform Data Bridge composition.

Private recovery directory: /home/codexsun-releases/billing-dashboard-refresh.
Before backup: before.sql.gz, SHA-256 b8b43647cbbdeae6dbe4afa62d378059421ecbeef24f5d832b785d7449c6e7c3.
The full MariaDB backup passes gzip integrity verification. Never restore all databases without a separately reviewed recovery scope.

### Dashboard reconciliation

Company 1 and financial year 1, reporting currency INR:

| Metric                   |        SUKRAA |      ALTEX |
| ------------------------ | ------------: | ---------: |
| Confirmed sales count    |           108 |        175 |
| Confirmed sales total    | 68,324,858.00 | 456,783.50 |
| Confirmed purchase count |            82 |          0 |
| Confirmed purchase total | 16,049,778.79 |       0.00 |
| Posted receipt count     |             0 |         51 |
| Posted receipt total     |          0.00 | 268,942.00 |
| Posted payment total     |          0.00 |       0.00 |
| Recent transactions      |            12 |         12 |

SUKRAA October sales and purchases remain zero because its confirmed documents are dated before October.
ALTEX October sales are 95,045.00 and receipts are 98,948.00.
Draft and deleted invoices remain excluded from financial metrics.
Authenticated public /api/app/billing/dashboard responses return HTTP 200 for both registered tenants.

### Verification limits

Billing API, Platform API, and Billing Web builds pass. The deployed Platform Web production build passes.
Focused projection tests cover multiple target contexts, event reason, and failure propagation.
Focused lint and Billing module boundaries pass.
The repository dependency-layout check remains blocked by unrelated devkits/codeit/dist output. It was not removed.
Web dependency installation reports seven advisories: one low, four moderate, one high, and one critical.
This rollout does not claim a clean dependency security audit.
Browser automation cannot load its private login script because its configured filesystem roots reject the workspace path.
Dashboard reconciliation uses normal authenticated public HTTP and independent target SQL, not browser interaction proof.

### Final live proof

Final registered-connection jobs both completed in one attempt through BullMQ/Redis:

| Target          | Run                                  | Queue job | Invoice match | Item match |
| --------------- | ------------------------------------ | --------: | ------------: | ---------: |
| sukraa_v2_db    | 903ac4d4-f7a6-42be-8b73-f39367b063ea |      3718 |       137/137 |    521/521 |
| altexlabs_v2_db | 5bdd1733-3700-46fe-afe0-dbf95c56349e |      3719 |       184/184 |    690/690 |

Both repeats have zero business inserts, updates, new users, invoice warnings, and orphan references.
SUKRAA retains ten e-invoices and nine e-way-bill rows. ALTEX retains five deleted invoices as history.
Each target retains its existing Billing company-settings difference as one warning.

Both snapshots record billing.dashboard.data-bridge-import after the final queue runs.
Public HTTP dashboard metrics match independent target SQL for every financial metric, count, and current-month value.
SUKRAA projection: 2026-10-25T02:43:02.263Z. ALTEX projection: 2026-10-25T02:44:09.565Z.
The deployed dashboard asset dashboard-CEogreF2.js no longer contains its reporting-currency control.

Before/after source fingerprints match all 96 tables in each source:

- SUKRAA, 4,145 rows: 538b0c7a2d7e1348912448ba35bf0e6894d17671c0db49dddeaaf3dc5c78b54e.
- ALTEX, 13,566 rows: 05308802692bb6ae40689b0d95511137db5ad78dfdb2c9c0609ca92c286af7ff.

Target business/user fingerprints also match, excluding only dashboard snapshots and derived event/outbox tables:

- SUKRAA, 1,986 rows across 84 tables: 301e9cb247762d694af8ddbd2cd75c2a32e43b7b5cd056e81f2eb4b30084003f.
- ALTEX, 5,487 rows across 84 tables: d15f3e68d6edf985641d197cc30c39102405e66ec6b5967c2f1e6a4f980ace48.

The source databases remain unchanged. Existing target business data and credentials remain unchanged.
API/Web health and public Platform readiness pass. Shop and shared service containers retain their identities.
Private evidence is under /storage/backups/data-bridge/billing-refresh and the release recovery directory.

Workspace-wide version checking also sees unrelated untracked apps/chatb and apps/worker packages at 1.1.59.
Those packages remain untouched. The staged tracked release snapshot passes the 1.1.60 version check.
Only the seven affected documentation originals and their generated references are synchronized for this commit.

## COTTON company branding and business migration, 25 October 2026

Authorized target: cottonknit_v2_dd, exactly as requested. Source: cottonknit_db on the shared MariaDB server.
Reuse registry tenant 7, COTTONKNIT. Activate its configured target and provision through owner setup run 11.
Do not modify CXApp's database records, logo files, container, or existing volume contents.

### Reusable implementation

Data Bridge excludes logo_path, logo_dark_path, and favicon_path from company business-value comparisons when its branding hook is available.
Retain mapped source field aliases. Read source media paths from the saved source company after the target business row commits.
The target audit now includes the actual company ID. Do not substitute a numeric source ID.
Invoke the branding host for reused, inserted, and existing target companies.
Missing mapped IDs produce a media warning instead of silently skipping the copy.
Platform validates the active Super Admin actor, registered source routing, and exact active target tenant.
Storage Manager owns configured file reads, realpath containment, image validation, uploads, and storage metadata.
Core owns the public branding-path update. Company identity and foreign references remain intact.
Different target images are preserved with warnings. Matching images do not cause uploads or company updates.
Media outcomes persist on transfer rows and media warnings appear in the business report.

Configure CODEXSUN_DATA_BRIDGE_MEDIA_SOURCES with sourceId, database, tenantKey, and an absolute root.
These are trusted server settings. They are not request-selected paths or arbitrary URLs.
The legacy storage volume is mounted at /storage/data-bridge-sources/cxapp with RW=false.
Source 3 maps only cottonknit_db to its cottonknit tenant root. Existing SUKRAA and ALTEX mappings remain available.
No app code contains the observed client database names, source IDs, target IDs, or media roots.

### Deployment and tests

Scoped API artifact: codexsun/api:1.1.60-company-branding, built over the live Billing-dashboard patch.
Web, Shop, CXApp, MariaDB, Redis, Media, and Cloudflared remain unchanged.
The source checkout has unrelated 1.1.61 release work. It is not part of this scoped runtime overlay.
Core, Data Bridge, and Platform API builds pass. Focused lint and Core/Platform ownership checks pass.
Two focused tests pass locally and in the Linux image.
They cover source-ID binding, foreign tenant paths, traversal, symlink/junction escapes, missing files, preservation of different target images, repeat copies, field aliases, target-ID selection, and sanitized failures.
The first live run exposed an omitted target ID in the projected company audit result.
The correction adds that audited ID and makes missing identity an explicit media warning.
A repeat then copied both logos automatically. A further repeat verified zero media writes.

Backup: /home/codexsun-releases/cotton-branding/before.sql.gz.
SHA-256: 2d9c1c7a7351955f223f2aaa176833f01e4bc5454b53768bbac61374b10ed94f.
The full MariaDB recovery dump passes gzip integrity verification.

### Business import results

All runs use the authenticated public Data Bridge action and real BullMQ/Redis delivery.
Common, Masters, and Billing run in parent order with business-identity foreign-key resolution.

| Group   | First inserts | First updates | Final repeat writes |
| ------- | ------------: | ------------: | ------------------: |
| Common  |             9 |             0 |                   0 |
| Masters |            12 |             1 |                   0 |
| Billing |            60 |             0 |                   0 |

The one company seed is updated in place. Company count remains one, ID 1, UUID fc396258.
Two missing users preserve supported source password hashes and receive target User access.
The existing target administrator is preserved. The final repeat finds three existing users and copies none.
All 19 invoices match, including 13 confirmed and 6 drafts. All 21 invoice item rows match.
There are zero invoice warnings and zero orphan references.
Source system roles, permissions, runtime events, queues, migration history, and caches are excluded from the established business import scope.
One existing Billing company-settings difference is retained as a warning. No target settings are overwritten to remove that warning.

| Stage                   | Run                                  | Queue job | Attempts |
| ----------------------- | ------------------------------------ | --------: | -------: |
| First business import   | e8e84d74-2bf6-459f-9d8a-e69980d5d007 |      3817 |        1 |
| Automatic logo copy     | 08b0c1d0-97f4-4a3d-9dc6-7c605b1ed96f |      3819 |        1 |
| Final idempotency audit | 78096d8d-6775-4af6-b96e-70f584b18bab |      3822 |        1 |

Every recorded delivery matches the persisted job identity and completes successfully.
Public report checks verify 70 table drilldowns, 466 reviewed business rows, 19 invoice records, and three user results.
No credential hashes appear in public reports.

### Branding and dashboard proof

The automatic copy reports two copied images and zero media warnings.
The final repeat reports zero copied images, two existing images, and zero media warnings.
Both served images match source SHA-256 9d60d903bc35af936c545cc0ebc348fcd6b5af5822e9354e93e82646980f6645, 18,688 bytes each.
Normal tenant browser login verifies both company-editor previews and invoice CK-019 print.
All displayed COTTON logo images decode successfully at natural dimensions 65 by 87.

Confirmed sales: 13 documents, INR 15,167,514.00.
Confirmed purchases: 10 documents, INR 14,484,963.00.
The authenticated public dashboard matches independent SQL totals and records billing.dashboard.data-bridge-import.
Drafts are preserved but excluded from confirmed financial metrics.

Source before/after fingerprint: eb50001eace09d261b12428c27c70f3d9e317b1d87f7a8e4c081d3e315c60289.
All 96 source tables and 812 rows remain unchanged. Both CXApp source logo files also retain their original checksums.
Target business/user fingerprint before/after the final repeat: de17ea9ee4abfbaebd211232e68ebc501960efe58a2a3fa2e1c8f43ec0dc0128.
The repeat preserves 472 rows across 84 target business/user tables, excluding only derived snapshots and event/outbox tables.
API readiness, database health, and queue health pass.
Private evidence remains under /storage/backups/data-bridge/cotton-branding and the scoped release directory.

## COTTON database-name correction and GANAPATHI migration, 25 October 2026

### COTTON cutover

Correct the active target from cottonknit_v2_dd to cottonknit_v2_db. Preserve tenant 7, corporate ID COTTONKNIT, and tenant UUID 31b971d4.
The corrected database is absent at preflight. Suspend only this target tenant after checking for active queue jobs.
MariaDB does not provide a database rename. Use a consistent logical dump and restore into the corrected name.
Verify every copied base table and reject cross-database foreign keys before changing the registry.
All 282 tables and 877 rows match exactly before cutover.
Full copy fingerprint: 9abe6e3062ae63b0f43f0b51d31ecfe96a3ff91dcf5ac306bbc5d1a306707ab2.
Update the existing tenant through its owner API. Reactivate it with cottonknit_v2_db.
No active tenant points at cottonknit_v2_dd. Retain that unwired database as a recovery copy.
Preserve historical report database names as audit snapshots. New runs resolve the corrected registry connection.
Existing COTTON sessions carry the old database context and must sign in again.
Company ID 1 and UUID fc396258, user hashes, invoice IDs, and storage paths remain intact.
Normal browser login verifies the existing CK-019 invoice and its decoded company logo after cutover.

### GANAPATHI setup and import

Source: ganapathi_db. Fresh target: ganapathi_v2_db.
Reuse inactive registry tenant 8, corporate ID GANAPATHI, UUID 4b1f9aed. Do not create another tenant.
Create registered source connection 4 through the saved-source copy/verify API.
Configure and activate the target through the tenant owner. Owner setup run 12 completes.
Extend the existing read-only media mapping for source 4. Preserve the API image and existing mounts.
No Web, Shop, CXApp, MariaDB, Redis, Media, or Cloudflared container is replaced.

Execute Common, Masters, and Billing through the normal public Data Bridge action and real BullMQ/Redis worker.
GANAPATHI imports 33 Common rows, 87 Master rows, and 301 Billing rows: 421 new business rows total.
The one pristine company seed is updated in place, retaining target ID 1 and UUID 1387767e.
Three missing users retain supported source password hashes and receive target User access.
One existing target administrator remains unchanged.
All 99 confirmed invoices and all 169 invoice items match their source values and mapped target parents.
There are zero invoice warnings and zero orphan references.
System roles, permission definitions, runtime history, queues, migration metadata, and caches remain outside the established business import scope.

### Warnings

COTTON retains its one existing Billing company-settings difference.
GANAPATHI retains its Billing company-settings difference and reports two missing-logo warnings.
GANAPATHI's source paths are bare logo.svg and logo-dark.svg. Its source tenant storage has no client image files.
Do not treat those unbound paths as an arbitrary filesystem location or copy another client's/platform logo.
Target company logo paths remain unset. Valid invoice data imports independently of missing media.
No target settings or unrelated images are overwritten to suppress warnings.

### Queue and repeat proof

| Target           | Stage                     | Run                                  |  Job | Attempts |
| ---------------- | ------------------------- | ------------------------------------ | ---: | -------: |
| cottonknit_v2_db | First audit after cutover | 35ccef90-a594-43f7-b7b5-f345e663f4b7 | 3855 |        1 |
| ganapathi_v2_db  | First import              | 244d796b-cd3b-4a9f-8593-b8f98c0501e6 | 3856 |        1 |
| cottonknit_v2_db | Final repeat              | 72d3a2fc-a675-4683-bfeb-c777a69eda23 | 3859 |        1 |
| ganapathi_v2_db  | Final repeat              | 1decafef-257c-4445-820f-4df057a4f335 | 3860 |        1 |

All deliveries match persisted job IDs and UUIDs and complete in one attempt.
Both final repeats make zero business inserts/updates and copy zero new users.
COTTON verifies 19 invoices and 21 item rows again. GANAPATHI verifies 99 invoices and 169 item rows again.
Public reports verify 140 table drilldowns, 1,272 reviewed business rows, 118 invoice records, and seven user results.
Public reports expose no credential hashes.

### Financial and browser verification

COTTON confirms 13 sales totaling INR 15,167,514.00 and 10 purchases totaling INR 14,484,963.00.
GANAPATHI confirms 99 sales totaling INR 1,321,982.81, three purchases totaling INR 17,806.00, and 23 posted receipts totaling INR 786,597.00.
Authenticated public dashboard totals match independent SQL aggregates.
Both dashboards record billing.dashboard.data-bridge-import after the final queue jobs.
Normal GANAPATHI browser login verifies the Overview totals, company SRI GANAPATHI PRINTING PRESS, and confirmed invoice 99 print, amount INR 3,735.00.
Missing source logo assets remain explicit warnings, not a claim of a verified client logo.

### Recovery and fingerprints

Private before backup: /home/codexsun-releases/cotton-rename-ganapathi/before.sql.gz.
SHA-256: e94e66a15dddfb6ed6541e5881f156b21de2d5b74d5f3549c0c2c29f70f57217. Gzip integrity passes.
The scoped COTTON SQL dump and the old target remain private recovery copies. Do not restore all databases without a reviewed recovery scope.

Both source fingerprints match before and after all operations:

- cottonknit_db: 96 tables, 812 rows, eb50001eace09d261b12428c27c70f3d9e317b1d87f7a8e4c081d3e315c60289.
- ganapathi_db: 96 tables, 1,652 rows, 06753057aca86f937ca0a4a4d80ec7182e52d00d8ed57e89c8adcb46cf512719.

Target business/user fingerprints match across the final repeat, excluding only derived dashboard/event/outbox tables:

- cottonknit_v2_db: 84 tables, 472 rows, de17ea9ee4abfbaebd211232e68ebc501960efe58a2a3fa2e1c8f43ec0dc0128.
- ganapathi_v2_db: 84 tables, 814 rows, 40526ec5269d5eaa55c2a952b8a9c8bc254bb38ca3b06f825562c6408ac92200.

Platform readiness, database health, queue health, and existing container health pass.
Private evidence is under /storage/backups/data-bridge/cotton-rename-ganapathi and the corresponding release directory.
Local summarized proof is dist/verification/cotton-rename-ganapathi/verification.json.


## ASKNITS, SUNLIGHT, MATHAN and AARAN live import — 2026-10-25

The Common → Masters → Billing queue flow completed for these four source/target pairs. Sources were read only. Each target reuses its original seed company ID and UUID; no second company was created.

| Source | Target | Verified invoices | Verified invoice items | Final repeat run | Queue job |
| --- | --- | ---: | ---: | --- | ---: |
| asknits_db | asknits_v2_db | 43 | 115 | 1ca4c8bf-4250-4946-a2a8-2d0b1eb353cc | 3915 |
| sunlight_db | sunlight_v2_db | 44 | 72 | a63981ac-74c3-46c1-890c-6d84ae3e8de5 | 3918 |
| mathan_db | mathan_v2_db | 35 | 35 | f3764030-baa4-471d-8f03-1d366a5c1bc7 | 3928 |
| aaran_db | aaran_v2_db | 10 | 10 | fd9ec9b7-cee8-4e90-8b8b-418c35860748 | 3925 |

All final jobs completed through Redis/BullMQ in one attempt. Repeats inserted and updated zero business rows and copied zero new users. Target business/user fingerprints remained identical across repeats. All invoice comparisons passed with no invoice warnings or orphan children. Public report checks covered 280 table drilldowns, 2,175 review rows, 132 invoices and 15 user entries; no credential hashes were exposed. Newly copied users retain exact source password hashes; existing accounts remain unchanged.

### Approved target corrections

ASKNITS, SUNLIGHT and MATHAN placeholder products now resolve to the source business unit Nos using target unit ID 3. Unit table hyphen ID 1 remains unchanged. AARAN retains its hyphen product unit. ASKNITS source invoice row 22 had one held line; it imported after this correction.

MATHAN financial-year flags now match the source: FY 2025–26 current, FY 2026–27 not current. The Core current-year operation changed selection flags only; names, dates, IDs, amounts and the default-company FY 2026–27 pointer remain unchanged. The subsequent queue run imported the held rows and verified all 35 invoices.

### Preserved warnings and scope

Each tenant retains one Billing company-settings value difference. SUNLIGHT and AARAN also retain source landing app application versus target billing. Their translated company/year/status/singleton identities match. No company or navigation setting was overwritten to hide these warnings. The report currently uses a generic company-mapping warning for this navigation-only difference.

A narrow Data Bridge user-context readiness fix allows that navigation-only difference after checking every other mapped default value, source immutability, exact tenant and completed sessions. Company/year/status mismatches and constant parent mappings still block user copying. Focused negative tests, API build, lint and Linux compiled test passed. API image codexsun/api:1.1.60-bridge-user-context overlays only three compiled Data Bridge files on the existing branding image; this is not a full 1.1.61 release.

SUNLIGHT has 13 extra Accounts tables containing 16 system seed configuration rows and no accounting transaction entries. These setup records were excluded from the requested Common/Masters/Billing business import. This operation is not a raw clone of system tables. None of the four sources has configured company logo files.

### Financial verification

Authenticated public dashboard totals match independent SQL. SUNLIGHT has 33 confirmed sales, INR 8,037,327.00; MATHAN has three confirmed sales, INR 4,492,163.00. ASKNITS has 43 drafts and AARAN has 10 drafts, so their posted-sales totals correctly remain zero. Dashboard snapshots record billing.dashboard.data-bridge-import.

### Source preservation and recovery proof

Full source fingerprints still match the pre-import baseline:

- asknits_db: 96 tables, 912 rows; fc764d2ce4e81b690ccc5ed278e224ee9b8baa6b4b2ac269a410ab829e201790.
- sunlight_db: 109 tables, 1,003 rows; 7bcd9b4ad6ef828b447be7db5f1e7856136a30aa80b56f1351e369591ab0c299.
- mathan_db: 96 tables, 990 rows; 939e936d3b4c92aa5257603f91f9725c87e4529b1c582d1c56df89949ea646cb.
- aaran_db: 96 tables, 605 rows; 46b533ebf24a02c26f786b45f66bb480a34aabe2a70cee1505d762382d6ccfd6.

Private consistent before backup: /home/codexsun-releases/four-client-import/before.sql.gz; SHA-256 e67360e87aa8f3934f19e11fa76a105c7054f4abb943f1a07055d0d21e589121. Integrity checked; do not restore the entire shared database without a scoped recovery review. Source media mount remains read only. Private repair, queue, report and fingerprint evidence: /storage/backups/data-bridge/four-client-import. Local consolidated proof: dist/verification/four-client-import/verification.json.

### Source release 1.1.62

The source release records these four migrations and the approved corrections. It includes automatic company branding transfer and the navigation-only user readiness check. Three focused tests, Core/Data Bridge/Platform API builds, lint and version alignment pass locally. Unrelated CRM, deployment, ecommerce and Codeit implementation changes remain outside this commit. Cloud runs used the scoped images documented above. This release does not deploy a new image or rerun a migration.
