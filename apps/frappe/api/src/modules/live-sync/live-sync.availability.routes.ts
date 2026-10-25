import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import type { FrappeAvailabilityService } from "./live-sync.availability.js";
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);
const input = z
  .object({
    scheduleEnabled: z.boolean(),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid IANA timezone."),
    opensAt: time,
    closesAt: time
  })
  .strict()
  .refine((value) => value.opensAt !== value.closesAt, "Opening and closing times must differ.");
const response = z.object({
  scheduleEnabled: z.boolean(),
  timezone: z.string(),
  opensAt: time,
  closesAt: time,
  status: z.enum(["unknown", "online", "offline", "closed"]),
  lastCheckedAt: z.string().nullable(),
  nextCheckAt: z.string().nullable(),
  reason: z.string().nullable()
});
export function registerFrappeAvailabilityRoutes(
  app: FastifyInstance,
  context: (
    request: FastifyRequest
  ) => Promise<{ service: FrappeAvailabilityService; actor: string }>
) {
  registerContractRoute(app, {
    method: "GET",
    url: "/frappe/availability",
    schemas: { response },
    handler: async ({ request }) => (await context(request)).service.settings()
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/frappe/availability",
    schemas: { body: input, response },
    handler: async ({ request, body }) => {
      const scope = await context(request);
      return scope.service.save(body, scope.actor);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/frappe/availability/check",
    schemas: { body: z.object({}).strict(), response },
    handler: async ({ request }) => {
      const scope = await context(request);
      await scope.service.ready();
      return scope.service.settings();
    }
  });
}
