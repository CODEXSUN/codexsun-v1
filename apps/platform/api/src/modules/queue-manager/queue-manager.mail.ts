import type { Tenant } from "../tenant/index.js";
import type { QueueJobRecord } from "./queue-manager.types.js";

export async function resolveMailJobTenant(
  job: Pick<QueueJobRecord, "tenantId" | "payload">,
  findTenant: (id: string) => Promise<Tenant | null>
) {
  if (!job.tenantId || typeof job.payload.tenantDatabase !== "string")
    throw new Error("Mail job requires a registered tenant and database.");
  const tenant = await findTenant(job.tenantId);
  if (
    !tenant ||
    tenant.uuid !== job.tenantId ||
    tenant.status !== "active" ||
    tenant.dbName !== job.payload.tenantDatabase ||
    !tenant.enabledModuleKeys.includes("mail")
  )
    throw new Error("Mail job tenant is invalid or inactive.");
  return tenant;
}
