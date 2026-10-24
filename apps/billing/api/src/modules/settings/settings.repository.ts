import { sql, type Generated, type Kysely } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import { getBillingDatabase } from "../../database/billing-database.js";
import {
  defaultBillingSettings,
  defaultBillingSalesSettings,
  type BillingDocumentKind,
  type BillingDocumentLayoutSettings,
  type BillingGstApiMode,
  type BillingNumberDocumentKind,
  type BillingSettings
} from "./settings.types.js";

type BillingSettingsRow = {
  created_at: string | null;
  id: number;
  settings_key: string;
  settings_json: string | null;
  updated_at: string | null;
};

type BillingSettingsDatabase = {
  billing_settings: BillingSettingsRow;
  billing_company_settings: {
    company_id: number;
    created_at: Generated<string>;
    id: Generated<number>;
    settings_json: string | null;
    settings_key: string;
    updated_at: Generated<string>;
    uuid: string;
  };
};

export class BillingSettingsRepository {
  async currencies(databaseName: string, companyId: number) {
    await this.assertCompany(databaseName, companyId);
    return (
      await sql<{ id: number; name: string }>`
        SELECT id, UPPER(name) AS name FROM core_currencies
        WHERE CHAR_LENGTH(name)=3 ORDER BY name,id
      `.execute(await getBillingDatabase(databaseName))
    ).rows;
  }

  async getBillingSettings(databaseName: string, companyId: number): Promise<BillingSettings> {
    await this.assertCompany(databaseName, companyId);
    const companyRow = await (
      await database(databaseName)
    )
      .selectFrom("billing_company_settings")
      .selectAll()
      .where("company_id", "=", companyId)
      .where("settings_key", "=", "billing")
      .executeTakeFirst();
    if (companyRow) return normalizeSettings(companyRow.settings_json);

    const row = await (
      await database(databaseName)
    )
      .selectFrom("billing_settings")
      .selectAll()
      .where("settings_key", "=", "billing")
      .executeTakeFirst();
    const settings = row ? normalizeSettings(row.settings_json) : defaultBillingSettings;
    await (
      await database(databaseName)
    )
      .insertInto("billing_company_settings")
      .values({
        company_id: companyId,
        settings_key: "billing",
        settings_json: JSON.stringify(settings),
        uuid: publicUuid()
      })
      .onDuplicateKeyUpdate({ company_id: companyId })
      .execute();
    return this.getBillingSettings(databaseName, companyId);
  }

  async saveBillingSettings(databaseName: string, companyId: number, input: BillingSettings) {
    await this.assertCompany(databaseName, companyId);
    const db = await database(databaseName);
    const settings = normalizeSettings(JSON.stringify(input));
    const payload = JSON.stringify(settings);
    await db
      .insertInto("billing_company_settings")
      .values({
        company_id: companyId,
        settings_json: payload,
        settings_key: "billing",
        uuid: publicUuid()
      })
      .onDuplicateKeyUpdate({
        settings_json: payload,
        updated_at: sql`CURRENT_TIMESTAMP(3)`
      })
      .execute();
    return settings;
  }

  async getSalesSettings(databaseName: string, companyId: number) {
    return this.getBillingSettings(databaseName, companyId);
  }

  async saveSalesSettings(databaseName: string, companyId: number, input: BillingSettings) {
    return this.saveBillingSettings(databaseName, companyId, input);
  }

  async advanceNextNumber(
    databaseName: string,
    companyId: number,
    kind: BillingNumberDocumentKind,
    minimumNextNumber: number
  ) {
    await this.getBillingSettings(databaseName, companyId);
    const path = `$.numbering.${kind}.nextNumber`;
    await sql`
      UPDATE billing_company_settings
      SET settings_json = JSON_SET(
        settings_json,
        ${path},
        GREATEST(
          COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(settings_json, ${path})) AS UNSIGNED), 1),
          ${Math.max(1, Math.trunc(minimumNextNumber))}
        )
      ), updated_at = CURRENT_TIMESTAMP(3)
      WHERE company_id = ${companyId} AND settings_key = 'billing'
    `.execute(await database(databaseName));
    return this.getBillingSettings(databaseName, companyId);
  }

  async defaultCompanyId(databaseName: string) {
    const result = await sql<{ company_id: number }>`
      SELECT company_id FROM core_default_company_settings
      WHERE singleton_key = 1 AND status = 'active'
      LIMIT 1
    `.execute(await database(databaseName));
    const companyId = Number(result.rows[0]?.company_id ?? 0);
    if (!companyId)
      throw AppError.conflict("An active Default Company is required for Billing settings.");
    return companyId;
  }

  private async assertCompany(databaseName: string, companyId: number) {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw AppError.validation("x-company-id is required for Billing settings.");
    }
    const result = await sql<{ id: number }>`
      SELECT id FROM core_companies WHERE id = ${companyId} AND status = 'active' LIMIT 1
    `.execute(await database(databaseName));
    if (!result.rows[0])
      throw AppError.validation("The selected company is not active or does not exist.");
  }
}

function publicUuid() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}

function database(databaseName: string) {
  return getBillingDatabase(databaseName) as unknown as Promise<Kysely<BillingSettingsDatabase>>;
}

