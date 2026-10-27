# QCafe working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing QCafe.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

Restaurant operations with a local API, POS web application, and Tauri Windows packaging.

Keep local operational data and operator credentials outside disposable build folders. Preserve PIN roles, stock and booking constraints, bill settlement, backups, and print-service boundaries.

## Implementation rules

- Web uses the current Platform tenant session and live permissions. Do not show the desktop PIN login in web.
- Web business persistence belongs in module-owned tenant MariaDB tables. Do not fall back to cloud SQLite.
- Keep desktop PIN authentication, local SQLite, printing, and license behavior unchanged during web work.
- Prices and totals are server-authoritative. Payments lock the bill and reject overpayment.
- Preserve financial records and record every bill, payment, and menu change in its owned audit table.
- Retry financial requests with their original operation IDs. Never silently resubmit with a new ID after a lost response.

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

- `npm run typecheck -w @codexsun/qcafe-web`
- `npm run build -w @codexsun/qcafe-web`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.
