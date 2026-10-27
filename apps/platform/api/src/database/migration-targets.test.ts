import assert from "node:assert/strict";
import test from "node:test";
import { crmPermissionTargets, tenantMigrationTargets } from "./migration-targets.js";

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
