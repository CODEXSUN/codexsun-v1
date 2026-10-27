import assert from "node:assert/strict";
import test from "node:test";
import { queueExecutionAllowed } from "./queue-manager.execution.js";
import { publishPendingDeliveries, queueDeliveryId } from "./queue-manager.delivery.js";
import { resolveMailJobTenant } from "./queue-manager.mail.js";
import type { Tenant } from "../tenant/index.js";

const tenant = { uuid: "tenant-a", status: "active", dbName: "codexsun_tenant_a" } as Tenant;

test("only the configured enabled executor owns execution", () => {
  for (const host of ["platform", "worker"] as const) {
    for (const executor of ["platform", "worker"] as const) {
      for (const enabled of ["0", "1"]) {
        assert.equal(
          queueExecutionAllowed(
            {
              CODEXSUN_QUEUE_EXECUTION_HOST: host,
              CODEXSUN_QUEUE_WORKER_ENABLED: enabled
            },
            executor
          ),
          enabled === "1" && host === executor
        );
      }
    }
  }
});

test("reconciliation publishes every pending page in ascending identity order", async () => {
  const records = Array.from({ length: 251 }, (_, index) => ({ id: index + 1 }));
  const cursors: number[] = [];
  const published: number[] = [];
  await publishPendingDeliveries(
    async (afterId) => {
      cursors.push(afterId);
      return records.filter((record) => record.id > afterId).slice(0, 100);
    },
    async (record) => {
      published.push(record.id);
    }
  );
  assert.deepEqual(cursors, [0, 100, 200]);
  assert.deepEqual(
    published,
    records.map((record) => record.id)
  );
});

test("reconciliation leaves an unsuccessful publication visible for the next pass", async () => {
  const published: number[] = [];
  await assert.rejects(
    publishPendingDeliveries(
      async () => [{ id: 1 }, { id: 2 }],
      async (job) => {
        published.push(job.id);
        if (job.id === 2) throw new Error("Redis unavailable");
      }
    ),
    /Redis unavailable/
  );
  assert.deepEqual(published, [1, 2]);
});

test("Mail execution restores only its active authoritative tenant", async () => {
  const job = { tenantId: tenant.uuid, payload: { tenantDatabase: tenant.dbName } };
  assert.equal(await resolveMailJobTenant(job, async () => tenant), tenant);
  const invalidTenants: Array<Tenant | null> = [
    null,
    { ...tenant, status: "inactive" },
    { ...tenant, uuid: "tenant-b" },
    { ...tenant, dbName: "codexsun_tenant_b" }
  ];
  for (const value of invalidTenants) {
    await assert.rejects(
      resolveMailJobTenant(job, async () => value),
      /invalid or inactive/
    );
  }
  let lookedUp = false;
  await assert.rejects(
    resolveMailJobTenant({ ...job, tenantId: null }, async () => {
      lookedUp = true;
      return tenant;
    }),
    /registered tenant/
  );
  assert.equal(lookedUp, false);
});

test("transport identity follows the persisted record and attempt generation", () => {
  assert.equal(queueDeliveryId({ uuid: "a", attempts: 0 }), queueDeliveryId({ uuid: "a", attempts: 0 }));
  assert.notEqual(queueDeliveryId({ uuid: "a", attempts: 0 }), queueDeliveryId({ uuid: "b", attempts: 0 }));
  assert.notEqual(queueDeliveryId({ uuid: "a", attempts: 0 }), queueDeliveryId({ uuid: "a", attempts: 1 }));
});
