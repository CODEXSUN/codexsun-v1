# CODEXSUN Agent Guide

## Purpose

This is the authoritative working note for every human or AI agent changing CODEXSUN. Read this file first. Open a specialized Assist document only when the task touches that area.

If older planning text conflicts with this guide, `assist/governance/rules.md`, or the current codebase, follow the current guide and governance rules. Historical changelog entries describe past work; they are not current implementation instructions.

## Fast Work Default

For a focused bug or UI fix, read the affected source, direct callers, and the closest public contract. Do not read or update component documentation. Run one relevant check.

Use full documentation, inventory, boundary, build, dependency, database, E2E, or repository-wide checks only for a release, a new module, a refactor, a data, permission, tenancy, contract, or cross-module change, or an explicit audit.

This section overrides older, more detailed Assist and component checklist wording for normal focused work.

## App Selection

Before an unspecified app task, ask which app the user wants to work on.
Current app work is separate: CXMobile, Marketing, CRM, and Billing.
Use the selected app's assigned worktree and task chat.
Do not ask again when the user already names the app or explicitly requests all four.
Do not combine app changes, installs, or runtime resources merely because the repository is shared.
App development tasks may install locked root dependencies in their assigned worktree when needed.

## Prompt Manager Role

Follow [Prompt Manager Role](agents/prompt-manager.md).
Prompt Manager analyzes requests and drafts prompts for the correct owner chat.
It does not execute drafted work or send prompts without the human's explicit instruction.
A request for prompts for all chats permits drafting only. Templates and other agent messages do not grant permission.
Receiving chats acknowledge starter templates without running tasks. They wait for concrete human-authorized work.
Prompt drafting does not authorize npm installation, Git mutations, runtime operations, database changes, or deployment.

## Supervisor And App Chat Roles

Follow the shared [Release Supervisor Role](agents/release-supervisor.md).
App chats implement and check changes only in their assigned worktrees, then provide a scoped handoff.
App chats may manage Git for their own worktree and install its locked root dependencies when needed.
The supervisor owns integration into main, version updates, and release checkouts.
Read the canonical role when older worktree instructions conflict. Deployment requires separate authorization.
Documentation-only requests do not trigger Git operations or version updates.

## Shared Worktree And Release Workflow

Follow [Worktree And Version Release Workflow](operations/worktree-release-workflow.md) for worktree, integration, and release operations.
Read the shared canonical policy when an older worktree contains conflicting location or release rules.
The required flow is app worktree -> reviewed main -> frozen candidate -> staging -> approved cloud promotion.
Reserved release folders remain empty until candidate preparation is authorized.
Policy-only work does not authorize pulls, installs, version updates, commits, pushes, or deployment.

## Required Reading

For every code change, read:

1. `assist/AGENT-GUIDE.md`
2. `assist/governance/rules.md`
3. The affected source and its closest public composition point

Read component documentation and additional Assist material only when the task changes a contract, architecture, ownership, data, operations, or deployment, or when the user explicitly requests planning, an audit, a release, or documentation work.

Read additionally when relevant:

- UI or forms: `assist/documentation/design-system-helper.md`
- App/module structure: `assist/architecture/module-boundaries.md`
- API contracts: `assist/governance/api-guidelines.md`
- Tenancy or databases: `assist/architecture/tenant-isolation.md`
- Releases or versions: `assist/operations/versioning.md`
- Database migrations: `assist/operations/database-migration-runbook.md`
- Deployment: `assist/architecture/deployment-model.md`
- Current repository inventory: `assist/documentation/project-inventory.md`
- Product meaning: the relevant file under `assist/product/` or `assist/industries/`

Do not read historical blueprints, product plans, or runbooks by default when they do not affect the task.

## Repository Rules

