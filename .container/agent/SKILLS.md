# Deployment rules

- Keep one active deployment contract under `codexsun-v1`. Do not add product, demo, or local deployment duplicates.
- Preserve database and Redis definitions. Do not install or bind Media or Frappe until separately authorized.
- Frappe installer source lives under `frappe`. It adds one container, reuses explicitly selected MariaDB, Redis, and network resources, and reserves a new database plus unused Redis databases. Preparing source does not authorize live installation.
- Keep the Frappe manual installer portable within its own folder. Package only its explicit source allowlist. Never copy private settings, deployment records, logs, profiles, or backups to another machine as installer source.
- Never deploy, run cleanup, commit, or push without current user authorization. This consolidation authorizes source changes and safe verification only.
- Keep private environment files, snapshots, backup dumps, generated Compose files, and secret-bearing release records out of Git and Docker build contexts.
- Do not publish `.container` documentation through application Docs.
- Back up and verify checksums before GitHub source changes, migrations, container replacement, or destructive cleanup.
- Serialize every mutating deployment operation with the same host lock. Require a clean GitHub source checkout and versioned images.
- Preserve MariaDB servers, all their mounts, shared services, and unrelated containers. Never use host-wide Docker system prune.
- Do not weaken Compose ownership checks to adopt another deployment. Design an explicit migration if ownership differs.
- Use expand-contract migrations and an exact per-version approval. Application rollback never implies database rollback.
- Check real container mounts and volume ownership before setup, update, or cleanup. Never adopt orphaned database or unowned application storage silently.
- Quiesce application writers before the final pre-migration backup and before destructive cleanup. Archive owned Redis only after its shutdown.
- Do not force-kill a service that fails graceful shutdown. Abort changes and recover previously running services.
- Verify the full backup manifest before rollback or deletion. Preserve original stopped/running states and remove only newly introduced application services.
- Escape dollars once in raw Docker rollback metadata. Do not escape already rendered Compose configuration a second time.
- Verify script behavior with fake commands first. Read-only Compose parsing is allowed. It is not live deployment proof.
- Run the focused deployment tests after changes. Run no setup, update, cleanup, build, restart, or migration as a substitute for static verification.

## Local Docker Desktop exception

The user authorized separate `deploy-local.sh` and `update-local.sh` entry points.
Their implementation stays under `codexsun-v1/local` and reuses the v1 Dockerfile and snapshot helper.
Local builds accept a dirty working tree and use unique local image tags. VPS rules remain unchanged.
Local commands preserve existing MariaDB and Redis containers. They do not provision new infrastructure or restore production snapshots.
