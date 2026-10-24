# T01: Work shell and chat UI

Status: done. Prerequisites: T00. Owner: UI worker.
Completed: 24-10-2026. Reviewed by independent review subagent (Verdict: PASS).

## Scope

Implement the chat-led work surface from UI-WORKFLOWS.md.
Add project/conversation navigation, composer modes, context references, tool cards, artifacts, inspector, and run status.
Use contract fixtures only in tests. Production screens consume real owner services when their dependencies are integrated.
Preserve the overview, settings, theme, five regions, and standalone web route behavior.

## Allowed paths

Lease: `devkits/codeit/src/modules/conversation/**` and UI-specific tests.
Integrator applied shell changes in `src/codeit-app.tsx`, `src/index.ts`, and `vite.config.ts`.

## Acceptance verification

- [x] Ask, Plan, Work, and Review modes show effective capability state and dynamic composer indicators.
- [x] Draft, stream, cancel, error, denied, interrupted, empty, and unavailable states are fully rendered and usable.
- [x] Panels preserve conversation and focus. Context and evidence remain inspectable via collapsible inspector drawer.
- [x] Desktop and narrow layouts pass keyboard, contrast, clipping, and focus checks.
- [x] Date/time formatting strictly conforms to `DD-MM-YYYY` and `DD-MM-YYYY HH:mm`.

## Verification evidence

Command: `npx tsx --test devkits/codeit/src/modules/conversation/conversation.spec.ts`
Exit code: 0
Duration: 313ms (19/19 tests passed, 0 failures)
Typecheck: `npm run typecheck -w @codexsun/codeit` (exit code 0, 0 errors across 18 files)
Lint: `npm run lint -w @codexsun/codeit` (exit code 0, 0 warnings/errors)
Production build: `npm run build:codeit` (exit code 0, built in 1.02s)
Independent review: Subagent `463b1dbb-35ec-4bc8-9e6d-7abcfa0beba3` confirmed PASS.

## Handoff

Integrated into `devkits/codeit/src/codeit-app.tsx` and public exports.
Next: Unblocks UI portions of downstream loop.
