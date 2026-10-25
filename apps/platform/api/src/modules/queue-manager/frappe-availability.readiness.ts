import {
  isFrappeUnavailable,
  FrappeLiveSyncService,
  type FrappeDatabase
} from "@codexsun/frappe-api";
import { crmFrappeAvailability, readCrmFrappeSyncAccess } from "../../crm-frappe-sync-access.js";
import { getTenantDatabase } from "../../database/tenant-database.js";
import { TenantRepository } from "../tenant/tenant.repository.js";
import { registerQueueJobReadiness } from "./queue-manager.worker.js";

export function registerFrappeAvailabilityReadiness() {
  for (const name of [
    "frappe.enquiries.import",
    "frappe.live-sync",
    "frappe.export",
    "frappe.call-logs.import",
    "crm.enquiry.frappe-sync",
    "crm.contact.frappe-sync",
    "crm.sop.frappe-sync"
  ]) {
    registerQueueJobReadiness(name, async (job, error, result) => {
      const failure = error ?? transportFailure(result);
      if (result && !failure)
        return { ready: true, reason: null, retryAt: new Date().toISOString() };
      const tenant = await new TenantRepository().findByIdOrCode(job.tenantId ?? "");
      if (!tenant || tenant.status !== "active" || tenant.dbName !== job.payload.tenantDatabase)
        return { ready: true, reason: null, retryAt: new Date().toISOString() };
      const database = getTenantDatabase(tenant);
      const access = await readCrmFrappeSyncAccess(database);
      const outbound =
        name.startsWith("crm.") ||
        name === "frappe.live-sync" ||
        (name === "frappe.export" && job.payload.mode === "export");
      const live = access.enabled
        ? await new FrappeLiveSyncService(
            database as unknown as import("kysely").Kysely<FrappeDatabase>
          ).settings()
        : null;
      if (!access.enabled || live?.paused || (outbound && !access.outbound))
        return {
          ready: false,
          reason: "Frappe sync is disabled or paused for this tenant and direction.",
          retryAt: new Date(Date.now() + 300_000).toISOString()
        };
      const availability = crmFrappeAvailability(database);
      if (failure) {
        if (isFrappeUnavailable(failure)) return availability.unavailable(failure);
        return { ready: true, reason: null, retryAt: new Date().toISOString() };
      }
      return availability.ready();
    });
  }
}

function transportFailure(result?: Record<string, unknown>) {
  if (!result) return undefined;
  if (typeof result.error === "string" && isFrappeUnavailable(result.error))
    return new Error(result.error);
  if (!Array.isArray(result.failures)) return undefined;
  for (const failure of result.failures) {
    if (
      failure &&
      typeof failure === "object" &&
      "message" in failure &&
      typeof failure.message === "string" &&
      isFrappeUnavailable(failure.message)
    )
      return new Error(failure.message);
  }
  return undefined;
}
