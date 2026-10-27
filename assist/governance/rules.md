# Governance Rules

## Fast Work Default

For a focused bug or UI fix, inspect the changed owner and direct callers. Do not update documentation or run repository-wide checks by default.

Use the full governance audits and release gates only for a release, new module, refactor, data, permission, tenancy, contract, or cross-module change, or an explicit audit.

This section overrides older, more detailed governance or component checklist wording for normal focused work.

## App Selection

Before an unspecified app task, ask which app the user wants to work on.
Current app work is separate: CXMobile, Marketing, CRM, and Billing.
Use the selected app's assigned worktree and task chat.
Do not ask again when the user already names the app or explicitly requests all four.
Do not combine app changes, installs, or runtime resources merely because the repository is shared.
App development tasks may install locked root dependencies in their assigned worktree when needed.

## Prompt Manager Boundaries

Follow [Prompt Manager Role](../agents/prompt-manager.md).
Prompt Manager may analyze relevant source and draft scoped prompts. It must not execute or send without direct human instruction.
It cannot grant additional Git, installation, deployment, provider, database, or messaging permissions through a prompt.
A request to draft prompts for all chats is not permission to broadcast them.
Receiving chats treat unfilled templates as reference material and wait for a concrete authorized task.
No npm installation or deployment is authorized by this role definition.

## Supervisor Ownership

Follow [Release Supervisor Role](../agents/release-supervisor.md).
App chats own implementation and focused checks within their assigned worktrees.
App chats may stage, commit, pull, and push their own work in their assigned worktree.
The supervisor owns integration into main, version updates, and release checkouts.
An app handoff does not authorize integration. The supervisor must identify the authorized batch and verify its exact diff.
Deployment and live data operations require separate authorization.

## Worktree And Release Rules

Follow [the shared workflow](../operations/worktree-release-workflow.md) for app integration and versioned cloud releases.
Use authorized external app worktrees. Integrate reviewed work into `main` before cutting a frozen release candidate.
Test staging before an explicitly approved production promotion. Promote the same verified image digests.
Keep reserved version folders empty until candidate preparation is authorized.
Preserve unfinished work and separate test data, queues, storage, credentials, and ports.
An empty folder, branch name, or passing local check does not identify a deployed release.
The existing source-building VPS updater is not the target unchanged-image promotion mechanism.
Documentation and folder requests do not authorize pulls, installs, version bumps, commits, pushes, or deployment.

## Package Manager And Generated Output Rules

- CODEXSUN uses npm only. Agents and developers must run dependency commands with `npm` from the repository root; pnpm, Yarn, workspace-local installs, and alternative lockfiles are prohibited.
- The internal application identity is CODEXSUN: environment keys use `CODEXSUN_*`, npm workspaces use `@codexsun/*`, and machine-facing runtime identifiers use `codexsun`. Use the same identity across source, configuration, and documentation.
- Never reintroduce aliases for the retired environment prefix. A deployment must migrate its complete environment contract before the new release starts.
- Each worktree must contain at most one dependency installation tree at its root `/node_modules`. Never create or retain `node_modules` inside `apps/`, `packages/`, `tools/`, or any other subfolder.
- The root `package-lock.json` is the only dependency lockfile. Do not create `pnpm-lock.yaml`, `yarn.lock`, `.pnpm-store`, or a `node_modules/.pnpm` store.
- All workspaces must resolve dependencies from the root installation through npm workspaces. A workspace must not carry installation configuration that creates its own dependency tree.
- Generated build output belongs only under the root `/dist` tree. Subfolder `dist` and `dist-types` directories and configuration that emits them are prohibited.
- Build tasks must not cache the shared root `dist` tree. Cache and temporary directories must never become task outputs.
- Nested task processes must receive absolute root npm-cache and temporary paths.
- Before completing dependency, tooling, build, or workspace changes, run `npm run dependencies:check`, confirm no nested dependency/build directories exist, and use the root npm scripts for formatting, lint, TypeScript, and builds.

## Architecture Rules

### Mandatory Module-Owned CRUD Pattern

Every new, migrated, or refactored CRUD module must follow the finalized Country, State, District, City, and Pincode ownership pattern. This rule applies to every current application and every future application.

