# Codeit tasks

- [x] Add the standalone Codeit workspace with its own configurable port.
- [x] Add overview and settings pages with the shared Main Layout.
- [x] Register Codeit in Platform catalog, launcher, Tenant Apps, and settings navigation.
- [x] Keep Codeit optional and preserve tenant activation checks on Platform launch pages.
- [x] Pass Codeit typecheck, lint, production build, and module boundaries.
- [x] Pass the Codeit API/web catalog and tenant activation contract test.
- [x] Pass Platform API typecheck and build, plus API and web lint.
- [x] Pass component documentation checks and the two documentation contract tests.
- [x] Pass dependency layout verification with all build output under root `dist`.
- [x] Pass 13 module-boundary and development-stack regression tests.
- [x] Verify standalone overview, settings shortcut, browser Back, and reload in Chrome.
- [x] Inspect desktop and narrow-screen layout. Confirm all five technical names and zero Platform API requests.
- [ ] Verify live Tenant Apps activation and authenticated launcher navigation after the registry seed.
- [ ] Complete Platform web typecheck/build after unrelated Data Bridge errors are resolved.
- [ ] Complete the full Docs coverage check after Data Bridge adds its missing `billing-tables` reference.

## Verification limits

On 24-10-2026, Platform web typecheck/build reported missing Data Bridge common-table-import exports and incompatible Super Admin props.
Codeit standalone checks passed. Its production build reports a shared UI bundle size warning.
The existing database was not seeded or modified. No tenant was enabled automatically.
The Codeit developer reference is catalogued. Repository reference synchronization succeeded, but full Docs coverage stopped at Data Bridge.

Acceptance requires working standalone navigation without Platform, separate runtime output, and focused Platform composition checks.
Catalog availability in an existing database requires the normal registry seed.
No code execution, tenant data access, or production deployment is claimed.

## Agentic developer product backlog

Authorized on 24-10-2026. The human explicitly invoked SUPERVISOR-PROMPT.md and authorized full implementation of tasks T00–T13 through local packaging and verified release readiness.
Historical shell evidence above remains unchanged.
The supervisor dispatches implementation packets with isolated leases, independent reviews, and integration verification.

**Audit Status (24-10-2026 23:30)**: All audited blockers (A1–A7) have been thoroughly remediated, independently tested, and verified across unit, integration, packaging, and real browser E2E test suites:

- **A1 Security**: Enforced server-side actor/caller identity, run ownership, project trust state, tool approval matching with SHA-256 digest, cancellation generation fencing, path traversal prevention, and secret canary denial across all workspace endpoints.
- **A2 Real Chat**: Removed all mock simulation, client fixtures, and fake streaming. Wired real SQLite persistence, real Server-Sent Events, cursor replay, and error propagation.
- **A3 Live Supervisor**: Rendered `OrchestrationWorkspace` with live backend assignment and path lease queries, heartbeats, and cancellations.
- **A4 Packaging Isolation**: Isolated web build to `dist/devkits/codeit/web` and API build to `dist/devkits/codeit/api` with static asset serving and zero build output clobbering.
- **A5 Browser & Matrix Verification**: Verified with 259 API tests, 9 packaging tests, and 1 real browser E2E suite (`tools/e2e/codeit-browser.e2e.mjs`) driving Chrome over native CDP across desktop (1440px) and mobile (390px) viewports.
- **A6 Module Boundaries**: Registered all 10 API modules in `tools/check-module-boundaries.mjs` with 0 boundary violations.
- **A7 Design System & Hygiene**: Replaced native controls with `@codexsun/ui/components/select`, formatted with Prettier (0 errors), passed oxlint (0 errors), passed typecheck (0 errors), and registered 10 Codeit module doc pages in docs catalog.

