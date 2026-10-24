# Codeit delivery plan

Status: implementation active. Updated 24-10-2026.
Implementation scope for T00–T13 explicitly authorized by human user on 24-10-2026.
M0 (Foundation & Contract Freeze) completed and verified; Wave A (T01, T02, T03) ready for dispatch.

## Product direction and current state

Build Codeit as a personalized, chat-led agentic development workspace.
The user moves from a request to a plan, bounded work, review, tests, and evidence.
Use the CODEXSUN design system and UIUX work pattern.
Keep tools, plugins, project context, personalization, and worker progress visible and controllable.

The current app has a standalone web shell, overview, settings, navigation, and public read-only exports.
The web port defaults to 7070. Build output belongs in root `dist/devkits/codeit`.
Platform provides optional catalog registration and tenant launch pages.
There is no Codeit API, model integration, persistent chat, project access, tool execution, plugin runtime, or worker scheduler.
Historical shell checks remain in [TASK.md](TASK.md). They do not prove future capabilities.

## Ownership

Codeit owns development projects, conversations, runs, worker assignments, personalization, tool policy, and development evidence.
Platform owns its existing identity, registry, tenant activation, and launch composition.
Shared UI owns reusable controls and layout regions.
Business applications retain ownership of their code and data.
Codeit must not become a shared business CRUD engine.

## Milestones

| Milestone | Result                                         | Packets | Exit gate                                                                         |
| --------- | ---------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| M0        | Agreed contracts and baseline                  | T00     | Decisions, ownership, schemas, storage fixtures verified; OS runner sandbox gated |
| M1        | Persistent chat and supervised read-only tools | T01–T05 | Real provider stream, durable history, policy denial, recovery                    |
| M2        | Bounded coding and verification                | T06–T08 | Safe patch, isolation, cancellation, one-worker golden path                       |
| M3        | Parallel supervisor/worker delivery            | T09     | Isolated tasks, dependency gates, stale-worker rejection                          |
| M4        | Plugins, personalization, integration          | T10–T12 | Revocation, fact isolation, optional bridge, complete E2E suite                   |
| M5        | Release candidate                              | T13     | Independent review, packaging, restore, documented limits                         |

## Parallel delivery

Freeze contracts in T00 before parallel implementation.
Wave A: T01, T02, and T03 may run in parallel in disjoint owned paths.
Wave B: T04 and T05 follow their declared dependencies.
Wave C: T06 and T07 may run in parallel after policy and workspace contracts pass.
Wave D: T08 joins the coding flow. T09 follows the passing single-worker flow.
Wave E: T10 and T11 may run in parallel. T12 and T13 integrate and verify afterward.
Waves describe ready work. Dispatch still respects the worker-count ceiling, so excess ready packets stay queued.
Only one integrator changes root manifests, lockfiles, boundary checks, exports, and Platform composition files.
Workers must not install dependencies or emit competing root builds concurrently.

## Design documents

| Document                                       | Purpose                                          |
| ---------------------------------------------- | ------------------------------------------------ |
| [README.md](README.md)                         | Agent entry point and reading order              |
| [PRODUCT.md](PRODUCT.md)                       | Journeys, tone, personalization, scope           |
| [ARCHITECTURE.md](ARCHITECTURE.md)             | Standalone topology, ownership, storage, scaling |
| [CONTRACTS.md](CONTRACTS.md)                   | Records, state machines, API and events          |
| [UI-WORKFLOWS.md](UI-WORKFLOWS.md)             | Screens, chat-to-work flow, accessibility        |
| [TOOLS-AND-PLUGINS.md](TOOLS-AND-PLUGINS.md)   | Capability policy and adapter isolation          |
| [SUPERVISOR-WORKERS.md](SUPERVISOR-WORKERS.md) | Dispatch, leases, integration, review            |
| [CODING-STANDARDS.md](CODING-STANDARDS.md)     | Repository and implementation rules              |
| [DEVELOPMENT-LOOP.md](DEVELOPMENT-LOOP.md)     | Write, test, review, repair, resume              |
| [E2E-VERIFICATION.md](E2E-VERIFICATION.md)     | Acceptance scenarios and evidence                |
| [IDE-HANDOFF.md](IDE-HANDOFF.md)               | Antigravity and OpenCode instructions            |
| [ROADMAP.md](ROADMAP.md)                       | Priorities and future capabilities               |
| [DECISIONS.md](DECISIONS.md)                   | Defaults and unresolved choices                  |
| [VERIFICATION.md](VERIFICATION.md)             | Actual planning-turn checks                      |

## Completion rule

Read the assigned packet and linked contracts before accepting work.
Every packet must pass its gates before dependent work starts.
The supervisor verifies worker evidence against the integrated revision.
An IDE message, mock response, screenshot, or build alone cannot prove end-to-end correctness.
Product completion requires the E2E matrix, including denied access, recovery, and isolation.
