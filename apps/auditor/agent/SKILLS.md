# Auditor working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing Auditor.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

Auditor client management and the app review overview.

Keep client records in the Auditor owner. Review screens must use authorized persisted evidence and must not imply a completed audit from a dashboard count.

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

- `node tools/check-module-boundaries.mjs auditor`
- `npm run typecheck -w @codexsun/auditor-api`
- `npm run lint -w @codexsun/auditor-api`
- `npm run build -w @codexsun/auditor-api`
- `npm run typecheck -w @codexsun/auditor-web`
- `npm run lint -w @codexsun/auditor-web`
- `npm run build -w @codexsun/auditor-web`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.