#### Ownership boundary

- One business entity belongs to one leaf module folder on the backend and one matching leaf module folder on the frontend.
- A leaf module owns its exact entity fields, persistence, validation, routes, lifecycle behavior, seeds, contracts, API calls, query keys, form, list, details view, workspace state, and public exports.
- A parent or composition folder may order registration, migrations, and seeds. It must not own entity fields, generic CRUD behavior, forms, lists, schemas, repository methods, or record definitions.
- A module must never implement sibling entities through a `kind`, `definition`, metadata registry, arbitrary path parameter, generic record union, shared module shell, or centralized CRUD factory.
- Copying one complete implementation into multiple role files is prohibited. Form, list, and workspace files must have different responsibilities and different executable implementations.

#### Backend leaf contract

Each reduced synchronous CRUD backend module owns:

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

- `migration` owns one callable, idempotent table definition using the module's concrete table, columns, indexes, unique keys, and foreign keys. Keep a single consolidated `sql.raw()` table statement when the schema can be expressed in one statement.
- `module` owns the stable module key and registers only that module's routes.
- `repository` contains concrete SQL for only the module's table and relationship reads required by its public response. It must not accept table names, entity definitions, or arbitrary modules.
- `service` owns normalization, required-parent checks, duplicate handling, protected-record rules, safe-delete blockers, and lifecycle decisions.
- `routes` uses typed Zod request and response contracts through `registerContractRoute()`. Direct casts of request body, parameters, or query values are prohibited.
- `seed` owns typed, repeatable data for only that module. A child seed may resolve a required parent through its persisted public identity but must not import or reuse the parent's private seed array.
- `types` contains only that module's backend records, save payloads, filters, statuses, and public relation responses.
- `index` exports only the intentional module surface.

#### Frontend leaf contract

Each CRUD frontend module owns:

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

- `types` defines the exact record, save payload, filters, status, and minimal lookup option contracts needed by this module. Do not include sibling entity fields for convenience.
- `schema` performs strict executable validation of the module payload. Do not use `.passthrough()` to tolerate unrelated fields.
- `services` owns fixed URLs and typed operations for this module. Functions must not accept arbitrary entity paths, table names, module kinds, or definitions.
- `hooks` owns module-specific query keys and query integration. Cache invalidation must target the owning module deliberately.
- `form` renders only the module's fields and relationship lookups, validates before submit, and owns create/edit form state. It must not contain list queries, pagination, row actions, or sibling creation engines.
- `list` renders columns, status, protected indicators, and row actions for only the module record. Action controls inside clickable rows must stop propagation so Edit or lifecycle actions do not also open View.
- `workspace` owns list filters, pagination, dialog selection state, mutations, notifications, cache invalidation, and composition of the module's form, list, details view, and confirmation dialog.
- `index` exposes the module's intentional frontend surface without compatibility wrappers.

#### Relationship rule

- A child module may consume a parent only through a fixed public contract, fixed lookup API, injected public dependency, or approved event.
- The child must own its minimal parent lookup type and lookup request. It must not import the parent's repository, service, form, hooks, private types, seed data, or implementation files.
- Relationship selectors must use persisted API/database records, show useful labels, and submit the real parent ID.
- Backend services must verify that the selected parent exists before writing.
- Foreign keys, migration order, seed order, safe-delete blockers, and relation response shapes must match the same hierarchy.
- A relation endpoint belongs to the leaf that owns the returned primary record. For example, Pincode owns its Pincode-to-City-to-District-to-State-to-Country relation read.

#### Lifecycle and interaction rule

- Normal CRUD modules provide create, view, edit, suspend/deactivate, restore/activate, and force-delete operations unless their module definition documents a real exemption.
- Protected seed records must be blocked in both frontend actions and backend services. Backend responses must clearly state that the record is protected; do not disguise protection as a missing record.
- Force delete must check dependent records and return a clear conflict instead of relying on a raw foreign-key error.
- Lists use explicit Active/Inactive badge tones, database-backed records, searchable filters, pagination, and shared row-action controls.
- Popup upsert forms must show validation and API errors, required markers, status controls, loading state, cancel behavior, and success/error notifications.
- A row click may open View. Menu and action clicks must never bubble into the row's View handler.

