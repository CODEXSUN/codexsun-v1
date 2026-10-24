import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import { getBillingDatabase } from "./database/billing-database.js";
import { requireTenantAccess } from "@codexsun/framework/api";
import { ok } from "@codexsun/framework/http";
import type { FastifyInstance } from "fastify";
import { authorizeBillingRequest } from "./auth/tenant-permission.js";
import {
  currentBillingScope,
  runWithBillingScope,
  setBillingFinalizedEntryEditAccess
} from "./auth/billing-scope.js";
import { resolveBillingDatabaseName } from "./database/billing-database.js";
import { env } from "./env.js";
import { exportSalesModule } from "./modules/export-sales/index.js";
import { purchaseModule } from "./modules/purchase/index.js";
import { paymentModule } from "./modules/payment/index.js";
import { quotationModule } from "./modules/quotation/index.js";
import { salesModule } from "./modules/sales/index.js";
import { receiptModule } from "./modules/receipt/index.js";
import { billingSettingsModule } from "./modules/settings/index.js";
import { dashboardModule } from "./modules/dashboard/index.js";
import { billingReportsModule } from "./modules/reports/index.js";
import { openingBalanceModule } from "./modules/opening-balance/index.js";

export const billingApiModuleKeys = [
  salesModule.key,
  purchaseModule.key,
  exportSalesModule.key,
  quotationModule.key,
  paymentModule.key,
  receiptModule.key,
  billingSettingsModule.key,
  dashboardModule.key,
  billingReportsModule.key,
  openingBalanceModule.key
];

export async function registerBillingApi(app: FastifyInstance) {
  await app.register(async (billingApp) => {
    billingApp.addHook("onRequest", (request, _reply, done) => {
      runWithBillingScope(request, done);
    });
    billingApp.addHook("preHandler", async (request) => {
      const requestedDatabase = request.headers["x-tenant-db"];
      const tenantDatabase = resolveBillingDatabaseName(
        Array.isArray(requestedDatabase) ? requestedDatabase[0] : requestedDatabase
      );
      const claims = requireTenantAccess({
        authorization: request.headers.authorization,
        secret: env.JWT_SECRET,
        tenantDatabase,
        tenantId: request.headers["x-tenant-id"]
      });
      const access = await authorizeBillingRequest(request, tenantDatabase, claims.email ?? "");
      setBillingFinalizedEntryEditAccess(access.canEditFinalizedEntries);
      currentBillingScope().canEditDraftEntries = access.canEditEntries;
      currentBillingScope().actorEmail = claims.email ?? "";
      if (
        request.url.startsWith("/billing/reports/") ||
        request.url.startsWith("/billing/dashboard")
      ) {
        const currency = currentBillingScope().reportCurrencyCode ?? "INR";
        const rows =
          await sql`SELECT id FROM core_currencies WHERE UPPER(name)=${currency} LIMIT 1`.execute(
            await getBillingDatabase(tenantDatabase)
          );
        if (!rows.rows.length)
          throw AppError.validation("The reporting currency is not configured for this tenant.");
      }
    });
    billingApp.get("/billing/access", async (request) => {
      const canEditEntries = Boolean(currentBillingScope().canEditDraftEntries);

      return ok(
        {
          canEditEntries,
          canEditFinalizedEntries: Boolean(currentBillingScope().canEditFinalizedEntries)
        },
        {
          requestId: request.id,
          ...(request.correlationId ? { correlationId: request.correlationId } : {}),
          ...(request.tenantId ? { tenantId: request.tenantId } : {})
        }
      );
    });
    await salesModule.register(billingApp);
    await purchaseModule.register(billingApp);
    await exportSalesModule.register(billingApp);
    await quotationModule.register(billingApp);
    await paymentModule.register(billingApp);
    await receiptModule.register(billingApp);
    await billingSettingsModule.register(billingApp);
    await dashboardModule.register(billingApp);
    await billingReportsModule.register(billingApp);
    await openingBalanceModule.register(billingApp);
  });
}
