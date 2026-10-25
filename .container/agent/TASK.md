# Consolidation evidence

- [x] Consolidate image and deployment definitions under `codexsun-v1`.
- [x] Wire root setup and update shortcuts.
- [x] Remove duplicate Billing, demo, preparation, setup, update, and local deployment definitions.
- [x] Preserve MariaDB, Redis, and Media definitions and existing private snapshots.
- [x] Retain realtime audit tools outside deployment ownership.
- [x] Add internal operator and agent documentation.
- [x] Focused shell, configuration, Compose, version, backup-failure, and rollback simulation checks passed.
- [x] Fifteen focused tests passed with `node --test --test-concurrency=1 tools/deployment-env-contract.test.mjs tools/version-bump.test.mjs tools/sync-repository-docs.test.mjs`.
- [x] Root dependency layout and application version checks passed for 1.1.61. No application version was changed.
- [x] Fix the empty-install preflight order and MariaDB initialization helper argument without changing infrastructure names or ports.
- [ ] Separately authorize VPS adoption and run real backup, migration, rollback, and browser checks.

Source implementation and simulated checks do not certify an applied production release.

## Follow-up audit: 2026-10-25

- [x] Reject conflicting container identities, MariaDB mounts, orphaned database volumes, and unowned application storage.
- [x] Fail closed on Docker inventory errors. Require a verified archive before volume deletion.
- [x] Require explicit retained-data setup and prevent seeding an existing tenant database beneath an empty master.
- [x] Use pinned images for both migrations and startup. Preserve literal credentials in Compose rollback models.
- [x] Take a final quiesced backup before migrations. Resume original services on pre-replacement failure.
- [x] Archive images and stopped application/Redis data before cleanup. Preserve MariaDB containers, mounts, and sample records in simulations.
- [x] Verify rollback manifests, remove added services, and preserve original running/stopped states.
- [x] All 37 focused tests passed. Root dependency layout, shell syntax, Python parsing, and Node helper syntax passed.
- [ ] Real dump/restore, image build/load, staging rollout, browser acceptance, and VPS adoption remain separately authorized operations.

See [the audit report](../docs/AUDIT-2026-10-25.md). This audit performed no deployment, database operation, commit, push, or version bump.

## Standalone Frappe installer: 2026-10-25

- [x] Review the requested legacy Docker reference and the official Frappe Docker service layout.
- [x] Add standalone Compose, Bash and Python installers, container initialization, private environment template, and operator instructions under `frappe`.
- [x] Keep root setup and update separate. Refuse existing Frappe resources and site recreation.
- [x] Nine mocked installer tests passed. Python parsing, Bash syntax, LF shell format, Compose parsing, and both entry-point configuration checks passed.
- [x] Confirm placeholder passwords fail validation. Component documentation verification and its two tests passed.
- [ ] Run a separately authorized live installation and verify login, workers, persistence, backup, and restore.

These checks created no containers and changed no databases.

## Authorized latest-v16 Frappe installation: 2026-10-25

- [x] Replace the separate-service installer with one Supervisor-managed Frappe container.
- [x] Resolve the highest stable ERPNext v16 release dynamically. Prompt before deployment unless `--yes` is supplied.
- [x] Reuse explicitly selected MariaDB, Redis, and network resources. Reserve a new database and unused Redis databases.
- [x] Keep root and Administrator credentials out of the persistent container environment.
- [x] Thirteen focused installer tests passed. Compose validation, Python parsing, Bash syntax, browser-script syntax, and component documentation checks passed.
- [x] Create and checksum-verify retained MariaDB and Redis backups before site creation.
- [x] Install Frappe 16.53.0 and ERPNext 16.52.1 from the dynamically selected latest stable v16 ERPNext image.
- [x] Verify six managed processes, real short/long worker jobs, Socket.IO handshake, Administrator login, session cookie, ERPNext Company API, and authenticated Desk.
- [x] Verify Chrome login reaches `/desk/build/setup-wizard/0`. Inspect the rendered welcome screenshot at `dist/codexsun-frappe-login-verified.png`.
- [x] Restart only the new Frappe container. Repeat worker/API/login checks and confirm shared MariaDB/Redis identities are preserved.
- [x] Reuse the existing internal network plus its existing entry network. Verify `http://localhost:8088/login` and existing application/infrastructure health.

Private credentials are in ignored `frappe/frappe.env`. The upstream digest and backup identity are in ignored `frappe/deployment.private.json`.
Initial company/accounting setup remains an operator task. Backup restore and future upgrades were not tested by this installation.

The user explicitly authorized this standalone installation and required v16. No root application release, commit, push, or shared-service replacement belongs to it.

## Manual Frappe installer audit: 25-10-2026

- [x] Review deployment history, current service logs, initializer behavior, credentials, network exposure, and partial-failure handling.
- [x] Add standalone Python, Bash, and PowerShell guided setup without AI or repository runtime dependencies.
- [x] Correct private credential transport, value parsing, Redis index validation, prerequisites, and destination mount checks.
- [x] Add redacted transcripts, deployment phases, repeated preflight, cooperative deployment locks, port checks, and bounded backup commands.
- [x] Add future-deployment shutdown grace and Docker log rotation. Preserve the already-running container.
- [x] Add a portable source-only ZIP builder, checksum manifest, manual runbook, recovery guidance, and scoped audit report.
- [x] Thirty-seven focused tests cover installation success, failure handling, cancellation, secrets, backups, package portability, and prerequisite rejection.
- [x] Current process, worker, websocket, authenticated API, and completed-Desk browser verification passed.
- [x] A new online MariaDB/Redis snapshot and checksum, gzip, and RDB checks passed. Shared services were preserved.
- [ ] Run the final package on a second physical machine and perform a separately planned restore drill.

See [the manual runbook](../frappe/README.md) and [audit report](../frappe/AUDIT.md).
This audit did not rebuild, replace, or restart the running Frappe container. Source checks do not certify another host's installation.
