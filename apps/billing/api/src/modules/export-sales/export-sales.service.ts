import { AppError } from "@codexsun/framework/errors";
import { assertBillingEntryEditable } from "../../auth/billing-scope.js";
import { billingDashboardProjection } from "../dashboard/index.js";
import {
  BillingSettingsRepository,
  formatBillingDocumentNumber,
  nextBillingDocumentNumber
} from "../settings/index.js";
import { ExportSalesRepository } from "./export-sales.repository.js";
import type {
  ExportSale,
  ExportSaleEinvoiceDetails,
  ExportSaleEwayDetails,
  ExportSaleLineItem,
  ExportSaleLineItemInput,
  ExportSaleSavePayload
} from "./export-sales.types.js";

export class ExportSalesService {
  constructor(
    private readonly repository = new ExportSalesRepository(),
    private readonly settings = new BillingSettingsRepository()
  ) {}

  listExportSales(databaseName: string) {
    return this.repository.list(databaseName);
  }
  listExportSalesPage(
    databaseName: string,
    query: {
      customer: string;
      dateFrom: string;
      dateTo: string;
      page: number;
      pageSize: number;
      search: string;
      status: string;
      numberSearch?: string;
      dateSearch?: string;
      partySearch?: string;
      totalSearch?: string;
      statusSearch?: string;
      quantitySearch?: string;
      taxableSearch?: string;
      taxSearch?: string;
    }
  ) {
    return this.repository.listPage(databaseName, query);
  }

  getExportSale(databaseName: string, id: string) {
    return this.repository.get(databaseName, id);
  }

  async getContext(databaseName: string) {
    const context = await this.repository.context(databaseName);
    if (!context) {
      throw AppError.validation(
        "Configure an active Default Company, Financial Year, and INR currency before creating export sales."
      );
    }
    return context;
  }

  async createExportSale(databaseName: string, input: ExportSaleSavePayload) {
    assertBillingEntryEditable("draft", "export sales", input.status);
    if (
      input.einvoice?.irn ||
      input.einvoice?.status === "generated" ||
      input.eway?.status === "generated"
    )
      throw AppError.validation(
        "Generate compliance only after saving and confirming the invoice."
      );
    const normalized = normalizeExportSaleInput(
      await this.repository.resolveMissingReferences(databaseName, input)
    );
    await this.validateReferences(databaseName, normalized);
    const billingSettings = await this.settings.getBillingSettings(
      databaseName,
      normalized.companyId
    );
    const numbering = billingSettings.numbering.exportSales;
    const numbered = await resolveNextExportSaleNumber(
      databaseName,
      normalized,
      numbering,
      this.repository
    );
    const totals = buildExportSaleTotals(numbered.input);
    const exportSale = await this.repository.create(databaseName, numbered.input, totals);
    if (!exportSale) throw AppError.validation("Export sales invoice could not be created.");
    if (numbering.automatic && (numbered.generated || numbered.nextNumber > numbering.nextNumber)) {
      await this.settings.advanceNextNumber(
        databaseName,
        normalized.companyId,
        "exportSales",
        numbered.nextNumber
      );
    }
    await this.project(databaseName, "created", exportSale);
    return exportSale;
  }

