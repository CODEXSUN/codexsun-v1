import assert from "node:assert/strict";
import { test } from "node:test";
import { crmEnquiryDeliveryKey } from "./crm-enquiry-sync.relay.js";

test("manual retry gets a fresh delivery while repeated scans reuse one job", () => {
  const initial = { id: 72, attempts: 0, correlation_id: "original-create" };
  const original = crmEnquiryDeliveryKey("TECHMEDIA", initial);
  assert.equal(crmEnquiryDeliveryKey("TECHMEDIA", initial), original);
  assert.notEqual(crmEnquiryDeliveryKey("TECHMEDIA", { ...initial, attempts: 1 }), original);
  assert.notEqual(
    crmEnquiryDeliveryKey("TECHMEDIA", {
      ...initial,
      correlation_id: "manual-retry"
    }),
    original
  );
  assert.notEqual(crmEnquiryDeliveryKey("RAINBOW", initial), original);
});
