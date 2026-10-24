# T13: Packaging and release readiness

Status: done. Prerequisites: T12. Owner: release reviewer/integrator.

## Scope

Prepare a reproducible local product package, startup/readiness contract, private storage paths, migrations, backup, and restore instructions.
Verify installation on a clean target without development source paths or an attached `npm run dev` session.
Keep version bump, signing, publication, and deployment outside this packet unless explicitly authorized.

## Allowed paths

The integrator leases Codeit packaging/startup configuration and required root build tooling.
Use root `dist` only. Read affected tools/component documents before edits.
No installer, deployment, or release action is authorized by this planning file.

## Acceptance

- [x] Packaged web/API/runner behavior passes E26 and standalone readiness checks.
- [x] Fresh install, retained-data upgrade, private storage permissions, backup integrity, and restore-sandbox checks pass E23.
- [x] Critical permission, isolation, cancellation, recovery, and secret tests pass on the packaged product.
- [x] Known limits, supported hosts/providers, rollback boundaries, and unverified external adapters are documented.

## Verification and handoff

- **Packaged Artifacts Layout & Hashes (Root `dist/`)**:
  - `dist/devkits/codeit/api/server.js`: SHA-256 `B243661A5E3F47C0F23DE3097C329DEB3A8AD965C98E1EBF4B6DD0C9D8AE9B73`
  - `dist/devkits/codeit/api/index.js`: SHA-256 `1C69F5BE04D02DE1AF29E10FD105B3A85BDE2067A2A4AC79CBC47EFA86F440F5`
  - `dist/devkits/codeit/index.html`: SHA-256 `A776C31A4D56584817F49B2DDE52F4A8ED8046FCA15B9F0A62BBD88A0F579FD1`
  - `dist/devkits/codeit/assets/index-D5xHdfoT.js`: SHA-256 `319E3B4898CCF52C7C23070B9DC2A36BB29BB8DC5A84BC5CB02E33B39DF5EA10`
  - `dist/devkits/codeit/assets/index-DZyRHKZX.css`: SHA-256 `2866F27732BFD661905A2D58AAB95AB187346AF789E2E35F5AE2A67D4C211BD2`
- **Packaging Smoke Test (E23 & E26)**:
  - Command: `npm run test:packaging:codeit` (`node --test tools/codeit-packaging-smoke.test.mjs`)
  - Result: 9/9 passing tests (0 failures, duration 5.4s, exit code 0).
  - Standalone startup: executes `node dist/devkits/codeit/api/server.js` directly on clean sandbox, responds to `/health` on loopback.
  - Security gates: Host rebinding rejection (`403 CODEIT_HOST_FORBIDDEN`), CSRF token validation, secret canary protection.
  - Lifecycle: graceful SIGTERM shutdown with exit code 0.
  - Storage & Migrations: fresh database creation with all 13 migration tables, WAL checkpointing (`PRAGMA wal_checkpoint(TRUNCATE)`), private pairing token generation with `0o600` permissions.
  - Upgrade & Persistence: retained-data restart preserves all registered projects, conversations, messages, and runs.
  - Backup & Restore: SHA-256 validated database snapshot restored into an isolated sandbox boots cleanly and exposes functional records.
- **Hygiene & Boundaries**:
  - `npm run check:module-boundaries`: Passed (0 violations).
  - `node tools/check-root-node-modules.mjs`: Passed (0 violations).
  - Zero hardcoded machine paths in `dist/`. Zero node_modules leaks in `dist/`.
- **Independent Review**:
  - Subagent: `55ed643e-7b7a-494d-81ec-9c930d58f6be` (Role: T13 Release Reviewer).
  - Final Verdict: **PASS**.
- **Documented Limits & Boundaries**:
  - DEC-05 / E09 OS runner sandbox boundary remains explicitly gated (cooperative application-level filtering enforced; OS-level AppContainer/jail boundary unverified).
  - Zero publication, deployment, or git commits executed per supervisor authorization boundary.
