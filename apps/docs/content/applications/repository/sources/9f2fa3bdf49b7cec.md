# CODEXSUN Assist Pack

Repository source: `assist/README.md`

Source SHA-256 (LF line endings): `5442071f93e9cd5108b6a9e4319bdb2bb6cec86c2f4bcf2940de905db841de1e`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

````markdown
# CODEXSUN Assist Pack

## Working Repository

The canonical local project repository is `D:\workspace\codexsun`.
Use it as the root for planning, implementation, verification, and release
work. Older CODEXSUN/CODEXSUN checkouts outside `D:\workspace\codexsun` are not
project references.

## Purpose

CODEXSUN is a SaaS business application platform for multi-tenant, multi-industry, multi-app, multi-port, and
multi-container business systems inside one codebase.

This `assist/` folder is the working knowledge base for humans and AI agents who plan, design, review, and build
CODEXSUN. It contains product scope, architecture principles, module boundaries, agent behavior rules, versioning notes,
and change history.

The goal is to keep the platform clean, scalable, modular, and understandable while supporting many industries,
deployment styles, customizations, and online/offline business workflows.

Agents should inspect only the relevant reference before changing authentication screens, global loading states, workspace shell
behavior, super-admin flows, tenant desk flows, or shared design-system primitives. Copy the intent and interaction
rhythm into CODEXSUN through `@codexsun/ui`; do not paste unrelated business logic or old module boundaries blindly.

## Development Standards

Agents read these standards only when the task changes the listed concern, or when the user requests planning, audit, release, or documentation work:

- Current repository inventory and latest work update: `assist/documentation/project-inventory.md`
- UI and backend module standard: `assist/documentation/design-system-helper.md`
- App/backend/frontend bundle structure: `assist/documentation/app-bundle-structure.md`
- Governance rule book: `assist/governance/rules.md`
- Changelog and version state: `assist/documentation/CHANGELOG.md`

For every new, migrated, or refactored CRUD module, load `assist/SKILL.md` and follow the `Mandatory Module-Owned CRUD Pattern` in the governance rule book. Country, State, District, City, and Pincode are the reference implementation tone: consistent roles and interactions with independently owned business code, never a generic or centralized entity engine.

Strict business app module folders:

```text
apps/{app}/api/src/modules/{module}/
apps/{app}/web/src/modules/{module}/
apps/{app}/web/src/shared/
```

Use `web/src/shared` only for cross-module app-web code; keep module-specific business forms, lists,
settings, print views, services, hooks, schemas, types, tests, and page orchestration inside the owning app web module.
Keep reusable design controls in `packages/ui`.

Strict workspace dependency and output layout:

- Use npm only and run dependency commands from the repository root.
- Keep exactly one root `node_modules` and one root `package-lock.json`; never install dependencies inside a workspace.
- Keep generated builds only in the root `dist`; nested `node_modules`, `dist`, and `dist-types` folders are prohibited.
- Run `npm run dependencies:check` when the change can affect dependency layout.

## Product Vision

CODEXSUN should become a business operating platform where each customer receives an isolated, customizable system that
matches their industry, billing flow, compliance needs, and growth stage.

It must support:

- Multi-tenant SaaS with strong tenant isolation.
- One database per tenant where required.
- Multiple industries from the same codebase.
- Multiple business apps connected as plug-and-play modules.
- Online, offline, and sync-enabled workflows.
- Centralized design system, authentication, accounting, billing, tasks, mail, activities, notifications, and
  integrations.
- Indian accounting, GST, e-invoice, e-way bill, and compliance-first business operations.
- Desktop, web, and mobile experiences.
- AI business assistance through ZERO.

## Core Architecture Direction

CODEXSUN follows a scalable modular monolith architecture with Domain-Driven Design, event-driven workflows, queue
management, offline synchronization, and deployable container boundaries.

The codebase should feel like one product, but each app and industry domain must have clear boundaries so it can be
developed, tested, activated, deployed, and extended independently.

Primary architecture ideas:

