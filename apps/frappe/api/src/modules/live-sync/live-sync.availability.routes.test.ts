import { AppError } from "@codexsun/framework/errors";
import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { registerFrappeAvailabilityRoutes } from "./live-sync.availability.routes.js";
import type { FrappeAvailabilityService } from "./live-sync.availability.js";
test("availability settings reject invalid timezone and ambiguous hours before saving", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  let saves = 0;
  registerFrappeAvailabilityRoutes(app, async () => ({
    actor: "test",
    service: {
      save: async () => {
        saves++;
      }
    } as unknown as FrappeAvailabilityService
  }));
  for (const body of [
    { scheduleEnabled: true, timezone: "Invalid/Timezone", opensAt: "08:00", closesAt: "21:00" },
    { scheduleEnabled: true, timezone: "Asia/Kolkata", opensAt: "08:00", closesAt: "08:00" },
    { scheduleEnabled: true, timezone: "Asia/Kolkata", opensAt: "25:00", closesAt: "21:00" }
  ])
    assert.equal(
      (await app.inject({ method: "PUT", url: "/frappe/availability", payload: body })).statusCode,
      400
    );
  assert.equal(saves, 0);
});

test("availability reads, saves, and live checks require the composed permission", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  registerFrappeAvailabilityRoutes(app, async () => {
    throw AppError.forbidden("Frappe connection management is required.");
  });
  assert.equal((await app.inject({ method: "GET", url: "/frappe/availability" })).statusCode, 403);
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/frappe/availability",
        payload: {
          scheduleEnabled: true,
          timezone: "Asia/Kolkata",
          opensAt: "08:00",
          closesAt: "21:00"
        }
      })
    ).statusCode,
    403
  );
  assert.equal(
    (await app.inject({ method: "POST", url: "/frappe/availability/check", payload: {} }))
      .statusCode,
    403
  );
});
