import { AppError } from "@codexsun/framework/errors";
import { assertBillingEntryEditable } from "../../auth/billing-scope.js";
import { billingDashboardProjection } from "../dashboard/index.js";
import { BillingSettingsRepository } from "../settings/settings.repository.js";
import {
  formatBillingDocumentNumber,
  nextBillingDocumentNumber
} from "../settings/settings.types.js";
import { SalesInvoiceReservationConflict, SalesRepository } from "./sales.repository.js";
import type {
  Sale,
  SaleEinvoiceDetails,
  SaleEwayDetails,
  SaleLineItem,
  SaleLineItemInput,
  SaleSavePayload
} from "./sales.types.js";

export class SalesService {
  quotationLinkCandidates(
    databaseName: string,
    customerId: number,
    currencyId: number,
    search: string
  ) {
    return this.repository.quotationLinkCandidates(databaseName, customerId, currencyId, search);
  }

  lockForQuotationLink(databaseName: string, id: string) {
    return this.repository.lockForQuotationLink(databaseName, id);
  }
  constructor(
    private readonly repository = new SalesRepository(),
    private readonly settings = new BillingSettingsRepository()
  ) {}

  listSales(databaseName: string) {
    return this.repository.list(databaseName);
  }

  listSalesPage(
    databaseName: string,
    query: {
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

  getSale(databaseName: string, id: string) {
    return this.repository.get(databaseName, id);
  }

  async getContext(databaseName: string) {
    const context = await this.repository.context(databaseName);
    if (!context) {
      throw AppError.validation(
        "Configure an active Default Company, Financial Year, and INR currency before creating sales."
      );
    }
    return context;
  }

  async createSale(databaseName: string, input: SaleSavePayload) {
    assertBillingEntryEditable("draft", "sales", input.status);
    if (
      input.einvoice?.irn ||
      input.einvoice?.status === "generated" ||
      input.eway?.status === "generated"
    )
      throw AppError.validation(
        "Generate compliance only after saving and confirming the invoice."
      );
    const normalized = normalizeSaleInput(
      await this.repository.resolveMissingReferences(databaseName, input),
      { allowAutomaticNumber: true }
    );
    await this.validateReferences(databaseName, normalized);
    const billingSettings = await this.settings.getBillingSettings(
      databaseName,
      normalized.companyId
    );
    const numbering = billingSettings.numbering.sales;
    const requestedNumber = normalized.invoiceNumber.trim().toUpperCase();
    let numbered = await resolveNextSaleNumber(
      databaseName,
      normalized,
      numbering,
      this.repository
    );
    let sale: Sale | null = null;
    for (let attempt = 0; attempt < 20 && !sale; attempt += 1) {
      try {
        sale = await this.repository.create(
          databaseName,
          numbered.input,
          buildSaleTotals(numbered.input)
        );
      } catch (error) {
        if (!(error instanceof SalesInvoiceReservationConflict)) throw error;
        numbered = await resolveNextSaleNumber(
          databaseName,
          { ...numbered.input, invoiceNumber: error.invoiceNumber },
          { ...numbering, automatic: true, nextNumber: numbered.nextNumber },
          this.repository
        );
      }
    }
    if (!sale) throw AppError.conflict("A sales invoice number could not be reserved.");
    if (numbering.automatic && (numbered.generated || numbered.nextNumber > numbering.nextNumber)) {
      await this.settings.advanceNextNumber(
        databaseName,
        normalized.companyId,
        "sales",
        numbered.nextNumber
      );
    }
    const saved = withNumberingWarning(sale, requestedNumber, numbered.input.invoiceNumber);
    await this.project(databaseName, "created", saved);
    return saved;
  }

  async updateSale(databaseName: string, id: string, input: SaleSavePayload) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.einvoice.irn || current.eway.status === "generated")
      throw AppError.conflict("Invoices with generated compliance cannot be edited.");
    assertBillingEntryEditable(current.status, "sales", input.status);
    const normalized = normalizeSaleInput({
      ...input,
      einvoice: current.einvoice,
      eway: current.eway,
      status: current.status
    });
    await this.validateReferences(databaseName, normalized);
    const billingSettings = await this.settings.getBillingSettings(
      databaseName,
      normalized.companyId
    );
    const requestedNumber = normalized.invoiceNumber.trim().toUpperCase();
    let numbered = await resolveNextSaleNumber(
      databaseName,
      normalized,
      billingSettings.numbering.sales,
      this.repository,
      id
    );
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const updated = await this.repository.update(
          databaseName,
          id,
          numbered.input,
          buildSaleTotals(numbered.input)
        );
        if (!updated) return null;
        if (numbered.nextNumber > billingSettings.numbering.sales.nextNumber) {
          await this.settings.advanceNextNumber(
            databaseName,
            normalized.companyId,
            "sales",
            numbered.nextNumber
          );
        }
        const saved = withNumberingWarning(updated, requestedNumber, numbered.input.invoiceNumber);
        await this.project(databaseName, "updated", saved);
        if (
          current.companyId !== saved.companyId ||
          current.financialYearId !== saved.financialYearId
        )
          await this.project(databaseName, "updated", current);
        return saved;
      } catch (error) {
        if (!(error instanceof SalesInvoiceReservationConflict)) throw error;
        numbered = await resolveNextSaleNumber(
          databaseName,
          { ...numbered.input, invoiceNumber: error.invoiceNumber },
          {
            ...billingSettings.numbering.sales,
            automatic: true,
            nextNumber: numbered.nextNumber
          },
          this.repository,
          id
        );
      }
    }
    throw AppError.conflict("A sales invoice number could not be reserved.");
  }

  async confirmSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft") throw AppError.conflict("Only draft sales can be confirmed.");
    if (current.currencyCode.toUpperCase() !== "INR")
      throw AppError.validation(
        "Normal sales use INR only. Use Export Sales for other currencies."
      );
    if (!current.items.length)
      throw AppError.conflict("Add at least one sale item before confirming.");
    const sale = await this.repository.setStatus(databaseName, id, "confirmed");
    if (sale) await this.project(databaseName, "confirmed", sale);
    return sale;
  }

  async cancelSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (
      (current.einvoice.irn && current.einvoice.status !== "cancelled") ||
      current.eway.status === "generated"
    )
      throw AppError.conflict(
        "Cancel the compliance documents with the provider before cancelling this invoice."
      );
    if (current.status === "cancelled") throw AppError.conflict("Sale is already cancelled.");
    const sale = await this.repository.setStatus(databaseName, id, "cancelled");
    if (sale) await this.project(databaseName, "cancelled", sale);
    return sale;
  }

  async revokeSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.einvoice.irn || current.eway.status === "generated")
      throw AppError.conflict("Cancel the generated E-invoice before revoking this sale.");
    if (current.status === "draft")
      throw AppError.conflict("A draft sale does not need to be revoked.");
    const sale = await this.repository.setStatus(databaseName, id, "draft");
    if (sale) await this.project(databaseName, "updated", sale);
    return sale;
  }

  async deleteSale(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft" || current.einvoice.status === "generated")
      throw AppError.conflict("Only draft sales without generated compliance can be deleted.");
    await this.repository.softDelete(databaseName, id);
    await this.project(databaseName, "deleted", current);
    return current;
  }

  async clearEinvoice(databaseName: string, id: string) {
    const sale = await this.repository.get(databaseName, id);
    if (!sale) return null;
    if (sale.einvoice.irn || sale.eway.status === "generated")
      throw AppError.conflict("Generated compliance cannot be cleared locally.");
    if (sale.status !== "draft")
      throw AppError.conflict("Only draft Sale E-invoice details can be cleared.");
    return this.repository.updateCompliance(databaseName, id, {
      einvoice: normalizeEinvoice(undefined)
    });
  }

  async clearEway(databaseName: string, id: string) {
    const sale = await this.repository.get(databaseName, id);
    if (!sale) return null;
    if (sale.einvoice.irn || sale.eway.status === "generated")
      throw AppError.conflict("Generated compliance cannot be cleared locally.");
    if (sale.status !== "draft")
      throw AppError.conflict("Only draft Sale E-way details can be cleared.");
    return this.repository.updateCompliance(databaseName, id, { eway: normalizeEway(undefined) });
  }

  private async validateReferences(databaseName: string, input: SaleSavePayload) {
    const references = await this.repository.referenceState(databaseName, input);
    const failures = [
      !references.company && "Company is inactive or missing.",
      !references.financialYear && "Invoice date is outside the selected active Financial Year.",
      !references.customer && "Customer is inactive or missing.",
      !references.billingAddress && "Billing address does not belong to the selected customer.",
      !references.shippingAddress && "Shipping address must belong to an active contact.",
      !references.workOrder && "Work order is inactive or missing.",
      !references.ledger && "Sales ledger is inactive or missing.",
      !references.currency &&
        "Normal sales require an active INR currency. Use Export Sales for other currencies."
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
    sale: Pick<Sale, "companyId" | "financialYearId" | "id">
  ) {
    return billingDashboardProjection.project(databaseName, {
      action,
      companyId: sale.companyId,
      documentId: sale.id,
      financialYearId: sale.financialYearId,
      source: "sales"
    });
  }
}

