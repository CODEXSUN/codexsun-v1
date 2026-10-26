# Platform: Tenant

This page records the `tenant` module in the Platform owner. The application business context is: tenant identity, access, application activation and operations.

## Workflow role

Platform owns master registry and tenant runtime identity. Business data stays in each app owner.

## Global administration authority

The root authentication context protects the registered `/admin` namespace before validation or business handlers.
Mounted `/api/platform/admin` routes receive the same policy.
Tenant administrator roles and staff sessions cannot list, create, update, suspend, or restore global tenant records.
They also cannot read global tenant activity, app registry, plans, subscriptions, entitlements, access control, industries, or operational administration.
An active Super Admin requires matching verified token claims and a live, unrevoked server session in platform mode.
Client roles, headers, bodies, and a signed token without a matching server session do not grant global access.
Unknown stored session user types or access modes are rejected.
Tenant/public routes keep their existing owner authorization.
The in-memory regression tests do not certify staging or production behavior.

Trace this module's concrete entry points below before changing its behavior. Its service is the authority for validation, lifecycle and dependency decisions; frontend controls cannot grant permissions.

## Source contracts

- `apps/platform/api/src/modules/tenant/index.ts`
- `apps/platform/api/src/modules/tenant/tenant.events.ts`
- `apps/platform/api/src/modules/tenant/tenant.migration.ts`
- `apps/platform/api/src/modules/tenant/tenant.module.ts`
- `apps/platform/api/src/modules/tenant/tenant.repository.ts`
- `apps/platform/api/src/modules/tenant/tenant.routes.ts`
- `apps/platform/api/src/modules/tenant/tenant.seed.ts`
- `apps/platform/api/src/modules/tenant/tenant.service.ts`
- `apps/platform/api/src/modules/tenant/tenant.sync.ts`
- `apps/platform/api/src/modules/tenant/tenant.types.ts`
- `apps/platform/api/src/modules/tenant/tenant.worker.ts`
- `apps/platform/web/src/modules/tenant/index.ts`
- `apps/platform/web/src/modules/tenant/tenant.activity.tsx`
- `apps/platform/web/src/modules/tenant/tenant.apps.tsx`
- `apps/platform/web/src/modules/tenant/tenant.form.tsx`
- `apps/platform/web/src/modules/tenant/tenant.hooks.ts`
- `apps/platform/web/src/modules/tenant/tenant.identity.tsx`
- `apps/platform/web/src/modules/tenant/tenant.list.tsx`
- `apps/platform/web/src/modules/tenant/tenant.schema.ts`
- `apps/platform/web/src/modules/tenant/tenant.services.ts`
- `apps/platform/web/src/modules/tenant/tenant.settings.tsx`
- `apps/platform/web/src/modules/tenant/tenant.types.ts`
- `apps/platform/web/src/modules/tenant/tenant.workspace.tsx`

## Explicit route declarations

- `/public/app-portal`

## Tables created by this leaf

- `app_module_settings`

## Permission declarations

No permission literal was detected. Check injected authorisation and app/host guards in the public composition contract.

## Request and change flow

```text
authenticated context → owning route schema → service decisions → repository/read contract
frontend gateway → owner query hooks → workspace/form/list → fixed API operation
```

Do not infer CRUD capabilities from file names. Review request/response schemas, parent lookups, transaction/audit writes, status policy and delete blockers in the listed source files. Applied migration checksums must not be rewritten.
