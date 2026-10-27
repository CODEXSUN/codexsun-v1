# Frappe suite installation audit

Audit date: 27 October 2026.

Status: installation in progress. Runtime acceptance remains pending until the checks below pass.

## Scope

This audit covers the local Docker installer, application dependencies, persistent assets, migration controls, and app startup.
It does not certify every upstream business workflow or provide a full security review of the upstream applications.

## Findings and repairs

| Finding | Effect | Repair |
| --- | --- | --- |
| Missing C compiler | Raven's `blurhash-python` wheel could not build | The suite image installs GCC, C headers, and libffi headers before Python dependencies |
| Bundling preceded JavaScript dependency installation | Frappe could not resolve HRMS and Raven imports | Each app's dependencies install before the combined asset build |
| Runtime serves baked assets | Volume-only asset copies can disappear after container replacement | The image retains generated assets in both the baked directory and an installation snapshot |
| Helpdesk needs build-time Socket.IO configuration | Its frontend build could not import the missing port | The build sets the internal Socket.IO port without copying private site settings |
| Clients assumed a separate browser port for Socket.IO | Realtime features would connect to port 9000 instead of this installation's HTTP proxy | Production clients use the page origin and existing `/socket.io` proxy. Development URLs retain their original behavior |
| Runtime could change during a long image build | Installation could act on stale container or storage assumptions | The installer rechecks container identity, image, mounts, app list, maintenance state, and shared storage before changing the site |
| Image tags can change | A tag alone does not identify the installed image | The deployment record saves the image ID and verification compares it with the running container |
| Browser checks could accept a rendered error page | A page alone did not prove app startup | Browser verification checks authenticated sessions, app roots, API errors, and uncaught JavaScript errors |
| Interrupted builds lost temporary sources | Repeated recovery required source downloads | This run uses ignored persistent source checkouts under `reports/suite-source` |

The installer preserves the shared maintenance lock. It waits for other CODEXSUN updates before installation.
It does not reset Docker storage, delete site volumes, or replace shared MariaDB and Redis.

## Selected releases

| App | Selected release or commit |
| --- | --- |
| Frappe HR | `v16.52.0` |
| Raven | `v3.0.0` |
| Frappe CRM | `v1.89.1` |
| Helpdesk | `v1.31.0` |
| Insights | `v3.15.1` |
| Telephony dependency | `9447577500a25d242088398157b72c654fa34b20` |

Exact resolved revisions and the image are recorded in the private deployment record.

## Evidence and acceptance

- Installer tests cover failures, concurrent operations, and unexpected image replacement.
- The 40-file portable package passed checksum and extraction checks.
- Current shared MariaDB and Redis container identities match the saved installation record.
- Before installation, only Frappe, ERPNext, `logicx_app`, and `logicx_biz` were installed.
- Pending: completed suite image, verified site backup, installation, migration, health, app APIs, and browser startup.

## Boundaries

Employee setup, payroll processing, outgoing email, telephony providers, AI services, and analytical business queries need separate configuration and acceptance.
No external messages or provider operations form part of this installation check.
Backup integrity checks do not prove a successful restore.
Partial installations stop for operator review. The installer performs no automatic schema rollback.