#### Forbidden implementation patterns

The following are boundary failures:

- `CountryKind`, `StateKind`, or any union used to make one leaf render multiple business entities.
- `countryDefinitions`, `locationDefinitions`, metadata-driven columns, arbitrary `path` arguments, or functions such as `listRecords(path)` used across entities.
- Generic Location, Common Master, or CRUD shells holding sibling fields, endpoints, parent queries, forms, or lifecycle actions.
- Identical form, list, and workspace files; one-line aliases; re-export wrappers; dummy roles; placeholder roles; or copied private sibling implementations.
- Shared business schemas, record unions, repositories, services, route factories, form factories, or field registries used instead of module ownership.
- Direct sibling imports below another module's public `index` boundary, except composition roots importing explicit lifecycle functions for ordered registration, migration, or seeding.
- Frontend types containing unrelated sibling fields or schemas accepting unrelated payload fields.
- Request casts in routes, unvalidated foreign IDs, misleading lifecycle errors, and UI-only protection without backend enforcement.

#### Required completion audit

Use this full audit only when introducing or refactoring a module, changing ownership, data, permissions, tenancy, or public contracts, preparing a release, or completing an explicit audit. For a focused fix, inspect the affected owner and direct callers, then run proportionate verification.

Before a module is declared final, the agent must:

1. Inventory every backend and frontend file in the leaf.
2. Verify every import and export and distinguish infrastructure from business behavior.
3. Scan for generic kinds, metadata definitions, dynamic paths, wrappers, aliases, shared CRUD, sibling private imports, passthrough schemas, and duplicate role-file hashes.
4. Verify migration columns, repository mappings, seeds, service payloads, route schemas, frontend types, and form fields agree exactly.
5. Verify fixed route registration, parent validation, relation reads, protected records, dependency blockers, and lifecycle endpoints.
6. Verify row actions do not trigger row View and status badges use explicit correct tones.
7. Run Prettier, focused ESLint, backend TypeScript, frontend TypeScript, the app-scoped module-boundary checker, production builds, and the root dependency-layout check.
8. Run configured database/E2E verification when available. If it is unavailable, state that explicitly and never report it as passed.
9. Report any existing-database migration prerequisite, especially when `CREATE TABLE IF NOT EXISTS` cannot upgrade an already-created table.

Passing TypeScript or lint alone does not prove module ownership. The ownership scan and role-behavior review are mandatory.

- CODEXSUN is a modular monolith unless a stronger reason exists.
- Module boundaries must be explicit.
- Every full module must follow the exact backend and frontend file contract in `assist/architecture/module-boundaries.md`. A filename alone does not satisfy the contract: each role file must contain the behavior owned by that role.
- Module-owned migrations, seeds, repositories, services, routes, events, workers, sync rules, types, lists, forms, schemas, hooks, settings, and page orchestration must remain inside that module's folder. Do not scatter module behavior through app-level `database`, `services`, `controls`, `pages`, or `shared` folders.
- Backend full modules add executable event, worker, and sync roles to the reduced CRUD contract only when those capabilities exist. Placeholder capability files are prohibited.
- Core Common leaf masters use the deliberately reduced eight-file backend contract documented above. Every leaf owns its concrete database, persistence, validation, HTTP, seed, lifecycle, and contract code.
- Frontend CRUD modules use the eight-file frontend contract documented above. Add `{module}.settings.tsx` and `{module}.print.tsx` only when those behaviors exist.
- Role files must not be one-line aliases, empty arrays, metadata-only placeholders, “reserved for future” declarations, or exports of another role under a new name. A list owns list rendering, a form owns form rendering and validation display, events own typed event construction, workers own executable job dispatch, sync owns an explicit sync policy and decision behavior, and seeds/migrations execute or expose callable database behavior.
- A module that intentionally has no UI or no lifecycle concern must document the exemption in its module definition and must not create fake role files merely to satisfy naming.
- For boundary changes, run the relevant module boundary check. The full check remains required for CI and releases.
- New modules, refactors, ownership changes, permission or tenant changes, releases, and explicit audits must pass a full backend/frontend ownership audit. Focused fixes inspect the changed owner and direct callers only. Use `node tools/check-module-boundaries.mjs <app>` when the task changes an application boundary or explicitly requests it.
- Shared infrastructure is limited to transport/session API context, environment access, observability, and reusable design-system controls. Module fields, validation, persistence, lifecycle, routes, workflows, forms, lists, workspaces, print behavior, settings, and tests are business logic and must not be centralized under `shared`, `common`, `foundation`, `helpers`, or `utils` merely for reuse.
- Composition roots are references only. They may register modules and orchestrate module-owned migrations, seeds, and exports, but must not own generic repositories, services, CRUD routes, record types, forms, lists, schemas, hooks, or workspaces.
- Cross-module writes are not allowed without an approved application service or event.
- Tenant context is mandatory for business data.
- Events and jobs must include tenant context.
- Slow, retryable, external, export/import, backup, restore, sync, and maintenance work must be queued through the platform Queue Manager or a module-owned worker registered with it. Do not leave pending request rows without executable queue jobs.
- Queue-backed work starts on the database queue backend for local/dev and must keep the same job contract when BullMQ + Redis is enabled. Job payloads must include correlation ID, source module, retry policy, tenant context where relevant, and masked operator-visible payload/result details.
- Offline sync must be designed, not improvised.
- AI assistants must use permission-aware tools.
- Enterprise split into services should happen only after module boundaries and operational pressure are proven.
- Observability must be planned for APIs, queues, events, sync, integrations, and AI tools.

