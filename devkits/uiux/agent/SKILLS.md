# UIUX working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing UIUX.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

The design-system gallery, component examples, and live interface-topology inspection.

Render the real shared components. Keep gallery examples separate from app business behavior. Preserve the five case-sensitive Main Layout region names.

## Implementation rules

- Inspect the affected source and public contracts before editing.
- Keep concrete business behavior in its owning leaf or package.
- Preserve authoritative validation, permission checks, and data ownership.
- Add worker, event, or sync roles only when they contain real implemented behavior.
- Keep secrets, generated files, and local runtime data out of source control.
- Run npm commands from the repository root. Write generated output under root `dist`.
- Update this owner documentation when scope, contracts, or supported operations change.

## Review and evidence

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `npm run typecheck -w @codexsun/uiux`
- `npm run lint -w @codexsun/uiux`
- `npm run build -w @codexsun/uiux`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.
