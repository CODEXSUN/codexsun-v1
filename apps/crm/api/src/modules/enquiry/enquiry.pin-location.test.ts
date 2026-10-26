import assert from "node:assert/strict";
import { test } from "node:test";
import { pinLocationDetails } from "./enquiry.pin-location.js";

test("pin details preserve seven coordinate decimals, two accuracy decimals, and the capture instant", () => {
  const details = pinLocationDetails({
    latitude: 11.1292752,
    longitude: 77.3409328,
    accuracyMeters: 381,
    capturedAt: "2026-10-26T17:16:02+05:30"
  });
  assert.equal(
    details,
    "[11.1292752, 77.3409328](https://www.google.com/maps?q=11.1292752,77.3409328) · Accuracy: 381.00 m · Captured: 2026-10-26T11:46:02.000Z"
  );
  assert.equal(details.includes("\n"), false);
});
