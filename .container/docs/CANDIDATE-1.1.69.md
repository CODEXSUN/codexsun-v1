# 1.1.69 candidate provenance and gates

Prepared on 26-10-2026, Asia/Calcutta. This is a local source candidate, with no build or deployment.

## Source selection

- Original published 1.1.69 baseline: `65a3a382dd43e7d7972170960c719aedba1385c6`.
- Prompt Manager rule published separately: `a81dfa5fbfe934d6cad16279051c684a047eb409`.
- The human approved including that rule before integrating the reviewed deploy batch locally on main.
- This candidate includes the reviewed deploy fixes. They are absent from both earlier published commits.
- Record the exact resulting commit in the private candidate manifest and supervisor receipt after commit creation.
- Freeze the candidate from that exact reviewed main commit. Do not add later feature changes.
- Keep package versions at 1.1.69. Do not publish the deploy commit or a release tag under this authorization.

## Reviewed changes

- Require a full reviewed SHA before a mutating VPS update can start.
- Reject a different fetched target before source merge, build, migration, or replacement.
- Add a read-only preparation validator for clean source, version, immutable image identities, image labels, evidence hashes, and selected isolation settings.
- Add staging-only templates with missing secrets, digests, migration approval, and evidence left explicit.
- Preserve strict mount-adoption checks and the distinction between input validation and actual staging acceptance.
- Keep the VPS source-building updater separate from the required immutable-image promotion flow.

## Service and data scope

Included application images: API, Web, and Shop. Their digests are unknown because no images were built.
Excluded: Worker and Chatb, pending exclusion compatibility and WebSocket acceptance.
Preserve CXApp, MariaDB, Redis, Media, Frappe, Cloudflare, tenant data, and unrelated services.
No schema, migration, seed, or database operation is introduced by this tooling batch.
Earlier Marketing, Ecommerce, Frappe, and Project Manager retirement compatibility still needs staging review.

## Verification and preservation

The supervisor verified all nine handoff file hashes before adding this provenance record and changelog notes.
Private snapshots retain original tracked patches, untracked files, source HEADs, and existing stash identities.
The separate Prompt Manager publication and worktree sync preserve unfinished CXMobile edits and Ecommerce media.
Deployment checks use synthetic files and fake Git/Docker drivers. They do not build images or contact production.
The full five-file Node simulation passed: 39 tests, zero failures.
The Python preparation suite passed: seven tests, zero failures.
Shell, Python and edited Node syntax, version alignment, documentation links, Docs references, and whitespace checks passed.
Dependency-based formatting, app builds, lint, and type checks were not run because this checkout has no dependencies.
Final commands, results, source SHA, and candidate checkout verification belong in the private supervisor receipt.
No dependency installation or dependency copying is authorized or performed.

## Open gates

1. Controlled build of the exact selected commit and immutable API/Web/Shop digests with matching OCI labels.
2. Reviewed staging model, private isolated secrets, sanitized data, queue separation, egress controls, and actual mount/network inspection.
3. Exact migration-ledger and tenant compatibility review, including restored-snapshot rehearsal.
4. Explicit adoption decision for the extra CXApp import mount and legacy VPS configuration differences.
5. Verified backup and image recovery artifacts, recovery rehearsal, and reconciliation of stale production release records.
6. Investigation of the recorded API database connection failures and affected runtime acceptance.
7. Actual authentication, tenant isolation, browser, Shop, Marketing, CRM/Frappe, restart, and realtime staging evidence.
8. A compliant immutable-image promotion executor and later explicit production approval.

No staging startup, migration, restore, Docker operation, production change, or image promotion is authorized by this record.
