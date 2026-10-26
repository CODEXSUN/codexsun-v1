import "@codexsun/framework/api";
import type { FastifyInstance } from "fastify";
import { dataBridgeModule } from "./modules/data-bridge/data-bridge.module.js";
import { migrateDataBridgeDatabase } from "./modules/data-bridge/data-bridge.migration.js";
import type { CommonTableImportHost } from "./modules/import-review/import-review.types.js";

export { migrateDataBridgeDatabase };
export { CommonBulkService } from "./modules/report/report.bulk.service.js";
export type { CommonTableImportHost } from "./modules/import-review/import-review.types.js";
export const dataBridgeApiModuleKeys = [
  dataBridgeModule.key,
  "data-bridge.legacy-preparation",
  "data-bridge.database-connection",
  "data-bridge.common-tables",
  "data-bridge.master-tables",
  "data-bridge.billing-tables",
  "data-bridge.report",
  "data-bridge.business-import"
] as const;

export async function registerDataBridgeApi(app: FastifyInstance, host: CommonTableImportHost) {
  await app.register(
    async (scope) => {
      scope.addHook("preHandler", async (request) => {
        await host.authorize(request);
      });
      dataBridgeModule.register(scope, host);
    },
    { prefix: "/api/data-bridge" }
  );
}

export { TransferService } from "./modules/transfer-session/transfer-session.service.js";
export { ConflictResolutionService } from "./modules/report/report.resolution.service.js";

export { BusinessImportService, businessImportWorker } from "./modules/business-import/index.js";
