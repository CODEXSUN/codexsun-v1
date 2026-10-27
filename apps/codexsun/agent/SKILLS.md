# CODEXSUN working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing CODEXSUN.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

Personal requirement portals, approvals, registered devices, actor-scoped draft replay, and realtime record notifications.

Preserve revision checks and actor-scoped idempotency. Device presence and chat modes do not authorize worker execution. Keep approval decisions online.

## Implementation rules

- Inspect the affected source and public contracts before editing.
- Keep concrete business behavior in its owning leaf or package.
- Preserve authoritative validation, permission checks, and data ownership.
- Add worker, event, or sync roles only when they contain real implemented behavior.
- Keep secrets, generated files, and local runtime data out of source control.
- Run npm commands from the repository root. Write generated output under root `dist`.
- Update this owner documentation when scope, contracts, or supported operations change.

## Review and evidence

For a small change, inspect the affected code and use at most one focused check when useful.
Inspection can suffice for a trivial edit. Add checks when the actual risk requires them.
The commands below are options for full verification, not a checklist for every prompt.

- `node tools/check-module-boundaries.mjs codexsun`
- `npm run typecheck -w @codexsun/codexsun-api`
- `npm run lint -w @codexsun/codexsun-api`
- `npm run build -w @codexsun/codexsun-api`
- `npm run typecheck -w @codexsun/codexsun-web`
- `npm run lint -w @codexsun/codexsun-web`
- `npm run build -w @codexsun/codexsun-web`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.