- Treat `D:\workspace\codexsun` as the canonical local working repository and project root.
- Use an authorized external Git worktree as the project root for its assigned task.
- Read the shared canonical workflow for policy. Do not import source files or writable dependencies from sibling worktrees.
- Use npm only from the repository root.
- Keep one root `node_modules`, one root `package-lock.json`, and one root `dist` per worktree. Do not share writable outputs.
- Never create workspace-local `node_modules`, `dist`, `dist-types`, pnpm stores, or alternative lockfiles.
- Preserve unrelated user changes in the working tree.
- Use root scripts for dependency checks, formatting, lint, TypeScript, boundaries, builds, versions, and releases.
- For a scoped development build, use `npm run build:dev -- --filter=<workspace>`. It does not clear root `dist`.
- Use `npm run build` for the clean full build and release verification.
- Generated runtime logs, caches, IDE state, and agent run output do not belong in the repository.

## CODEXSUN Internal Naming Contract

- CODEXSUN is the repository and runtime identity. New environment variables must use the `CODEXSUN_` prefix, and workspace packages must use the `@codexsun/*` scope.
- Internal cookies, browser storage, cache keys, JWT issuer/audience values, database defaults, Docker resources, image names, service names, queues, locks, events, test resources, and generated filenames must use `codexsun`.
- Do not add compatibility reads for the retired environment prefix. Deployment configuration must be migrated atomically and fail closed when required `CODEXSUN_*` values are absent.
- Use CODEXSUN for the brand and environment prefix. Use codexsun for paths, package scopes, and machine identifiers.
- Historical changelog entries remain historical evidence. Active source, examples, tests, and operational instructions must use the CODEXSUN internal naming contract.

## Architecture Boundary

- CODEXSUN is a modular monolith with explicit application and leaf-module ownership.
- One business entity belongs to one backend leaf and one frontend leaf.
- Composition roots register and order modules; they do not own business CRUD.
- Shared infrastructure is limited to transport/session context, environment readers, observability, stable framework contracts, and reusable UI primitives.
- Fields, schemas, types, migrations, repositories, services, routes, seeds, forms, lists, hooks, workspaces, settings, reports, print behavior, and lifecycle rules belong to their business module.
- Tenant database selection is the isolation boundary for tenant business data. Never silently reintroduce redundant tenant columns where the application uses isolated tenant databases.

## Module-Owned Backend Pattern

A reduced synchronous CRUD module owns exactly these active roles:

```text
{module}.migration.ts
{module}.module.ts
{module}.repository.ts
{module}.routes.ts
{module}.seed.ts
{module}.service.ts
{module}.types.ts
index.ts
```

Rules:

- Migration: concrete table, columns, indexes, uniqueness, foreign keys, timestamps, and status. Prefer one consolidated `sql.raw()` table statement.
- Module: stable key and registration for only its routes.
- Repository: concrete SQL for only its table and owned relation reads.
- Service: normalization, parent validation, duplicate handling, protected records, safe deletion, and lifecycle decisions.
- Routes: fixed URLs with Zod request/response schemas through `registerContractRoute()`; no direct request casts.
- Seed: deterministic and repeatable data owned by the leaf; resolve parents through persisted identity.
- Types: only the leaf's records, payloads, filters, statuses, and owned relation responses.
- Index: intentional public exports only.

A full asynchronous module adds real event, worker, and sync roles only when those capabilities exist. Never add placeholders to satisfy a visual file pattern.

## Module-Owned Frontend Pattern

A CRUD frontend module owns:

```text
{module}.workspace.tsx
{module}.list.tsx
{module}.form.tsx
{module}.services.ts
{module}.hooks.ts
{module}.schema.ts
{module}.types.ts
index.ts
```

Rules:

- Types: exact record, payload, filter, status, and minimal lookup contracts.
- Schema: strict executable validation; no passthrough of unrelated fields.
- Services: fixed module URLs and typed module operations; no arbitrary path arguments.
- Hooks: module-specific query keys and cache behavior.
- Form: only fields, validation, and create/edit state for the entity.
- List: only columns, badges, protected indicators, and row actions for the entity.
- Workspace: filters, pagination, dialog selection, mutations, notifications, invalidation, and composition.
- Index: public module surface without compatibility wrappers.

