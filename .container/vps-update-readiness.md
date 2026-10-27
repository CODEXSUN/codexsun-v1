# VPS update readiness

Date: 2026-10-27

The VPS checkout is at version 1.1.72, commit `bc0670e3f320f3a71f35f2dcae2a170c2a695950`.
The fetched main commit is `fc29fbdf70eef16cb4d83425b105d0e2b6fbf127`, version 1.1.82.

The deployment environment now points to the existing `cxapp-mariadb` and `cxapp-redis` containers.
It uses `cxapp-network`, `codexsun-data`, `cxapp-media-data`, and `cxapp-redis-data`.
The existing credentials were not changed. Private configuration backups remain in `/root` on the VPS.
The VPS Git exclude file preserves `.container/releases/` without moving its contents.

The VPS `update.sh --check` stops at the storage-adoption guard.
The running API mounts `cxapp-billing-stack-data` at `/storage/data-bridge-sources/cxapp`.
The deployed v1 Compose model does not include that mount. Replacing the API would omit it.
The Docker branch adds a read-only mount and guards against omitted realtime services.
The saved realtime settings now use values from the running services.
An isolated copy of the updated updater passed `update.sh --check` on the VPS.
The production checkout still uses the older updater.
The migration compatibility value is `1.1.9` and has not been reviewed for the target version.

No app update or migration ran during this readiness check.
MariaDB and Redis remained healthy and retained their container IDs and start times.
The existing database backup passed its checksum. Restore and migration testing remain pending.
Review the live mounts, environment, release source, and migration compatibility before updating.
Do not remove the adoption guard or replace the containers until the candidate preserves them.
