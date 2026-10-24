# Codeit

Codeit is a standalone development workspace under `devkits/codeit`.
It uses the shared CODEXSUN Main Layout, controls, and UIUX visual pattern.

## Run

Run `npm run dev:codeit` from the repository root.
Open `http://127.0.0.1:7070/codeit/overview`.
Settings are at `/codeit/settings`.
Set `CODEXSUN_CODEIT_WEB_PORT` to change the port. The default is 7070.
The Vite server binds to loopback and rejects an occupied port.
Platform does not start Codeit. Codeit does not require Platform to run.

Run `npm run build:codeit` to build into `dist/devkits/codeit`.

## Integration

Platform registers the optional `codeit` application in its API catalog and web launcher.
Super Admin can enable it through Tenant Apps. It is not enabled for existing tenants automatically.
Platform provides `/app/codeit/overview` and `/app/codeit/settings` as read-only launch pages.
The settings shortcut opens Codeit settings when Codeit is the active application.
Local launch links use the configured Codeit port.
For hosted launch links, set `CODEXSUN_CODEIT_WEB_URL` to the separately hosted Codeit URL before building Platform Web.
Hosted Platform pages do not infer a loopback address for remote users.
Existing databases need the normal Platform registry seed to create the catalog row. No new table or migration is required.

## Architecture and Module Ownership

Codeit is structured as a standalone local-first development workspace with an independent Node.js API runtime (`devkits/codeit/api`) and a React/Tailwind frontend (`devkits/codeit`):

- **`artifact`**: Bounded local artifact persistence, content-addressable SHA-256 digests, and streaming downloads.
- **`conversation`**: Chat interface, message persistence, run initiation, cursor-based event replay, and approval interactions.
- **`orchestration`**: Parallel worker coordination, bounded concurrency (max 2 workers), disjoint path leases, dependency DAG validation, and lease heartbeats.
- **`personalization`**: Scoped context memories (user/project/conversation), explicit-save confirmation, fact precedence, and secret canary filtering.
- **`plugin`**: Model Context Protocol (MCP) plugin lifecycle, manifest verification, JSON-RPC broker, and process-fenced revocation.
- **`project`**: Workspace project registration, root canonicalization, trust states (`trusted` / `untrusted`), and isolation.
- **`provider`**: Multi-provider LLM adapters (Mock, Gemini 2.5 Flash/Pro) with streaming SSE responses, usage accounting, and token budgeting.
- **`run`**: 11-state execution lifecycle machine, transactional state transitions, cancellation generation fencing, and coding loop coordination.
- **`tool`**: Capability policy enforcement (Actor + Trust + Mode + Grants), approval binding, canary redaction, and tool execution audit logging.
- **`workspace`**: Canonical path sandboxing, atomic `.tmp` patch application, secret-scrubbed command execution with process-tree cleanup.

The public `@codexsun/codeit` entry exports `CodeitApp`, `CodeitOverview`, `CodeitSettings`, `ConversationWorkspace`, `SupervisorDashboard`, `PersonalizationPanel`, and `PluginPanel`.
Platform composes these pages without embedding the standalone app shell.
`@codexsun/ui` supplies reusable layout and controls. React and Lucide supply rendering and icons.

## Verification

- `npm run check:module-boundaries`: Architecture and capability role verification.
- `npm run lint -w @codexsun/codeit` & `npm run lint -w @codexsun/codeit-api`: Linting across frontend and API.
- `npm run typecheck -w @codexsun/codeit` & `npm run typecheck -w @codexsun/codeit-api`: TypeScript typecheck.
- `npm run test:codeit`: Unit and module contract test suites.
- `npm run test:e2e:codeit`: Complete E01–E25 end-to-end integration matrix.
- `npm run test:packaging:codeit`: Clean packaging, standalone startup, upgrade persistence, and restore sandbox tests (E23, E26).
- See [tasks](agent/TASK.md), [plan](agent/PLAN.md), and [working rules](agent/SKILLS.md).
