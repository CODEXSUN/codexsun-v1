import { legacyPreparationModule } from "../legacy-cxapp/index.js";
import { registerBusinessImport } from "../business-import/business-import.module.js";
import { registerDatabaseConnection } from "../database-connection/database-connection.module.js";
import { registerCommonTables } from "../common-tables/common-tables.module.js";
import { registerMasterTables } from "../master-tables/master-tables.module.js";
import { registerBillingTables } from "../billing-tables/billing-tables.module.js";
import { transferSessionModule } from "../transfer-session/transfer-session.module.js";
import { registerReport } from "../report/report.module.js";
import type { FastifyInstance } from "fastify";
import { importReviewModule } from "../import-review/import-review.module.js";
import type { CommonTableImportHost } from "../import-review/index.js";

export const dataBridgeModule = {
  key: "data-bridge.common-table-import",
  register(app: FastifyInstance, host: CommonTableImportHost) {
    legacyPreparationModule.register(app, host);
    importReviewModule.register(app, host);
    transferSessionModule.register(app, host);
    registerDatabaseConnection(app, host);
    registerCommonTables(app, host);
    registerMasterTables(app, host);
    registerBillingTables(app, host);
    registerReport(app, host);
    registerBusinessImport(app, host);
  }
};
