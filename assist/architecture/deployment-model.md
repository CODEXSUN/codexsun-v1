# Deployment Model

## Supervisor Ownership

The [release supervisor](../agents/release-supervisor.md) owns Git integration and versioned release checkouts.
App chats remain in their assigned worktrees and supply implementation and verification handoffs.
Production promotion requires separate explicit approval. Supervisor Git authority does not authorize deployment or npm installation.

## Release Promotion Policy

Follow [Worktree And Version Release Workflow](../operations/worktree-release-workflow.md).
Integrate app worktrees into reviewed `main`, then prepare a frozen versioned candidate.
Build candidate images once, test staging, and promote the approved digests to production after explicit authorization.
Staging must use separate data, queues, storage, secrets, and integration settings.
The current VPS updater still builds source. Immutable image promotion requires a separate implementation task.
This policy does not authorize deployment or create additional app containers.

## Deployment Goal

CODEXSUN should support flexible deployment while keeping development simple.

The platform should run as a modular monolith by default, with container boundaries prepared for scaling and tenant-specific deployment needs.

Local testing and cloud deployment should follow the same strict rules and service boundaries wherever practical.

## Runtime Surfaces

- Web application.
- API server.
- Background workers.
- Queue processor.
- Scheduler.
- Windows desktop app through a Tauri 2/Rust shell and WebView2.
- Mobile app through a future Capacitor host for the shared React UI.
- Tenant databases.
- File storage.
- Integration services.

## Multi-Port And Multi-Container Direction

Different runtime parts may run on different ports and containers:

- Frontend web app.
- Backend API.
- Worker service.
- Scheduler service.
- Tenant database containers.
- Local development services.
- Integration bridge services where needed.

## App Bundle Containers

CODEXSUN should support product bundles where each container/deployment includes its own backend, frontend, workers, and selected app packages while still sharing framework, platform, and UI packages from the same codebase.

Examples:

```text
billing-suite
  shared packages
  framework
  platform
  core
  billing

crm-suite
  shared packages
  framework
  platform
  core
  crm

```

Each bundle may eventually have its own API, Web, and Worker images:

```text
docker/
  billing/
    api.Dockerfile
    web.Dockerfile
    worker.Dockerfile

  crm/
    api.Dockerfile
    web.Dockerfile
    worker.Dockerfile

```

The source code remains app-owned and modular. Containers bind selected apps and shared packages together.

The executable local product stacks use the same composition contract:

```text
framework + platform + core + billing = billing stack
```

The active VPS container contract lives under `.container/codexsun-v1`.
Root setup and update commands select API, Web, Shop, and optional Worker/Chatb images from that contract.
MariaDB and Redis retain their definitions under `.container/database`. Existing infrastructure remains persistent.
Media is retained separately and Frappe setup is deferred. Neither is installed or bound by this contract.
Updates verify backups before GitHub source changes, builds, migrations, and application replacement.
Read the internal `.container/docs/DEPLOYMENT.md` guide for ownership, version, checksum, and rollback guards.

Platform supplies identity, tenant, permission, activation, audit, queue, storage, and operational
services. Core supplies tenant-owned common masters through fixed public contracts. Billing remains
the owner of invoices and financial documents. A stack is a deployment composition, not a shared
business CRUD boundary.

### Development runtime boundary

The root development command owns only Platform API `7010` and Platform Web `7020`. Core, Billing,
Mail, Framework, and UI are npm workspace packages composed into those two processes. No product
package may introduce a standalone API or web listener.

Codeit is an explicitly separate developer-kit shell, like the UIUX gallery.
`npm run dev:codeit` starts its loopback web listener on `CODEXSUN_CODEIT_WEB_PORT`, default 7070.
The Platform stack does not start it. Codeit runs without Platform API or Web.
Platform registers its optional catalog entry and read-only tenant launch pages only.
Codeit has no tenant data, authentication, filesystem, or command execution capability in this shell release.
For a separately hosted Codeit site, configure `CODEXSUN_CODEIT_WEB_URL` before building Platform Web.
Its static build output is `dist/devkits/codeit`.

Changing Framework, Platform, Core, or another public foundation contract is intentionally wider work:
`npm run stack:impact -- <changed files>` lists every product verification gate that must run. A change
to shared foundation code impacts all product stacks.

### Composed live releases

Workspace package versions remain lockstep for repository compatibility. Product changes preserve
their owned database and module boundaries, but deployment replaces the composed Platform API and
Platform Web services declared by `tools/product-stack-contract.mjs`. Use
`npm run stack:plan -- billing` to print the verification, database, rollout, and rollback boundary.

