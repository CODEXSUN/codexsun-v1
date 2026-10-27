import { AppError } from "@codexsun/framework/errors";
import type { Kysely } from "kysely";
import {
  registerDataMigrationApi,
  type DataMigrationHost,
  type MigrationTenant
} from "@codexsun/data-migration-api";
import { getPlatformDatabase } from "./database/platform-database.js";
import { env } from "./env.js";
import { resolveTenantDatabasePassword } from "./database/tenant-database.js";
import { TenantRepository } from "./modules/tenant/tenant.repository.js";

const tenants = new TenantRepository();

export async function registerDataMigrationHost(
  app: Parameters<typeof registerDataMigrationApi>[0]
): Promise<DataMigrationHost> {
  const host = createDataMigrationHost();
  await registerDataMigrationApi(app, host);
  return host;
}

export function createDataMigrationHost(): DataMigrationHost {
  return {
    database: getPlatformDatabase() as unknown as Kysely<unknown>,
    secretKey: env.JWT_SECRET,
    masterDatabase: { host: env.DB_HOST, port: env.DB_PORT, database: env.DB_MASTER_NAME },
    currentDatabase: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    },
    authorize(request) {
      const payload = request.authContext?.payload;
      if (payload?.userType !== "super_admin") {
        throw AppError.forbidden("Data Migration is available only to Super Admin.");
      }
      return payload.email;
    },
    async listTenants() {
      const records = await tenants.list();
      return records
        .filter((tenant) => tenant.status === "active" && tenant.dbType === "mariadb")
        .map((tenant) => ({
          id: tenant.id,
          label: `${tenant.tenantName} (${tenant.tenantCode})`,
          database: tenant.dbName
        }));
    },
    async resolveTenant(id): Promise<MigrationTenant> {
      const tenant = await tenants.findByIdOrCode(String(id));
      if (
        !tenant ||
        tenant.id !== id ||
        tenant.status !== "active" ||
        tenant.dbType !== "mariadb"
      ) {
        throw AppError.validation("Choose an active MariaDB tenant from the registry.");
      }
      return {
        id: tenant.id,
        label: tenant.tenantName,
        database: tenant.dbName,
        host: tenant.dbHost,
        port: tenant.dbPort,
        user: tenant.dbUser,
        password: resolveTenantDatabasePassword(tenant)
      };
    }
  };
}
