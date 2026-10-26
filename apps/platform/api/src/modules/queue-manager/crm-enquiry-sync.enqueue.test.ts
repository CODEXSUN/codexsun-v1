import assert from "node:assert/strict";
import { mock, test } from "node:test";

let outbound = true;
let event: { id: number; enquiry_id: number; attempts: number; correlation_id: string } | null = {
  id: 7,
  enquiry_id: 3,
  attempts: 0,
  correlation_id: "local-update"
};
let dispatchable = true;
const database = {};
mock.module(new URL("../../crm-frappe-sync-access.ts", import.meta.url), {
  namedExports: {
    readCrmFrappeSyncAccess: async () => ({ enabled: outbound, outbound }),
    canDispatchCrmFrappeSync: async () => {
      throw new Error("Remote readiness must stay outside enqueue");
    }
  }
});
mock.module("@codexsun/crm-api/enquiry-sync", {
  namedExports: {
    EnquirySyncRepository: class {
      getEvent() {
        return Promise.resolve(event);
      }
      dispatchableEvents() {
        return Promise.resolve(dispatchable && event ? [event] : []);
      }
    }
  }
});
mock.module("@codexsun/frappe-api", { namedExports: { FrappeLiveSyncService: class {} } });
mock.module(new URL("../../database/tenant-database.ts", import.meta.url), {
  namedExports: { getTenantDatabaseByName: () => database, getTenantDatabase: () => database }
});
mock.module(new URL("../tenant/tenant.repository.ts", import.meta.url), {
  namedExports: { TenantRepository: class {} }
});
const { enqueueCrmEnquirySync } = await import("./crm-enquiry-sync.relay.js");

test("enqueue persists eligible work without remote readiness or inline delivery", async () => {
  const submitted: Array<Record<string, unknown>> = [];
  const queue = {
    enqueue: async (job: Record<string, unknown>) => {
      submitted.push(job);
      return job;
    }
  };
  const input = {
    tenantId: "crm-local",
    tenantDatabase: "codexsun_crm_dev_tenant",
    eventId: 7,
    actorEmail: "local@example.test"
  };
  await enqueueCrmEnquirySync(queue as never, input);
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0]!.dispatchImmediately, false);
  assert.equal(submitted[0]!.tenantId, input.tenantId);
  assert.deepEqual(submitted[0]!.payload, { eventId: 7, tenantDatabase: input.tenantDatabase });
  assert.equal(submitted[0]!.jobName, "crm.enquiry.frappe-sync");
  assert.equal(submitted[0]!.correlationId, "local-update");
  outbound = false;
  assert.equal(await enqueueCrmEnquirySync(queue as never, input), null);
  outbound = true;
  dispatchable = false;
  assert.equal(await enqueueCrmEnquirySync(queue as never, input), null);
  dispatchable = true;
  event = null;
  assert.equal(await enqueueCrmEnquirySync(queue as never, input), null);
  assert.equal(submitted.length, 1);
});