  async updateExportSale(databaseName: string, id: string, input: ExportSaleSavePayload) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.einvoice.irn || current.eway.status === "generated")
      throw AppError.conflict("Invoices with generated compliance cannot be edited.");
    assertBillingEntryEditable(current.status, "export sales", input.status);
    const normalized = normalizeExportSaleInput({
      ...input,
      einvoice: current.einvoice,
      eway: current.eway,
      status: current.status
    });
    await this.validateReferences(databaseName, normalized);
    const duplicateId = await this.repository.findByInvoiceNumber(
      databaseName,
      normalized.companyId,
      normalized.financialYearId,
      normalized.invoiceNumber
    );
    if (duplicateId && duplicateId !== id)
      throw AppError.conflict(
        "Export sales invoice number already exists for this company and year."
      );
    const updated = await this.repository.update(
      databaseName,
      id,
      normalized,
      buildExportSaleTotals(normalized)
    );
    if (updated) {
      await this.project(databaseName, "updated", updated);
      if (
        current.companyId !== updated.companyId ||
        current.financialYearId !== updated.financialYearId
      )
        await this.project(databaseName, "updated", current);
    }
    return updated;
  }

  async confirmExportSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft")
      throw AppError.conflict("Only draft export sales can be confirmed.");
    if (!current.items.length)
      throw AppError.conflict("Add at least one export sale item before confirming.");
    const exportSale = await this.repository.setStatus(databaseName, id, "confirmed");
    if (exportSale) await this.project(databaseName, "confirmed", exportSale);
    return exportSale;
  }

  async cancelExportSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (
      (current.einvoice.irn && current.einvoice.status !== "cancelled") ||
      current.eway.status === "generated"
    )
      throw AppError.conflict(
        "Cancel the compliance documents with the provider before cancelling this invoice."
      );
    if (current.status === "cancelled")
      throw AppError.conflict("Export sale is already cancelled.");
    const exportSale = await this.repository.setStatus(databaseName, id, "cancelled");
    if (exportSale) await this.project(databaseName, "cancelled", exportSale);
    return exportSale;
  }

  async revokeExportSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status === "draft")
      throw AppError.conflict("A draft export sale does not need to be revoked.");
    if (current.einvoice.irn || current.eway.status === "generated")
      throw AppError.conflict("Cancel the generated E-invoice before revoking this export sale.");
    const exportSale = await this.repository.setStatus(databaseName, id, "draft");
    if (exportSale) await this.project(databaseName, "updated", exportSale);
    return exportSale;
  }

  async deleteExportSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft" || current.einvoice.status === "generated")
      throw AppError.conflict(
        "Only draft export sales without generated compliance can be deleted."
      );
    await this.repository.softDelete(databaseName, id);
    await this.project(databaseName, "deleted", current);
    return current;
  }

  private async validateReferences(databaseName: string, input: ExportSaleSavePayload) {
    const references = await this.repository.referenceState(databaseName, input);
    const failures = [
      !references.company && "Company is inactive or missing.",
      !references.financialYear && "Invoice date is outside the selected active Financial Year.",
      !references.customer && "Customer is inactive or missing.",
      !references.billingAddress && "Billing address does not belong to the selected customer.",
      !references.shippingAddress && "Shipping address does not belong to the selected customer.",
      !references.workOrder && "Work order is inactive or missing.",
      !references.ledger && "Export sales ledger is inactive or missing.",
      !references.currency && "Currency is inactive or missing."
    ].filter((message): message is string => Boolean(message));
    if (failures.length) throw AppError.validation(failures[0]!);

    const itemReferences = await this.repository.validItemReferenceIds(databaseName, input);
    const invalid = (requested: number[], existing: Set<number>, label: string): string | null =>
      requested.some((id) => !existing.has(id)) ? `${label} is inactive or missing.` : null;
    const itemFailure =
      invalid(itemReferences.requested.products, itemReferences.products, "Product") ??
      invalid(itemReferences.requested.hsnCodes, itemReferences.hsnCodes, "HSN code") ??
      invalid(itemReferences.requested.colours, itemReferences.colours, "Colour") ??
      invalid(itemReferences.requested.sizes, itemReferences.sizes, "Size") ??
      invalid(itemReferences.requested.units, itemReferences.units, "Unit") ??
      invalid(itemReferences.requested.taxes, itemReferences.taxes, "Tax");
    if (itemFailure) throw AppError.validation(itemFailure);
  }

  private project(
    databaseName: string,
    action: "cancelled" | "confirmed" | "created" | "deleted" | "updated",
    exportSale: Pick<ExportSale, "companyId" | "financialYearId" | "id">
  ) {
    return billingDashboardProjection.project(databaseName, {
      action,
      companyId: exportSale.companyId,
      documentId: exportSale.id,
      financialYearId: exportSale.financialYearId,
      source: "export-sales"
    });
  }
}

