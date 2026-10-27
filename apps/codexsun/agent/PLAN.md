# CODEXSUN plan

## Scope

Personal requirement portals, approvals, registered devices, actor-scoped draft replay, and realtime record notifications.

## Ownership contract

Preserve revision checks and actor-scoped idempotency. Device presence and chat modes do not authorize worker execution. Keep approval decisions online.

The root Agent Guide and governance rules remain authoritative.
Keep one root dependency installation, lockfile, and generated output tree.
Keep business roles inside their owner and compose other components through public contracts.

## Current source surfaces

- `api/src/modules`: `devices`, `realtime`, `requirements`.
- `web/src/modules`: `devices`, `requirements`.
- `mobile/`: `android`, `integration_test`, `lib`, `test`.

Source presence is not release evidence. Confirm executable behavior before describing a capability as complete.

## Delivery sequence

1. Read [TASK.md](TASK.md), [SKILLS.md](SKILLS.md), and the affected public entry points.
2. Inventory the current CODEXSUN implementation and its consumers.
3. Define the requested change and acceptance criteria within the scope above.
4. Resolve stored-data and public-contract compatibility before changing behavior.
5. Implement the change in its owner and update legitimate composition points.
6. Verify the owner, denied-access paths where relevant, and dependent applications.
7. Record evidence and remaining work in [TASK.md](TASK.md).

## Verification gates

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs codexsun`
- `npm run typecheck -w @codexsun/codexsun-api`
- `npm run lint -w @codexsun/codexsun-api`
- `npm run build -w @codexsun/codexsun-api`
- `npm run typecheck -w @codexsun/codexsun-web`
- `npm run lint -w @codexsun/codexsun-web`
- `npm run build -w @codexsun/codexsun-web`

Use component and root checks when the change or full verification requires them.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.
