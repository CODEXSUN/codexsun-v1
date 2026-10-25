# Hostinger Deploy working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing Hostinger Deploy.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

Read-only pinned-host SSH, Docker, Compose, and deployment-checkout status.

Keep private credentials outside source. Verify the pinned host. This tool has no source mutation or deployment operation. Do not contact a host merely to update documentation.

## Implementation rules

- Inspect the affected source and public contracts before editing.
- Keep concrete business behavior in its owning leaf or package.
- Preserve authoritative validation, permission checks, and data ownership.
- Add worker, event, or sync roles only when they contain real implemented behavior.
- Keep secrets, generated files, and local runtime data out of source control.
- Run npm commands from the repository root. Write generated output under root `dist`.
- Update this owner documentation when scope, contracts, or supported operations change.

## Review and evidence

- `node --check tools/hostinger-deploy/src/cli.mjs`
- `npm run check:versions`

Check affected consumers and relevant tests. Report skipped or blocked checks explicitly.
Documentation and prompts never replace backend authorization or deployment approval.
