import type { FastifyInstance } from "fastify";
import {
  deliverSitePublication,
  expireSiteDelivery,
  startSitesDeliveryRelay,
  SiteRepository,
  type SitesDatabase,
  type DeploymentHost
} from "@codexsun/sites-api";
import { TenantRepository } from "./modules/tenant/index.js";
import { getTenantDatabase } from "./database/tenant-database.js";
import { registerQueueJobProcessor } from "./modules/queue-manager/queue-manager.worker.js";
import type { QueueManagerService } from "./modules/queue-manager/queue-manager.service.js";
import type { Kysely } from "kysely";
export function sitesDeliveryHost(
  app: FastifyInstance,
  queue: QueueManagerService
): DeploymentHost {
  registerQueueJobProcessor("sites.publication.deliver", async (job) => {
    if (
      !job.tenantId ||
      typeof job.payload.siteUuid !== "string" ||
      typeof job.payload.deploymentUuid !== "string"
    )
      throw new Error("Invalid Sites delivery job.");
    const tenant = await new TenantRepository().findByIdOrCode(job.tenantId);
    if (
      !tenant ||
      tenant.uuid !== job.tenantId ||
      tenant.status !== "active" ||
      tenant.corporateId !== "TIRUPURCONNECT" ||
      !tenant.enabledModuleKeys.includes("sites")
    )
      throw new Error("Sites delivery tenant is unavailable.");
    const db = getTenantDatabase(tenant) as unknown as Kysely<SitesDatabase>;
    const site = await new SiteRepository(db).findByUuid(job.payload.siteUuid);
    if (!site || site.status !== "active") throw new Error("Sites delivery client is unavailable.");
    return deliverSitePublication(db, {
      tenantId: tenant.uuid,
      siteId: site.id,
      siteUuid: site.uuid,
      deploymentUuid: job.payload.deploymentUuid
    });
  });
  if (queue.canExecute() && process.env.CODEXSUN_SITES_PUBLISH_SECRET) {
    let activeRelay: Promise<void> | undefined;
    const relay = async () => {
      await queue.expireRunningJobs(["sites.publication.deliver"], 120000);
      const jobs = await queue.listJobs({
        queueName: "system",
        jobName: "sites.publication.deliver",
        tenantId: process.env.CODEXSUN_SITES_TIRUPURCONNECT_TENANT_ID!
      });
      for (const job of jobs.filter(
        (job) => job.status === "failed" && job.attempts >= job.maxAttempts
      )) {
        const tenant = await new TenantRepository().findByIdOrCode(job.tenantId!);
        if (
          tenant &&
          typeof job.payload.siteUuid === "string" &&
          typeof job.payload.deploymentUuid === "string"
        ) {
          const db = getTenantDatabase(tenant) as unknown as Kysely<SitesDatabase>;
          const site = await new SiteRepository(db).findByUuid(job.payload.siteUuid);
          if (site) await expireSiteDelivery(db, job.payload.deploymentUuid, site.id);
        }
      }
    };
    const stop = startSitesDeliveryRelay(() => {
      activeRelay = relay();
      return activeRelay;
    });
    app.addHook("onClose", async () => {
      stop();
      await activeRelay?.catch(() => undefined);
    });
  }
  return {
    async enqueue(input) {
      const job = await queue.enqueue({
        jobName: "sites.publication.deliver",
        queueName: "system",
        sourceModule: "sites.site.deployment",
        tenantId: input.tenantId,
        actorEmail: input.actor,
        correlationId: input.correlationId,
        idempotencyKey: `sites:${input.tenantId}:${input.deploymentUuid}:${input.attempt}`,
        maxAttempts: 3,
        payload: { siteUuid: input.siteUuid, deploymentUuid: input.deploymentUuid }
      });
      if (!job) throw new Error("Delivery queue is unavailable.");
    }
  };
}
