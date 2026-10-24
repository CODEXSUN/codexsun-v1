# Codeit Workspace Module

File reading, structured search, unified diff patching, and safe subprocess command execution.

## Workflow and ownership

The `workspace` module exposes workspace inspection (tree listing, file reads, regex search), patch application with pre-apply SHA-256 validation, and process execution.
Every command and patch is fenced server-side by canonical project roots, run state, and security policy gates.

## Sources

- `devkits/codeit/api/src/modules/workspace/`
- `devkits/codeit/agent/CONTRACTS.md`
- `devkits/codeit/agent/ARCHITECTURE.md`

## Verification

Verified via `devkits/codeit/api/test/workspace.test.mjs` and security regression suites.
