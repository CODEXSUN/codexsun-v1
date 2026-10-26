import assert from "node:assert/strict";
import { test } from "node:test";
import { enquiryCountForFilter } from "./enquiry.status-filter.js";

test("pagination totals match status groups including tenant-defined statuses", () => {
  const counts = [
    "new",
    "open",
    "reopen",
    "escalation",
    "hold-for-approval",
    "long-hold",
    "hold-for-spares",
    "hold-for-job-out",
    "won",
    "lost",
    "closed",
    "custom"
  ].map((code) => ({ code, count: 2 }));
  for (const [filter, expected] of Object.entries({
    all: 24,
    active: 18,
    hold: 8,
    "pending-group": 6,
    "in-progress": 14,
    "closed-group": 6,
    other: 2,
    new: 2,
    custom: 2,
    missing: 0
  })) {
    assert.equal(enquiryCountForFilter(counts, filter), expected, filter);
  }
});