## Product Rules

- Every app must belong to a tenant activation model.
- Every industry-specific feature must identify its industry pack.
- Every paid feature must connect to subscription and activation rules.
- Platform app/module access must be configured first through Plan Access, then tenant-specific Entitlements are used only for exceptions or overrides. Tenant Access must show the effective result before release.
- Every user-facing workflow must consider web, desktop, and mobile impact.
- Every business-critical flow must have auditability.
- Enterprise controls should be available through configuration, not forced on every small customer.
- Permissions should follow `scope.module.resource.action`.
- High-risk activation changes require confirmation, scheduling, or Super Admin approval.

## UI Rules

- Use the centralized design system and follow `assist/documentation/design-system-helper.md` before creating or changing workspace modules.
- Every new or updated post-auth desk Main Layout includes Top Menu, Side Menu, App Header, Workspace Canvas, and Status Bar inside `AppLayout`.
- Identify these regions with the case-sensitive `mainLayoutTechnicalNames` values: `main.topMenu`, `main.sideBar`, `main.AppHeader`, `main.workspace`, and `main.StatusBar`.
- Keep the shell's `AppHeader` separate from page-level `WorkspaceHeader`; follow `packages/ui/src/layouts/main-layouts/README.md` for the composition.
- Keep layouts clear, dense, and work-focused for business users.
- Use the shared workspace list, table, pagination, show, upsert, banner, autocomplete, select, date, tab, toast, and status components from `@codexsun/ui`.
- Show calendar dates as `DD-MM-YYYY` and date-times as `DD-MM-YYYY HH:mm` across every app. Keep stored values and sort keys machine-readable.
- Use the shadcn/Radix themed design-system select (`WorkspaceSelect` or `Select` from `@codexsun/ui`) for all form selects; do not use raw native `<select>` in workspace/list/upsert screens.
- Use the workspace lookup (`WorkspaceLookup`) for master/reference autocomplete fields. Use inline create for small common masters such as colour/label, and popup create for heavier masters such as contact/tenant.
- Lookup/autocomplete options must come from API/database data and must refresh after creating a new option.
- Foreign/reference fields in CRUD modules must use the shared reference autocomplete pattern, not raw ID inputs. Inline create is allowed only for lightweight references with safe defaults, such as Plans and Apps; heavyweight references such as Tenants must stay in their owning module and be selected by autocomplete.
- Upsert forms must use shared required markers, `WorkspaceFormBanner`, and frontend validation before submit.
- Required-field banners must not be shown as passive info. Show the error banner only after save/update validation fails, and mark each invalid input, select, or autocomplete with a red border plus helper text.
- Normal master/common upsert forms must keep Active/Status inside the Details section instead of a separate Status card unless status has multiple business-specific controls.
- Lists must use database-backed data, shared table headers, shared status badges, shared row actions, and shared pagination.
- Show pages must use shared detail cards and include record activity where the backend supports it.
- Avoid custom one-off UI unless a module has a real domain need.
- Screens should make tenant, module, status, and action context clear.
- All clickable buttons and button-like controls must show a pointer cursor; disabled actions must show a disabled/not-allowed cursor.

