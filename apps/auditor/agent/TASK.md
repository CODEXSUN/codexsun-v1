# Auditor tasks

## Responsibility

Auditor client management and the app review overview.

Keep client records in the Auditor owner. Review screens must use authorized persisted evidence and must not imply a completed audit from a dashboard count.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected Auditor source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs auditor`
- `npm run typecheck -w @codexsun/auditor-api`
- `npm run lint -w @codexsun/auditor-api`
- `npm run build -w @codexsun/auditor-api`
- `npm run typecheck -w @codexsun/auditor-web`
- `npm run lint -w @codexsun/auditor-web`
- `npm run build -w @codexsun/auditor-web`

Use component documentation checks when full verification requires them.
Run checks proportionate to the implemented behavior and its risks.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.
