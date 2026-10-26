# Release 1.1.72: Trusted global Platform administration

Date: 26-10-2026, Asia/Calcutta.
Published baseline: `70a4aed9aa7516472590c805c9beb1dd98c10092`, version 1.1.71.
Owner repair: `e5ac18f4`. Cookie/in-memory regression and source formatting follow-up: `f12bb1a3`.
The publication receipt records the final published SHA and clean frozen candidate.

## Confirmed defect

Deploy's synthetic staging tenant session had `userType=tenant`, yet the global tenant registry returned both synthetic tenants.
The owner route lacked a local Super Admin pre-handler, and the root authentication context did not enforce global administration authority.
The adjacent route audit found the same missing local check on app registry, plans, subscriptions, entitlements, access control, industries, and activity.
Database maintenance, storage, queue operations, orchestration, tenant domains, and tenant-user support already had explicit guards.

## Resulting behavior

The root context now installs a central global administration guard after authentication resolution.
It runs before request validation and business handlers for registered `/admin` and mounted `/api/platform/admin` routes.
Authenticated tenant and staff denial occurs before tenant business-context resolution for these global operations.
No client role, authority header, body field, or signed token alone can supply the required authority.

The shared Super Admin guard requires verified claims that match an active server session.
The server session must be unrevoked, unexpired, and in platform mode, without tenant database routing.
The token must also be unexpired. Missing or mismatched authority fails closed.
Unknown stored user types and access modes no longer default to Super Admin or platform authority.
The existing claims-matching export remains available from the authentication context.

Tenant administrators, ordinary tenant users, staff, and anonymous callers cannot execute global reads or writes.
Active server-backed Super Admin bearer and encrypted-cookie operations remain allowed.
Staff retains its own session surface. Tenant and public owner authorization remain in place.
The central guard also covers future registrations within the global namespace.

Database update: No. This patch adds no migration, database write, permission grant, or automatic session repair.
Unknown old session metadata requires a new valid sign-in rather than an inferred privilege.
The prior 41-step Ecommerce migration catalog and writer repair remain unchanged.

## Validation

The authentication suite passed all 25 tests.
It executes actual tenant, plan, subscription, entitlement, access-control, activity, app-registry, and industry route registrations.
Thirty-three method/path operations deny tenant administrator, tenant user, staff, and anonymous classes before business-service access.
The tests cover HEAD, reads, mutations, mounted prefixes, forged authority headers/body fields, and future admin routes.
They reject missing, mismatched, expired, and revoked server sessions and forged bearer tokens.
A tenant encrypted cookie cannot inherit a valid Super Admin bearer identity.
Positive cases preserve Super Admin bearer/cookie reads and writes, staff session access, and public paths.
Existing session-cookie, tab-slot, reset, host-binding, and claim-matching tests pass.

Tests use in-memory session and business-service boundaries. They contact no database or live service.
Platform API typecheck, lint, module boundaries, and whitespace checks passed during focused review.
Final repository checks belong in the publication receipt.

## Staging, recovery, and operational limits

Deploy reports that real 1.1.71 MariaDB tests passed both populated historical 40-step lineages and the forward writer upgrade.
Those results are prior-version staging evidence. They do not certify this new authorization candidate.
Deploy also reports local encrypted backups under `D:\workspace\backups\26-10-2023\run-20261026T060916Z`.
The report covers master plus 13 active databases, configuration, and ten CODEXSUN-owned files.
The supervisor does not create, restore, decrypt, or certify those backups in this source batch.
Restore proof remains false. Backup integrity does not establish a verified restore rehearsal.
The broader operator recovery-scope review remains unresolved. No recovery or promotion gate is weakened here.

Deploy must build fresh API, Web, Shop, Worker, and Chatb images from the exact published 1.1.72 SHA.
Repeat the tenant/global administration isolation test and positive Super Admin browser/session checks on those images.
Retain required migration, recovery, isolation, restart, realtime, quiescence, immutable-image, and production acceptance gates.
No production request, SQL/server operation, backup, restore, dependency install, tag, or chat dispatch ran in this source batch.
CXApp databases, the shared MariaDB server/container, old candidates, stashes, and unrelated unfinished work remain preserved.

## Final supervisor validation

The full `npm run check` passed on the integrated 1.1.72 source.
It completed component documentation/tests, cleanup tests, all module boundaries/tests, add-on checks, Docs, 116 typecheck/build tasks, and 62 lint tasks.
All 25 authentication tests passed, including real route registrations and encrypted-cookie authority cases.
Version validation, dependency layout, and whitespace checks passed.
An independent audit confirmed version-only substitutions in 67 package manifests and the lockfile.
Historical 1.1.71 and earlier changelog entries remain unchanged.
No complete deployed-system or live-tenant acceptance is inferred from these checks.
