import { BillingSettingsRepository } from "./settings.repository.js";
import { defaultBillingSettings, type BillingSettings } from "./settings.types.js";

export class BillingSettingsService {
  constructor(private readonly repository = new BillingSettingsRepository()) {}

  currencies(databaseName: string, companyId: number) {
    return this.repository.currencies(databaseName, companyId);
  }

  getBillingSettings(databaseName: string, companyId: number) {
    return this.repository.getBillingSettings(databaseName, companyId);
  }

  saveBillingSettings(databaseName: string, companyId: number, input: BillingSettings) {
    return this.repository.saveBillingSettings(
      databaseName,
      companyId,
      normalizeBillingSettings(input)
    );
  }

  getSalesSettings(databaseName: string, companyId: number) {
    return this.getBillingSettings(databaseName, companyId);
  }

  saveSalesSettings(databaseName: string, companyId: number, input: BillingSettings) {
    return this.saveBillingSettings(databaseName, companyId, input);
  }
}

function normalizeBillingSettings(input: BillingSettings): BillingSettings {
  return {
    ...defaultBillingSettings,
    ...input,
    features: {
      exportSales: input.features?.exportSales ?? defaultBillingSettings.features.exportSales,
      quotation: input.features?.quotation ?? defaultBillingSettings.features.quotation,
      tconnect: input.features?.tconnect ?? defaultBillingSettings.features.tconnect
    },
    gstApiMode: normalizedGstApiMode(input),
    layout: normalizedLayout(input),
    numbering: {
      exportSales: {
        ...defaultBillingSettings.numbering.exportSales,
        ...(input.numbering?.exportSales ?? {})
      },
      payment: { ...defaultBillingSettings.numbering.payment, ...(input.numbering?.payment ?? {}) },
      purchase: {
        ...defaultBillingSettings.numbering.purchase,
        ...(input.numbering?.purchase ?? {})
      },
      quotation: {
        ...defaultBillingSettings.numbering.quotation,
        ...(input.numbering?.quotation ?? {})
      },
      receipt: { ...defaultBillingSettings.numbering.receipt, ...(input.numbering?.receipt ?? {}) },
      sales: { ...defaultBillingSettings.numbering.sales, ...(input.numbering?.sales ?? {}) }
    },
    customise: {
      documentTitles: {
        ...defaultBillingSettings.customise.documentTitles,
        ...(input.customise?.documentTitles ?? {})
      },
      printLanguage: "english"
    },
    printing: {
      ...defaultBillingSettings.printing,
      ...(input.printing ?? {}),
      documentTerms: {
        ...defaultBillingSettings.printing.documentTerms,
        ...(input.printing?.documentTerms ?? {})
      },
      letterhead: {
        ...defaultBillingSettings.printing.letterhead,
        ...(input.printing?.letterhead ?? {})
      }
    }
  };
}

function normalizedGstApiMode(input: BillingSettings) {
  if (input.gstApiMode === "none") return "none" as const;
  if (input.gstApiMode === "eway_only") return "eway_only" as const;
  if (input.gstApiMode === "einvoice_only") return "einvoice_only" as const;
  return "einvoice_eway" as const;
}

function normalizedLayout(input: BillingSettings) {
  const layout = { ...defaultBillingSettings.layout, ...(input.layout ?? {}) };
  const mode = normalizedGstApiMode(input);
  return {
    ...layout,
    useEinvoice: mode === "einvoice_eway" || mode === "einvoice_only",
    useEway: mode === "einvoice_eway" || mode === "eway_only"
  };
}
