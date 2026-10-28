import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchReady } from "./runtime-health.mjs";

test("retries transient proxy startup failures", async () => {
  let count = 0;
  const result = await fetchReady("http://localhost/api/app/ready", {
    request: async () => ({ status: ++count < 3 ? 502 : 200 }),
    pause: async () => {}
  });
  assert.equal(result.status, 200);
  assert.equal(count, 3);
});

test("fails on permanent errors and exhausted retries", async () => {
  await assert.rejects(
    fetchReady("http://localhost/ready", {
      request: async () => ({ status: 401 }),
      pause: async () => {}
    }),
    /HTTP 401/
  );
  await assert.rejects(
    fetchReady("http://localhost/ready", {
      request: async () => ({ status: 502 }),
      pause: async () => {},
      attempts: 2
    }),
    /HTTP 502/
  );
});
