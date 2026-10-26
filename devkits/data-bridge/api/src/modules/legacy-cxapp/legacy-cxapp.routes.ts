import type { FastifyInstance } from "fastify";
import type { CommonTableImportHost } from "../import-review/index.js";

export function registerLegacyPreparationRoutes(app: FastifyInstance, host: CommonTableImportHost) {
  app.get("/legacy-preparation/capabilities", async (request) => {
    await host.authorize(request);
    return {
      phases: ["core", "masters", "billing"],
      preparation: "local-only",
      executionAuthorized: false
    };
  });
}
