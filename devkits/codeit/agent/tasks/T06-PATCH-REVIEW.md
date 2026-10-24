# T06: Safe patches and change review

Status: done. Prerequisites: T04 (verified), T05 (verified). Owner: patch worker.
Reviewed by: Independent Reviewer subagent `2e191f77-7744-489d-982d-da28feb0744f` (PASS). Integrated by: Codeit Supervisor.

## Scope

Implement exact patch proposals, expected content hashes, atomic writes, diff artifacts, conflict reporting, and review UI.
Bind patch approval to current project, action digest, policy, and relevant file hashes.
Preserve unrelated dirty changes and expose conflicts instead of overwriting them.

## Allowed paths

Leased workspace patch files `workspace.patch.ts`, `workspace.patch.types.ts`, `devkits/codeit/src/modules/conversation/components/patch-review.tsx`, and `patch.test.mjs`.
Integrator wired routes into `workspace.routes.ts`, module into `workspace.module.ts`, and public exports into `workspace/index.ts`, `api/src/index.ts`, and `src/modules/conversation/index.ts`.

## Acceptance Criteria Verification

- [x] Exact patch proposals validate `expected_hash` (pre-write SHA-256 match); stale or mismatched hash fails with 409 `CODEIT_INVALID_STATE` (E08).
- [x] Atomic writes write to temporary `.tmp.[pid].[random]` file, flush with `fsyncSync`, and atomically rename (`renameSync`) with rollback backup (E08, E23).
- [x] Path traversal (`..`), null bytes, absolute paths outside root, and symlink/junction escapes are blocked with `CODEIT_PATH_DENIED` via `realpathSync` (E03).
- [x] Secret canary files (`.env*`, `*.key`, `*.pem`, `*.crt`, `id_rsa*`) are unconditionally blocked with `CODEIT_PATH_DENIED` (E21).
- [x] Generation fencing rejects writes if run is cancelled or generation is stale with 409 (E10).
- [x] Unified diff generation with standard headers and hunks, and artifact creation with provenance (E22).
- [x] Accessible `PatchReview` UI component with before/after SHA-256 badges, line count badges, accessible ARIA attributes, and keyboard shortcuts `A` / `R` (E24).
- [x] 22 tests passing in `devkits/codeit/api/test/patch.test.mjs` (exit code 0).
- [x] Independent review PASS (reviewer `2e191f77-7744-489d-982d-da28feb0744f`).