- Modular monolith first, distributed deployment ready.
- Domain-Driven Design for business areas.
- Event-driven communication between modules.
- Queue-backed background processing.
- Tenant-aware data access everywhere.
- Offline-first capable modules where business flow requires it.
- Runtime subscription and feature activation.
- Industry-specific modules layered on top of shared platform services.
- Plugin-style app and integration registration.
- Centralized UI and experience standards.

Enterprise architecture ideas:

- Dedicated tenant databases where needed.
- Optional dedicated containers for large tenants.
- Multi-company, multi-branch, warehouse, counter, and device-aware design.
- Strong audit, backup, restore, monitoring, and support workflows.
- Observable APIs, queues, events, sync, integrations, and AI tools.
- Quality gates for planning, build, review, release, and hotfixes.

## Supported Industries

CODEXSUN must support multiple industries through industry packs. Initial examples include:

- Software services and product companies.
- Garments manufacturing.
- Garments billing and retail.
- uPVC manufacturing and sales.
- Offset printing.
- POS billing.
- General trading and distribution.
- Service billing.
- Other future industries through extension packs.

Each industry can define its own:

- Workflows.
- Billing rules.
- Tax and compliance behavior.
- Documents and print formats.
- Masters and transactions.
- Reports and dashboards.
- Role permissions.
- Offline needs.
- Integrations.

## Platform Apps

CODEXSUN should include common platform apps that are shared across industries:

- Authentication and identity.
- Tenant management.
- User, role, and permission management.
- Subscription, activation, and license control.
- Common master data.
- Mail and notification center.
- Task manager.
- Activities and audit trail.
- Calendar and reminders.
- File and document management.
- External API management.
- Integration hub.
- WhatsApp integration.
- Telegram integration.
- Billing engine.
- Accounting engine.
- Compliance engine.
- Reporting and analytics.
- Offline sync manager.
- Queue and job manager.
- AI assistant layer.

## Tenant Model

Every tenant must be treated as an isolated business unit.

Tenant isolation requirements:

- Each tenant has its own identity, settings, users, roles, subscriptions, features, and customizations.
- Each tenant can have a dedicated database where needed.
- Tenant context must be explicit in backend, frontend, queues, jobs, events, logs, and integrations.
- No module may read or write business data without tenant context.
- Tenant-specific configuration must not leak into global platform configuration.
- Tenant data export, backup, restore, and migration should be planned from the beginning.

## Customization Model

Each tenant may need custom business behavior without damaging the platform core.

Customization should be handled through:

- Feature flags.
- Runtime settings.
- Industry configuration.
- Tenant overrides.
- Plugin modules.
- Custom forms and fields.
- Custom print templates.
- Custom workflows.
- Custom reports.
- Integration adapters.

Avoid direct tenant-specific changes inside shared platform code unless the change is promoted into a generic extension
point.

## Offline And Sync

CODEXSUN must support offline-to-online workflows for desktop, web where possible, and mobile.

Offline support should cover:

- Local data cache.
- Tenant-scoped offline store.
- Sync queue.
- Conflict detection.
- Conflict resolution rules.
- Retry and recovery.
- Audit history.
- Background sync.
- Clear user status for pending, synced, failed, and conflicted records.

Offline sync must be designed per module. Accounting, inventory, billing, and compliance records need stricter rules
than simple task or note records.

## Billing And Accounting

Billing is centralized but industry-aware.

The billing engine must support:

- Industry-specific invoice flows.
- GST invoices.
- e-Invoice.
- e-Way bill.
- POS billing.
- Garments billing.
- Manufacturing billing.
- Service billing.
- Credit notes and debit notes.
- Payment tracking.
- Print formats.
- Round-off, discounts, tax slabs, and charges.

Accounting should be Tally-like and suitable for Indian businesses.

Accounting must support:

- Ledgers.
- Groups.
- Vouchers.
- Journals.
- Receipts.
- Payments.
- Contra.
- Sales and purchase accounting.
- GST reports.
- Trial balance.
- Balance sheet.
- Profit and loss.
- Cash flow.
- Bank reconciliation.
- Financial year handling.
- Audit trail.
- Compliance exports.

