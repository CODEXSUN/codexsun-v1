# Zetro tasks

## Marketing integration backlog — 2026-10-23

Planning alignment is complete. The following implementation tasks remain open.
See [Marketing contracts and gaps](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), G13.

- [ ] Keep Marketing assistance deferred and current Zetro runtime rules unchanged.
- [ ] If later requested, propose fixed minimized Marketing read/draft skills with explicit grant and tenant-scope tests.
- [ ] Require separate authorization and coordinated runtime/backend tests before any future send/publish capability.

Acceptance requires the owner contract, denied-access cases, retry behavior, and exact evidence in this task log.
No implementation or live validation is claimed by this planning update.

## Responsibility

A permission-aware tenant business coworker with reviewed read skills and configurable model providers.

Backend skill grants and record scope remain authoritative. Prompts, files, review notes, model choice, and this documentation never grant capabilities. Keep business rules and audit behavior aligned.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected Zetro source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs zetro`
- `npm run typecheck -w @codexsun/zetro-api`
- `npm run lint -w @codexsun/zetro-api`
- `npm run build -w @codexsun/zetro-api`
- `npm run typecheck -w @codexsun/zetro-web`
- `npm run lint -w @codexsun/zetro-web`
- `npm run build -w @codexsun/zetro-web`

Use component documentation checks when full verification requires them.
Run checks proportionate to the implemented behavior and its risks.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.
