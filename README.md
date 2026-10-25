# CODEXSUN

**A modular, self-hosted platform for business applications.**

[![Repository checks](https://github.com/CODEXSUN/codexsun/actions/workflows/ci.yml/badge.svg)](https://github.com/CODEXSUN/codexsun/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

CODEXSUN brings tenant administration, business modules, and developer tools into one npm workspace repository.
The Platform API and web shell compose application packages with shared Framework and UI packages.

[Documentation](#documentation) · [Quick start](#quick-start) · [Contributing](#contributing) · [Report an issue](https://github.com/CODEXSUN/codexsun/issues) · [Changelog](assist/documentation/CHANGELOG.md)

## Project status

CODEXSUN is under active development. Application maturity varies, and some desks provide foundations for future workflows.
Repository versions identify source baselines. A version number alone does not establish production readiness or feature completeness.

Read the [changelog](assist/documentation/CHANGELOG.md) for validation results and known limitations.
Check [GitHub Actions](https://github.com/CODEXSUN/codexsun/actions/workflows/ci.yml) for the status of each revision.

## What is included

- **Platform:** tenant registration, authentication, app activation, permissions, administration, and database operations.
- **Business applications:** Core masters, Billing, Accounts, CRM, Ecommerce, Mail, Notes, Chat, and other app packages.
- **Specialized applications:** HRMS, Himsx, Q Cafe, Sites, and integration packages, with different implementation scopes.
- **Documentation and assistants:** the Docs library, Zetro, and Zuno developer tools.
- **Shared packages:** a TypeScript Framework and React UI controls for module-owned applications.
- **Additional clients:** Windows desktop hosts and selected Flutter mobile applications with separate toolchain requirements.

Most business modules run inside the composed Platform API and web shell.
An application folder does not necessarily represent an independently deployable service.
App access depends on Plan Access, tenant Entitlements, and backend permissions.

See the [project inventory](assist/documentation/project-inventory.md) and each application's documentation for its implemented scope.

## Contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Development commands](#development-commands)
- [Docker deployment](#docker-deployment)
- [Repository structure](#repository-structure)
- [Architecture](#architecture)
- [Checks and tests](#checks-and-tests)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Support and bug reports](#support-and-bug-reports)
- [Security](#security)
- [Versions and releases](#versions-and-releases)
- [License](#license)

## Requirements

For local web and API development:

| Requirement      | Repository configuration                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Git              | Clone this repository and submit changes through pull requests.                                         |
| Node.js          | `>=26.5.0`, as declared in `package.json`.                                                              |
| npm              | `>=12.2.0`; the declared package manager is `npm@12.2.0`.                                               |
| MariaDB          | A reachable server. The container baseline uses MariaDB 11.8.                                           |
| Database account | Credentials with permission to create and migrate the configured local master and tenant databases.     |
| Redis            | Required when using the `bullmq-redis` queue backend. The development template selects database queues. |

Run npm commands from the repository root. Use the root `package-lock.json` and one root `node_modules` installation.

Docker deployment requires Docker Engine or Docker Desktop with Compose v2 and Bash.
Windows desktop and Flutter mobile builds require additional SDKs. See their [client guides](#documentation).

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/CODEXSUN/codexsun.git
cd codexsun
npm ci
```

### 2. Prepare the development environment

Copy `.env.example` to `.env` with your editor or shell.

Bash:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` before starting configuration:

- Set `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` for your local MariaDB server.
- Set different names for `DB_MASTER_NAME` and `DEFAULT_TENANT_DB_NAME`.
- Review `PLATFORM_WEB_ORIGIN`, the port settings, storage paths, and tenancy mode.
- For a local seeded tenant, fill the `DEFAULT_TENANT_*` identity and administrator settings.
- Choose your local bootstrap administrator settings. There are no published default login credentials.
- Keep database reset flags disabled for normal startup.

The development sample enables `ENABLE_DEFAULT_TENANT_SEED=1` for local testing.
Set it to `0` when you do not want the test tenant seed.

Run the interactive configurator in a terminal:

```bash
npm run env:configure
npm run env:check
```

The configurator generates a missing JWT secret and prompts for credentials.
It validates the complete template, so fill any remaining required values reported by the command.
It does not install MariaDB or create database user grants.

### 3. Start development

Start MariaDB, then run:

```bash
npm run dev
```

Normal API startup bootstraps the configured database and applies the configured seeds.
The supervisor starts Platform, Ecommerce, Q Cafe web, UIUX, and Project Manager services.
Single-tenant mode also starts the local Q Cafe API.
Each service has its own health checks and restart handling.

| Service         | Default local address                     |
| --------------- | ----------------------------------------- |
| Platform web    | <http://127.0.0.1:7020>                   |
| Platform API    | <http://127.0.0.1:7010>                   |
| Ecommerce shop  | <http://127.0.0.1:7030/shop>              |
| UIUX gallery    | <http://127.0.0.1:7040/uiux/main-layouts> |
| Project Manager | <http://127.0.0.1:7050/registry>          |
| Q Cafe web      | <http://127.0.0.1:5180/qcafe/>            |

These addresses use the sample ports. Your `.env` determines the actual ports and canonical web origin.
Use a hostname that resolves to your development machine when you configure a custom origin.
Tenant login requires the configured Corporate ID and tenant user credentials.

## Configuration

| File                                                           | Purpose                                       |
| -------------------------------------------------------------- | --------------------------------------------- |
| [`.env.example`](.env.example)                                 | Shareable template for local development.     |
| `.env`                                                         | Private development settings. Ignored by Git. |
| [`.container/deploy.env.sample`](.container/deploy.env.sample) | Shareable container deployment template.      |
| `.container/deploy.env`                                        | Private container settings. Ignored by Git.   |

Container scripts read `.container/deploy.env`. They do not copy development settings from `.env`.
Never commit real passwords, API keys, private signing keys, database dumps, or tenant data.

### Tenancy

- `CODEXSUN_TENANCY_MODE=multi` supports multiple registered tenants with separate tenant databases.
- `CODEXSUN_TENANCY_MODE=single` requires `CODEXSUN_SINGLE_TENANT_CORPORATE_ID` and exactly one active registered tenant.
- Single mode still uses tenant-scoped sessions and a tenant database.
- When default tenant seeding is enabled in single mode, its Corporate ID must match the configured single tenant.

Restart the API after changing tenancy mode.
See [tenant isolation](assist/architecture/tenant-isolation.md) for the complete contract.

### Database changes

Use the [database migration runbook](assist/operations/database-migration-runbook.md) for existing databases.
The available commands include:

```bash
npm run db:migrations:list
npm run db:migrations:preflight
npm run db:migrations:run
npm run db:seed
```

These commands target the databases selected by your environment.
Production migration preflight requires a verified backup.

## Development commands

| Command                        | Purpose                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `npm run dev`                  | Start the supervised development services.                                              |
| `npm run dev:api`              | Start only the Platform API watcher.                                                    |
| `npm run dev:web`              | Start only Platform web after the API becomes healthy.                                  |
| `npm run dev:ecommerce`        | Start the Ecommerce frontend.                                                           |
| `npm run dev:qcafe`            | Start Q Cafe development services.                                                      |
| `npm run dev:uiux`             | Start the UI gallery.                                                                   |
| `npm run dev:project-manager`  | Start the Project Manager frontend.                                                     |
| `npm run build`                | Build the repository and collect output under root `dist`.                              |
| `npm run start:api:production` | Start the built Platform API with production package resolution.                        |
| `npm run dependencies:check`   | Verify the root dependency and generated-output layout.                                 |
| `npm run clean:dist`           | Clear generated output after stopping development servers and builds.                   |
| `npm run clean:cache`          | Remove only disposable caches and temporary files. Keep build outputs and dependencies. |

### Cache-only cleanup

Run `npm run clean:cache -- --dry-run` to preview cleanup. Run `npm run clean:cache` to apply it.
The command removes only `dist/.cache`, `dist/.tmp`, and the root dependency caches `.cache`, `.vite`, and `.vite-temp`.
It preserves other `dist` content, installed packages, source files, lockfiles, and application storage.
It rejects arbitrary paths and refuses symbolic links or junctions in cleanup targets before deletion.
Close tools that use these caches before cleanup. The command refuses cleanup while a registered development launcher is running.
It reports locked files and exits with an error if removal fails.
It does not stop processes. Active tools can recreate caches after cleanup.
Run cleanup after builds and checks. For the last cleanup without npm logging, use `node tools/clean-repository-cache.mjs`.
Run `npm run test:cleanup` to verify preservation, preview mode, repeat cleanup, and link protection.

Use one runner per service. Development startup leaves existing listeners and launchers running by default.
Set `CODEXSUN_DEV_PORT_POLICY=takeover` only when you intend to replace an existing CODEXSUN runner.

Use root build and mobile commands to keep generated files under `dist`.
Avoid simultaneous builds because workspaces share the root output tree.
See [package.json](package.json) for all commands.

## Docker deployment

From the repository root:

```bash
bash setup.sh --configure
bash setup.sh
```

The first command explicitly configures private VPS settings. The second installs the versioned v1 deployment.
The stack includes API, Web, Shop, MariaDB, and Redis. Worker and Chatb are optional. Media and Frappe remain separate.
A Linux deployment host can use the declared Docker Node image without a host Node.js installation.

Deployment commands target a Linux VPS and reject development workstations.

Before applying an existing deployment update:

```bash
bash update.sh --check
```

To apply the reviewed update:

```bash
bash update.sh
```

Use the [internal deployment guide](.container/docs/DEPLOYMENT.md) for ports, persistent volumes, backups, migrations, and recovery.
Provision unique credentials and verify restore procedures before storing production data.

## Repository structure

```text
apps/
  platform/           # Composed API, web shell, and Windows host
  core/               # Shared business masters and organization modules
  billing/            # Billing application modules
  crm/                # CRM API, web, and mobile modules
  ...                 # Other application packages and clients
devkits/
  project-manager/    # Project registry and development workflows
  uiux/               # UI component gallery
  zuno/               # Developer diagnostics
packages/
  framework/          # Backend and runtime infrastructure
  ui/                 # Shared React controls and layouts
tools/                # Checks, builds, environment, and release commands
assist/               # Architecture, governance, operations, and changelog
.container/           # Container deployment and environment templates
.github/              # CI, release workflows, and dependency updates
```

## Architecture

CODEXSUN uses a modular monolith with explicit application and module ownership.

- Each business module owns its migrations, persistence, validation, routes, and frontend behavior.
- Composition roots register modules through their public contracts.
- Shared Framework and UI packages provide infrastructure and reusable controls.
- Tenant database selection isolates tenant business data.
- Backend checks enforce permissions, protected records, and relationship rules.
- Browser sessions use encrypted HttpOnly cookies. Prompts and tenant settings cannot grant backend capabilities.

Read the [module-boundary rules](assist/architecture/module-boundaries.md) before adding or moving module code.
Read the [UI/form guardrails](assist/devops/ui-form-regression-guardrails.md) before changing shared forms or lookups.

## Checks and tests

Run the standard checks from the repository root:

```bash
npm run check
npm run build
npm run dependencies:check
npm run check:versions
```

`npm run check` covers module boundaries, boundary regression tests, add-on packages, documentation, TypeScript, and lint.
Check formatting separately with `npm run format:check`.

Run the relevant additional suites for your change:

```bash
npm run test:docs
npm run test:product-stacks
npm run test:deployment-env
npm run test:dev-stack
```

Database E2E suites require configured local databases and credentials.
Review the relevant script and environment before running a database test.
The [CI workflow](.github/workflows/ci.yml) records the shared automation gates.

## Documentation

| Guide                                                                  | Use it for                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| [Agent and contributor guide](assist/AGENT-GUIDE.md)                   | Repository conventions and required checks.       |
| [Governance rules](assist/governance/rules.md)                         | Architecture, data, UI, and security constraints. |
| [Project inventory](assist/documentation/project-inventory.md)         | Application and package context.                  |
| [Container deployment](.container/docs/DEPLOYMENT.md)                  | Internal installation, updates, and recovery.     |
| [Database migrations](assist/operations/database-migration-runbook.md) | Migration preflight, execution, and rollback.     |
| [Docs application](apps/docs/README.md)                                | Developer Library and documentation authoring.    |
| [Windows client](apps/platform/windows/README.md)                      | Desktop setup and packaging.                      |
| [CRM mobile](apps/crm/mobile/README.md)                                | CRM Flutter development.                          |
| [CODEXSUN mobile](apps/codexsun/mobile/README.md)                      | CODEXSUN Flutter development.                     |
| [Q Cafe](apps/qcafe/README.md)                                         | Q Cafe architecture and clients.                  |
| [Versioning](assist/operations/versioning.md)                          | Changelog, version, commit, and release rules.    |
| [Changelog](assist/documentation/CHANGELOG.md)                         | Versioned changes and verification limits.        |

## Contributing

Bug reports, documentation improvements, and focused pull requests are welcome.

1. Search existing issues and pull requests before starting work.
2. Open an issue to discuss substantial changes or new application behavior.
3. Fork the repository and create a branch for your change.
4. Read the [contributor guide](assist/AGENT-GUIDE.md), [governance rules](assist/governance/rules.md), and the owning module's documentation.
5. Keep changes within the owning module and update the relevant documentation.
6. Add tests when behavior changes and run the applicable checks.
7. Open a pull request with the problem, change, test results, and any database migration requirements.

Keep unrelated changes out of your pull request. Report checks that you could not run.
Update the current changelog entry for meaningful work. Version bumps require an explicit release decision.

For Zetro changes, also read its [agent guide](apps/zetro/agent/README.md) and [runtime business rules](apps/zetro/agent/skills.md).
Treat other contributors respectfully and keep reviews focused on the work.

## Support and bug reports

Use [GitHub Issues](https://github.com/CODEXSUN/codexsun/issues) for reproducible bugs, feature requests, and setup questions.
Include:

- The commit or version and your operating system.
- Node.js/npm versions or Docker/Compose versions.
- Steps to reproduce, expected behavior, and actual behavior.
- Relevant logs with secrets and personal or tenant data removed.

Community support has no guaranteed response time.
For security concerns, follow the private-contact guidance below.

## Security

Do not publish vulnerability details, credentials, or customer data in public issues or pull requests.

GitHub private vulnerability reporting is currently disabled for this repository, and no dedicated security contact is published here.
If you find a vulnerability, request a private reporting channel from the maintainers without disclosing technical details publicly.
If private reporting becomes available, use the repository's [Security page](https://github.com/CODEXSUN/codexsun/security).

Production operators must configure HTTPS, protect environment files, maintain backups, and review enabled integrations.
See the [governance rules](assist/governance/rules.md) for tenant isolation and authentication requirements.

## Versions and releases

Workspace packages use lockstep `<major>.<minor>.<patch>` versions.
Release tags use `v-<major>.<minor>.<patch>`.
See [versioning and releases](assist/operations/versioning.md) for independent product-stack tags and signing requirements.

Use the [changelog](assist/documentation/CHANGELOG.md) for release notes and [GitHub Releases](https://github.com/CODEXSUN/codexsun/releases) for published artifacts.
A repository version does not imply that an installer or signed release exists.

## License

This repository includes the [GNU General Public License, version 3](LICENSE).
Review the license before using, modifying, or distributing the software.
Third-party dependencies remain subject to their respective licenses.

## Component documentation index

Every component owns a README and `agent/TASK.md`, `agent/PLAN.md`, and `agent/SKILLS.md`.

| Component        | Owner guide                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| Accounts         | [apps/accounts/README.md](apps/accounts/README.md)                     |
| Auditor          | [apps/auditor/README.md](apps/auditor/README.md)                       |
| Billing          | [apps/billing/README.md](apps/billing/README.md)                       |
| Chat             | [apps/chat/README.md](apps/chat/README.md)                             |
| CODEXSUN         | [apps/codexsun/README.md](apps/codexsun/README.md)                     |
| Core             | [apps/core/README.md](apps/core/README.md)                             |
| CRM              | [apps/crm/README.md](apps/crm/README.md)                               |
| Docs             | [apps/docs/README.md](apps/docs/README.md)                             |
| Ecommerce        | [apps/ecommerce/README.md](apps/ecommerce/README.md)                   |
| Frappe           | [apps/frappe/README.md](apps/frappe/README.md)                         |
| HIMSX            | [apps/himsx/README.md](apps/himsx/README.md)                           |
| HRMS             | [apps/hrms/README.md](apps/hrms/README.md)                             |
| LogicX ERP       | [apps/logicx-erp/README.md](apps/logicx-erp/README.md)                 |
| Mail             | [apps/mail/README.md](apps/mail/README.md)                             |
| Notes            | [apps/notes/README.md](apps/notes/README.md)                           |
| Platform         | [apps/platform/README.md](apps/platform/README.md)                     |
| QCafe            | [apps/qcafe/README.md](apps/qcafe/README.md)                           |
| Sites            | [apps/sites/README.md](apps/sites/README.md)                           |
| Zetro            | [apps/zetro/README.md](apps/zetro/README.md)                           |
| Framework        | [packages/framework/README.md](packages/framework/README.md)           |
| UI               | [packages/ui/README.md](packages/ui/README.md)                         |
| Project Manager  | [devkits/project-manager/README.md](devkits/project-manager/README.md) |
| UIUX             | [devkits/uiux/README.md](devkits/uiux/README.md)                       |
| Zuno             | [devkits/zuno/README.md](devkits/zuno/README.md)                       |
| Hostinger Deploy | [tools/hostinger-deploy/README.md](tools/hostinger-deploy/README.md)   |
| Version Tools    | [tools/version/README.md](tools/version/README.md)                     |
| Blog add-on      | [addons/blog/README.md](addons/blog/README.md)                         |

Run `npm run check:component-docs` to check all owners and external add-on integration guides.