## AI Strategy

CODEXSUN has two AI assistants with different purposes.

CODEIT is a personal development assistant for planning, writing, reviewing, and improving code. It should support
multiple modes and multiple models through a clean interface.

ZERO is a business companion inside CODEXSUN. It helps users understand business data, find records, summarize activity,
detect risks, predict trends, and recommend actions.

Both assistants must follow tenant security, permission rules, audit requirements, and clear boundaries.

## Technology Pack

Preferred technology stack:

- Node.js.
- TypeScript.
- Fastify.
- React.
- Tailwind CSS.
- shadcn/ui.
- TanStack Query.
- TanStack Table.
- MariaDB.
- Docker.
- Tauri 2 and Rust with WebView2 for Windows desktop.
- Capacitor for future Android and iOS hosts that reuse the React UI.

Technology choices should support modular development, type safety, clean boundaries, scalable deployment, offline
workflows, and developer productivity.

## Technology Change Discipline

Agents must not silently override the selected technology stack, package manager, runtime, framework, database, UI
system, or tooling. If a user command appears to conflict with the current stack, uses the wrong tool name, or creates
doubt about the intended technology choice, the agent must ask the user before changing direction.

Do not substitute package managers. Use the package manager requested by the user for that task, and use the
repository's declared package manager when the user does not specify one.

## Enterprise Standard

CODEXSUN should be enterprise-ready without becoming heavy for small customers.

Enterprise readiness means:

- Secure tenant isolation.
- Permission-aware workflows.
- Audit trails for important activity.
- Reliable billing, accounting, and compliance records.
- Recoverable queues and integrations.
- Tested backup and restore.
- Clear release and support process.
- Performance planning for large tenants.
- Observability across runtime services.
- AI assistants governed by the same rules as the application.

## Vibe Coding Standard

Vibe coding is allowed and encouraged when it stays inside the CODEXSUN guardrails.

Good vibe coding means:

- Clear intent before changes.
- Small-focused edits.
- Existing patterns first.
- Tenant, permission, subscription, and offline impact checked.
- Verification is proportional to risk and every skipped check is reported explicitly.
- Docs updated only when the user asks, or when product meaning, a contract, architecture, or release changes.
- Clean summary after work.

Use `assist/AGENT-GUIDE.md` as the working standard for AI-assisted development. Open specialized documents only when the task touches their subject.

## Folder Guide

- `assist/AGENT-GUIDE.md`: Authoritative execution and module-ownership notes for agents.
- `assist/SKILL.md`: Portable CODEXSUN module-owner skill for agents on every computer.
- `assist/README.md`: Product and architecture overview.
- `assist/blueprint/`: Practical pre-coding blueprint and captured decisions.
- `assist/documentation/`: Active release changelog, current project inventory, and future customer/developer documentation.
- `assist/product/`: Product scope, domain map, industry model, and feature planning.
- `assist/architecture/`: Architecture decisions, boundaries, tenancy, data, security, events, queues, sync, and
  deployment notes.
- `assist/industries/`: Industry-specific planning notes.
- `assist/agents/`: Instructions for CODEIT, ZERO, and other future agents.
- `assist/operations/`: Tech stack, versioning, releases, environment, deployment, and support notes.
- `assist/governance/`: Active rules, API guidelines, engineering standards, decisions, glossary, and quality gates.

## Recommended Reading Order For Agents

1. `assist/AGENT-GUIDE.md`
2. `assist/governance/rules.md`
3. The owning module and its composition points.
4. The specialized Assist document routed by the guide when relevant.

Do not load every planning, product, architecture, and operations file for routine work. Read progressively from the authoritative guide to the documents required by the task.

## Working Principle

CODEXSUN should stay simple at the center and flexible at the edges.

Shared platform services should be stable and predictable. Industry modules, tenant customizations, integrations, and AI
tools should extend the platform without breaking the core.
````
