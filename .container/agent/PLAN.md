# Deployment boundary

1. One root setup shortcut and one root update shortcut select `codexsun-v1`.
2. Fresh setup configures an empty application installation against new or retained infrastructure.
3. Routine VPS updates create verified backups, fetch reviewed source, build versioned images, migrate, replace, and verify.
4. Cleanup removes owned application and optional owned Redis resources while preserving MariaDB and shared services.
5. Keep Frappe and Media work separate from the root deployment contract. Frappe has an explicit standalone installer.
6. Add v2 only for a reviewed deployment-contract change. Keep application release numbers independent.

Root application releases remain separate. The user separately authorized the standalone latest-v16 Frappe installation on 2026-10-25.
Frappe reuses selected infrastructure and adds one container. Application version bumps, commits, and pushes remain outside that task.
