# T02: Local runtime, identity, and storage

Status: done. Prerequisites: T00. Owner: runtime worker.
Completed: 24-10-2026. Reviewed by independent review subagent (Verdict: PASS).

## Scope

Implement Codeit's own API host, local pairing/session boundary, metadata storage, migrations, artifact storage, and readiness.
Use the accepted embedded adapter and private storage root.
Implement real project registration/trust and artifact contracts in their owners.
Keep owner persistence available to later packets through intentional public contracts.

## Allowed paths

Leased path: `devkits/codeit/api/**` (specifically host, storage, project, artifact, server, and test).
Excluded from lease: provider, run, tool, plugin, personalization (reserved for downstream tasks).
Root manifests and vite proxy managed by supervisor/integrator.

## Acceptance verification

- [x] The runtime starts without Platform and refuses occupied or invalid ports (E01).
- [x] Unapproved Host/Origin headers (DNS rebinding attacks, untrusted origins), missing identity, and invalid CSRF on mutations are denied with 403/401 (E02).
- [x] Pairing cannot be completed by arbitrary remote browser content (constant-time token check, HttpOnly SameSite=Strict cookies).
- [x] Fresh schema and retained-data upgrade work idempotently over `migration_schema`.
- [x] Crash-safe, atomic artifact file storage with SHA-256 deduplication and streaming downloads (E15, E21, E23).
- [x] Canonical root verification (`realpathSync`), directory validation, and duplicate rejection on project registration (E03).

## Verification evidence

Command: `node --test devkits/codeit/api/test/runtime.test.mjs`
Exit code: 0
Duration: 181ms (21/21 tests passed across 7 suites, 0 failures)
Lint: `npx oxlint devkits/codeit/api/src` (0 warnings, 0 errors on 21 files)
TypeScript: `npx tsc -p devkits/codeit/api/tsconfig.json --noEmit` (0 errors)
Independent review: Subagent `42173b65-a284-4597-82aa-57a303e71ee1` confirmed PASS.

## Handoff

Public persistence contracts and API server available under `@codexsun/codeit-api`.
Next: Unblocks T04 (Conversation & Run Lifecycle) and T05 (Workspace Reads & Tool Policy).
