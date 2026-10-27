# UIUX tasks

## Responsibility

The design-system gallery, component examples, and live interface-topology inspection.

Render the real shared components. Keep gallery examples separate from app business behavior. Preserve the five case-sensitive Main Layout region names.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected UIUX source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `npm run typecheck -w @codexsun/uiux`
- `npm run lint -w @codexsun/uiux`
- `npm run build -w @codexsun/uiux`

Use component documentation checks when full verification requires them.
Run checks proportionate to the implemented behavior and its risks.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.
