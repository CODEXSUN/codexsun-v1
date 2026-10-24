# Local company mapping and user transfer repair

Date: 2026-10-24. Version: 1.1.57, unreleased local changes.

## Scope

Core owns company provenance, default settings, units, and its User-access policy.
Platform owns credential transfer and account-role assignment.
Billing and CRM own their permission rules and persisted state checks.
Data Bridge orders these public contracts and stores sanitized review results.

No cloud deployment or client database import ran for this repair.
The tests write only to disposable local databases and remove them afterward.
Existing unrelated work remains outside this repair.

## Company mapping

1. Read source schema and company count.
2. Prefer a verified existing company match using mapped business fields.
3. If no match exists, require exactly one source company and one pristine marked target seed.
4. Check the complete seed signature and existing company child details.
5. Prepare the selected business values against that retained target identity.
6. Recheck source values, source count, target values, and seed eligibility before the target update.
7. Update the seed in place. Preserve ID, UUID, creation metadata, and dependent references.
8. Resolve default-company and financial-year references by their persisted target identity.
9. Mark confirmed seed identities as claimed, including exact existing matches.
10. Warn on ambiguity, customized target records, or stale preparation. Do not insert a duplicate company.

Fresh seeds write their provenance marker in the same insert.
Tracked upgrades adopt legacy seeds only when the complete original signature and unchanged timestamps match.
Normal owner edits clear that marker.
The internal marker never appears in generic business field selection.

## Units

An empty unit table reserves hyphen at ID 1.
Legacy upgrades preserve occupied IDs and every existing reference.
Add missing pcs and nos without renaming existing business units.
Data Bridge normalizes case and surrounding whitespace for unit identity.
For example, Nos and nos can match while preserving target name and display order.
Other mapped differences remain warnings. Do not guess aliases or use equal numeric IDs as identity proof.

## Account transfer

Wait until company and default-company mapping pass verification.
Require an active mapped target company, default setting, and financial year.
Recheck the active Super Admin and exact registered target before accessing credentials.
Use the Platform-owned account transfer contract. Keep app_users outside generic imports and SQL previews.

Copy only supported password hashes unchanged. Do not rehash, print, persist in reports, or return credential values.
Preserve existing target accounts, passwords, status, and account-role assignments.
New accounts receive only the active target User role, regardless of source administrator privileges.
Run narrow User-access seeds. Full app boot seeds can change unrelated role assignments and must not run here.
Warn on unsupported hashes, account conflicts, missing roles, or unverified business context.

## User permissions

Core and CRM grant supported view/create access within existing tenant and record visibility rules.
Core master records have no generic draft state, so their edits remain administrator-only.
Billing Users can create and edit drafts. Creation and update reject finalized status in submitted payloads.
Administrators control finalized edits, lifecycle changes, deletion, compliance, and settings.
CRM SOP revisions have a real draft state. Their draft-edit grant does not permit published revision changes.
Existing operational CRM work permissions retain their own scopes.
Backend checks enforce these rules even if stale broad permission links exist.

## Reports

Keep company updates separate from inserts.
Show account results in the Users tab and sanitized issues in Warnings.
Preserve the original source collection while showing resolved target values.
A target transaction protects each account or prepared row. There is no atomic transaction across both databases and every table.
After interruption, prepare again. Do not replay a stale snapshot or claim an entire import is atomic.

## Observed local client inventory

This inventory used read-only queries. It is evidence for this date, not a fixed mapping contract.

| Pair   | Source companies | Target companies | Verified company mapping | Default company | Supported source-user hashes |
| ------ | ---------------: | ---------------: | ------------------------ | --------------: | ---------------------------: |
| SUKRAA |                1 |                2 | Source 1 to target 2     |               2 |                            3 |
| ALTEX  |                1 |                1 | Source 1 to target 1     |               1 |                            4 |

Preserve both existing SUKRAA companies. Do not merge or remove them through seed reuse.
Existing client databases have not received the new provenance upgrades as part of these tests.

## Verification

The focused Node test suite passed 32 tests with zero failures, skips, or cancellations.
It covered Core unit upgrades, Data Bridge bulk/business/reference/mapped transfers, company reuse, user copying, and CRM/Billing permissions.
The account tests verified supported hashes with the actual password verifier and checked that report JSON contains no hash.
The create-service regression rejected finalized payloads through all four Billing document services that accept status fields.

Core, Platform, Billing, CRM, and Data Bridge API checks passed TypeScript, lint, and builds.
Data Bridge and Billing frontend checks passed TypeScript, lint, and workspace builds.
Module boundaries, dependency layout, component documentation structure, version alignment, and diff whitespace checks passed.
Version remains 1.1.57. No commit or push ran.

The repository Docs check stops on stale generated references across this work and unrelated concurrent work.
Full root validation is not green. Refresh generated Docs in a coordinated release step.
Do not replace this result with a claim that all repository checks passed.
Browser interaction and cloud execution are outside this local verification.
