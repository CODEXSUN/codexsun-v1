import { env } from "./env.js";
import type { Kysely } from "kysely";
import {
  FrappeAvailabilityService,
  FrappeLiveSyncService,
  type FrappeDatabase
} from "@codexsun/frappe-api";
import type { TenantDatabase } from "./database/schema.js";

export async function readCrmFrappeSyncAccess(database: Kysely<TenantDatabase>) {
  const modules = await database
    .selectFrom("app_module_settings")
    .select("module_key")
    .where("module_key", "in", ["crm", "frappe"])
    .where("enabled", "=", true)
    .where("status", "=", "active")
    .execute();
  if (modules.length !== 2) return { enabled: false, outbound: false };
  return new FrappeLiveSyncService(database as unknown as Kysely<FrappeDatabase>).access();
}

export function crmFrappeAvailability(database: Kysely<TenantDatabase>) {
  return new FrappeAvailabilityService(
    database as unknown as Kysely<FrappeDatabase>,
    env.JWT_SECRET,
    {
      baseUrl: env.CODEXSUN_FRAPPE_BASE_URL,
      apiKey: env.CODEXSUN_FRAPPE_APP_KEY,
      apiSecret: env.CODEXSUN_FRAPPE_APP_SECRET,
      enabled: env.CODEXSUN_FRAPPE_ENABLED === "1"
    }
  );
}
export async function canDispatchCrmFrappeSync(database: Kysely<TenantDatabase>) {
  if (!(await readCrmFrappeSyncAccess(database)).outbound) return false;
  return (await crmFrappeAvailability(database).ready()).ready;
}