function normalizeSettings(value: string | null): BillingSettings {
  if (!value) return defaultBillingSalesSettings;
  try {
    const parsed = JSON.parse(value) as Omit<Partial<BillingSettings>, "layout"> &
      Partial<BillingDocumentLayoutSettings> & {
        featureQuotation?: boolean;
        layout?:
          | Partial<BillingDocumentLayoutSettings>
          | Partial<Record<BillingDocumentKind, Partial<BillingDocumentLayoutSettings>>>;
      };
    const legacyLayout: Partial<BillingDocumentLayoutSettings> = {};
    if (typeof parsed.useColour === "boolean") legacyLayout.useColour = parsed.useColour;
    if (typeof parsed.useDc === "boolean") legacyLayout.useDc = parsed.useDc;
    if (typeof parsed.useEinvoice === "boolean") legacyLayout.useEinvoice = parsed.useEinvoice;
    if (typeof parsed.useEway === "boolean") legacyLayout.useEway = parsed.useEway;
    if (typeof parsed.usePo === "boolean") legacyLayout.usePo = parsed.usePo;
    if (typeof parsed.useSize === "boolean") legacyLayout.useSize = parsed.useSize;
    if (typeof parsed.useWorkOrder === "boolean") legacyLayout.useWorkOrder = parsed.useWorkOrder;
    const hasLegacyLayout = Object.values(legacyLayout).some((value) => typeof value === "boolean");
    const normalizedLegacyLayout = hasLegacyLayout ? normalizeLayout(legacyLayout) : undefined;
    const savedLayout = normalizeSavedLayout(parsed.layout, normalizedLegacyLayout);
    const gstApiMode: BillingGstApiMode =
      parsed.gstApiMode === "none" ||
      parsed.gstApiMode === "eway_only" ||
      parsed.gstApiMode === "einvoice_only" ||
      parsed.gstApiMode === "einvoice_eway"
        ? parsed.gstApiMode
        : savedLayout.useEinvoice && savedLayout.useEway
          ? "einvoice_eway"
          : savedLayout.useEinvoice
            ? "einvoice_only"
            : savedLayout.useEway
              ? "eway_only"
              : "none";
    return {
      ...defaultBillingSettings,
      features: {
        exportSales: parsed.features?.exportSales ?? defaultBillingSettings.features.exportSales,
        quotation:
          typeof parsed.featureQuotation === "boolean"
            ? parsed.featureQuotation
            : (parsed.features?.quotation ?? defaultBillingSettings.features.quotation),
        tconnect: parsed.features?.tconnect ?? defaultBillingSettings.features.tconnect
      },
      gstApiMode,
      layout: {
        ...savedLayout,
        useEinvoice: gstApiMode === "einvoice_eway" || gstApiMode === "einvoice_only",
        useEway: gstApiMode === "einvoice_eway" || gstApiMode === "eway_only"
      },
      numbering: normalizeNumbering(parsed.numbering),
      customise: {
        documentTitles: {
          ...defaultBillingSettings.customise.documentTitles,
          ...(parsed.customise?.documentTitles ?? {})
        },
        printLanguage: "english"
      },
      printing: {
        ...defaultBillingSettings.printing,
        ...(parsed.printing ?? {}),
        documentTerms: {
          ...defaultBillingSettings.printing.documentTerms,
          ...(parsed.printing?.documentTerms ?? {})
        },
        letterhead: {
          ...defaultBillingSettings.printing.letterhead,
          ...(parsed.printing?.letterhead ?? {})
        }
      }
    };
  } catch {
    return defaultBillingSalesSettings;
  }
}

function normalizeNumbering(
  value: Partial<BillingSettings["numbering"]> | undefined
): BillingSettings["numbering"] {
  return {
    exportSales: normalizeNumberingSequence(
      defaultBillingSettings.numbering.exportSales,
      value?.exportSales
    ),
    payment: normalizeNumberingSequence(defaultBillingSettings.numbering.payment, value?.payment),
    purchase: normalizeNumberingSequence(
      defaultBillingSettings.numbering.purchase,
      value?.purchase
    ),
    quotation: normalizeNumberingSequence(
      defaultBillingSettings.numbering.quotation,
      value?.quotation
    ),
    receipt: normalizeNumberingSequence(defaultBillingSettings.numbering.receipt, value?.receipt),
    sales: normalizeNumberingSequence(defaultBillingSettings.numbering.sales, value?.sales)
  };
}

function normalizeNumberingSequence(
  defaults: BillingSettings["numbering"]["sales"],
  value: Partial<BillingSettings["numbering"]["sales"]> | undefined
) {
  const nextNumber = Number(value?.nextNumber ?? defaults.nextNumber);
  return {
    ...defaults,
    ...(value ?? {}),
    nextNumber: Number.isFinite(nextNumber) ? Math.max(1, Math.trunc(nextNumber)) : 1
  };
}

function normalizeLayout(
  value: Partial<BillingDocumentLayoutSettings> | undefined
): BillingDocumentLayoutSettings {
  return {
    ...defaultBillingSettings.layout,
    ...(value ?? {})
  };
}

function normalizeSavedLayout(
  value:
    | Partial<BillingDocumentLayoutSettings>
    | Partial<Record<BillingDocumentKind, Partial<BillingDocumentLayoutSettings>>>
    | undefined,
  legacyLayout: BillingDocumentLayoutSettings | undefined
) {
  if (!value) return normalizeLayout(legacyLayout);
  if ("usePo" in value || "useDc" in value || "useColour" in value) {
    return normalizeLayout(value as Partial<BillingDocumentLayoutSettings>);
  }
  const documentLayouts = value as Partial<
    Record<BillingDocumentKind, Partial<BillingDocumentLayoutSettings>>
  >;
  return normalizeLayout(
    documentLayouts.sales ?? documentLayouts.quotation ?? documentLayouts.purchase ?? legacyLayout
  );
}
