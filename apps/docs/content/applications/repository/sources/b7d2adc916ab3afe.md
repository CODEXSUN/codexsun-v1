# CRM working skills

Repository source: `apps/crm/agent/SKILLS.md`

Source SHA-256 (LF line endings): `ab176232a2bbb5e6aecdc32eeec6b32541ec7c5557ace702a3ae65c405b79e91`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# CRM working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing CRM.
Read [the README](../README.md), [TASK.md](TASK.md), and [PLAN.md](PLAN.md) first.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

Marketing owns Campaign and promotional consent. CRM owns sales/service contact restrictions and operational preferences.
Follow the reconciled boundary in [PLAN](PLAN.md#marketing-integration-decision--2026-10-23).
Do not implement CRM Campaign CRUD or infer promotional opt-in from Contact Preferences.
Add fixed idempotent Lead/follow-up contracts and minimized outcome projections before Marketing consumes them.
Marketing-origin intake does not authorize Frappe export or broader CRM visibility.

Local enquiries, contact activity, follow-up tasks, SOPs, duty assignments, and duty reporting across web and mobile.

Scheduler owns CRM reminders and follow-up schedule records. Use typed links to source records and preserve each source module's read permissions. Platform composes due CRM reminders into its main-menu notification control; this is an in-app web surface and does not imply SMS, email, or operating-system push delivery.

Core owns contact identity. Local CRM records remain authoritative for CRM operations. Imported enquiries retain source serials, timestamps, mapped user identity, comments, and source links. The explicitly approved enquiry live-sync contract posts local enquiry creates and updates to their verified Frappe links and imports remote changes. This approval does not extend to other CRM outbound transfers. Preserve assignment scope and activity history.

## Implementation rules

The enquiry comment extension is explicitly approved: opening comments, new comments, and replies
use the durable enquiry outbox and standalone Frappe Job Comments. Preserve retry identities,
reply links, and suppression of import echoes. General Activities exports remain outside this scope.

- For custom Frappe contracts, refer to [CODEXSUN/logicx-biz](https://github.com/CODEXSUN/logicx-biz.git).
- Read [the Frappe comparison](FRAPPE-COMPARISON.md) before changing CRM transfer contracts. Enquiry transfer uses the tenant's verified site and must preserve source timestamps, identity links, queue idempotency, and conflict checks.

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

- `node tools/check-module-boundaries.mjs crm`
- `npm run typecheck -w @codexsun/crm-api`
- `npm run lint -w @codexsun/crm-api`
- `npm run build -w @codexsun/crm-api`
- `npm run typecheck -w @codexsun/crm-web`
- `npm run lint -w @codexsun/crm-web`
- `npm run build -w @codexsun/crm-web`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.
```