export function normalizeExportSaleInput(input: ExportSaleSavePayload): ExportSaleSavePayload {
  const items = input.items
    .map(normalizeExportSaleLineItem)
    .filter((item) => (item.productId || (item.productName?.length ?? 0) > 0) && item.quantity > 0);
  if (!Number.isInteger(input.companyId) || input.companyId <= 0)
    throw AppError.validation("Default Company is required.");
  if (!Number.isInteger(input.financialYearId) || input.financialYearId <= 0)
    throw AppError.validation("Financial Year is required.");
  if (!Number.isInteger(input.customerId) || input.customerId <= 0)
    throw AppError.validation("Select a persisted customer.");
  if (!Number.isInteger(input.billingAddressId) || input.billingAddressId <= 0)
    throw AppError.validation("Select a persisted billing address.");
  if (!Number.isInteger(input.shippingAddressId) || input.shippingAddressId <= 0)
    throw AppError.validation("Select a persisted shipping address.");
  if (!Number.isInteger(input.currencyId) || input.currencyId <= 0)
    throw AppError.validation("Select a persisted currency.");
  if (!input.invoiceNumber.trim()) throw AppError.validation("Invoice number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issuedOn.trim()))
    throw AppError.validation("Invoice date is required.");
  if (input.status !== "draft" && items.length === 0)
    throw AppError.validation("Add at least one export sale item with a persisted unit.");
  if (items.some((item) => !Number.isInteger(item.unitId) || item.unitId <= 0))
    throw AppError.validation("Every export sale item requires a persisted unit.");

  return {
    billingAddress: input.billingAddress.trim(),
    billingAddressId: input.billingAddressId,
    companyId: input.companyId,
    currencyCode: input.currencyCode.trim().toUpperCase() || "INR",
    currencyId: input.currencyId,
    customerEmail: input.customerEmail.trim().toLowerCase(),
    customerId: input.customerId,
    customerName: input.customerName.trim(),
    einvoice: normalizeEinvoice(input.einvoice),
    eway: normalizeEway(input.eway),
    financialYearId: input.financialYearId,
    invoiceNumber: input.invoiceNumber.trim().toUpperCase(),
    issuedOn: input.issuedOn.trim(),
    items,
    ledgerId: positiveOrNull(input.ledgerId),
    notes: input.notes.trim(),
    roundOff: roundMoney(Number(input.roundOff ?? 0) || 0),
    salesLedger: input.salesLedger?.trim() ?? "",
    shippingAddress: input.shippingAddress.trim(),
    shippingAddressId: input.shippingAddressId,
    status: input.status,
    taxType: input.taxType ?? "cgst-sgst",
    terms: input.terms?.trim() ?? "",
    workOrderId: positiveOrNull(input.workOrderId),
    workOrderNo: input.workOrderNo?.trim().toUpperCase() ?? "",
    customerPhone: input.customerPhone.trim()
  };
}

function normalizeExportSaleLineItem(item: ExportSaleLineItemInput): ExportSaleLineItemInput {
  const productName = item.productName?.trim() ?? "";
  return {
    colour: item.colour?.trim() ?? "",
    colourId: positiveOrNull(item.colourId),
    dcNo: item.dcNo?.trim().toUpperCase() ?? "",
    description: item.description?.trim() ?? "",
    hsnCode: item.hsnCode.trim().toUpperCase(),
    hsnCodeId: positiveOrNull(item.hsnCodeId),
    poNo: item.poNo?.trim().toUpperCase() ?? "",
    productId: positiveOrNull(item.productId),
    productName,
    quantity: quantity(item.quantity),
    rate: quantity(item.rate),
    size: item.size?.trim() ?? "",
    sizeId: positiveOrNull(item.sizeId),
    taxId: positiveOrNull(item.taxId),
    taxRate: quantity(item.taxRate),
    unit: item.unit.trim().toUpperCase(),
    unitId: Number(item.unitId)
  };
}

function normalizeEway(value?: ExportSaleEwayDetails): ExportSaleEwayDetails {
  return {
    billDate: value?.billDate?.trim() ?? "",
    billNo: value?.billNo?.trim().toUpperCase() ?? "",
    notes: value?.notes?.trim() ?? "",
    part: value?.part === "Part A" ? "Part A" : "Part B",
    status: value?.status === "generated" ? "generated" : "not-generated",
    transport: value?.transport?.trim() ?? "",
    transportGst: value?.transportGst?.trim().toUpperCase() ?? "",
    transportId: positiveOrNull(value?.transportId ?? null),
    vehicleNo: value?.vehicleNo?.trim().toUpperCase() ?? ""
  };
}

function normalizeEinvoice(value?: ExportSaleEinvoiceDetails): ExportSaleEinvoiceDetails {
  return {
    ackDate: value?.ackDate?.trim() ?? "",
    ackNo: value?.ackNo?.trim() ?? "",
    irn: value?.irn?.trim().toUpperCase() ?? "",
    signedQr: value?.signedQr?.trim() ?? "",
    status: value?.status === "generated" ? "generated" : "not-generated"
  };
}

async function resolveNextExportSaleNumber(
  databaseName: string,
  input: ExportSaleSavePayload,
  numbering: Parameters<typeof formatBillingDocumentNumber>[0],
  repository: ExportSalesRepository
) {
  const enteredNumber = input.invoiceNumber.trim();
  const configuredNumber = formatBillingDocumentNumber(numbering);
  const generated =
    numbering.automatic &&
    (!enteredNumber || enteredNumber.toUpperCase() === configuredNumber.toUpperCase());
  if (!generated) {
    const duplicate = await repository.findByInvoiceNumber(
      databaseName,
      input.companyId,
      input.financialYearId,
      enteredNumber.toUpperCase()
    );
    if (duplicate)
      throw AppError.conflict(
        "Export sales invoice number already exists for this company and year."
      );
    return {
      generated: false,
      input,
      nextNumber: nextBillingDocumentNumber(numbering, enteredNumber)
    };
  }
  let nextNumber = Math.max(1, numbering.nextNumber);
  while (true) {
    const invoiceNumber = formatBillingDocumentNumber({ ...numbering, nextNumber });
    const duplicate = await repository.findByInvoiceNumber(
      databaseName,
      input.companyId,
      input.financialYearId,
      invoiceNumber
    );
    if (!duplicate)
      return { generated: true, input: { ...input, invoiceNumber }, nextNumber: nextNumber + 1 };
    nextNumber += 1;
  }
}

export function buildExportSaleTotals(
  input: ExportSaleSavePayload
): Pick<ExportSale, "amount" | "items" | "subtotal" | "taxAmount"> {
  const items: ExportSaleLineItem[] = input.items.map((item, index) => {
    const taxableAmount = roundMoney(item.quantity * item.rate);
    const taxAmount = roundMoney((taxableAmount * item.taxRate) / 100);
    const cgstAmount = input.taxType === "igst" ? 0 : roundMoney(taxAmount / 2);
    const sgstAmount = input.taxType === "igst" ? 0 : roundMoney(taxAmount - cgstAmount);
    const igstAmount = input.taxType === "igst" ? taxAmount : 0;
    return {
      ...item,
      cgstAmount,
      id: "",
      igstAmount,
      lineNumber: index + 1,
      lineTotal: roundMoney(taxableAmount + taxAmount),
      sgstAmount,
      taxableAmount,
      taxAmount
    };
  });
  const subtotal = roundMoney(items.reduce((total, item) => total + item.taxableAmount, 0));
  const taxAmount = roundMoney(items.reduce((total, item) => total + item.taxAmount, 0));
  const amount = roundMoney(subtotal + taxAmount + Number(input.roundOff ?? 0));
  return { amount, items, subtotal, taxAmount };
}

function positiveOrNull(value: number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function quantity(value: number) {
  return Math.round((Number(value) || 0) * 10_000) / 10_000;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
