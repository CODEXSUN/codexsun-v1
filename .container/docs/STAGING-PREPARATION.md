# Staging preparation

The v1 preparation helper checks local candidate inputs. It never runs Docker, writes Git, contacts a service, or deploys.
It does not implement staging startup or production image promotion.
The source-building VPS updater remains unsuitable for unchanged-image promotion.

## Candidate provenance

The current sample identifies published 1.1.69 at `65a3a382dd43e7d7972170960c719aedba1385c6`.
Copy candidate inputs to ignored operator storage before filling private evidence paths.
Keep published source separate from proposed deployment-tooling fixes.
The supervisor owns review, commits, publication, candidate branches, and checkout creation.
Do not label a dirty checkout as that exact published source.
If fixes enter the candidate, record its new reviewed commit and rebuild its images.
Keep the original published baseline in the review record. Do not invent a final fix SHA.

## Input checks

Run from the assigned repository root:

```powershell
python -B .container/codexsun-v1/prepare.py --root . --manifest .container/codexsun-v1/candidate.sample.json --phase source
python -B .container/codexsun-v1/prepare.py --root . --manifest .container/codexsun-v1/candidate.sample.json --env .container/codexsun-v1/staging.env.sample --phase staging
```

Exit 78 means preparation is blocked. The distributed samples deliberately omit secrets, image digests, approvals, and evidence.
Source checks require matching HEAD, clean tracked/untracked source, and matching committed and working package versions.
Dirty proposed fixes must fail until the supervisor prepares reviewed source.

Staging checks require API, Web, and Shop repository digests plus saved image inspections.
An API/Web-only candidate may exclude Shop, Worker, and Chatb when it records compatibility for all three excluded services.
For the reviewed realtime profile, include both `worker` and `chatb` in `services` with the same image evidence.
Remove them from `excludedServices`. Partial or contradictory service selection fails preparation.
Set realtime to 1 only for that five-service candidate. Keep the default three-service sample disabled.
Use staging ports 28040 and 28031, a private Worker control token, and the isolated API upstream from the environment sample.
The resolved staging model must supply the API hostname and optional proxy service aliases on an isolated network.
Add checksummed `realtime-queue-routing` evidence covering Redis namespace ownership, authenticated WebSockets, rejection, and graceful shutdown.
Worker currently consumes its own `worker.probe` queue. It does not replace Platform business workers.
Chatb forwards to the existing Chat gateway. Do not transfer queue ownership or trust caller tenant selectors implicitly.
Each inspection must contain one image with matching OCI version/revision labels and the requested repository digest.
For each image, record `inspection` as `{"path":"api.inspect.json","sha256":"<64 lowercase hex characters>"}`.
Record image as `<repository>@sha256:<64 lowercase hex characters>`.
Obtain inspection data only after a separately authorized build. Synthetic tests do not provide candidate identities.

Required review evidence uses the same path/checksum shape under these manifest keys:

- `isolation`: reviewed services, resource identities, egress controls, queues, ports, and provider restrictions.
- `migration-review`: applied-ledger comparison, affected tenant targets, expand-contract analysis, and exact-version approval.
- `recovery-rehearsal`: isolated restore results and application rollback limits.
- `mount-adoption`: actual mounts, ownership, external writers, and reviewed adoption decisions.

Evidence checks prove local file presence and integrity. They cannot establish reviewer authority or factual accuracy.
Never manufacture evidence files or approval values to pass the helper.
A successful check is an input check. Human review and actual staging acceptance remain separate gates.

## Isolation and adoption

The staging environment sample uses separate resource names and loopback ports 28010, 28020, and 28030.
It disables mail, automatic tenant seed, queue workers, reset, restore, and optional realtime.
Use isolated secrets. Do not copy production credentials or provider tokens.
Remove integration credentials from approved sanitized snapshots and restrict outbound provider access.
Separate names alone do not prove isolation. Inspect resolved mounts, networks, queues, and DNS before startup.
The helper validates selected configuration keys. It does not audit every imported row or integration setting.

Do not run VPS wrappers against this file. `CODEXSUN_DEPLOY_TARGET=staging` deliberately fails their VPS guard.
The base Compose model hardcodes production container names and its deployment environment path.
Do not launch that model unchanged for staging. A reviewed staging model with distinct names remains required before startup authorization.
Do not mount production volumes, connect production queues, or reuse the production tenant registry.

The inspected production API has an additional read-only CXApp import mount.
The existing v1 exact-mount guard rejects it. This change preserves that refusal.
Review whether the import capability remains required, and define an explicit supported adoption plan before deployment.
Preserve MariaDB, Redis, Media, Frappe, Cloudflare, CXApp, tenant data, and unrelated resources.

## Ordered staging handoff — UNEXECUTED

1. Have the supervisor review the proposed tooling batch and preserve its source distinction.
2. Have the supervisor prepare a clean checkout of the explicitly selected source revision.
3. Build that exact source once in an authorized controlled environment.
4. Record immutable image digests and image inspection files for each included service.
5. Provision isolated staging resources and secrets only after separate runtime authorization.
6. Prepare and inspect a staging model with distinct container names, resource identities, loopback bindings, and pinned images.
7. Restore only an approved sanitized snapshot through a separately authorized isolated recovery procedure.
8. Review migration ledgers and compatibility for Marketing, Ecommerce, Frappe, and Project Manager retirement.
9. Record evidence paths and hashes, then run the local staging input check.
10. Obtain explicit staging startup and migration authorization.
11. Run the reviewed staging procedure and verify authentication, refresh, tenant isolation, Shop, CRM/Frappe, and affected Marketing flows.
12. Rehearse rollback and record restart behavior and database recovery limits.

No staging launch command is supplied because an approved resolved staging model does not yet exist.
No production promotion command is implemented by this preparation change.
Production still needs an approved promotion implementation, exact images, adoption decisions, verified backups, and explicit deployment approval.
The current operation permits new tenant backups for Techmedia and Rainbow only.
Do not invoke the existing updater under that limit: its backup helper uses `--all-databases` and whole shared storage archives.
Two tenant backups do not cover master migrations or other tenants. Review the actual migration target set and existing recovery coverage first.
Missing coverage blocks replacement. Do not expand the backup scope or suppress migrations merely to pass the gate.
The normal update script retains previous image IDs but does not export runtime image bytes.
Require verified image recovery artifacts before future production changes. Do not use cleanup to obtain them.
Application rollback does not reverse database migrations.

## Focused checks

```powershell
python -B tools/deployment-preparation.test.py
node --test --test-concurrency=1 tools/deployment-env-contract.test.mjs tools/deployment-backup-safety.test.mjs tools/deployment-recovery.test.mjs tools/version-bump.test.mjs tools/sync-repository-docs.test.mjs
```

The tests use synthetic local evidence and fake Docker/Git drivers. They do not contact production or prove live recovery.
