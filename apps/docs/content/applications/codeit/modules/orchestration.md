# Codeit Orchestration Module

Multi-worker supervisor orchestration, disjoint path lease coordination, dependency scheduling, and sequential merge integration.

## Workflow and ownership

The `orchestration` module coordinates parallel worker assignments under a bounded concurrency model (maximum concurrent workers).
It enforces disjoint path leases with overlap detection, prerequisite dependency satisfaction, worker identity validation, heartbeat lease extension, and generation fencing on run cancellation.
Sequential merge integration validates pre-apply file checksums before merging worker artifacts.

## Sources

- `devkits/codeit/src/modules/orchestration/`
- `devkits/codeit/api/src/modules/orchestration/`
- `devkits/codeit/agent/SUPERVISOR-WORKERS.md`

## Verification

Verified via `devkits/codeit/api/test/orchestration.test.mjs` and multi-worker execution audits.
