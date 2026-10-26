# Framework

## Component documentation

Shared transport, configuration, database, environment, error, event, health, logging, module, queue, and storage contracts.

Keep this package free of app-owned fields and business CRUD. Expose intentional public contracts. Preserve runtime and source export resolution and root output paths.

`MigrationBatch.resolveSteps` optionally resolves an owner's steps from immutable `MigrationLedgerEntry` metadata for that scope.
The runner reads and resolves the scope ledger inside its existing advisory lock, before any migration-step write.
Owner callbacks cannot change checksum semantics. The runner still validates each applied version and checksum and skips it without rewriting its ledger row.
Owners define historical manifests and reject unsupported histories. Framework contains no app-specific lineage rules.

- [TASK.md](agent/TASK.md): work items and acceptance evidence.
- [PLAN.md](agent/PLAN.md): scope, ownership, delivery order, and verification gates.
- [SKILLS.md](agent/SKILLS.md): component working rules and safety constraints.

### Source inventory

- `src/`: `addons`, `api`, `config`, `db`, `env`, `errors`, `events`, `health`, `http`, `logger`, `modules`, `queue`, `storage`.

This inventory records source presence. It does not certify a deployed feature.

### Workspace verification

Run these commands from the repository root. Use the root installation and `dist` output tree.

- `npm run typecheck -w @codexsun/framework`
- `npm run lint -w @codexsun/framework`
- `npm run build -w @codexsun/framework`

Run `npm run check:component-docs` to verify the required documentation files.
Run the relevant app tests and root release gates when implementation changes.
Report database, browser, native, and deployment checks separately.

### Workspace packages

- `.`: `@codexsun/framework`.

### Declared internal dependencies

This owner declares no internal workspace dependency in its package manifests.

### Public package entry points

- `@codexsun/framework`: `.`, `./api`, `./addons`, `./config`, `./db`, `./env`, `./errors`, `./events`, `./health`, `./http`, `./logger`, `./modules`, `./queue`, `./storage`.
