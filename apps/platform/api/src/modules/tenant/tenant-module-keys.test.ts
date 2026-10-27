import assert from "node:assert/strict";
import test from "node:test";
import { parseTenantModuleKeys } from "./tenant-module-keys.js";

test("tenant module keys accept JSON and legacy comma-separated entries", () => {
  assert.deepEqual(parseTenantModuleKeys('["crm","platform.application"]'), [
    "crm",
    "platform.application"
  ]);
  assert.deepEqual(parseTenantModuleKeys("billing.sales,crm,platform.application"), [
    "billing.sales",
    "crm",
    "platform.application"
  ]);
});

test("malformed tenant module keys remain unavailable", () => {
  assert.deepEqual(parseTenantModuleKeys('["crm"'), []);
  assert.deepEqual(parseTenantModuleKeys("crm, unsafe module"), []);
  assert.deepEqual(parseTenantModuleKeys(null), []);
});
