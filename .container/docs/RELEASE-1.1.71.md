# Release 1.1.71: Legacy writer compatibility and Data Bridge ownership

Date: 26-10-2026, Asia/Calcutta.
Published baseline: `b10f8930669b3dce758fc7c27fdcc424be474804`, version 1.1.70.
Owner source commits: Ecommerce `0439aef4` and `1f642b7c`, Data Bridge `f8ac09a2`.
The publication receipt records the final published SHA and clean candidate.

## Problem and behavior

Real synthetic MariaDB evidence for 1.1.70 confirmed successful historical-ledger upgrades.
It also confirmed that the old API's variant insert fails because `option_signature` has no default.
A shared constant identity would collide across distinct variants within one product.

Forward Ecommerce migration 41 installs deterministic owner functions and insert/update triggers.
The functions implement the existing application signature contract using frozen Unicode 17 data.
They include contextual final sigma, ECMAScript whitespace trimming, JSON escaping, and UTF-16 pair ordering.
The sentinel default admits old inserts. Triggers compute their real signature before unique-key validation.
Both old and new writers retain the existing canonical unique index.
Update triggers recompute identity and increment revision, including legacy updates that omit both fields.
The existing application validation remains unchanged.

The migration refuses canonical duplicates before creating routines.
It checks synthetic parity cases and existing-row parity before triggers, default changes, or business updates.
It then backfills signatures through the trigger. Existing row revisions advance during that update.
It preserves row identity and all applied migration-ledger records.
It does not modify any first-40 migration implementation or checksum.
The legacy31 history now has ten pending upgrades. The stable34 history has seven.
An already upgraded 40-step history has only migration 41 pending.

MariaDB routine and trigger privileges must already exist. No privilege, plugin, server, or container change is authorized here.
DDL may partially commit before a failed step. Preserve failure evidence and stop for review.
Do not rewrite the ledger or automatically re-run failed histories.
Migration execution requires the existing lock, maintenance, quiescence, approval, and recovery gates.

## Data Bridge

The missing eight role files now contain real preparation lifecycle responsibilities.
Stage DDL and immutable context binding move from the repository into owner migration and seed files.
The service enforces Core, Masters, then Billing. Snapshot hydration replaces prior memory and rejects execution-authorized rows.
The explicit local worker commits or rolls back stage preparation and produces a count-only completion event.
It does not register an import queue job.
The local harness uses the owner service and synchronization contract while retaining fingerprint checks.
An authenticated capabilities endpoint exposes no records and cannot run preparation or imports.
The owner developer reference is registered in Docs.
This change performs no CXApp access or data preparation.

## Validation and limits

Focused Ecommerce tests passed: 39. Data Bridge tests passed: 8.
The Ecommerce tests include both lineages, already-upgraded 40-step histories, repeated runs, immutable ledger identities, collisions, and parity failure.
Unicode source data was checked against every scalar value in the current application runtime.
Tests use in-memory SQL boundaries. They do not execute MariaDB stored functions or prove old-image rollback safety.
The staging-only `verifyProductVariantWriterCompatibility` helper supplies real SQL acceptance checks for Deploy.
Final repository checks and any blockers belong in the publication receipt.

## Recovery and deployment gates

No documented waiver permits promotion without qualifying recovery evidence.
The unchanged promotion policy requires recent verification, all actual migration targets including master, and a verified restore rehearsal.
It verifies artifact hashes, retained images, scoped storage/Media, configuration, and shared coverage.
Shared coverage must carry a genuine capture timestamp within the existing one-hour freshness gate.
Only already-existing evidence that independently meets every unchanged requirement can satisfy the current restrictions.
No qualifying record has been established. Re-labeling an old artifact or updating its timestamp is not verification.
The supervisor does not change these gates.

No new backups, restores, production contact, SQL/server operation, dependency install, tag, or chat dispatch ran in this source batch.
CXApp databases and the shared MariaDB server/container remain untouched.
Deploy owns fresh builds for API, Web, Shop, Worker, and Chatb from the final published SHA.
Build and test new immutable images. Preserve existing candidates and images.
Actual SQL parity, old/new writes, collision refusal, tenant isolation/authentication, restart/realtime behavior, recovery, and production acceptance remain required.
Candidate creation does not certify those gates or authorize bypasses.

## Additional release gate cleanup

The full repository check exposed one pre-existing Marketing lint error: an unused conversation-list `loading` binding.
Commit `138c703f` removes only that binding. Marketing behavior and its unfinished assigned worktree remain unchanged.
The supervisor isolated the one-line fix in a code-only sparse checkout. No Marketing dependency installation or runtime operation occurred.
The final focused suite passed all 47 tests on the integrated source.

## Final validation

The final full `npm run check` passed after the isolated Marketing binding cleanup.
It completed component documentation, cleanup tests, module boundaries/tests, add-on checks, Docs, 116 typecheck/build tasks, and 62 lint tasks.
The integrated focused suite passed 47 tests. Version validation and dependency layout passed.
An independent audit confirmed only version substitutions in 67 package manifests and the lockfile.
Historical changelog entries remain unchanged.
The 13 supplied reachable tenant ledgers plan with 31 exact applied Ecommerce steps and ten pending steps each.
This is offline metadata proof, not current authenticated tenant acceptance or MariaDB writer proof.

## Latest operational steering

After the source checks, the human authorized Deploy to create new local backups under `D:\workspace\backups\26-10-2023\`.
The stated scope covers CODEXSUN master, all 13 active migration targets, and files, with each tenant separate.
The supervisor does not run backups or change that exact requested directory name.
No restore authorization was given. CXApp databases and shared MariaDB server/container lifecycle and configuration remain protected.
The operator still hardcodes recovery evidence to Techmedia/Rainbow.
Broader backup evidence requires a reviewed operator-scope change bound to the explicit human scope and verified registry identities.
This source release does not change that policy, accept arbitrary manifest grants, or certify those broader artifacts.
Backup file integrity does not establish a verified restore rehearsal.
Deploy owns the backup proof and operational acceptance. The restore/recovery gate remains unresolved.
