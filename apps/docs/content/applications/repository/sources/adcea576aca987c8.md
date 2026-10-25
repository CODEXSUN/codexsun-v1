# Hostinger Deploy tasks

Repository source: `tools/hostinger-deploy/agent/TASK.md`

Source SHA-256 (LF line endings): `1de1c82424e977a94d5d24694e31f033d90c9dc8c72ab8073d08a7d4c69dd5d9`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# Hostinger Deploy tasks

## Responsibility

Read-only pinned-host SSH, Docker, Compose, and deployment-checkout status.

Keep private credentials outside source. Verify the pinned host. This tool has no source mutation or deployment operation. Do not contact a host merely to update documentation.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected Hostinger Deploy source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

- `node --check tools/hostinger-deploy/src/cli.mjs`
- `npm run check:versions`

Use `npm run check:component-docs` for this documentation contract.
Run applicable tests before marking implementation work complete.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.
```
