import assert from "node:assert/strict";
import test from "node:test";
import { crmPermissionTargets, existingTenantMigrationTargets, tenantMigrationTargets } from "./migration-targets.js";

test("skip unprovisioned non-active tenants while retaining configured inactive databases", () => {
  const live = { tenantCode: "LIVE", status: "active" as const, dbName: "live_db" };
  const inactive = { tenantCode: "OLD", status: "inactive" as const, dbName: "old_db" };
  assert.deepEqual(
    tenantMigrationTargets([
      live,
      inactive,
      { tenantCode: "DRAFT", status: "inactive", dbName: "" },
      { tenantCode: "NEW", status: "provisioning", dbName: "" }
    ]),
    [live, inactive]
  );
});
test("an active tenant without a database or any unsafe configured database still blocks release", () => {
  assert.throws(
    () => tenantMigrationTargets([{ tenantCode: "LIVE", status: "active", dbName: "" }]),
    /Invalid tenant database/
  );
  assert.throws(
    () => tenantMigrationTargets([{ tenantCode: "OLD", status: "inactive", dbName: "unsafe;db" }]),
    /Invalid tenant database/
  );
});

test("CRM permission sync targets only active CRM tenants with valid databases", () => {
  const crm = {
    tenantCode: "CRM",
    status: "active" as const,
    dbName: "crm_db",
    enabledModuleKeys: ["crm"]
  };
  assert.deepEqual(
    crmPermissionTargets([
      crm,
      { ...crm, tenantCode: "OFF", status: "inactive", dbName: "off_db" },
      { ...crm, tenantCode: "OTHER", enabledModuleKeys: [] }
    ]),
    [crm]
  );
  assert.throws(() => crmPermissionTargets([{ ...crm, dbName: "" }]), /Invalid tenant database/u);
});

test("upgrade includes existing inactive databases but skips absent inactive registries", async () => {
  const tenants = [
    { tenantCode: "ACTIVE", status: "active" as const, dbName: "active_db" },
    { tenantCode: "EXISTING", status: "inactive" as const, dbName: "existing_db" },
    { tenantCode: "ABSENT", status: "inactive" as const, dbName: "absent_db" }
  ];
  const inspected: string[] = [];
  const result = await existingTenantMigrationTargets(tenants, async (tenant) => {
    inspected.push(tenant.tenantCode);
    if (tenant.tenantCode === "ABSENT") throw Object.assign(new Error("unknown database"), { code: "ER_BAD_DB_ERROR" });
  });
  assert.deepEqual(inspected, ["ACTIVE", "EXISTING", "ABSENT"]);
  assert.deepEqual(result.map((tenant) => tenant.tenantCode), ["ACTIVE", "EXISTING"]);
});

test("upgrade fails closed on missing active databases and all other connection errors", async () => {
  for (const [status, code] of [["active", "ER_BAD_DB_ERROR"], ["inactive", "ER_ACCESS_DENIED_ERROR"], ["inactive", "ECONNREFUSED"]] as const) {
    const error = Object.assign(new Error(code), { code });
    await assert.rejects(existingTenantMigrationTargets([{ tenantCode: "T", status, dbName: "test_db" }], async () => { throw error; }), error);
  }
});
