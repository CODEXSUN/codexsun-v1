import { LegacyPreparationRepository, legacyText, legacyUuid } from "./legacy-cxapp.repository.js";
import { decimalUnits, decimalText, legacyLineAmounts } from "./legacy-cxapp.amounts.js";
import type { LegacyPrepared, LegacyRecord, LegacyReference } from "./legacy-cxapp.types.js";

type PreparedLine = { source: LegacyRecord; data: LegacyRecord; issues: string[] };
export class LegacyBillingPreparation {
  constructor(private readonly repository: LegacyPreparationRepository) {}
  async run() {
    await this.mappings();
    const items = await this.repository.read("invoiceitems_tbl");
    const products = new Map(
      (await this.repository.read("product_tbl")).map((p) => [Number(p.PRODUCT_ID), p])
    );
    const orders = new Map((await this.repository.read("po_tbl")).map((p) => [Number(p.PO_ID), p]));
    const deliveries = new Map(
      (await this.repository.read("dc_tbl")).map((p) => [Number(p.DC_ID), p])
    );
    const companies = new Map(
      (await this.repository.read("company_tbl")).map((r) => [Number(r.COMPANY_ID), r])
    );
    const modes = new Map(
      (await this.repository.read("taxtype_tbl")).map((r) => [
        Number(r.TAXTYPE_ID),
        legacyText(r.TAXTYPE_NAME).toUpperCase()
      ])
    );
    const sequences = new Map<number, number>();
    for (const source of await this.repository.read("invoice_tbl")) {
      const own = items.filter((r) => r.INVOICE_ID === source.INVOICE_ID);
      const lines = own.map((r, i) =>
        this.line(
          r,
          i + 1,
          products.get(Number(r.PRODUCT_ID)),
          orders.get(Number(r.PO_ID)),
          deliveries.get(Number(r.DC_ID))
        )
      );
      const sequence = (sequences.get(Number(source.COMPANY_ID)) ?? 0) + 1;
      sequences.set(Number(source.COMPANY_ID), sequence);
      const label = modes.get(Number(source.TAXTYPE_ID));
      const taxMode = label === "SGST" ? "cgst-sgst" : label === "IGST" ? "igst" : null;
      const issues = this.headerIssues(source, lines, taxMode);
      const company = companies.get(Number(source.COMPANY_ID));
      if (
        !company ||
        String(source.INVOICE_DATE) < String(company.ACCOUNTING_YEAR_FROM) ||
        String(source.INVOICE_DATE) > String(company.ACCOUNTING_YEAR_TO)
      )
        issues.push("Invoice date lies outside the saved company accounting period.");
      if (own.some((r) => r.INVOICE_NO !== source.INVOICE_NO))
        issues.push("Child invoice number disagrees with its header.");
      const subtotal = decimalUnits(source.TOTAL_TAXABLE_AMOUNT, 2),
        tax = decimalUnits(source.GSTTOTAL, 2);
      const amount = decimalUnits(source.GRANDTOTAL, 2),
        additional = decimalUnits(source.ADDITIONAL, 2);
      const header = await this.repository.save(
        {
          phase: "billing",
          sourceTable: "invoice_tbl",
          sourceKey: String(source.INVOICE_ID),
          targetTable: "billing_sales",
          source,
          data: {
            uuid: legacyUuid("sales", String(source.INVOICE_ID)),
            invoice_number: String(source.INVOICE_NO),
            line_number: sequence,
            issued_on: source.INVOICE_DATE!,
            tax_type: taxMode,
            subtotal: decimalText(subtotal, 2),
            tax_amount: decimalText(tax, 2),
            round_off: decimalText(amount - subtotal - tax - additional, 2),
            amount: decimalText(amount, 2),
            status: null,
            notes:
              `${legacyText(source.NOTES)}\nLegacy YEAR_NO: ${source.YEAR_NO}; SALESTYPE_ID: ${source.SALESTYPE_ID}; source invoice: ${source.INVOICE_ID}`.trim()
          },
          issues
        },
        ["company_id", "financial_year_id", "invoice_number"],
        this.headerReferences(source)
      );
      for (const line of lines)
        await this.item(line, header, products.get(Number(line.source.PRODUCT_ID)));
    }
  }

