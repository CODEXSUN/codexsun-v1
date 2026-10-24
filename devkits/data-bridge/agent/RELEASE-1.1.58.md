# Data Bridge 1.1.58 local client verification

Date: 2026-10-24. Cloud deployment: not performed.

## Execution boundary

The agent ran the repository Data Bridge service through an explicit local test harness.
The harness created fresh targets because both requested target names were absent.
Core, Platform, Billing, and CRM owner migrations and seeds initialized the targets.
BusinessImportService prepared and committed Common, Masters, and Billing data in dependency order.
The harness did not insert business records with manual SQL.
This test called the persisted service runner directly. It did not test browser interaction or Redis delivery.

Sources remain read-only in this workflow. Full source row fingerprints matched before and after both import passes.
Both targets remain available locally. Do not drop them when repeating this test.

## Results

| Verification                          |    SUKRAA |     ALTEX |
| ------------------------------------- | --------: | --------: |
| Sales invoices verified               | 137 / 137 | 184 / 184 |
| Invoice item rows verified            | 521 / 521 | 690 / 690 |
| Other invoice child rows verified     |        19 |         0 |
| Deleted invoices retained             |         0 |         5 |
| User hashes and User roles verified   |     3 / 3 |     4 / 4 |
| Companies after import                |         1 |         1 |
| Company/default rows updated in place |         2 |         2 |
| Orphan references                     |         0 |         0 |
| Repeat business inserts or updates    |         0 |         0 |
| Repeat account inserts                |         0 |         0 |
| Remaining settings warnings           |         1 |         1 |

SUKRAA descendants include 10 e-invoice rows, 9 e-way-bill rows, and 521 item rows.
ALTEX retains five deleted invoices as deleted history. Active sales must continue to hide them.
Owner verification resolves foreign IDs from target business identity before comparing persisted values.
The unit table starts with hyphen at ID 1. Missing pcs and nos defaults exist.
Company reuse preserves the seed ID and UUID and resolves the mapped default company and financial year.

### Group totals

| Target    | Group   | Tables | Inserted | Updated in place | Warnings |
| --------- | ------- | -----: | -------: | ---------------: | -------: |
| sukraa_db | common  |     31 |      143 |                0 |        0 |
| sukraa_db | masters |     16 |      199 |                2 |        0 |
| sukraa_db | billing |     23 |     1253 |                0 |        1 |
| altex_db  | common  |     31 |       28 |                0 |        0 |
| altex_db  | masters |     16 |      247 |                2 |        0 |
| altex_db  | billing |     23 |     4811 |                0 |        1 |

### Preserved settings warnings

Each target has one billing_company_settings conflict for its existing company/settings key.
Only settings_json differs. The importer preserved the target default settings and reported the difference.
This is not an invoice or relationship failure. Source settings were not overwritten or modified.
Review configuration explicitly before promoting these target databases.

## User access proof

All seven copied accounts retain their exact supported hashes and receive only the target User role.
Existing-account preservation and password verification also pass the separate disposable regression suite.
Actual target authorization checks allow Core view/create and Billing draft edits.
They reject Core edits/deletion, Billing finalized edits, workflow changes, deletion, and settings changes.
CRM grants include enquiry creation without enquiry update/delete grants.
Runtime permission initialization does not elevate the copied accounts.
No client password was known or entered. Hash equality and authorization checks are not a browser login test.

## Repeat and source preservation proof

### sukraa_cloud_db to sukraa_db

- First report: `df5fbad7-24bb-4b4b-9fa5-7bb127d030a2`.
- Repeat report: `1e688de2-ac43-4552-9d03-309e2736a691`.
- Source row SHA-256 before and after: `538b0c7a2d7e1348912448ba35bf0e6894d17671c0db49dddeaaf3dc5c78b54e`.
- Repeat business and account row fingerprints match. Auto-increment counters are outside this row-value claim.

### altex_cloud_db to altex_db

- First report: `9ef82e3c-584e-4281-930f-3849941c8c16`.
- Repeat report: `8ee51d02-1826-4589-8566-f4fd8181f298`.
- Source row SHA-256 before and after: `701162e4cadb4b70c338ab18c4fa65d564b814a95c326d490234ef78e3f50319`.
- Repeat business and account row fingerprints match. Auto-increment counters are outside this row-value claim.

## Checks and limitations

The prior focused suite passed 32 tests. The release rerun passed all 10 access and CRM scope tests.
Core, Billing, CRM, and Data Bridge API typechecks passed. Data Bridge and Billing frontend typechecks passed.
All seven selected owner lint checks, dependency layout, module boundaries, and version alignment passed.
Platform API typecheck encounters an unrelated Ecommerce product-information statusCounts type error in the shared working tree.
The root check passes component documentation, cleanup, boundaries, and add-on checks, then stops on stale generated Docs references.
Those unrelated implementations remain outside this commit. The full shared-working-tree root gate is not green.

Run the fresh-target harness only with CODEXSUN_BRIDGE_LOCAL_CLIENT_TEST=1 and the local root environment.
It refuses to replace existing targets. Use a reviewed fresh-target setup for any later rehearsal.
Sanitized totals are recorded here. Row-level reports remain in the local review database and ignored dist verification folder.
Do not commit hashes, credentials, or client row contents.

## Release scope

Release 1.1.58 includes unit defaults, company provenance/reuse, User access policy, account transfer, sanitized reports, and these tests.
Package metadata changes remain lockstep across workspaces. No Ecommerce or Codeit implementation is included.
No cloud migration or cloud deployment ran.