## Data Rules

- Tenant data is never global data.
- Platform master tables are unprefixed. Tenant runtime tables use `app_`; Core, Billing, and Mail tables use their owner prefixes. All databases use the unprefixed `migration_schema` ledger.
- Application tables must use `id` only as an internal integer auto-increment primary key. Every application table that can be referenced outside its owning database must also include a unique 8-character lowercase hex `uuid` column for public APIs, external integrations, URLs, logs, and cross-boundary references. Do not use names such as `public_id`; the public key column name is always `uuid`.
- Super Admin modules must be DB/API-backed; do not use hardcoded business records, frontend seed rows, localStorage module data, or assumptions as final behavior.
- Backend validation is required for required fields, duplicate records, status values, relationship references, safe delete blockers, and tenant/platform boundaries.
- Frontend validation must mirror required backend checks enough to show clear missing-field banners before submit.
- Every create, update, delete, force delete, suspend, restore, enable, disable, and high-risk lifecycle action must be audited.
- Database backup and restore actions must be Super Admin only, auditable, and queue-backed. Restore must default to a sandbox database and must never restore over a live master or tenant database from the UI.
- Show pages should expose activity/history for the selected record.
- Financial records must be auditable.
- Compliance records must be traceable.
- Deletions should usually be soft deletes for business records.
- Numbering systems must be predictable and recoverable.
- Imports must validate before writing.
- Exports must follow permission rules.

## Integration Rules

- External credentials must be encrypted.
- Integration calls must be logged.
- Failed integration calls must be retryable where safe.
- Webhooks must verify authenticity.
- Messages sent to WhatsApp, Telegram, mail, or other channels must respect user approval and tenant policy.

## AI Rules

- AI must not become a backdoor around permissions.
- AI actions should be auditable.
- AI predictions must be labeled as estimates.
- AI-generated business actions need confirmation.
- AI development suggestions must respect `assist/` architecture notes.

## Vibe Coding Rules

- Fast changes must still preserve tenant isolation.
- CODEIT should read nearby product and architecture notes before significant work.
- Small focused changes are preferred.
- Assumptions must be stated when business rules are unclear.
- Generated code should be reviewed against quality gates before release.

## Authentication And Domain Rules

- `app.codexsun.com` and the `codexsun.com` apex are shared application domains; Corporate ID is mandatory there for tenant login.
- Custom tenant domains require ownership verification and an active mapping before they may resolve a tenant. The server selects the mapped tenant without Corporate ID input; any supplied Corporate ID must match that tenant.
- Verify the host, tenant selector (Corporate ID on shared hosts, verified mapping on custom hosts), tenant status, tenant database secret, and tenant user before creating a session. Unknown hosts cannot fall back to a supplied Corporate ID.
- Browser sessions are encrypted, HttpOnly, Secure, SameSite Strict, host-only, and revocable. Browser-readable JWT storage is forbidden. The only exception to Secure is an explicit `AUTH_COOKIE_SECURE=0` on a plain-HTTP LAN install; it must never be set on an internet-facing deployment.
- A new login replaces the current browser principal and clears old tokens, cookies, tenant context, and query caches.
- Request tenant headers are inputs only at the edge; authenticated server claims and registry data must overwrite them before module routes execute.
- Safe per-session metadata may be cached, but permissions, authorization outcomes, credentials, and secrets must always be resolved from authoritative server state.

## Component documentation

Each component and external add-on integration guide has a README that explains its purpose and public contract.
Add plans, tasks, and agent guidance only when they help the work. Preserve useful existing documents.
Update documentation when contracts, ownership, operations, or documented behavior change.
Documentation does not grant runtime permissions. Zetro's runtime `apps/zetro/agent/SKILLS.md` remains required.
Keep its loader, build collector, backend permissions, and tests in agreement.
Run component documentation checks for documentation changes and repository-wide verification.
The root `npm run check` remains the full CI and release gate.
