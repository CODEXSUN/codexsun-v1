# Docs tasks

## Responsibility

Versioned repository documentation, tenant body overrides, source-hash verification, and bounded developer-reference lookup.

Repository sources remain protected. Tenant overrides do not grant application permissions. Keep cited source identity and live Docs authorization aligned.

Read [the component README](../README.md), [the plan](PLAN.md), and [the skills](SKILLS.md) before changing this owner.
These tasks define acceptance for a change. Unchecked items are not claims of missing production features.

## Change checklist

- [ ] Identify the affected Docs source contracts and their public consumers.
- [ ] Confirm the requested behavior against the ownership constraints above.
- [ ] Record schema, permissions, stored-data, and compatibility effects before implementation.
- [ ] Keep validation, persistence, API responses, and relevant UI or adapters aligned.
- [ ] Verify the affected owner and its Platform or package consumers.
- [ ] Record exact checks and unresolved limitations. Update the existing plan only from evidence.

## Acceptance evidence

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs docs`
- `npm run typecheck -w @codexsun/docs-api`
- `npm run lint -w @codexsun/docs-api`
- `npm run build -w @codexsun/docs-api`
- `npm run typecheck -w @codexsun/docs-web`
- `npm run lint -w @codexsun/docs-web`
- `npm run build -w @codexsun/docs-web`

Use component documentation checks when full verification requires them.
Run checks proportionate to the implemented behavior and its risks.
Do not treat documentation, a build, or a model response as proof of live persistence or deployment.

## Repository reference acceptance

- [x] Add Storefront Organisation and newly discovered QCafe/Sites module references.
- [x] Add full-source repository references with stable identity and stale-reference verification.
- [x] Verify synchronization, all 500 catalog MD/MDX pages, all 28 component documentation owners, and seven Docs tests.
- [x] Verify production composition after the CODEXSUN Requirements and Platform Tenant JSX corrections.

The October 17, 2026 audit includes 208 repository Markdown/MDX originals and fifteen added module references.
Module boundaries, the Blog add-on contract, and the root dependency layout passed.
The follow-up root check passed all type checks and lint tasks. All 50 production build tasks passed with forced compilation.
The final `npm run build` passed root cleanup, all 50 forced build tasks, and artifact collection with zero cache hits.
Repository development processes were stopped before cleanup. The old root `dist`, including caches and temporary files, was removed.
Thirteen CODEXSUN tests, ten CI isolation tests, and both module-boundary regression tests passed.
Repository reference hashes normalize CRLF to LF so Windows and Linux produce the same catalog.
No database, browser, desktop/mobile, or deployment verification is included in this documentation audit.
