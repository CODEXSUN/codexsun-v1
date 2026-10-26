# One-time 1.1.72 operator exception

This is an operator-only change. Application source remains `e6e7b79c751fb0d700b063daadd89cba4b289473`, version 1.1.72.
Do not rebuild or change any tested image. Keep the application and published operator SHAs separate.
The default promoter and all future releases keep the existing recovery gates.

## Exact authorization

The opt-in path pins the recorded human exception, all five tested repository digests, both reviewed models, and registry identity hashes.
Pins live in `codexsun-v1/lib/release172-pins.json`. They contain no private model contents or tenant identities.
The exception expires at midnight Asia/Calcutta after 26-10-2026.
The human exception file must remain byte-identical. Its old backup path records historical context, not the final selected proof.
Select the fresh backup through the release recovery receipt.

Only missing restore verification, the old two-database artifact format, cross-database consistency, and incomplete shared-Media coverage are accepted gaps.
Keep `restoreRehearsalVerified`, `completeRecovery`, `crossDatabaseAtomicityVerified`, and `filesCoverageVerified` false in the fresh proof and recovery receipt.
No restore or reset is authorized. No accepted gap becomes a passing technical proof.

## Fresh local proof

Capture the exact CODEXSUN master plus 13 approved tenant identities under the authorized local backup directory.
Preserve the current SQL encryption format, scope file, table inventory, protected key, configuration, and included storage artifacts.
Set `quiesced=true` and add `captureStartedAt` at actual capture start after graceful application shutdown.
Include `quiescedContainers` with the exact prior API/Web/Shop container IDs and Docker `finishedAt` timestamps.
Keep the same map in the recovery receipt. The live promoter checks it again under the deployment lock.
The fresh scope, SQL, configuration, and included storage artifacts must be within one hour.
Every artifact completion time must be between capture start and final proof completion.
Do not refresh old timestamps. Final `completedAt` must include completion of all included captures.

Run only the published local verifier on the authorized Windows backup profile:

```text
node .container/codexsun-v1/verify-local-release172.mjs D:\workspace\backups\26-10-2023\FRESH-RUN\BACKUP-PROOF.json D:\workspace\backups\26-10-2023\FRESH-RUN\LOCAL-VERIFICATION.json
```

The verifier retrieves the protected key through CurrentUser DPAPI without logging it.
It reads ciphertext hashes and sizes, authenticates AES-GCM identity headers, verifies gzip, and checks SQL scope and table definitions.
Configuration must include exactly the previous three CODEXSUN applications.
Included storage archives are read as streams. Foreign paths, traversal, links, and special files fail.
No SQL executes, no files are extracted, no plaintext backup is written, and no restore occurs.
The output receipt is written exclusively beside the proof. Existing receipts are not overwritten.
The command prints its SHA-256. Supply that trusted hash separately to the Linux promoter.
A boolean copied into a manifest is not a substitute for running this verifier.

## Release record additions

Keep all standard source, image, staging, adoption, migration, production, rollback, and authorization fields.
The `source` is exactly the two-key version/revision object for the application.
Use the standard five `codexsun-*` service names for image mappings.
Add these checksummed references. Each `path` points to a private copy readable by the Linux operator:

```json
{
  "release172Exception": {"path":"human-release-exception.json","sha256":"PINNED-HUMAN-RECORD-HASH"},
  "recovery": {"path":"recovery.json","sha256":"ACTUAL-RECOVERY-RECEIPT-HASH"}
}
```

The referenced recovery JSON retains the standard actual fields and adds:

```json
{
  "completedAt":"ACTUAL-FINAL-PROOF-COMPLETION",
  "backupProof":{"path":"BACKUP-PROOF.json","sha256":"ACTUAL-PROOF-HASH"},
  "localVerification":{"path":"LOCAL-VERIFICATION.json","sha256":"PRINTED-VERIFIER-HASH"},
  "coveredTargets":["master","EXACT-THIRTEEN-APPROVED-TENANT-DATABASES"],
  "registryTargetsVerified":true,
  "rollbackSha256":"PINNED-ROLLBACK-MODEL-HASH",
  "quiescedContainers":{"codexsun-api":{"id":"ACTUAL-ID","finishedAt":"ACTUAL-DOCKER-TIMESTAMP"}},
  "restoreRehearsalVerified":false,
  "completeRecovery":false,
  "crossDatabaseAtomicityVerified":false,
  "filesCoverageVerified":false,
  "artifacts":{"images":{"path":"VERIFIED-PREVIOUS-IMAGE-ARCHIVE","sha256":"ACTUAL-ARCHIVE-HASH"}}
}
```

The example is incomplete and must fail. Supply all three actual previous writer identities and all fourteen exact targets.
Copy proof bytes without rewriting Windows paths inside it. The local receipt binds those exact proof bytes.
Protected keys and decrypted backups stay local. Do not transfer them to the VPS.
The migration receipt must record actual completed approved production migrations after the fresh backup, with `completedAt`.
Unknown, mixed, or failed histories remain blocked. No applied ledger rewriting or arbitrary target expansion is permitted.

## Operator execution

Use the reviewed, published, clean operator checkout. Expected revision is the application SHA, not the newer operator SHA.

```text
python3 -B .container/codexsun-v1/promote.py --manifest /private/release.json --expected-revision e6e7b79c751fb0d700b063daadd89cba4b289473 --release172-exception --release172-local-verification-sha256 PRINTED-VERIFIER-HASH
```

Apply adds the existing `--apply --expected-operator-revision FULL-PUBLISHED-OPERATOR-SHA` arguments.
All input files must retain private ownership and permissions.
The promoter retains staging acceptance, exact models and images, actual migration targets, freshness, and rollback-image graph validation.
It also retains ownership, mount/configuration identity, secret preservation, Linux-only execution, graceful quiescence, and the host deployment lock.
It never fetches, builds, pulls images, captures backups, runs migrations, restores data, or provisions infrastructure.
CXApp databases and MariaDB server lifecycle, configuration, privileges, and volumes remain outside its operations.

After all preflight checks, apply exclusively creates `/tmp/codexsun-v1-release172-e6e7b79c-exception.used` under the deployment lock.
This fixed host marker prevents replay through another manifest or directory.
There is no reset command. A failed attempt after consumption needs operator review instead of automatic replay.
The private status and command result explicitly record accepted gaps and the unchanged false proof values.
Application rollback restores prior images/configuration and running states. It does not reverse database migrations.
Every prior service must carry an explicit boolean `x-codexsun-running` from the original inventory.
The pinned corrected rollback model records all three prior applications as running.
Omitted running states fail this exception instead of silently creating stopped rollback containers.

## Focused verification

Run the normal promotion, OCI, preparation, release172 exception, and local encrypted-integrity tests.
Tests use synthetic receipts, keys, dumps, archives, and a fake Docker boundary.
They do not certify production recovery or perform any production operation.