Production rollout must use an inactive/blue-green slot or a rolling replacement with readiness and
health gates. Traffic moves only after the new Platform API and web are healthy. Rollback switches
traffic to the previous composed runtime release.
Product database migrations are restricted to the product-owned scope and use expand-contract:
backward-compatible additions deploy first, destructive contraction occurs only after the rollback
window. A migration requiring an immediate destructive change is not independently deployable.

The CODEXSUN guarded updater enforces one release version across source and application image tags,
serializes updates with a host lock, rejects undeclared dirty source, checks backup and Docker disk
capacity, and requires a per-version expand-contract compatibility declaration before production
migration. It retains SHA-256-verified database dumps and deployment metadata containing the source
commit, version, image digests, migration result, timestamp, and backup identity. Application image
rollback never pretends to roll back an already-applied database migration.

Shared public contracts remain explicit between workspace packages. A breaking contract must update
the owner and all composed consumers in the same verified repository release.

## Root Dist Rule

Build output must use the root `dist/` folder as the packaging surface. App-local `dist/` folders should not be treated as final release artifacts.

Expected shape:

```text
dist/apps/platform/api
dist/apps/platform/web
dist/apps/core/api
dist/apps/billing/api
dist/apps/mail/api
dist/packages/framework
dist/packages/ui
```

Root build/dev workflows should clean app-local `.turbo` folders under `apps/` so package outputs and Docker build contexts stay predictable.

## Hosted Platform Runtime

The non-container hosted baseline serves `dist/apps/platform/web` as static files through nginx and runs one compiled
Platform API server under systemd. Production nginx must not proxy the web root to Vite, and hosted services must not
depend on `npm run dev` remaining attached to a shell.

Browser API traffic uses the same-origin `/api/app` path. The Platform API strips this prefix before dispatching
to the owning Platform, Core, Billing, CRM, Mail, and add-on routes. The Platform Vite proxy forwards this path
to Platform API `7010`. Hosted nginx must also forward `/api/app/` to the Platform API. Legacy
`/api/platform`, `/api/core`, and `/api/billing` proxy paths may remain for older clients.
Platform Web is the only browser runtime on `7020`.
Core and Billing retain route ownership inside their packages after composition.

Platform Web receives `/api/app` as its browser API base at startup in development and production. It must never embed a
loopback or container-only API hostname in a cloud browser bundle. `PLATFORM_WEB_ORIGIN` defines the canonical CORS
origin for direct API clients. Wildcard CORS is prohibited because authenticated requests may carry credentials.

The public app portal is a safe tenant projection. Shared navigation, slider, features, updates, and footer components
are rendered by Platform, while tenant-specific content is stored under `tenants.payload_settings.appPortal`. The
exact app hostname must be registered through Tenant Domains; the canonical Platform hostname may resolve the
configured default tenant. A tenant's optional public URL is external content only. Authenticated dashboard Home
actions return to the Platform root on the current app origin.

The maintained baseline configuration and installation commands live under `deploy/hosted/`. The Platform API binds
to loopback behind nginx, restarts automatically after failures, and exposes its existing health endpoint through
`/api/platform/health`. The Platform web build reads client variables from the root `.env`; its dev-server port is not
a production-build requirement.

## Container Rules

- Containers should be replaceable and reproducible.
- Runtime configuration should come from environment variables or secure config.
- Secrets must not be stored in images.
- Logs should be structured.
- Health checks should be available.
- Workers and API should share the same domain contracts.
- Local and cloud containers should use matching contracts, health checks, environment names, and service responsibilities.

## Tenant Deployment Options

Possible tenant deployment models:

- Shared app containers with dedicated tenant database.
- Dedicated app and database containers for selected tenants.
- Hybrid local desktop plus cloud sync.
- On-premise private deployment if business requires it.

### Offline-first Windows client

One Windows installation binds to one tenant and runs packaged React assets with a Tauri 2/Rust host
and a tenant-local SQLite database. It communicates outward to the cloud sync API over HTTPS. The
cloud must not connect directly to the client or require an inbound customer firewall rule. Rust
owns native and synchronization infrastructure; it does not duplicate module business logic. Node.js
remains the cloud runtime and build tool rather than an installed sidecar.

Cloud web is the control plane and auditor/back-office projection. It must show synchronization
freshness and must not present stale replicated data as current local state.

The Windows client ships as a signed current-user NSIS installer. Tauri checks the latest GitHub
`latest.json` feed and accepts only updater-key-signed artifacts. A `v-<version>` Git tag must match
the lockstep repository version before the release workflow can build, Authenticode-sign,
updater-sign, checksum, and publish the package.

## Scaling Direction

Scale in this order:

1. Optimize module and database design.
2. Separate workers from API.
3. Scale read-heavy reporting separately.
4. Add dedicated containers for heavy modules.
5. Split services only when module boundaries are proven.
