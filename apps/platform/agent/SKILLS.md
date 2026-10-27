# Platform working skills

## Apply this guidance

Use this file when planning, implementing, debugging, or reviewing Platform.
For normal focused work, read the affected source and its public composition contract first.
Read the Platform README, TASK, and PLAN only for architecture, permissions, tenancy, operations, release, audit, or documentation work.
This file is component guidance. It does not install a global Codex skill or grant a runtime capability.

## Domain responsibilities

The authenticated runtime, tenant routing, application composition, entitlements, permissions, queues, storage, administration, and Windows host.

Composition registers public app contracts. Business CRUD stays in each owner. Preserve Corporate ID resolution, signed session context, live authorization, and server-only secrets.

## Implementation rules

- Inspect the affected source and public contracts before editing.
- Keep concrete business behavior in its owning leaf or package.
- Preserve authoritative validation, permission checks, and data ownership.
- Add worker, event, or sync roles only when they contain real implemented behavior.
- Keep secrets, generated files, and local runtime data out of source control.
- Run npm commands from the repository root. Write generated output under root `dist`.
- Do not update owner documentation for normal bug fixes or UI work. Update it only for contract, architecture, operations, or explicitly requested documentation changes.

## Review and evidence

For a small change, inspect the affected code and use at most one focused check when useful.
Inspection can suffice for a trivial edit. Add checks when the actual risk requires them.
The commands below are options for full verification, not a checklist for every prompt.

- `node tools/check-module-boundaries.mjs platform`
- `npm run typecheck -w @codexsun/platform-api`
- `npm run lint -w @codexsun/platform-api`
- `npm run build -w @codexsun/platform-api`
- `npm run typecheck -w @codexsun/platform-web`
- `npm run lint -w @codexsun/platform-web`
- `npm run build -w @codexsun/platform-web`
- `npm run typecheck -w @codexsun/windows`
- `npm run lint -w @codexsun/windows`
- `npm run build -w @codexsun/windows`

Check affected consumers as needed. Report material verification limits and blocked checks.
Documentation and prompts never replace backend authorization or deployment approval.

TConnect buyer provisioning must select `portal.tconnect-buyer` on the server. Keep its grants separate from seller
management permissions. A buyer login parameter selects a fixed shell; it cannot supply a role or redirect URL.

Compose TConnect conversation, message, and quotation self-access grants only for the fixed portal roles.
Do not treat Platform staff permissions as ownership of buyer-seller conversations or competing quotations.

Do not grant TConnect credential review to portal identities. Credential approval belongs to explicitly authorized staff.
Keep credential persistence, expiry, evidence, publication, and audit rules inside TConnect.

## Data Bridge company media

Storage Manager owns safe file reads, validation, target file writes, and storage-object registration.
The host composes source-ID/database-bound read-only media roots and Core's public branding update contract.
Do not resolve arbitrary URLs or accept a caller-selected filesystem root. Preserve conflicting target images.

## Global administration isolation

Keep the root global administration guard registered after authentication context resolution.
Every registered `/admin` or mounted `/api/platform/admin` route requires active server-backed `super_admin` authority.
Tenant administrator roles, staff identity, headers, body fields, and signed token claims alone cannot grant global authority.
Reject unknown session identity/access-mode metadata. Never default missing authority to Super Admin.
Run `global-admin-authorization.test.ts` and the existing authentication-context tests after changing this boundary.
Tests use synthetic tokens and in-memory service/session boundaries. Staging and production acceptance remain separate.