export function normalizeSaleInput(
  input: SaleSavePayload,
  options: { allowAutomaticNumber?: boolean } = {}
): SaleSavePayload {
  if (input.currencyCode.trim().toUpperCase() !== "INR")
    throw AppError.validation("Normal sales use INR only. Use Export Sales for other currencies.");
  const items = input.items
    .map(normalizeSaleLineItem)
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
  if (!input.invoiceNumber.trim() && !options.allowAutomaticNumber)
    throw AppError.validation("Invoice number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issuedOn.trim()))
    throw AppError.validation("Invoice date is required.");
  if (input.status !== "draft" && items.length === 0)
    throw AppError.validation("Add at least one sale item with a persisted unit.");
  if (items.some((item) => !Number.isInteger(item.unitId) || item.unitId <= 0))
    throw AppError.validation("Every sale item requires a persisted unit.");

  return {
    billingAddress: input.billingAddress.trim(),
    billingAddressId: input.billingAddressId,
    companyId: input.companyId,
    currencyCode: "INR",
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

function normalizeSaleLineItem(item: SaleLineItemInput): SaleLineItemInput {
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

function normalizeEway(value?: SaleEwayDetails): SaleEwayDetails {
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

function normalizeEinvoice(value?: SaleEinvoiceDetails): SaleEinvoiceDetails {
  return {
    ackDate: value?.ackDate?.trim() ?? "",
    ackNo: value?.ackNo?.trim() ?? "",
    irn: value?.irn?.trim().toUpperCase() ?? "",
    signedQr: value?.signedQr?.trim() ?? "",
    status: value?.status === "generated" ? "generated" : "not-generated"
  };
}

async function resolveNextSaleNumber(
  databaseName: string,
  input: SaleSavePayload,
  numbering: Parameters<typeof formatBillingDocumentNumber>[0],
  repository: SalesRepository,
  excludeId?: string
) {
  const enteredNumber = input.invoiceNumber.trim();
  if (!enteredNumber && !numbering.automatic)
    throw AppError.validation("Invoice number is required when automatic numbering is disabled.");
  const configuredNumber = formatBillingDocumentNumber(numbering);
  const generated =
    numbering.automatic &&
    (!enteredNumber || enteredNumber.toUpperCase() === configuredNumber.toUpperCase());
  if (!generated) {
    const duplicate = await repository.findByInvoiceNumber(
      databaseName,
      input.companyId,
      input.financialYearId,
      enteredNumber.toUpperCase(),
      excludeId
    );
    if (!duplicate)
      return {
        generated: false,
        input: { ...input, invoiceNumber: enteredNumber.toUpperCase() },
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
      invoiceNumber,
      excludeId
    );
    if (!duplicate)
      return { generated: true, input: { ...input, invoiceNumber }, nextNumber: nextNumber + 1 };
    nextNumber += 1;
  }
}

function withNumberingWarning(sale: Sale, requestedNumber: string, reservedNumber: string): Sale {
  if (!requestedNumber || requestedNumber === reservedNumber) return sale;
  return {
    ...sale,
    numberingWarning: `Sales invoice ${requestedNumber} was already reserved. Saved as ${reservedNumber}.`
  };
}

export function buildSaleTotals(
  input: SaleSavePayload
): Pick<Sale, "amount" | "items" | "subtotal" | "taxAmount"> {
  const items: SaleLineItem[] = input.items.map((item, index) => {
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