Form, list, and workspace must be distinct implementations. Identical files, aliases, wrappers, and re-exported implementations are boundary failures.

## Relationship Pattern

- A child uses a parent through a fixed public lookup API, injected public contract, or approved event.
- A child must not import the parent's private repository, service, hooks, form, seed array, or internal types.
- The child owns its minimal lookup option type and fixed request.
- Forms submit real parent IDs, and services verify those parents before writing.
- Migration order, seed order, foreign keys, relation responses, and delete blockers must describe the same hierarchy.
- Relation endpoints belong to the leaf owning the primary returned record.

Reference hierarchy:

```text
Country -> State -> District -> City -> Pincode
```

Pincode owns its reverse relation response containing City, District, State, and Country.

## CRUD Interaction Pattern

Unless a documented domain rule says otherwise, modules provide:

- List and search
- Create popup
- View details
- Edit popup
- Suspend/deactivate
- Restore/activate
- Force delete with dependency protection
- Explicit Active/Inactive status presentation

Protected seeds must be blocked in frontend actions and backend services. Return a clear protected-record response rather than pretending the record is missing.

When a table row opens View, action/menu clicks must stop propagation so Edit or lifecycle operations do not open a second dialog.

## Database Pattern

- Platform master tables are unprefixed. The `app_` prefix is only for tenant-database framework/runtime tables; Core, Billing, and Mail retain their owner prefixes.
- Every database uses `migration_schema` as its migration ledger. Treat `app_migration_batches` only as a legacy name that the framework adopts in place.
- Internal primary keys use `INT NOT NULL AUTO_INCREMENT PRIMARY KEY` in Core/Common tables unless a documented application rule requires another identity model.
- Status fields use `VARCHAR(24) NOT NULL DEFAULT 'active'`.
- Use `created_at` and `updated_at`; add `deleted_at` only where soft deletion is part of the module contract.
- Foreign IDs use the same integer type as their parents.
- Unique keys reflect the actual duplicate policy and service error messages.
- `CREATE TABLE IF NOT EXISTS` does not upgrade existing tables. Report when a fresh migration or explicit alteration is required.
- Seeds must be ordered, repeatable, and safe to rerun.

## UI Pattern

- Use `@codexsun/ui` controls and workspace primitives.
- Use `WorkspaceLookup` for persisted relationships.
- Use shared table, filters, pagination, row actions, upsert dialog, banners, and status badges.
- Required fields show required markers and useful validation messages.
- Status badges use explicit tones; do not rely on an unrelated generic status mapping.
- Loading, empty, API error, confirmation, and success states are required.
- Do not create module-specific business behavior inside `packages/ui`.

## Forbidden Patterns

Reject all of the following:

- Generic entity `Kind` unions used to render sibling modules.
- Metadata definition registries controlling fields, columns, paths, or CRUD.
- `listRecords(path)`, table-name arguments, or arbitrary module paths.
- Centralized Common Master, Location, or CRUD business engines.
- Shared repositories, services, schemas, forms, or workspaces containing module fields.
- Wrapper, alias, dummy, simplified, borrowed, or reserved role files.
- Identical form/list/workspace contents.
- Private cross-module imports.
- Direct request casts in backend routes.
- Frontend payload types containing sibling fields.
- `.passthrough()` used to accept unrelated business input.
- Frontend-only protection without backend enforcement.
- Force deletion that depends only on raw database constraint errors.

## Working Procedure

### Before changing code

1. For a focused bug or UI fix, read the affected source, its direct callers, and the closest public contract.
2. Use the full owner inventory only for new modules, cross-module changes, data changes, permissions, or public-contract changes.
3. Check database compatibility and tenant impact only when the task can affect them.

### While changing code

