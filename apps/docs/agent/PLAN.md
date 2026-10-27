# Docs plan

## Scope

Versioned repository documentation, tenant body overrides, source-hash verification, and bounded developer-reference lookup.

## Ownership contract

Repository sources remain protected. Tenant overrides do not grant application permissions. Keep cited source identity and live Docs authorization aligned.

The root Agent Guide and governance rules remain authoritative.
Keep one root dependency installation, lockfile, and generated output tree.
Keep business roles inside their owner and compose other components through public contracts.

## Current source surfaces

- `api/src/modules`: `knowledge`, `overview`.
- `web/src/modules`: `knowledge`, `overview`.

Source presence is not release evidence. Confirm executable behavior before describing a capability as complete.

## Delivery sequence

1. Read [TASK.md](TASK.md), [SKILLS.md](SKILLS.md), and the affected public entry points.
2. Inventory the current Docs implementation and its consumers.
3. Define the requested change and acceptance criteria within the scope above.
4. Resolve stored-data and public-contract compatibility before changing behavior.
5. Implement the change in its owner and update legitimate composition points.
6. Verify the owner, denied-access paths where relevant, and dependent applications.
7. Record evidence and remaining work in [TASK.md](TASK.md).

## Verification gates

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs docs`
- `npm run typecheck -w @codexsun/docs-api`
- `npm run lint -w @codexsun/docs-api`
- `npm run build -w @codexsun/docs-api`
- `npm run typecheck -w @codexsun/docs-web`
- `npm run lint -w @codexsun/docs-web`
- `npm run build -w @codexsun/docs-web`

Use component and root checks when the change or full verification requires them.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.

## Repository documentation synchronization

Original repository Markdown and MDX remain authoritative.
`tools/sync-repository-docs.mjs` creates protected catalog references with stable path-derived page keys and source hashes.
Full source is fenced to prevent MDX and instruction execution.
The checker rejects missing mirrors and drift. Authored application guides keep their existing rendering.
