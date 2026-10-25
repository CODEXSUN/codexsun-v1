# Release 1.1.66: deployment readiness

Prepared on 2026-10-25 from committed baseline `55e8035b` on the isolated
`codex/cloud-release-readiness` branch. Unfinished CRM, Ecommerce, CXMobile,
Project Manager, and DevKit changes in other checkouts are excluded.

## Changes

- Replace signal-only VPS shutdown with native graceful stop and a bounded CLI wait.
- Forward WebSocket upgrade headers in Web and Shop; add opt-in same-origin Chatb routing.
- Add explicit adoption of an existing Media volume without provisioning a Media service.
  Validate mount identities and database separation, archive Media files with checksums,
  and retain Media during clean and application rollback.
- Include the completed local updater fixes: immutable source snapshots, locked-workspace
  selection, unchanged-release health checks, guarded recent backup reuse, graceful
  shutdown, and stable permanent-database enumeration. A fresh quiesced backup still
  precedes every application replacement.
- Align version manifests and the previously stale committed lockfile to 1.1.66.

## Data compatibility

No schema, seed, or tenant-data changes. MariaDB, Redis, Frappe, Media, Cloudflare,
and existing running application containers are not replaced by this preparation.
Migration compatibility approval remains an operator action for the exact release.
Application rollback never automatically reverses database changes.

## Verification

Focused deployment tests exercise configuration, backup checksums, ownership,
mount protection, native stop failure, local snapshot integrity, and rollback recovery.
Nginx syntax tests pass Web and Shop templates through configuration-only `nginx -t`
processes in the local Web container. Each uses a temporary file removed on exit.
The tests do not replace active configuration, reload Nginx, or make upstream requests.
The version check verifies all registered workspace manifests and lockfile versions.

- 33 focused configuration/local deployment checks passed.
- 22 backup and recovery checks passed, including fresh setup, retained-data setup,
  update, migration failure, partial replacement, cleanup, and corrupt-backup rejection.
- Four Nginx syntax checks passed: Web and Shop with realtime off and on.
- `npm run check:versions` and `git diff --check` passed.

These are deployment-contract checks. They do not substitute for an application
image build, a WebSocket handshake through the production domain, or browser acceptance.

No application image build or production browser acceptance is claimed for this source
release. The earlier local 1.1.65 runtime checks apply to their captured images only.
No VPS connection, deployment, production migration, or domain change is performed.
Before production promotion, review this branch, build its exact committed revision,
verify a current backup, approve migration compatibility, and run staged browser checks.
