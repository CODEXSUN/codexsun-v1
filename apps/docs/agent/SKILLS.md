# Docs working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing Docs.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

Versioned repository documentation, tenant body overrides, source-hash verification, and bounded developer-reference lookup.

Repository sources remain protected. Tenant overrides do not grant application permissions. Keep cited source identity and live Docs authorization aligned.

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

- `node tools/check-module-boundaries.mjs docs`
- `npm run typecheck -w @codexsun/docs-api`
- `npm run lint -w @codexsun/docs-api`
- `npm run build -w @codexsun/docs-api`
- `npm run typecheck -w @codexsun/docs-web`
- `npm run lint -w @codexsun/docs-web`
- `npm run build -w @codexsun/docs-web`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.
