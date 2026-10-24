# Codeit Project Module

Canonical workspace registration, root resolution, trust boundaries, and persistence.

## Workflow and ownership

The `project` module handles project registration, canonical path resolution, and trust assignment.
Server-side project resolution guarantees that all file reading, searching, patching, and execution commands resolve against an authorized project root, preventing path traversal and untrusted repository exploitation.

## Sources

- `devkits/codeit/api/src/modules/project/`
- `devkits/codeit/agent/ARCHITECTURE.md`

## Verification

Verified via `devkits/codeit/api/test/project.test.mjs` and security regression suites.
