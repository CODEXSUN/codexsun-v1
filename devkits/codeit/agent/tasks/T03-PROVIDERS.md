# T03: Provider adapter and model settings

Status: done. Prerequisites: T00. Owner: provider worker.
Completed: 24-10-2026. Reviewed by independent review subagent (Verdict: PASS).

## Scope

Implement one approved model provider behind the frozen provider contract.
Support capability discovery, text/tool-call streaming, cancellation, usage, normalized errors, and bounded retry.
Add provider settings and connection health through the provider owner.
Keep model choice explicit. Do not assume a consumer subscription permits API use.

## Allowed paths

Leased paths: `devkits/codeit/api/src/modules/provider/**`, `devkits/codeit/src/modules/provider/**`, and `devkits/codeit/api/test/provider.test.mjs`.
Integrator applied public exports in `devkits/codeit/api/src/index.ts` and server registration in `server.ts`.

## Acceptance verification

- [x] Provider interface defines capabilities, discriminated stream events (`text_delta`, `tool_call_delta`, `usage`, `finish`, `error`), cancellation via AbortSignal, and normalized error mapping.
- [x] Deterministic offline `MockProvider` and Google Gemini adapter (`gemini-2.5-flash` / `gemini-2.5-pro`) implemented.
- [x] Credentials remain strictly server-side (`GEMINI_API_KEY`), never exposed to browser or logs, with URL/error secret scrubbing.
- [x] Tool calls are strictly proposed as deltas (`type: "tool_call_delta"`), not executed in the provider module.
- [x] Frontend provider settings workspace implemented under `devkits/codeit/src/modules/provider/` with provider list, model selector, temperature controls, and live connection testing.

## Verification evidence

Command: `node --test devkits/codeit/api/test/provider.test.mjs`
Exit code: 0
Duration: 248ms (18/18 tests passed across 5 suites, 0 failures)
Typecheck: `npm run typecheck -w @codexsun/codeit` (exit code 0) & `npx tsc -p devkits/codeit/api/tsconfig.json --noEmit` (exit code 0)
Lint: `npm run lint -w @codexsun/codeit` & `npx oxlint devkits/codeit/api/src` (exit code 0, 0 warnings/errors)
Independent review: Subagent `8b416980-026c-4683-8c99-38bdd2c52d6c` confirmed PASS.

## Handoff

Public provider contracts, mock double, and Gemini adapter available.
Next: Unblocks T04 (Conversation & Run Lifecycle) in combination with T02.
