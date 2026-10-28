# Database Migration Runbook

## Purpose

Use this runbook for CODEXSUN database changes that affect platform or tenant schemas.

## Before Creating A Migration

- Confirm the owning app or module.
- Write the database change as a tracked migration, not a manual production edit.
- Prefer expand/migrate/contract for destructive or risky changes.
- Record affected tables, expected runtime, risk level, and validation SQL in the migration notes.

## Local Restored-Dump Test

1. Create or download a recent safe dump.
2. Restore it into local platform and tenant databases.
3. Set the local `.env` database names to the restored databases.
4. Run `npm run db:migrations:preflight`.
5. Run `CODEXSUN_RESTORED_DUMP_TEST=1 npm run db:migrations:test-local`.
6. Run affected API and app tests.
7. Compare row counts, important totals, and schema snapshots.

## Production Preflight

The production CLI migration preflight requires a completed backup for the
Platform database and each target tenant database. Each backup must be no
more than 24 hours old, identify the current database server, pass its file
checksum check, and have a completed fresh sandbox restore linked to the
same backup checksum. Restore evidence created before checksum recording was
added must be refreshed with a new sandbox restore.

```text
npm run db:migrations:preflight
```

Do not continue if backup freshness, restore status, tenant targets, or rollback notes are missing.
Production Platform startup and migration, and tenant setup, migration,
seeding, and reinstall verify the target backup when its database already
exists. A database created by the current operation does not need a prior
backup. An existing Platform database without current verifiable backup and
restore evidence will refuse startup migration, including on an ordinary
restart. Restore evidence does not validate application-level data.
The built-in SQL backup uses an InnoDB snapshot and rejects detected views,
triggers, routines, events, and non-InnoDB tables. Use a complete external
backup when those objects are present. Database privileges must permit full
metadata inspection, and external schema changes must be controlled during
backup and migration.
Tenant schemas with Ecommerce functions or triggers cannot use the built-in
SQL backup. The exporter rejects these objects. Do not rely on that backup
path for tenant migration or reinstall until a complete format supports them.

## Running Migrations

Run migrations through the stable command:

```text
npm run db:migrations:run
```

All Platform, tenant-runtime, Core, Billing, and Mail migrations in this
baseline are release batch `1`. The shared `migration_schema` ledger
records the scope, batch, integer step version, SHA-256 checksum, status,
operator, timestamps, and failure text. Applied checksums are immutable:
change the schema through a new versioned step instead of editing an applied
step.

The CLI, startup, tenant provisioning, and database maintenance jobs share a
release advisory lock. The CLI holds it across preflight and the Platform and
tenant migration sequence. The runner also holds a database advisory lock per
batch and processes a bounded number of
steps at a time. Reruns skip only checksum-validated applied steps. A failed
step remains visible in the ledger. Earlier successful steps stay applied so
recovery can account for any partial DDL in the failed step.

Database naming is part of the ownership boundary:

- Platform master tables are unprefixed. Never add `app_` to master tables.
- `app_` is reserved for tenant-database framework/runtime tables.
- `core_` for Core-owned tables.
- `billing_` for Billing-owned tables.
- `crm_` for CRM-owned tables.
- `mail_` for Mail-owned tables.

The migration ledger is always `migration_schema`, regardless of database
owner. The runner adopts the legacy `app_migration_batches` ledger by an
in-place rename. Platform master tables that were incorrectly given `app_`
are also restored by in-place rename. Migration fails closed when both a
legacy and target name exist; reconcile the rows explicitly instead of
allowing an implicit merge.

List the checksum ledger with:

```text
npm run db:migrations:list
```

The release-wide rollback command currently refuses to run before changing
any database because not every app has a verified safe reverse plan. The
Platform and tenant rollback entry points also refuse for the same reason:

```text
npm run db:migrations:rollback
```

Under the release lock, the CLI checks target identities and reads each
target's migration ledger. It reports applied and incomplete steps by scope,
then refuses rollback until a release manifest and verified safe reverse
catalog exist. An unreadable ledger or duplicate target also blocks the
assessment. Use verified backups or a reviewed corrective forward migration.
Individual batch rollback checks all applied steps before reversing that batch,
but does not provide release-wide coordination.
The release rollback planner is not wired to the CLI. It does not validate
dependencies between app scopes or authenticate a stored release manifest.

## Consolidated Lifecycle Order

Framework and UI are database-free infrastructure packages. They do not own migrations or seeders.

Database installation, migration, seeding, tenant setup, and tenant reinstall use one deterministic order for every registered tenant database:

1. Platform master module migrations.
2. Platform master module seeders.
3. Tenant runtime migrations: module settings, users, roles, permissions, user roles, and role permissions.
4. Core leaf migrations in dependency order: Common lookups, Organisation, then Master modules.
5. Project Manager registry, Ecommerce, CRM, Frappe, Auditor, and Zetro migrations.
6. Billing migrations before LogicX ERP schemes, followed by Accounts, Mail, Task Manager, and Blog migrations.
7. Tenant runtime seeders for users, roles, and tenant module settings. Known app settings are reconciled to the tenant registry, including disabling an app removed from the enabled set.
8. Core leaf seeders in dependency order.
9. Enabled app seeders in their composition order. These install defaults and permission grants only for apps enabled for that tenant; Blog defaults follow Task Manager. App schema presence does not activate an app.

All module SQL and seed behavior remains in the owning module's `*.migration.ts` and `*.seed.ts` files. Database composition roots only order and record those module-owned lifecycle functions. Repeatable seeders are additive: they insert missing defaults but do not reset tenant passwords, module JSON, or edited lookup labels.

`npm run db:migrate` runs migrations without application seeders. `npm run db:seed` ensures migrations and then runs seeders. Tenant setup and reinstall preserve existing data, run every installed tenant-app migration first, then run enabled app seeders repeatably. Accounts activation uses `accounts.overview`; the older `accounts.accounting` key resolves to it during tenant access and seeding, then normalizes on tenant update.

QCafe web menu and POS use the module-owned tenant MariaDB migration batch. Permission seeds run only when QCafe is enabled. Desktop retains local SQLite and PIN login. Historical cloud SQLite files are preserved and require an explicit tenant-specific import before replacing an existing restaurant deployment.

For a local full lifecycle check against a disposable database, run `tsx tools/e2e/all-tenant-apps-upgrade.e2e.ts --fresh`. Pass a tenant SQL dump path instead of `--fresh` to restore it into a uniquely named sandbox and check migration, existing row retention, and repeat seeding. The test leaves the sandbox database for inspection.

For production, run during the approved release window and keep logs with the release record.

## Failure Handling

- Stop the rollout.
- Preserve logs and failed migration status.
- A `running` or `failed` step is not retried automatically. Inspect its actual
  schema and data, reconcile partial changes using a reviewed recovery plan,
  and reconcile the ledger before retrying.
- Do not edit an already-applied migration.
- Add a corrective forward migration unless the approved rollback plan says otherwise.
- Re-run preflight before retrying.
- Run `npm run test:migration-contract` to validate owner prefixes, standard
  columns, destructive-DDL exclusions, checksum mutation, and reversible
  prefix planning.
