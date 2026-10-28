import { assertDatabaseName } from "./database-utils.js";
import type { Tenant } from "../modules/tenant/tenant.types.js";

export function tenantMigrationTargets<T extends Pick<Tenant, "dbName" | "status" | "tenantCode">>(
  tenants: T[]
): T[] {
  return tenants.filter((tenant) => {
    if (!tenant.dbName.trim() && tenant.status !== "active") return false;
    assertDatabaseName(tenant.dbName, `tenant database name for ${tenant.tenantCode}`);
    return true;
  });
}

export async function existingTenantMigrationTargets<
  T extends Pick<Tenant, "dbName" | "status" | "tenantCode">
>(tenants: T[], inspect: (tenant: T) => Promise<void>): Promise<T[]> {
  const targets: T[] = [];
  for (const tenant of tenantMigrationTargets(tenants)) {
    try {
      await inspect(tenant);
      targets.push(tenant);
    } catch (error) {
      const missing = typeof error === "object" && error !== null &&
        "code" in error && error.code === "ER_BAD_DB_ERROR";
      if (!missing || tenant.status === "active") throw error;
    }
  }
  return targets;
}

export function crmPermissionTargets<
  T extends Pick<Tenant, "dbName" | "status" | "tenantCode" | "enabledModuleKeys">
>(tenants: T[]): T[] {
  return tenantMigrationTargets(
    tenants.filter((tenant) => tenant.status === "active" && tenant.enabledModuleKeys.includes("crm"))
  );
}
