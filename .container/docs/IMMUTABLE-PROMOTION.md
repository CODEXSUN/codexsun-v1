# Immutable five-service promotion

`codexsun-v1/promote.py` promotes locally available API, Web, Shop, Worker, and Chatb repository digests.
It never fetches source, builds images, pulls images, runs migrations, creates backups, or provisions infrastructure.
The existing `update.sh` remains a separate source-building updater. Do not use it as image promotion.

## Build and operator provenance

Build application source once from a clean reviewed candidate. Record all five OCI version/revision labels and repository digests.
Test these same digests on isolated staging. Transfer existing images by an approved mechanism without rebuilding.
Check imported image digests and labels before promotion. Do not replace missing images with tags.

Keep the application source SHA separate from the operator-tooling SHA if they differ.
The supervisor owns publication and the clean operator checkout. Do not execute unpublished tooling against production.
Apply requires the exact reviewed operator commit and a clean checkout. This check reads Git but never changes it.
The operator must verify publication separately. A local commit alone does not prove publication or review.

```bash
python3 -B .container/codexsun-v1/promote.py --manifest /private/release.json --expected-revision "$APPLICATION_SHA"
python3 -B .container/codexsun-v1/promote.py --manifest /private/release.json --expected-revision "$APPLICATION_SHA" --expected-operator-revision "$OPERATOR_SHA" --apply
```

These are operator interfaces, not instructions to deploy an incomplete sample.
The sample manifest intentionally lacks images, evidence, and authorization. It must fail.

## Checked release record

Use `promotion.sample.json` as the field guide. Keep completed records outside Git with private permissions.
Every evidence reference has `path` and a lowercase SHA-256. Relative paths resolve beside the release manifest.
Paths can contain secrets. The command does not print Compose contents, environment values, or raw Docker stderr.

The `images` mapping contains exactly the five production service names and immutable repository digests.
Every evidence receipt identifies actual operations and reviewed facts. Never create a passing receipt to substitute for missing verification.
Checksums establish integrity, not reviewer authority or truthful acceptance.

Required receipts:

- `staging`: exact `source`, `images`, timezone-qualified `completedAt`, and actual passing `checks`.
- `migrations`: exact `source`, `images`, actual `targets` including `master`, `compatible: true`, and `completed: true`.
- `adoption`: exact `source`, `approved: true`, bound `productionSha256`, and actual container IDs under `containers`.
- `recovery`: final backup time, exact coverage, checked artifact references, rollback-model hash, and quiesced container identities.
- `production`: resolved JSON Compose model, reviewed by the adoption receipt.
- `rollback`: captured previous Compose model with immutable image IDs and original running-state flags.

`productionAuthorization` binds the exact application source and image mapping to the human's deployment authorization.
It does not supply technical evidence. Existing task authorization remains subject to every gate.

Staging acceptance requires `startup`, `isolation`, `authentication`, `tenant-isolation`, `browser`, `worker-queue-ownership`,
`chatb-websocket`, `restart`, and `rollback` checks. Every value must be true from actual evidence.
Staging acceptance expires after 24 hours. Final recovery evidence expires after one hour. Future timestamps fail.
Migration completion does not authorize arbitrary destructive changes or imply database rollback.

Adoption also requires `workerQueueOwnershipVerified` and `realtimeRoutingVerified`.
Existing application mounts must match the proposed named volumes and read-only modes exactly.
This preserves legitimate read-only import mounts rather than silently discarding them.
Database identity, credentials, session keys, tenancy mode, and existing Redis URL cannot change during promotion.
Worker and Chatb cannot acquire application/database mounts or unrelated environment credentials.

The production model permits only the five application services, loopback ports, and external resources.
Builds, runtime overrides, unresolved extensions, reset/restore flags, bootstrap tenant seed, and new infrastructure fail.
Use explicit environments in the resolved private model. Do not retain `env_file`, include, or extends references.
Use resolved numeric ports and escape literal environment dollars once as `$$` for Compose.
Unresolved interpolation fails. Existing secret comparisons decode only that single Compose escaping layer.

## Recovery scope

New tenant databases are exactly `techmedia_db` and `rainbow_db`.
Do not invoke the existing updater backup helper because it dumps all databases and archives shared storage.
The recovery receipt's `coveredTargets` must cover every actual migration target, not only the two new backups.
Set `registryTargetsVerified` and `restoreRehearsalVerified` only after actual verification.
This does not permit creating other tenant backups or treating old snapshots as current coverage.

The recovery `artifacts` mapping requires these checksummed indexes or files:

- `scoped-sql`: JSON array of two database/path/hash records. SQL directives and completion markers are checked.
- `scoped-storage` and `scoped-media`: JSON indexes with `tenantOwnershipVerified`, both `tenantUuids`, `allowedPrefixes`, and an `archive` reference.
- `configuration`: private scoped configuration recovery artifact.
- `images`: Docker save archive with its load manifest, every previous image configuration, and all referenced layers.
- `shared-coverage`: existing recovery index with `capturedAt`, `coveredTargets`, `restoreVerified`, and checksummed `artifacts`.

The scoped UUIDs are `de870404` and `14c8040c`. Verify their exact live registry/database bindings before creating backups.
Archive members must stay within reviewed tenant-owned prefixes. Links, special files, traversal, and empty archives fail.
Do not infer ownership from a filename or fabricate an empty backup when storage mapping is unresolved.
Existing shared coverage must be fresh and sufficient. Missing coverage blocks the operation under the two-tenant limit.
Image and configuration artifacts do not establish database restore capability.
Configuration digests alone do not establish image recovery. Every retained layer must match its configuration's uncompressed content digest.

## Maintenance boundary and rollback

This command consumes final recovery artifacts. It does not orchestrate maintenance, stop original writers, or take final backups.
The approved maintenance procedure must hold the prescribed lock while it quiesces writers and verifies final backups.
Never force-kill writers. Abort on graceful-stop timeout and recover the previous running state.
Before apply, `quiescedContainers` must match each actual container ID and Docker `FinishedAt` value.
Every previous application container must still be stopped. A restart after the final backup invalidates that state.
Coordinate external Media and database writers separately. Stopped API containers alone do not prove shared-resource consistency.

Apply is Linux VPS only, rejects Docker Desktop, acquires `/tmp/codexsun-v1-deployment.lock`, and rechecks all inputs.
It runs Compose with `--no-build --pull never`, verifies running identities and readiness, and records a private status file.
After replacement failure, it gracefully stops only owned application services, removes only newly introduced services,
and restores previous image/configuration references and original running states.
Rollback cannot provision networks or volumes or load external runtime settings. It disables dependency startup to preserve stopped services.
A timeout, ownership change, missing artifact, or recovery failure leaves an explicit failure instead of force-killing services.
Application rollback never reverses database migrations. External browser and business acceptance remains required after health checks.

## Local verification

```powershell
python -B tools/deployment-promotion.test.py
python -B tools/deployment-preparation.test.py
```

Tests use synthetic receipts and a fake Docker boundary. They are not production migration, backup, or restore evidence.
