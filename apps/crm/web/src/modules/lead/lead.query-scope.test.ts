import assert from "node:assert/strict";
import { test } from "node:test";
import { leadDetailQueryKey, leadQueryScope, leadRequestContext } from "./lead.query-scope.js";
import { leadSchema } from "./lead.schema.js";

test("lead caches and delayed requests retain their original tenant and company", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map([
    ["codexsun_tenant_id", "tenant-a"],
    ["codexsun_tenant_db_name", "db-a"],
    ["codexsun.tenant.company-id", "1"]
  ]);
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null }
  });
  try {
    const first = leadQueryScope();
    const key = leadDetailQueryKey("1234abcd");
    values.set("codexsun.tenant.company-id", "2");
    assert.notDeepEqual(leadDetailQueryKey("1234abcd"), key);
    assert.equal(leadRequestContext(first).headers["x-company-id"], "1");
    assert.equal(leadRequestContext().headers["x-company-id"], "2");
    values.set("codexsun_tenant_id", "tenant-b");
    values.set("codexsun_tenant_db_name", "db-b");
    assert.notDeepEqual(leadDetailQueryKey("1234abcd"), key);
    assert.equal(leadRequestContext(first).headers["x-tenant-db"], "db-a");
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

test("lead form rejects malformed mobile and forged conversion fields; allows blank contact and details", () => {
  const input = {
    name: "Prospect",
    phone: "9876543210",
    email: "",
    message: "Enquiry details",
    campaignLabel: "Campaign",
    contactId: null,
    status: "review"
  };
  assert.equal(leadSchema.safeParse(input).success, true);
  assert.equal(leadSchema.safeParse({ ...input, name: "", message: "" }).success, true);
  for (const extra of [
    { phone: "123" },
    { status: "converted" },
    { enquiryId: 9 },
    { companyId: 2 }
  ])
    assert.equal(leadSchema.safeParse({ ...input, ...extra }).success, false);
});
