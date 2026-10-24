import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import { resolveBillingDatabaseName } from "../../database/billing-database.js";
import { BillingSettingsService } from "./settings.service.js";

const service = new BillingSettingsService();

const numberSettingsSchema = z.object({
  automatic: z.boolean(),
  nextNumber: z.number().int().positive(),
  padding: z.number().int().min(1).max(12),
  prefix: z.string(),
  separator: z.string(),
  suffix: z.string(),
  usePrefix: z.boolean(),
  useSeparator: z.boolean(),
  useSuffix: z.boolean()
});
const numberingSchema = z.object({
  exportSales: numberSettingsSchema,
  payment: numberSettingsSchema,
  purchase: numberSettingsSchema,
  quotation: numberSettingsSchema,
  receipt: numberSettingsSchema,
  sales: numberSettingsSchema
});
const settingsSchema = z.object({
  features: z.object({
    exportSales: z.boolean(),
    quotation: z.boolean(),
    tconnect: z.boolean()
  }),
  gstApiMode: z.enum(["none", "einvoice_eway", "einvoice_only", "eway_only"]),
  layout: z.object({
    useColour: z.boolean(),
    useDc: z.boolean(),
    useEinvoice: z.boolean(),
    useEway: z.boolean(),
    usePo: z.boolean(),
    useSize: z.boolean(),
    useWorkOrder: z.boolean()
  }),
  numbering: numberingSchema,
  customise: z.object({
    documentTitles: z.object({
      payment: z.string(),
      purchase: z.string(),
      quotation: z.string(),
      receipt: z.string(),
      sales: z.string()
    }),
    printLanguage: z.literal("english")
  }),
  printing: z.object({
    addressMode: z.enum(["billing_only", "billing_and_shipping"]),
    customTerms: z.string(),
    defaultTerms: z.string(),
    documentTerms: z.object({
      exportSales: z.string(),
      purchase: z.string(),
      quotation: z.string(),
      sales: z.string()
    }),
    letterhead: z.object({
      addressColor: z.string(),
      addressFont: z.string(),
      addressSize: z.number(),
      borderColor: z.string(),
      companyColor: z.string(),
      companyFont: z.string(),
      companySize: z.number(),
      contactSize: z.number(),
      headerHeightMm: z.number(),
      logoHeightMm: z.number(),
      logoLeftMm: z.number(),
      logoTopMm: z.number(),
      logoWidthMm: z.number(),
      taxSize: z.number()
    }),
    printAccountNumber: z.boolean(),
    printQrAccountDetails: z.boolean(),
    printWithLogo: z.boolean(),
    useCustomTerms: z.boolean()
  })
});

export async function registerBillingSettingsRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: "/billing/settings/currencies",
    schemas: { response: z.array(z.object({ id: z.number().int().positive(), name: z.string() })) },
    handler: ({ request }) => service.currencies(...context(request))
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/billing/settings",
    schemas: { response: settingsSchema },
    handler: ({ request }) => service.getBillingSettings(...context(request))
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/billing/settings",
    schemas: { body: settingsSchema, response: settingsSchema },
    handler: ({ body, request }) => service.saveBillingSettings(...context(request), body)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/billing/settings/sales",
    schemas: { response: settingsSchema },
    handler: ({ request }) => service.getSalesSettings(...context(request))
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/billing/settings/sales",
    schemas: { body: settingsSchema, response: settingsSchema },
    handler: ({ body, request }) => service.saveSalesSettings(...context(request), body)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/billing/document-settings",
    schemas: { response: numberingSchema },
    handler: async ({ request }) =>
      (await service.getBillingSettings(...context(request))).numbering
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/billing/document-settings",
    schemas: { body: numberingSchema, response: numberingSchema },
    handler: async ({ body, request }) => {
      const [databaseName, companyId] = context(request);
      const settings = await service.getBillingSettings(databaseName, companyId);
      return (
        await service.saveBillingSettings(databaseName, companyId, {
          ...settings,
          numbering: body
        })
      ).numbering;
    }
  });
}

function context(request: FastifyRequest): [string, number] {
  const tenantHeader = request.headers["x-tenant-db"];
  const companyHeader = request.headers["x-company-id"];
  const databaseName = resolveBillingDatabaseName(
    Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader
  );
  const companyId = Number(Array.isArray(companyHeader) ? companyHeader[0] : companyHeader);
  if (!Number.isInteger(companyId) || companyId <= 0)
    throw AppError.validation("x-company-id is required for Billing settings.");
  return [databaseName, companyId];
}