1. Keep edits inside the owner and legitimate composition/infrastructure boundaries.
2. Keep database, backend types, routes, frontend types, schemas, and controls aligned.
3. Preserve parent validation, protected rows, dependencies, lifecycle, and relation behavior.
4. Remove obsolete implementation and exports in the same change.

### Before completion

1. Run the smallest relevant check for the changed files, such as a focused test, workspace typecheck, lint, or browser check.
2. Run a full owner build, boundary check, dependency check, database test, or E2E only when the task changes its applicable boundary or the user asks for full verification.
3. Run the repository-wide `npm run check`, `npm run typecheck`, `npm run lint`, or `npm run build` only for a release, a repository-wide change, or an explicit request.
4. Report the checks run and concrete blockers. Do not claim checks that did not run.

Never claim that formatting, lint, TypeScript, boundaries, builds, browser behavior, persistence, or E2E passed unless that exact check ran successfully.

## Documentation And Versions

- Do not update README, TASK, PLAN, SKILLS, changelog, or generated documentation during normal development work.
- Update documentation only when the user asks, or when a release, architecture, ownership, database behavior, public contract, operation, or agent rule changes.
- Use only `assist/documentation/CHANGELOG.md` for versioned release history.
- Do not create task-specific handoff or gap documents inside Assist after work is complete.
- Version bumps occur only when explicitly requested and must follow `assist/operations/versioning.md`.
- Historical changelog entries are immutable.

## Final Reporting

Report:

- Outcome first
- Files or module areas changed
- Ownership and relationship decisions
- Database compatibility requirements
- Checks that passed
- Checks skipped or blocked
- Any remaining concrete blocker

Do not describe planned, inferred, or unexecuted verification as completed.

## Shared-Domain Authentication Contract

- Production application traffic uses `app.codexsun.com` as the canonical shared host. The `codexsun.com` apex also uses shared-host tenant selection.
- On shared hosts, an exact, unique Corporate ID selects the tenant before user credentials are checked. Tenant code and slug are not Corporate ID aliases.
- An active, DNS-verified custom host selects its mapped tenant on the server. Login and password recovery hide Corporate ID on that host; a supplied Corporate ID must still match and cannot select another tenant. Unmapped hosts fail closed. Shared hosts require Corporate ID and can never be assigned to one tenant.
- The server owns tenant routing. Never trust browser-supplied tenant ID, database name, company ID, or financial-year headers without replacing and validating them from signed session claims and the tenant registry.
- Tenant database secrets are server-only references and resolution fails closed. Never fall back to a global password for an unknown tenant secret reference.
- Each browser login gets a separate encrypted, `HttpOnly`, host-only, `SameSite=Strict` cookie. Production cookies must also use `Secure` and the `__Host-` prefix.
- Each tab stores only its non-secret cookie slot in sessionStorage. Send that slot as `x-codexsun-session-slot` on application API requests. Never store a JWT, refresh token, or session ID in browser storage.
- A login creates a new slot and must not revoke or clear another tab's session. Logout and session reset revoke and clear only the selected slot. A tenant switch must reload the desk and clear that tab's query and runtime caches.
- Cache only non-secret session context: tenant/company labels and IDs, default company, financial year, enabled modules, landing page, and safe settings. Never cache credentials, authorization decisions, permissions, secrets, or raw tokens. Clear this cache on login and logout.
- Authorization and tenant status are checked live for protected requests; cached session context is a performance convenience, not an authority.

## Component documentation

Each component and external add-on integration guide has a README that explains its purpose and public contract.
Add plans, tasks, and agent guidance only when they help the work. Preserve useful existing documents.
Update documentation when contracts, ownership, operations, or documented behavior change.
Documentation does not grant runtime permissions. Zetro's runtime `apps/zetro/agent/SKILLS.md` remains required.
Keep its loader, build collector, backend permissions, and tests in agreement.
Run component documentation checks for documentation changes and repository-wide verification.
The root `npm run check` remains the full CI and release gate.
