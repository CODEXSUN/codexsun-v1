import assert from "node:assert/strict";
import { test } from "node:test";
import { frappeAvailabilityWindow, isFrappeUnavailable } from "./live-sync.availability.policy.js";
const settings = {
  scheduleEnabled: true,
  timezone: "Asia/Kolkata",
  opensAt: "08:00",
  closesAt: "21:00"
};
test("daily server hours close at 9pm and reopen at 8am in the tenant timezone", () => {
  assert.equal(frappeAvailabilityWindow(settings, new Date("2026-10-25T15:29:59Z")).open, true);
  assert.deepEqual(frappeAvailabilityWindow(settings, new Date("2026-10-25T15:30:00Z")), {
    open: false,
    nextOpenAt: "2026-10-26T02:30:00.000Z"
  });
  assert.equal(frappeAvailabilityWindow(settings, new Date("2026-10-26T02:29:59Z")).open, false);
  assert.equal(frappeAvailabilityWindow(settings, new Date("2026-10-26T02:30:00Z")).open, true);
});
test("disabled and overnight schedules use the correct window", () => {
  assert.equal(
    frappeAvailabilityWindow(
      { ...settings, scheduleEnabled: false },
      new Date("2026-10-25T18:00:00Z")
    ).open,
    true
  );
  assert.equal(
    frappeAvailabilityWindow(
      { ...settings, opensAt: "21:00", closesAt: "08:00" },
      new Date("2026-10-25T18:00:00Z")
    ).open,
    true
  );
});
test("the next opening follows timezone daylight saving changes", () => {
  assert.equal(
    frappeAvailabilityWindow(
      { ...settings, timezone: "America/New_York" },
      new Date("2026-10-31T23:00:00Z")
    ).open,
    true
  );
  assert.equal(
    frappeAvailabilityWindow(
      { ...settings, timezone: "America/New_York" },
      new Date("2026-11-01T02:00:00Z")
    ).nextOpenAt,
    "2026-11-01T13:00:00.000Z"
  );
});
test("only availability failures open the circuit, not record mapping errors", () => {
  assert.equal(
    isFrappeUnavailable(
      new Error("Frappe is unavailable: Cloudflare Tunnel error (HTTP 530, Error 1033).")
    ),
    true
  );
  assert.equal(isFrappeUnavailable(new Error("Frappe could not be reached.")), true);
  assert.equal(isFrappeUnavailable(new Error("No Customer mapping found")), false);
});