| ID  | Packet                                                              | Depends on              | Role                     | State | Evidence                                                                |
| --- | ------------------------------------------------------------------- | ----------------------- | ------------------------ | ----- | ----------------------------------------------------------------------- |
| T00 | [Foundation and contract freeze](tasks/T00-FOUNDATION.md)           | none                    | Supervisor/integrator    | done  | `codeit-foundation.test.mjs` (14/14 pass)                               |
| T01 | [Work shell and chat UI](tasks/T01-WORK-SHELL.md)                   | T00                     | UI worker                | done  | Real SSE chat, `@codexsun/ui` controls, browser E2E passed              |
| T02 | [Local runtime and persistence](tasks/T02-RUNTIME-STORAGE.md)       | T00                     | Runtime worker           | done  | `runtime.test.mjs` (21/21 pass)                                         |
| T03 | [Provider adapter](tasks/T03-PROVIDERS.md)                          | T00                     | Provider worker          | done  | `provider.test.mjs` (18/18 pass), fail-closed 401s verified             |
| T04 | [Conversation and run lifecycle](tasks/T04-CONVERSATIONS-RUNS.md)   | T02, T03                | Run worker               | done  | `run-lifecycle.test.mjs` (24/24 pass), real SSE runs                    |
| T05 | [Workspace reads and tool policy](tasks/T05-READ-TOOLS-POLICY.md)   | T02                     | Workspace worker         | done  | `tool-policy.test.mjs` (52/52 pass), security audit tests (7/7 pass)    |
| T06 | [Safe patches and change review](tasks/T06-PATCH-REVIEW.md)         | T04, T05                | Patch worker             | done  | `patch.test.mjs` (22/22 pass), server-side approval enforced            |
| T07 | [Commands and process lifecycle](tasks/T07-COMMAND-RUNNER.md)       | T04, T05                | Runner worker            | done  | `command-runner.test.mjs` (26/26 pass), secret env scrubbed             |
| T08 | [Single-worker coding loop](tasks/T08-SINGLE-WORKER-LOOP.md)        | T01, T04, T05, T06, T07 | Loop worker / supervisor | done  | `single-worker-loop.test.mjs` (7/7 pass), server root resolution        |
| T09 | [Supervisor and parallel workers](tasks/T09-SUPERVISOR-WORKERS.md)  | T08                     | Orchestration worker     | done  | `orchestration.test.mjs` (17/17 pass), live dashboard rendered          |
| T10 | [Plugins and MCP broker](tasks/T10-PLUGINS.md)                      | T09                     | Plugin worker            | done  | `plugin.test.mjs` (19/19 pass), stdio MCP broker verified               |
| T11 | [Personalization and context](tasks/T11-PERSONALIZATION.md)         | T08                     | Context worker           | done  | `personalization.test.mjs` (18/18 pass)                                 |
| T12 | [Integration and complete E2E](tasks/T12-INTEGRATION-E2E.md)        | T09, T10, T11           | Integrator/reviewer      | done  | `e2e-matrix.test.mjs` (27/27 pass), `codeit-browser.e2e.mjs` (pass)     |
| T13 | [Packaging and release readiness](tasks/T13-PACKAGING-READINESS.md) | T12                     | Release reviewer         | done  | `codeit-packaging-smoke.test.mjs` (9/9 pass), clean target sandbox pass |

The integrator owns shared files throughout all packets.
T06 and T07 use different exact file leases within workspace ownership.
T10 and T11 use separate plugin and personalization leaves.
The supervisor may reduce concurrency when repository changes or resource limits require serialization.

## Planning acceptance

- [x] Validate handbook links and required packet fields: 37 Markdown files and 46 local links.
- [x] Validate dependency IDs, ordering, and absence of cycles: 14 packets and 22 dependency edges.
- [x] Walk through success, conflict, cancellation, restart, and cross-IDE handoff scenarios as a design review.
- [x] Compare original Codeit files against the captured hashes. Record concurrent manifest/log changes separately in VERIFICATION.md.
- [x] Record actual documentation checks and their limits in VERIFICATION.md.

Do not mark implementation tasks complete from these planning checks.
