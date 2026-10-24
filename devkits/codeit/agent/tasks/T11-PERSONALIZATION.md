# T11: Personalization and context control

Status: done. Prerequisites: T08. Owner: context worker.
Review verdict: PASS (verified by Independent Reviewer `48ded9b8-7454-4a2f-8217-1cef416d139e` on 24-10-2026).

## Scope

Implement explicit preferences and confirmed facts with source, scope, revision, verification time, and retention.
Add proposal/confirmation, edit/forget, precedence, stale-fact handling, and a provider context preview.
Keep inferred preferences unconfirmed and prevent memory from granting tool authority.
Use actual user-provided facts. Do not prefill undisclosed personal details.

## Allowed paths

Lease API/frontend personalization leaves and context-specific tests.
Request provider context integration through its public contract and the integrator.
T10 owns plugin paths. Workers must not edit shared settings composition concurrently.

## Acceptance

- Facts stay within user/project/conversation scope and persist only under the configured explicit-save policy.
- Conflicts and stale facts are visible. Source changes invalidate affected project-rule facts.
- Forget prevents future retrieval and invalidates derived summaries.
- Credentials and protected content stay out of memory and provider context.
- Personalization cannot widen mode, grants, sandbox limits, or worker scope.

## Verification and handoff

Cover E19/E20/E21 with cross-project fixtures, source revision changes, forgotten facts, and malicious stored text.
Run storage, policy, UI, and actual context-assembly tests.
Return fact provenance/retention behavior, deletion limits, context preview evidence, and templates/HANDOFF.md.

## Delivered Artifacts & Verification

- [x] Backend Personalization Module (`devkits/codeit/api/src/modules/personalization/`): `personalization.types.ts`, `personalization.repository.ts`, `personalization.service.ts`, `personalization.routes.ts`, `personalization.module.ts`, `index.ts`.
- [x] Explicit-Save Policy (E19): Agent proposals and inferred preferences default to `unconfirmed` and are excluded from context assembly until explicitly confirmed by the operator.
- [x] Strict Scope Isolation (E19): Facts are partitioned across `user`, `project`, and `conversation` scopes. Zero cross-project bleed between independent workspaces.
- [x] Precedence & Conflict Resolution: Precedence hierarchy `conversation > project > user`. Colliding keys resolve to higher precedence; overridden facts recorded in exclusions.
- [x] Immediate Forget / Purge (E19): `DELETE /api/codeit/personalization/:uuid` purges fact from SQL database and immediately excludes it from context assembly.
- [x] Secret Canary & Token Scrubbing (E21): Content security validator rejects secret canaries (`CANARY_`, `SEC-CANARY`), API keys, credentials, and tokens with `CODEIT_VALIDATION_ERROR`.
- [x] Capability Bounds & Injection Resistance (E20): Facts cannot grant tool authority, alter permissions, widen execution mode, or bypass sandbox boundaries.
- [x] Context Preview with Token Budget: Assembles markdown prompt prefix with advisory header, token consumption estimate, and lowest-precedence truncation.
- [x] Frontend Personalization Panel (`devkits/codeit/src/modules/personalization/personalization-panel.tsx`): Built with `@codexsun/ui`, Tailwind CSS, Lucide icons, scope and status filters, add preference dialog, and context preview drawer.
- [x] Automated Tests: 18/18 tests passing in `devkits/codeit/api/test/personalization.test.mjs`.
- [x] Integrated into server routes (`api/src/server.ts`), API package exports (`api/src/index.ts`), and Web package exports (`src/index.ts`).
- [x] Independent review PASS (verified by Reviewer `48ded9b8-7454-4a2f-8217-1cef416d139e`).
