# Local Docker deployment

Use these commands from the repository root in Git Bash. They manage Docker Desktop Linux containers only.
They do not call the VPS scripts, pull GitHub source, change versions, commit, or push.

Requirements: Node.js, Git Bash, Python 3, Docker Desktop, and Docker Compose v2.
Keep Docker Desktop on the `desktop-linux` context. Unset `DOCKER_HOST`.

## First configuration

```bash
bash deploy-local.sh --configure
```

This captures the existing healthy `codexsun-local-cloud` stack into `.container/local-deploy.private.json`.
The file contains secrets. Git and Docker exclude it. The script restricts file access.
Keep this file when you remove local app containers. Back it up before you change it.
Keep its referenced bind files and storage volumes. Preflight refuses missing files instead of creating replacement directories.
Configuration capture refuses an existing configuration file. Review and move the old file before capturing changed settings.

The local stack must already have these five app containers for initial configuration:
`codexsun-api`, `codexsun-web`, `codexsun-shop`, `codexsun-worker`, and `codexsun-chatb`.
Initial configuration can also happen automatically during the first update.
An empty machine needs local database, Redis, and app configuration provisioned first. These scripts do not invent credentials or restore production data.

## Fresh app deployment

```bash
bash deploy-local.sh --check
bash deploy-local.sh
```

Deploy requires the saved private configuration and no existing app containers.
It reuses the configured healthy `cxapp-mariadb` and `cxapp-redis` containers, networks, and retained storage.
It refuses missing volumes, changed infrastructure identities, public port bindings, or unsafe database flags.
It never creates, recreates, removes, or restarts MariaDB or Redis.
It leaves Frappe, Media, and unrelated containers unchanged.

## Daily development update

```bash
bash update-local.sh --check
bash update-local.sh
```

Update requires all five local app containers to be healthy and owned by `codexsun-local-cloud`.
The script copies tracked and non-ignored build sources into a private snapshot before building.
It checks source consistency during capture and validates every copied file with SHA-256 after building.
Later working-tree edits go into the next update. They do not alter the captured build.
It builds the snapshot with the shared `codexsun-v1/Dockerfile` and Docker cache.
Every run creates unique local image tags, then pins their immutable image IDs.
No clean Git checkout, release version bump, or GitHub push is required.
The existing `setup.sh`, `update.sh`, and VPS deployment implementation keep their current behavior.

## Backup and recovery

Both commands share an atomic local operation lock under `.container/backups/local`.
They save complete SQL, Redis RDB, app volume archives, container metadata, and bind-file copies before building.
Updates then stop only app writers gracefully and take another backup before container replacement.
SQL dumps require a completion marker. Redis snapshots require a valid header. Volume archives must pass gzip validation.
The scripts verify every backup file against its SHA-256 checksum.
SQL backup credentials come from the local API configuration and must permit a complete server dump.

The API keeps normal startup migration behavior. Reset and bootstrap-seeding flags must remain disabled.
Review data migrations before testing them against your local snapshot.
App rollback does not reverse database migrations. Restore SQL, Redis, or volume archives only through a separate reviewed recovery operation.

Failed updates restore the captured app images and configuration.
Failed fresh deployments remove only newly created app containers. They retain all volumes and images.
Failed backups abort before replacement and resume any app writers stopped by the operation.
No command prunes images, removes volumes, deletes backups, or force-kills an app.
Ctrl+C cancels active Docker CLI work and attempts app recovery. Wait for recovery before interrupting again.
An interrupted process can leave a lock directory. Confirm no deployment is active before removing that lock.

After replacement, checks cover container health, immutable images, API readiness, runtime configuration, and storefront bootstrap.
Backups and logs remain private under `.container/backups/local/<run-id>`.
These checks do not replace browser tests for application features or prove VPS deployment behavior.
