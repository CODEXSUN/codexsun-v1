# Internal VPS deployment

This is an operator guide. Do not publish `.container` content through the application Docs catalog.
No command below has been run as part of the consolidation.

The separate [manual Frappe installer](../frappe/README.md) supports guided setup and a portable source-only ZIP.
It reuses selected infrastructure and remains outside the root application setup/update contract.

## Layout

```text
setup.sh                         -> .container/codexsun-v1/deploy.sh
update.sh                        -> .container/codexsun-v1/update.sh
.container/
  codexsun-v1/                   versioned deployment implementation
    deploy.sh                    fresh installation
    update.sh                    routine VPS release
    clean.sh                     scoped destructive cleanup
    Dockerfile
    docker-compose.yml
    api-entrypoint.sh
    nginx-web.conf
    nginx-shop.conf
    lib/                         configuration, backup, and release helpers
  database/mariadb/              retained definition
  database/redis/                retained definition
  media/                         retained, not installed or bound by v1
  frappe/                        separate fresh ERPNext installer, invoked explicitly
  docs/                          internal operator guides
  agent/                         agent instructions and evidence
  deploy.env.sample              shared configuration template
  deploy.env                     ignored private VPS configuration
  backups/                       ignored private backups and release records
```

`codexsun-v1` identifies the deployment contract. It is separate from application version `1.1.x`.
A future v2 requires reviewed root-wrapper changes. Do not silently migrate infrastructure or volume identities.

## Prerequisites

Use a Linux VPS with Docker Engine, Compose v2, Git, Python 3, gzip, sha256sum, and flock.
Docker Desktop and workstation deployment are rejected. Use a clean, committed GitHub checkout on the configured branch.
Keep the existing Cloudflare Tunnel and domain routing unchanged. Published application ports bind to loopback.
Provision `.container/deploy.env` with private permissions. Do not copy development `.env` or put secrets in command arguments.

```bash
bash setup.sh --configure
```

Configuration is an explicit setup mode, not another root preparation script.
It uses host Node or the exact Node Docker image from the source manifest.
Review every value before installation. Set the VPS marker, DB/Redis container names, network, storage volume, credentials, ports, and origins.
For shared infrastructure, retain its actual names, passwords, database names, network, and Redis URL.
Do not replace existing secrets or attach this deployment to another tenant registry.
`--configure` fills sample defaults. It is not an automatic migration from retired deployment layouts.

## Fresh installation

```bash
bash setup.sh --check
bash setup.sh
```

Fresh installation refuses existing application containers.
For a populated master database, explicitly add `--reuse-database`. Existing database data remains and bootstrap seeding is skipped.
An existing MariaDB volume also requires this flag when its container is absent.
Setup checks the master database again after infrastructure starts. Reuse mode never runs bootstrap seeders, including against an empty registry.
It can reuse healthy MariaDB and Redis containers on the configured network.
When absent, it creates only the retained `codexsun-mariadb` and `codexsun-redis` definitions.
It never replaces an existing database server. Media and Frappe remain outside setup.

Setup backs up the database server before application builds and migrations.
It builds API, Web, and Shop. An empty installation runs initial migrations before preflight because its tenant registry does not exist yet.
It then runs preflight and explicitly seeds the fresh installation. Retained databases run preflight before migrations and skip bootstrap seeding.
It creates the named application volume, starts containers, and checks readiness and web proxies.
`--yes` skips the operator confirmation but preserves all guards.

## Routine update

Commit and push reviewed development changes separately. This updater does not create commits or push source.
The VPS checkout must be clean, on `CODEXSUN_GIT_BRANCH`, with a GitHub `origin`.
Review migrations and set `CODEXSUN_MIGRATION_COMPATIBLE_VERSION` to the candidate version before update.
This approval confirms expand-contract compatibility with the running release. It is never inferred from a successful build.

```bash
bash update.sh --check
bash update.sh
```

`--check` validates current VPS configuration and source without fetching, building, migrating, or replacing containers.
The update acquires a host lock shared with setup and cleanup.
It creates and verifies database, application-storage, configuration, and rollback backups before pulling source or building images.
After building, it stops selected application writers gracefully and creates a second verified backup before migrations.
This creates a maintenance window during the final backup, migrations, and application replacement. Redis and MariaDB remain running during updates.
It fetches the configured GitHub branch and fast-forwards to that exact fetched commit.
Changed commits require an increased application version. Same-commit reruns can retry an incomplete deployment.
Source package versions define image tags. Persisted secrets and infrastructure versions remain unchanged.
Version-bump tooling does not change infrastructure pins or automatically approve migrations for the next version.

