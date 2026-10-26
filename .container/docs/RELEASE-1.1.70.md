# Release 1.1.70: Ecommerce migration lineage compatibility

Date: 26-10-2026, Asia/Calcutta.
Published source baseline: `38d2b32b20648fa8d9307cab71ffd0dfd55d1da0`.
Reviewed owner repair: `d1eb742b1b3a325a3f0902c0a14bc2730f13f034`.
The supervisor publishes the final versioned main commit and records its exact SHA in the candidate receipt.

## Problem and resulting behavior

The previous application candidate was `44f2e542d0ce8efb8b3ff090e648d32705522901`, version 1.1.69.
Its array-derived migration numbers conflict with the older deployed Ecommerce lineage.
All 31 supplied applied Ecommerce records match `8433a8ff`. Later insertions shifted 29 names under the newer 34-step lineage.
The framework correctly rejected the conflicting version/checksum pairs.

Explicit manifests now preserve both proven histories.
The 31-step lineage appends nine missing upgrades at versions 32–40.
The 34-step lineage appends six missing upgrades at versions 35–40.
Empty histories use the newer manifest for fresh installation.
Incomplete, mixed, unknown, failed, running, rolled-back, duplicate, wrong-scope, or wrong-batch histories require review and fail closed.
Execution dependencies remain separate from historical version identities.

## Ownership and database impact

Database update: Yes. The release changes migration selection and permits the existing pending forward upgrades to execute on a verified lineage.
Migration SQL bodies are unchanged. Ecommerce owns its manifests and compatibility decisions.
The optional framework `MigrationBatch.resolveSteps` contract supplies immutable scope metadata inside the existing migration lock.
The framework still validates every applied version and checksum. It skips applied steps without rewriting ledger rows or timestamps.
No arbitrary checksum aliases or live ledger edits are introduced.
The public `planEcommerceTenantMigrations(ledger)` reports lineage and pending identities without SQL execution.

The nine older-lineage upgrades cover product revision, variant option storage/canonical identity, attributes, specifications, collections, and activity.
Variant canonicalization can update signatures and change indexes. It rejects canonical duplicates before rewriting variants.
MariaDB DDL, existing rows, foreign keys, and runtime compatibility require actual isolated staging acceptance.
The in-memory SQL boundary does not establish those facts.
Partial installations or failed migrations are intentionally not auto-repaired by this release.

## Source validation

- Focused migration, variant identity, and variant service tests passed: 34 tests.
- Tests execute the actual migration callbacks against an in-memory SQL boundary, with no server connection.
- Both historical manifests preserve applied identities and simulated timestamps. Repeat runs add no migration-step writes.
- Tampered, unknown, mixed, duplicate, incomplete, wrong-batch, failed, running, and rolled-back evidence fails.
- Populated variant fixtures verify bounded signatures and duplicate refusal without row deletion.
- Supplied metadata for 13 active reachable tenants selects the older lineage with 31 exact applied records and nine pending Ecommerce steps each.
- Framework and Ecommerce API typechecks and focused lint passed. The Ecommerce boundary check passed.
- Docs synchronization and the local-runtime exclusion regression passed.
- A framework library compile supplied the public runtime contract for tests. No application images were built.

Record final repository release checks, exact candidate SHA, and any unavailable checks in the supervisor receipt.
The Docs scanner now excludes `.codex-runtime`, preserving local ignored handoffs without publishing them.

## Tenant and recovery limits

The operational audit reports THIRUMURUGAN was explicitly marked inactive, retaining its database binding and audit event.
This source batch does not alter that registry record or create a replacement database.
Thirteen remaining active tenants had reachable metadata at audit time. This is not authenticated tenant acceptance.
Pending Marketing and Frappe steps remain outside this Ecommerce compatibility proof.
Extra pending steps in TIRUPURCONNECT and TENKASISPORTS require their own review.

No production contact, SQL/server operation, restore, new backup, CXApp database access, or shared MariaDB change ran in this source batch.
Synthetic SQL-driver tests and metadata fixtures are not database execution or recovery evidence.
The no-restore constraint remains binding.
No qualifying preexisting recovery verification has been established. Existing restore-verification and target-wide coverage gates remain blocked.
Do not fabricate evidence, waive checks, or treat this source repair as deployment approval.

## Corrected candidate

Prepare a clean `release/1-1-70` checkout from the exact reviewed, versioned, published main commit.
Keep the old 1.1.69 candidate and images unchanged. They do not contain this repair and cannot stand in for it.
Deploy owns separately authorized staging image builds and gated deployment.
New API, Web, Shop, Worker, and Chatb image identities must bind to the new source SHA and version.
No digests, staging acceptance, migration approval, or recovery approval are invented by candidate creation.
No tags are published. Existing unrelated work, media, stashes, and release reservations remain preserved.

## Final supervisor checks

The final 1.1.70 source checks passed:

- Version validation and an independent audit of 67 package manifests and the lockfile.
- The audit found only 1.1.69 to 1.1.70 substitutions in package metadata. Historical changelog entries remain unchanged.
- Framework library compilation, Framework and Ecommerce API typechecks, and both scoped lint commands.
- All 34 focused migration and variant tests, plus the Docs scanner regression test.
- Docs content synchronization/check, Ecommerce module boundaries, dependency layout, and Git whitespace validation.

The full `npm run check` ran and failed at repository module boundaries.
The existing `data-bridge-api/legacy-cxapp` module lacks eight required role files:
`module`, `service`, `routes`, `events`, `migration`, `worker`, `seed`, and `sync`.
Those files are also absent from published baseline `38d2b32b`.
The aggregate command stopped before its later tests, add-on audit, full typecheck, and full lint.
Do not report full repository validation as passed.
This release does not change that unrelated module.

Source publication and a clean staging candidate do not waive this blocker or authorize production promotion.
Deploy must record the unresolved repository gate alongside its own staging, migration, recovery, and production gates.
The latest constraints permit no new backups and no restores.
Existing artifacts do not independently establish recovery acceptance.
CXApp databases and the shared MariaDB server/container remain untouched by this source task.
