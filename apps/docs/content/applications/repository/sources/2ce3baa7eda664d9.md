# Zuno plan

Repository source: `devkits/zuno/agent/PLAN.md`

Source SHA-256 (LF line endings): `7323ddd17cb3ed1677682dd650f0dc6888479b506ecafce2b5928a7560dbf428`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# Zuno plan

## Scope

Super Admin support conversations, bounded diagnostics, operational watch, and reviewed correction cases.

## Ownership contract

Diagnostic tools remain read-only. Production correction cases require the existing backup, approval, unchanged-value, and exact-row checks. Never turn chat Build mode into source or arbitrary SQL execution.

The root Agent Guide and governance rules remain authoritative.
Keep one root dependency installation, lockfile, and generated output tree.
Keep business roles inside their owner and compose other components through public contracts.

## Current source surfaces

- `api/src/modules`: `cases`, `conversations`, `diagnostics`, `watch`.
- `web/src/modules`: `cases`, `conversations`, `diagnostics`, `watch`.

Source presence is not release evidence. Confirm executable behavior before describing a capability as complete.

## Delivery sequence

1. Read [TASK.md](TASK.md), [SKILLS.md](SKILLS.md), and the affected public entry points.
2. Inventory the current Zuno implementation and its consumers.
3. Define the requested change and acceptance criteria within the scope above.
4. Resolve stored-data and public-contract compatibility before changing behavior.
5. Implement the change in its owner and update legitimate composition points.
6. Verify the owner, denied-access paths where relevant, and dependent applications.
7. Record evidence and remaining work in [TASK.md](TASK.md).

## Verification gates

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs zuno`
- `npm run typecheck -w @codexsun/zuno-api`
- `npm run lint -w @codexsun/zuno-api`
- `npm run build -w @codexsun/zuno-api`
- `npm run typecheck -w @codexsun/zuno-web`
- `npm run lint -w @codexsun/zuno-web`
- `npm run build -w @codexsun/zuno-web`

Use component and root checks when the change or full verification requires them.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.
```
