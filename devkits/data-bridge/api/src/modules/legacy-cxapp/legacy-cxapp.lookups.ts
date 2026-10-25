import type { LegacyRecord } from "./legacy-cxapp.types.js";
import { productTaxRate } from "./legacy-cxapp.amounts.js";
import {
  LegacyPreparationRepository,
  legacyStatus,
  legacyText
} from "./legacy-cxapp.repository.js";
export class LegacyLookupPreparation {
  constructor(private readonly repository: LegacyPreparationRepository) {}
  async run() {
    for (const [source, key, name, target] of [
      ["contacttype_tbl", "CONTACTTYPE_ID", "CONTACTTYPE_NAME", "core_contact_types"],
      ["producttype_tbl", "PRODUCTTYPE_ID", "PRODUCTTYPE_NAME", "core_product_types"],
      ["unit_tbl", "UNIT_ID", "UNIT_NAME", "core_units"],
      ["hsncode_tbl", "HSNCODE_ID", "HSNCODE_NAME", "core_hsn_codes"],
      ["salestype_tbl", "SALESTYPE_ID", "SALESTYPE_NAME", "core_sales_types"]
    ])
      await this.named(source!, key!, name!, target!);
    await this.taxes();
    await this.ledgers();
    await this.currency();
  }
  private async named(sourceTable: string, key: string, field: string, targetTable: string) {
    const destination = targetTable === "core_hsn_codes" ? "code" : "name";
    await this.repository.mapping({
      phase: "core",
      sourceTable,
      sourceKey: key,
      targetTable,
      columns: {
        [destination]: field,
        status: "ACTIVE_ID",
        ...(targetTable === "core_hsn_codes" ? { description: "DESCRIPTION" } : {})
      }
    });
    for (const source of await this.repository.read(sourceTable)) {
      const name = legacyText(source[field]);
      const target = await this.repository.matches(targetTable, { [destination]: name });
      const canonical =
        target.length === 1 &&
        legacyText(target[0]![destination]).toLowerCase() === name.toLowerCase()
          ? String(target[0]![destination])
          : name;
      const data: LegacyRecord = {
        [destination]: canonical,
        status: legacyStatus(source.ACTIVE_ID)
      };
      if (targetTable === "core_hsn_codes") data.description = legacyText(source.DESCRIPTION);
      await this.repository.save(
        {
          phase: "core",
          sourceTable,
          sourceKey: String(source[key]),
          targetTable,
          source,
          data,
          issues: []
        },
        [destination]
      );
    }
  }

  private async taxes() {
    await this.repository.mapping({
      phase: "core",
      sourceTable: "invoiceitems_tbl",
      sourceKey: "combined tax rate",
      targetTable: "core_taxes",
      columns: {
        rate_percent: "CGST_PERCENT + SGST_PERCENT + IGST_PERCENT",
        description: "derived historical total GST rate"
      }
    });
    const rates = new Set(
      (await this.repository.read("invoiceitems_tbl")).map(
        (r) => Number(r.CGST_PERCENT) + Number(r.SGST_PERCENT) + Number(r.IGST_PERCENT)
      )
    );
    for (const source of await this.repository.read("product_tbl")) {
      try {
        const rate = productTaxRate(source);
        if (rate !== null) rates.add(rate);
      } catch {
        /* Incomplete product tax paths stay blocked in Masters. */
      }
    }
    for (const rate of [...rates].sort((a, b) => a - b)) {
      const target = await this.repository.matches("core_taxes", { rate_percent: rate });
      await this.repository.save(
        {
          phase: "core",
          sourceTable: "invoiceitems_tbl",
          sourceKey: String(rate),
          targetTable: "core_taxes",
          source: { rate_percent: rate },
          data: {
            rate_percent: rate,
            description: target.length === 1 ? target[0]!.description! : `${rate}% GST`,
            status: "active"
          },
          issues: []
        },
        ["rate_percent"]
      );
    }
  }

  private async ledgers() {
    await this.named("ledgergroup_tbl", "LEDGERGROUP_ID", "LEDGERGROUP_NAME", "core_ledger_groups");
    await this.repository.mapping({
      phase: "core",
      sourceTable: "ledger_tbl",
      sourceKey: "LEDGER_ID",
      targetTable: "core_ledgers",
      columns: { name: "LEDGER_NAME", ledger_group_id: "LEDGERGROUP_ID", status: "ACTIVE_ID" }
    });
    for (const source of await this.repository.read("ledger_tbl"))
      await this.repository.save(
        {
          phase: "core",
          sourceTable: "ledger_tbl",
          sourceKey: String(source.LEDGER_ID),
          targetTable: "core_ledgers",
          source,
          data: { name: legacyText(source.LEDGER_NAME), status: legacyStatus(source.ACTIVE_ID) },
          issues: []
        },
        ["ledger_group_id", "name"],
        [
          {
            field: "ledger_group_id",
            row: this.repository.find("core_ledger_groups", Number(source.LEDGERGROUP_ID))
          }
        ]
      );
  }

  private async currency() {
    await this.repository.mapping({
      phase: "core",
      sourceTable: "missing-source-currency",
      sourceKey: "invoice-currency",
      targetTable: "core_currencies",
      columns: {
        name: "review required; legacy invoice has no currency",
        symbol: "verified target currency symbol"
      }
    });
    const candidates = await this.repository.matches("core_currencies", { name: "INR" });
    await this.repository.save(
      {
        phase: "core",
        sourceTable: "missing-source-currency",
        sourceKey: "invoice-currency",
        targetTable: "core_currencies",
        source: {},
        data: {
          name: "INR",
          symbol: candidates.length === 1 ? candidates[0]!.symbol! : null,
          status: "active"
        },
        issues: ["Confirm invoice currency; INR is a proposal, not an extracted source value."]
      },
      ["name"]
    );
  }
}
