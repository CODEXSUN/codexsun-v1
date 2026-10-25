# CODEXSUN Mobile (cxmobile)

## Status and scope

Planning baseline: 25 October 2026. This component contains documentation only.
No React client, Capacitor project, native binary, API change, or mobile verification exists in this component yet.

The user selected a new app named `cxmobile` and requested planning before implementation.
The product display name is CODEXSUN. The implementation uses React, TypeScript, Vite, and Capacitor for Android and iPhone.
Ionic Framework is optional and is not a planned dependency. Reuse `@codexsun/ui` and existing owner screens first.

The target is one installed staff client for CRM, Billing, Chat, and Ecommerce through the composed Platform API.
Include every currently supported workflow in these apps, subject to server permissions and tenant activation.
Do not treat the first delivery slice as the final feature scope.
Customer shopping remains a separate actor surface. Its unfinished order and payment capabilities require their own backend work.

## Ownership

| Owner     | Responsibility                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| cxmobile  | Installed client, mobile shell, app switching, native adapters, lifecycle, distribution, mobile acceptance evidence     |
| Platform  | Authentication, sessions, tenant resolution, permissions, app activation, company/year context, shared client contracts |
| CRM       | CRM screens, fixed resource services, record visibility, work actions, reports, schedules, integration policy           |
| Billing   | Billing screens, calculations, documents, allocation, posting, reports, print contracts                                 |
| Chat      | Channels, membership, messages, attachments, read cursors, realtime authorization                                       |
| Ecommerce | Staff catalog, publishing, storefront content, customer storefront contracts                                            |
| Core      | Contact, product, category, brand, company, financial-year records and lookup contracts                                 |
| Shared UI | Reusable controls, responsive workspace primitives, design tokens, layout regions                                       |

cxmobile is a frontend/native composition app. It does not own a second business API or database.
Keep module-specific mobile changes inside the existing business module.
Consume public package entry points. Add explicit exports where a required contract is private.
Do not import Platform desk internals or copy business modules into cxmobile.

## Planned client structure

This tree describes future implementation. This component currently contains documentation only.

```text
apps/cxmobile/
  README.md
  agent/
    PLAN.md
    TASK.md
    SKILLS.md
    AUDIT.md
  client/                       # Planned @codexsun/cxmobile-client workspace
    package.json
    index.html
    tsconfig.json
    vite.config.ts
    capacitor.config.ts
    public/                     # App-owned static assets
    src/
      main.tsx
      app/                      # Bootstrap, providers, typed routes, app composition
      shell/                    # Mobile AppLayout, launcher, navigation, status
      session/                  # Public Platform client contract integration
      native/                   # Separate transport, session, socket, file, lifecycle, link, push adapters
      styles/                   # Host layout and native safe-area adjustments
    android/                    # Generated native source, reviewed and tracked
    ios/                        # Generated native source, reviewed and tracked
    test/                       # Host and native-adapter contract tests
    e2e/                        # Cross-app mobile journeys
```

Create implementation folders only when they contain real behavior.
The existing root workspace pattern `apps/*/*` can include `client` without a new package manager.
Install dependencies from the repository root. Keep one root lockfile and `node_modules`.
Place web output, native build intermediates, caches, and release artifacts under root `dist/apps/cxmobile` and `dist/.cache`.
Native source trees are distinct from generated native build output.
Plan the output paths before generating Android or iOS projects.

## Reuse and contracts

Reuse existing public web workspaces, forms, schemas, hooks, fixed services, and design-system controls.
Reuse their current API routes, validation, lifecycle behavior, activity history, and permission checks.
Adapt dense screens for touch inside their owner modules.
Keep business forms and lists out of the mobile shell.

Platform Web currently lacks a declared reusable package export for its client/session infrastructure.
Expose a small reviewed public client entry point during implementation. Do not import its private source paths.
Each owner request helper must use the approved transport contract without moving business endpoints into shared infrastructure.

The packaged app loads bundled web assets and calls an approved HTTPS Platform API origin.
It must not depend on a Vite proxy, localhost production API, arbitrary remote pages, or desktop development launch controls.
Native authentication, authenticated sockets, files, and media require device proof before general screen integration.

## Documentation

- [PLAN.md](agent/PLAN.md): architecture, feature scope, delivery order, risks, and acceptance gates.
- [TASK.md](agent/TASK.md): implementation tasks and required evidence. Unchecked tasks remain open.
- [SKILLS.md](agent/SKILLS.md): component working rules and ownership constraints.
- [AUDIT.md](agent/AUDIT.md): source findings, readiness risks, feature baseline, and implementation prerequisites.
- [SUPERVISOR-PROMPT.md](agent/SUPERVISOR-PROMPT.md): implementation authorization and supervisor execution loop.
- [WORKER-TASKS.md](agent/WORKER-TASKS.md): worker split, dependency graph, file leases, review prompts, and evidence contracts.

Read README for orientation, AUDIT for evidence, PLAN for decisions, and TASK for execution.
PLAN owns architectural decisions. TASK owns completion status. AUDIT distinguishes source findings from untested assumptions.

## Verification and release

Planning checks use the existing component-documentation checker and its tests.
Implementation commands in PLAN and TASK are proposed names until their root scripts exist.
Do not report a native build, installed app, live API flow, or store release from documentation checks.

Android requires the supported Android SDK, JDK, Gradle, signing configuration, and device verification.
iPhone builds require macOS and Xcode. TestFlight and store distribution require the relevant Apple account and signing setup.
Keep developer credentials, certificates, private keys, and push-provider secrets outside source control.

## Official references

- [Capacitor installation](https://capacitorjs.com/docs/getting-started)
- [Environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Native HTTP](https://capacitorjs.com/docs/apis/http)
- [Cookie constraints](https://capacitorjs.com/docs/apis/cookies)
- [Push notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Configuration](https://capacitorjs.com/docs/config)

These references support planning. Recheck supported versions and plugin compatibility before installation.
