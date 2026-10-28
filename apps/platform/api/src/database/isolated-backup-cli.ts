import { env } from "../env.js";
import { platformDatabaseName } from "./platform-database.js";
import { IsolatedBackupVerifier } from "../modules/database-maintenance/database-maintenance.isolated-files.js";
import type { MigrationBackupVerifier } from "../modules/database-maintenance/database-maintenance.migration-backup.js";

/** Called only by the database CLI after an explicit opt-in. */
export function isolatedCliBackupVerifier(): MigrationBackupVerifier {
  const verifier = new IsolatedBackupVerifier(
    "/run/codexsun-upgrade-evidence",
    process.env.CODEXSUN_ISOLATED_ATTESTATION_KEY || "",
    process.env.CODEXSUN_ISOLATED_SOURCE_CONTAINER_ID || ""
  );
  return {
    master: () =>
      verifier.verify({
        scope: "master",
        targetKey: "master",
        databaseName: platformDatabaseName(),
        host: env.DB_HOST,
        port: env.DB_PORT
      }),
    tenant: (tenant) =>
      verifier.verify({
        scope: "tenant",
        targetKey: String(tenant.id),
        databaseName: tenant.dbName,
        host: tenant.dbHost || env.DB_HOST,
        port: tenant.dbPort || env.DB_PORT
      })
  };
}
