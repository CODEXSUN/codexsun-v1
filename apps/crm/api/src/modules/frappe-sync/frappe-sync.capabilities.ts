import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";

export function registerCrmFrappeSyncCapabilities(
  app: FastifyInstance,
  read: (request: FastifyRequest) => Promise<{ enabled: boolean }>
) {
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/frappe-sync/capabilities",
    schemas: { response: z.object({ enabled: z.boolean() }) },
    handler: ({ request }) => read(request)
  });
}
