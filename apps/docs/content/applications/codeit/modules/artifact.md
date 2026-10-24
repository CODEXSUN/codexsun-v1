# Codeit Artifact Module

Content-addressed artifact storage, diff hashing, media typing, and verification provenance.

## Workflow and ownership

The `artifact` module manages immutable, content-addressed artifacts produced during agent runs, code generation, and verification phases.
Artifacts are hashed via SHA-256 and stored on disk under canonical relative keys.
Metadata records capture MIME types, parent run UUID, provenance tags, byte sizes, and timestamps.

## Sources

- `devkits/codeit/api/src/modules/artifact/`
- `devkits/codeit/agent/CONTRACTS.md`
- `devkits/codeit/agent/ARCHITECTURE.md`

## Verification

Artifact immutability, hash verification, and read streaming are verified in `devkits/codeit/api/test/artifact.test.mjs` and integration runs.
