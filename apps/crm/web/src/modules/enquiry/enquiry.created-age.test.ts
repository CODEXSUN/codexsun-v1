import assert from "node:assert/strict";
import { test } from "node:test";
import { compactCreatedAge } from "./enquiry.created-age.js";

test("created age shows one compact unit and handles future or invalid dates", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  const age = (seconds: number) =>
    compactCreatedAge(new Date(now - seconds * 1000).toISOString(), now);
  assert.equal(age(5 * 3600), "5 h");
  assert.equal(age(2 * 86400), "2 d");
  assert.equal(age(7 * 86400), "1 w");
  assert.equal(age(30 * 86400), "1 mo");
  assert.equal(compactCreatedAge(new Date(now + 3600000).toISOString(), now), "in 1 h");
  assert.equal(compactCreatedAge("invalid", now), "—");
});
