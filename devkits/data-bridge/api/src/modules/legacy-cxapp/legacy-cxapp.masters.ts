import { LegacyContactPreparation } from "./legacy-cxapp.contacts.js";
import {
  LegacyPreparationRepository,
  legacyStatus,
  legacyText,
  legacyUuid
} from "./legacy-cxapp.repository.js";
import type { LegacyReference } from "./legacy-cxapp.types.js";
import { productTaxRate } from "./legacy-cxapp.amounts.js";

export class LegacyMasterPreparation {
  constructor(private readonly repository: LegacyPreparationRepository) {}
  async run() {
    await this.companies();
    await new LegacyContactPreparation(this.repository).run();
    await this.products();
  }

  private async companies() {
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "company_tbl",
      sourceKey: "COMPANY_ID",
      targetTable: "core_companies",
      columns: {
        code: "stable LEGACY-COMPANY-<key>",
        name: "COMPANY_NAME; legal identity review required",
        legal_name: "DISPLAY_NAME",
        primary_phone: "CELL1/PHONE",
        primary_email: "EMAIL",
        gstin: "GST",
        pan: "PAN",
        website: "WEBSITE",
        status: "ACTIVE_ID"
      }
    });
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "company_tbl",
      sourceKey: "COMPANY_ID",
      targetTable: "core_financial_years",
      columns: {
        name: "ACCOUNTING_YEAR_FROM/TO; review conflicts against invoice dates",
        start_date: "ACCOUNTING_YEAR_FROM",
        end_date: "ACCOUNTING_YEAR_TO",
        is_current: "not inferred"
      }
    });
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "company_tbl",
      sourceKey: "COMPANY_ID",
      targetTable: "core_companies_addresses",
      columns: {
        parent_id: "verified legal company",
        address_line1: "STREET1",
        address_line2: "STREET2",
        is_default: "one reviewed address"
      }
    });
    for (const source of await this.repository.read("company_tbl")) {
      const key = String(source.COMPANY_ID);
      const company = await this.repository.save(
        {
          phase: "masters",
          sourceTable: "company_tbl",
          sourceKey: key,
          targetTable: "core_companies",
          source,
          data: {
            code: `LEGACY-COMPANY-${key}`,
            name: legacyText(source.COMPANY_NAME),
            legal_name: legacyText(source.DISPLAY_NAME),
            primary_phone: legacyText(source.CELL1 || source.PHONE),
            primary_email: legacyText(source.EMAIL),
            gstin: legacyText(source.GST) || null,
            pan: legacyText(source.PAN) || null,
            website: legacyText(source.WEBSITE) || null,
            status: legacyStatus(source.ACTIVE_ID)
          },
          issues: [
            "Confirm legal-company crosswalk before separating accounting-period company rows. No company will be created."
          ]
        },
        ["code"]
      );
      const start = legacyText(source.ACCOUNTING_YEAR_FROM),
        end = legacyText(source.ACCOUNTING_YEAR_TO);
      await this.repository.save(
        {
          phase: "masters",
          sourceTable: "company_tbl",
          sourceKey: key,
          targetTable: "core_financial_years",
          source,
          data: {
            uuid: legacyUuid("financial-year", key),
            name: `FY ${start.slice(0, 4)}-${end.slice(2, 4)}`,
            start_date: start,
            end_date: end,
            is_current: 0,
            status: "active"
          },
          issues: [
            "Review accounting-year bounds against document dates and resolve duplicate periods before creating a year."
          ]
        },
        ["start_date", "end_date"]
      );
      await this.repository.save(
        {
          phase: "masters",
          sourceTable: "company_tbl",
          sourceKey: key,
          targetTable: "core_companies_addresses",
          source,
          data: {
            address_line1: legacyText(source.STREET1) || null,
            address_line2: legacyText(source.STREET2) || null,
            is_default: 1
          },
          issues: []
        },
        ["parent_id", "address_line1", "address_line2"],
        [{ field: "parent_id", row: company }]
      );
    }
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "default_cmp",
      sourceKey: "DEFAULT_CMP_ID",
      targetTable: "core_default_company_settings",
      columns: {
        singleton_key: "1",
        company_id: "COMPANY_ID → legal company",
        financial_year_id: "COMPANY_ID → verified year",
        landing_app: "review target navigation",
        status: "active"
      }
    });
    for (const source of await this.repository.read("default_cmp"))
      await this.repository.save(
        {
          phase: "masters",
          sourceTable: "default_cmp",
          sourceKey: String(source.DEFAULT_CMP_ID),
          targetTable: "core_default_company_settings",
          source,
          data: { singleton_key: 1, landing_app: null, status: "active" },
          issues: [
            "Confirm default company, year, and landing app. Preserve the target seed settings until approved."
          ]
        },
        ["singleton_key"],
        [
          {
            field: "company_id",
            row: this.repository.find("core_companies", Number(source.COMPANY_ID))
          },
          {
            field: "financial_year_id",
            row: this.repository.find("core_financial_years", Number(source.COMPANY_ID))
          }
        ]
      );
  }

  private async products() {
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "product_tbl",
      sourceKey: "PRODUCT_ID",
      targetTable: "core_products",
      columns: {
        name: "PRODUCT_NAME",
        product_type_id: "PRODUCTTYPE_ID",
        hsn_code_id: "HSNCODE_ID",
        unit_id: "UNIT_ID",
        gst_tax_id: "combined product GST percentage",
        opening_qty: "OPENING_STOCK",
        opening_price: "OPENING_PRICE",
        status: "ACTIVE_ID"
      }
    });
    for (const source of await this.repository.read("product_tbl")) {
      let rate: number | null = null;
      const issues: string[] = [];
      try {
        rate = productTaxRate(source);
      } catch {
        issues.push(
          "Incomplete current product tax percentages; review without changing historical item tax."
        );
      }
      const references: LegacyReference[] = [
        {
          field: "product_type_id",
          row: this.repository.find("core_product_types", Number(source.PRODUCTTYPE_ID))
        },
        {
          field: "hsn_code_id",
          row: this.repository.find("core_hsn_codes", Number(source.HSNCODE_ID))
        },
        { field: "unit_id", row: this.repository.find("core_units", Number(source.UNIT_ID)) }
      ];
      if (rate !== null)
        references.push({ field: "gst_tax_id", row: this.repository.find("core_taxes", rate) });
      await this.repository.save(
        {
          phase: "masters",
          sourceTable: "product_tbl",
          sourceKey: String(source.PRODUCT_ID),
          targetTable: "core_products",
          source,
          data: {
            name: legacyText(source.PRODUCT_NAME),
            opening_qty: source.OPENING_STOCK!,
            opening_price: source.OPENING_PRICE!,
            status: legacyStatus(source.ACTIVE_ID)
          },
          issues
        },
        ["name"],
        references
      );
    }
  }
}
