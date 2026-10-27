# Mail tasks

## Marketing integration backlog — 2026-10-23

Planning alignment is complete. The following implementation tasks remain open.
See [Marketing contracts and gaps](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), G04/G05.

- [ ] Define campaign sender/approval/recipient dispatch, delivery event, and unsent-cancel contracts.
- [ ] Select a suitable bulk provider and verify sender/domain, feedback, quotas, cost limits, and safe suppression storage.
- [ ] Block campaign shared-sender fallback and test withdrawal/complaint races, duplicate requests, and ambiguous provider acceptance.

Acceptance requires the owner contract, denied-access cases, retry behavior, and exact evidence in this task log.
No implementation or live validation is claimed by this planning update.

## Responsibility

Tenant mail API operations and app-owned mail workspaces.

Keep message records and delivery behavior in Mail. External sends require the applicable approval, permissions, tenant context, and delivery audit.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected Mail source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs mail`
- `npm run typecheck -w @codexsun/mail-api`
- `npm run lint -w @codexsun/mail-api`
- `npm run build -w @codexsun/mail-api`
- `npm run typecheck -w @codexsun/mail-web`
- `npm run lint -w @codexsun/mail-web`
- `npm run build -w @codexsun/mail-web`

Use component documentation checks when full verification requires them.
Run checks proportionate to the implemented behavior and its risks.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.

## Local email policy evidence, 23-10-2026

Mail now owns append-only company-scoped email suppression evidence for hard bounce, complaint, and delivery policy.
The public safety check never clears a block because Marketing records a new grant.
New permissions are `mail.suppression.check` and `mail.suppression.record`, granted only to Admin by default.
Authenticated provider feedback, suppression release, and campaign dispatch remain open. Existing SMTP sends do not consume this assessment automatically.

The two-disposable-database Marketing suite verifies denied grants, tenant/company isolation, legacy CRM restrictions, Mail complaint/bounce blocking, and owner outages.
Existing local business row counts were preserved. No commit, push, or deployment was performed for this work.

Focused owner typecheck, lint, build, and module boundaries passed for the email policy continuation.
Marketing database tests verify exact UTC timestamps and near-expiry rejection alongside tenant and owner policy checks.