Builds record application version and Git revision labels for every image. The candidate Compose model pins immutable image IDs.
The updater checks those labels, records immutable image IDs, verifies backups again, and runs compiled migration commands.
It replaces application containers only. MariaDB, Redis, Media, networks, and data volumes remain in place.
Worker and Chatb join the release only when `CODEXSUN_REALTIME_ENABLED=1`.
Their business queue ownership and WebSocket routing do not change automatically.

## Backup and rollback

Backups live in `.container/backups/<UTC timestamp>-<PID>-<unique suffix>` with private permissions.
They contain a complete transactional MariaDB dump, private configuration, optional application-storage archive,
the previous container model and raw inspection metadata, image identities, candidate model, release status, and SHA-256 checksums.
The SQL dump requires a completion marker. Storage archives must pass gzip validation.
Failed or partial backups stop deployment. No automatic backup deletion runs during an update.

The database dump covers the configured MariaDB server, including its other databases.
Ensure the backup account has sufficient privileges and adequate backup disk space.
The initial online SQL transaction and storage archive are separate snapshots.
The final update backup stops selected application writers before both snapshots. Coordinate external database writers for a single recovery point.
Shared Media is not backed up by v1 because it is not bound to this deployment.
Redis is preserved during updates. Cleanup backs up an owned Redis volume before removing it.

Failed application replacement verifies backup checksums, removes newly introduced services, restores previous images and configuration, and waits for health.
Originally stopped services remain stopped. A failure before replacement resumes the original running services.
Raw Docker configuration needs dollar-sign escaping when rendered as Compose JSON. Rendered candidate models already contain this escaping.
Database migrations are not automatically reversed. Keep old image IDs until the rollback window closes.
After failure, the Git checkout may remain at the candidate commit while previous containers run.
Inspect `release.json` and verify application behavior before retrying or restoring data manually.
Do not use Docker health checks as proof of tenant permissions, browser behavior, or business data correctness.

## Cleanup

```bash
bash .container/codexsun-v1/clean.sh --check
bash .container/codexsun-v1/clean.sh
```

Cleanup is destructive and requires confirmation after a displayed plan.
It first creates checksum-verified database, storage, configuration, and rollback backups.
Before backup, it stops application writers and owned Redis gracefully. Redis persistence is flushed before its shutdown.
It saves runtime images to `runtime-images.tar.gz` before removing them. Raw cleanup container metadata is retained for recovery.
Backup or archive failure resumes surviving services that were running before cleanup. Originally stopped services remain stopped.
It removes only the known application containers in Compose project `codexsun`, their removable images, and the configured application volume.
It removes Redis only when its container belongs to the retained `codexsun-redis` Compose project.
Shared Redis, MariaDB, every MariaDB-mounted volume, Media, Frappe, networks, and backups remain protected.
Volumes used by another container cannot be deleted. Image deletion never uses force.
Database-owned, unowned, and custom-driver storage cannot silently become application or Redis storage.
Graceful shutdown honors the image stop signal and waits up to 60 seconds. It never escalates to SIGKILL.
An unsuccessful shutdown aborts deletion. MariaDB is never included in the shutdown list.

Unused Docker build cache has no reliable per-project ownership.
Add `--prune-cache` only when host-wide unused build-cache removal is intended.
Cleanup does not reinstall automatically. Restore required storage from backup before reinstalling with `setup.sh --reuse-database`.
Use the saved images and original configuration during recovery. Cleanup intentionally removes only its declared application and owned Redis data.

## Existing installation adoption

This consolidation does not deploy, re-label, rename, or stop the existing cloud or local stack.
The canonical application Compose project remains `codexsun` with `codexsun-api`, `codexsun-web`, and `codexsun-shop` services.
Other Compose projects, including old Billing/demo/local-mirror projects, are rejected rather than taken over.
Before a first v1 update, review existing application mounts, environment values, ports, and network against the candidate model.
Preserve storage volume identity. An existing external Media mount requires a separate reviewed migration before v1 adoption.
Private snapshots and current local containers remain untouched. Their generated Compose files are not maintained deployment entry points.
Realtime and load-test harnesses remain under `tools/container-testing` for controlled test fixtures only.

## Audit evidence

Read [the 2026-10-25 follow-up audit](AUDIT-2026-10-25.md) for fixes, simulated checks, and live verification limits.