  private async mappings() {
    await this.repository.mapping({
      phase: "billing",
      sourceTable: "invoice_tbl",
      sourceKey: "INVOICE_ID",
      targetTable: "billing_sales",
      columns: {
        company_id: "COMPANY_ID → legal-company crosswalk",
        financial_year_id: "COMPANY_ID → reviewed fiscal period",
        invoice_number: "INVOICE_NO as text",
        line_number: "deterministic sequence after company/year mapping",
        customer_id: "PARTY_ID",
        billing_address_id: "PARTY_ID → address",
        shipping_address_id: "review same legacy address use",
        currency_id: "review currency; absent in source",
        issued_on: "INVOICE_DATE",
        tax_type: "TAXTYPE_ID semantics",
        subtotal: "TOTAL_TAXABLE_AMOUNT",
        tax_amount: "GSTTOTAL",
        round_off: "signed GRANDTOTAL - subtotal - tax - additional",
        amount: "GRANDTOTAL",
        status: "requires lifecycle decision",
        ledger_id: "validated LEDGER_ID text → parent",
        notes: "NOTES and legacy provenance"
      }
    });
    await this.repository.mapping({
      phase: "billing",
      sourceTable: "invoiceitems_tbl",
      sourceKey: "INVOICEITEMS_ID",
      targetTable: "billing_sales_items",
      columns: {
        sales_id: "INVOICE_ID",
        line_number: "stable order by INVOICEITEMS_ID within invoice",
        product_id: "PRODUCT_ID",
        description: "source product name; historical description unavailable",
        hsn_code_id: "source product HSNCODE_ID",
        unit_id: "source product UNIT_ID",
        quantity: "QTY → lossless decimal(18,4)",
        rate: "PRICE",
        tax_id: "historical item combined GST rate",
        tax_rate: "CGST_PERCENT + SGST_PERCENT + IGST_PERCENT",
        taxable_amount: "decimal quantity × rate, 2-place rounding",
        cgst_amount: "historical CGST_PERCENT",
        sgst_amount: "historical SGST_PERCENT",
        igst_amount: "historical IGST_PERCENT",
        tax_amount: "component sum",
        line_total: "taxable + component tax",
        po_no: "PO_ID → PO_NO",
        dc_no: "DC_ID → DC_NO"
      }
    });
  }

