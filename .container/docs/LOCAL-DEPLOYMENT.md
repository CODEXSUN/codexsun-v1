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
bash update-local.sh --plan
bash update-local.sh --check
bash update-local.sh
```

For the second or third update on the same local calendar day, `bash update-local.sh --nobackup` reuses a verified backup from an earlier successful update.
Use `bash update-local.sh --check --nobackup` to check backup eligibility without changing the stack.
The command refuses a missing, changed, expired, or mismatched backup. It also checks the existing master startup evidence.
At most two successful updates may reuse one full backup. A failed reuse requires a new full backup.
Data, Redis, and files changed after the reused backup are not recoverable from that backup. Run a normal update for a new recovery point.

`--plan` describes the possible actions without inspecting Docker or changing data.
Update requires all five local app containers to be healthy and owned by `codexsun-local-cloud`.
Before building, update checks existing master and tenant migration ledgers for unfinished entries.
Resolve any unfinished migration with a reviewed recovery before retrying. The updater does not change the ledger.
The script copies tracked and non-ignored build sources into a private snapshot before building.
It checks source consistency during capture and validates every copied file with SHA-256 after building.
Later working-tree edits go into the next update. They do not alter the captured build.
It builds the snapshot with the shared `codexsun-v1/Dockerfile` and Docker cache.
Changed sources create unique local image tags, then pin their immutable image IDs.
If the checksum and running images match a successful release, update checks health and exits without rebuilding or restarting.
Only workspaces recorded in the root lockfile enter the build. Unregistered drafts remain in the checkout and are reported.
No clean Git checkout, release version bump, or GitHub push is required.
The existing `setup.sh`, `update.sh`, and VPS deployment implementation keep their current behavior.

## Local replacement and app recovery

Both commands share an atomic local operation lock under `.container/backups/local`.
They create checksum-verified SQL, Redis, storage, and configuration backups after stopping app containers.
The updater saves application schemas in `databases.sql` and the MariaDB system schema in `mysql-system.sql`.
It first saves a preliminary backup. It then records and verifies a fresh master restore for normal API startup.
The updater marks database changes as possible before it records the startup proof.
It saves a final database and storage backup after the proof completes.
They refuse tenant database targets outside the selected MariaDB container and storage engines other than InnoDB or MyISAM.
The SQL dump holds a global read lock for its duration.
The MariaDB event scheduler must be off and no other database connections may be active.
The database user must have global PROCESS and backup privileges.
MariaDB must not publish a host port during the update.
If external local access is required, use a separately managed loopback-only database relay.
MariaDB itself must have no published ports. Configure the relay explicitly in the private
local deployment file as `relay` with its `name`, immutable container `id`, and host `port`.
For example, add `"relay": {"name": "codexsun-mariadb-relay", "id": "<container-id>", "port": 13306}`
to the top level of `.container/local-deploy.private.json` after provisioning the relay.
The relay must be named `codexsun-mariadb-relay`, carry the label
`io.codexsun.role=mariadb-relay`, and use the selected MariaDB image with entrypoint
`/usr/bin/socat` and arguments `TCP-LISTEN:3306,fork,reuseaddr` and
`TCP:<mariadb-container-name>:3306`. Override the image's declared database volume with
`--tmpfs /var/lib/mysql:ro,nosuid,nodev,noexec,size=1m`. No persistent or writable mounts
or added capabilities are allowed. Publish only `127.0.0.1:<port>:3306`. It must retain the image's default environment,
use no restart policy, and share only networks attached to MariaDB without taking its alias.
The updater stops the validated relay and reserves its loopback port while it checks and
migrates data. It restores the relay after success or a failure before database changes.
After a possible database change it leaves the relay stopped for review. An abrupt process
termination can require manual relay recovery. The updater does not create the relay or
convert an existing directly published MariaDB container.
Unmanaged containers must not share a MariaDB network or write a protected volume.
Stop the local File Browser before updating if it writes a protected media volume.
Ensure no host process or external client writes to protected storage during the update.
Before migration, the updater restores the application dump to a disposable MariaDB server.
The server has no network or shared mounts. It disables networking and events, and uses a read-only root filesystem.
The updater compares deterministic dumps of every application table and database object.
It then signs the result for each existing migration target. Tables without primary keys fail verification.
The sandbox uses temporary storage capped at 2 GiB. A larger restore fails closed.
The updater provides this proof to its production preflight, migration and seed commands through a
read-only mount. The ordinary application and its web routes continue to require their normal backup evidence.
Updates stop only the five app containers before replacement.
The script saves the previous app Compose model for an application-only rollback.
It keeps MariaDB, Redis, and their volumes running and unchanged.

The API keeps normal startup migration behavior. Reset and bootstrap-seeding flags must remain disabled.
Review data migrations before applying a new local image. App rollback does not reverse database migrations.
The production backup and migration gates remain enabled. The isolated proof is accepted only by
the explicitly opted-in local upgrade CLI commands.

Before migrations start, failed updates restore the captured app images and configuration.
After migrations start, failed updates stop candidate app containers and leave old images stopped for review.
They do not assume that old images are compatible with a changed schema.
Failed fresh deployments retain all volumes and images.
No command prunes images, removes volumes, deletes backups, or force-kills an app.
Ctrl+C cancels active Docker CLI work and attempts app recovery. Wait for recovery before interrupting again.
An interrupted process can leave a lock directory. Confirm no deployment is active before removing that lock.

After replacement, checks cover container health, immutable images, API readiness, runtime configuration, and storefront bootstrap.
Operation logs and the previous app model remain private under `.container/backups/local/<run-id>`.
These checks do not replace browser tests for application features or prove VPS deployment behavior.

## Future update add-ons

Add a migration, seeder, configuration change, or patch only when its requirements are defined.
Each add-on should declare its version, target tenants, retry behavior, and verification.
Record progress per tenant so a failed run can resume without repeating completed work.
Show configuration changes for review without printing secrets. Stop on unsupported or failed actions.
These add-ons are not implemented by the current command.