  private line(
    source: LegacyRecord,
    order: number,
    product?: LegacyRecord,
    po?: LegacyRecord,
    dc?: LegacyRecord
  ): PreparedLine {
    const issues: string[] = [];
    const data: LegacyRecord = {
      uuid: legacyUuid("sales-item", String(source.INVOICEITEMS_ID)),
      line_number: order,
      description: product ? legacyText(product.PRODUCT_NAME) : null,
      po_no: po && Number(po.PO_NO) !== 0 ? String(po.PO_NO) : null,
      dc_no: dc && Number(dc.DC_NO) !== 0 ? String(dc.DC_NO) : null
    };
    try {
      Object.assign(data, legacyLineAmounts(source));
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "Invalid line decimal values.");
    }
    if (!product) issues.push("Missing source product.");
    if (!po && Number(source.PO_ID)) issues.push("Missing source PO reference.");
    if (!dc && Number(source.DC_ID)) issues.push("Missing source DC reference.");
    return { source, data, issues };
  }

  private headerIssues(source: LegacyRecord, lines: PreparedLine[], taxMode: string | null) {
    const issues = [
      "Choose historical invoice lifecycle; ACTIVE_ID/LOCKED do not prove confirmation.",
      "Confirm whether the legacy party address is valid for both billing and shipping."
    ];
    if (!lines.length || lines.some((l) => l.issues.length))
      issues.push("Invoice aggregate has missing or invalid children.");
    if (!taxMode) issues.push("Unknown source tax mode.");
    if (
      decimalUnits(source.GSTTOTAL, 2) !==
      decimalUnits(source.TOTAL_CGST, 2) +
        decimalUnits(source.TOTAL_SGST, 2) +
        decimalUnits(source.TOTAL_IGST, 2)
    )
      issues.push("Header total GST disagrees with its stored components.");
    if (decimalUnits(source.ADDITIONAL, 2))
      issues.push("Nonzero legacy additional charge needs an explicit target rule.");
    const total = (field: string) =>
      lines.reduce((sum, l) => sum + (l.data[field] ? decimalUnits(l.data[field], 2) : 0n), 0n);
    for (const [destination, origin] of [
      ["taxable_amount", "TOTAL_TAXABLE_AMOUNT"],
      ["cgst_amount", "TOTAL_CGST"],
      ["sgst_amount", "TOTAL_SGST"],
      ["igst_amount", "TOTAL_IGST"]
    ])
      if (total(destination!) !== decimalUnits(source[origin!], 2))
        issues.push(`Header/line ${destination} differs; preserve source and review rounding.`);
    const residual =
      decimalUnits(source.GRANDTOTAL, 2) -
      decimalUnits(source.TOTAL_TAXABLE_AMOUNT, 2) -
      decimalUnits(source.GSTTOTAL, 2) -
      decimalUnits(source.ADDITIONAL, 2);
    if ((residual < 0n ? -residual : residual) !== decimalUnits(source.ROUNDS, 2))
      issues.push("Signed round-off residual does not match saved magnitude.");
    if (Number(source.REFERED_AMT))
      issues.push(
        "Legacy settlement exists; receipts/allocations are not included in the requested invoice-only scope."
      );
    if (
      lines.some((l) =>
        taxMode === "cgst-sgst"
          ? Number(l.source.IGST_PERCENT) !== 0
          : Number(l.source.CGST_PERCENT) !== 0 || Number(l.source.SGST_PERCENT) !== 0
      )
    )
      issues.push("Header/line tax paths disagree.");
    return issues;
  }

  private headerReferences(source: LegacyRecord): LegacyReference[] {
    const company = Number(source.COMPANY_ID),
      party = Number(source.PARTY_ID);
    const references: LegacyReference[] = [
      { field: "company_id", row: this.repository.find("core_companies", company) },
      { field: "financial_year_id", row: this.repository.find("core_financial_years", company) },
      { field: "customer_id", row: this.repository.find("core_contacts", party) },
      { field: "billing_address_id", row: this.repository.find("core_contacts_addresses", party) },
      { field: "shipping_address_id", row: this.repository.find("core_contacts_addresses", party) },
      { field: "currency_id", row: this.repository.find("core_currencies", "invoice-currency") }
    ];
    if (legacyText(source.LEDGER_ID))
      references.push({
        field: "ledger_id",
        row: this.repository.find("core_ledgers", legacyText(source.LEDGER_ID))
      });
    return references;
  }

  private async item(line: PreparedLine, header: LegacyPrepared, product?: LegacyRecord) {
    const source = line.source;
    if (header.issues.length) line.issues.push("Parent invoice aggregate is blocked.");
    await this.repository.save(
      {
        phase: "billing",
        sourceTable: "invoiceitems_tbl",
        sourceKey: String(source.INVOICEITEMS_ID),
        targetTable: "billing_sales_items",
        source,
        data: line.data,
        issues: line.issues
      },
      ["sales_id", "line_number"],
      [
        { field: "sales_id", row: header },
        {
          field: "product_id",
          row: this.repository.find("core_products", Number(source.PRODUCT_ID))
        },
        {
          field: "hsn_code_id",
          row: this.repository.find("core_hsn_codes", Number(product?.HSNCODE_ID))
        },
        { field: "unit_id", row: this.repository.find("core_units", Number(product?.UNIT_ID)) },
        { field: "tax_id", row: this.repository.find("core_taxes", Number(line.data.tax_rate)) }
      ]
    );
  }
}
