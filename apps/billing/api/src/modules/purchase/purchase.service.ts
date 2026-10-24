import { AppError } from "@codexsun/framework/errors";
import { assertBillingEntryEditable } from "../../auth/billing-scope.js";
import { billingDashboardProjection } from "../dashboard/index.js";
import type { EventPublisher } from "@codexsun/framework/events";
import type { QueueAdapter } from "@codexsun/framework/queue";
import { SalesService } from "../sales/index.js";
import type { SaleLineItemInput } from "../sales/index.js";
import { BillingSettingsRepository } from "../settings/settings.repository.js";
import {
  formatBillingDocumentNumber,
  nextBillingDocumentNumber
} from "../settings/settings.types.js";
import { PurchaseRepository } from "./purchase.repository.js";
import type {
  Purchase,
  PurchaseLineItem,
  PurchaseLineItemInput,
  PurchaseSavePayload
} from "./purchase.types.js";
import { createPurchaseEvent } from "./purchase.events.js";
import {
  BillingDatabaseEventPublisher,
  BillingDatabaseQueueAdapter
} from "../runtime-persistence/runtime-persistence.repository.js";

export class PurchaseService {
  constructor(
    private readonly repository = new PurchaseRepository(),
    private readonly settings = new BillingSettingsRepository(),
    private readonly sales = new SalesService(),
    private readonly events: EventPublisher = new BillingDatabaseEventPublisher(),
    private readonly queue: QueueAdapter = new BillingDatabaseQueueAdapter()
  ) {}

  list(databaseName: string) {
    return this.repository.list(databaseName);
  }
  listPage(
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

  get(databaseName: string, id: string) {
    return this.repository.get(databaseName, id);
  }

  async getContext(databaseName: string) {
    const context = await this.repository.context(databaseName);
    if (!context) {
      throw AppError.validation(
        "Configure an active Default Company, Financial Year, and INR currency before creating purchases."
      );
    }
    return context;
  }

  async create(databaseName: string, input: PurchaseSavePayload) {
    assertBillingEntryEditable("draft", "purchases", input.status);
    const normalized = normalizePurchaseInput(
      await this.repository.resolveMissingReferences(databaseName, input)
    );
    await this.validateReferences(databaseName, normalized);
    const billingSettings = await this.settings.getBillingSettings(
      databaseName,
      normalized.companyId
    );
    const numbering = billingSettings.numbering.purchase;
    const numbered = await resolveNextPurchaseNumber(
      databaseName,
      normalized,
      numbering,
      this.repository
    );
    const totals = buildPurchaseTotals(numbered.input);
    const purchase = await this.repository.create(databaseName, numbered.input, totals);
    if (!purchase) throw AppError.validation("Purchase could not be created.");
    if (numbering.automatic && (numbered.generated || numbered.nextNumber > numbering.nextNumber)) {
      await this.settings.advanceNextNumber(
        databaseName,
        normalized.companyId,
        "purchase",
        numbered.nextNumber
      );
    }
    await this.publish("created", purchase, databaseName);
    return purchase;
  }

  async update(databaseName: string, id: string, input: PurchaseSavePayload) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    assertBillingEntryEditable(current.status, "purchases", input.status);
    const normalized = normalizePurchaseInput({ ...input, status: current.status });
    await this.validateReferences(databaseName, normalized);
    const duplicateId = await this.repository.findByPurchaseNumber(
      databaseName,
      normalized.companyId,
      normalized.financialYearId,
      normalized.invoiceNumber
    );
    if (duplicateId && duplicateId !== id)
      throw AppError.conflict("Purchase number already exists for this company and year.");
    const purchase = await this.repository.update(
      databaseName,
      id,
      normalized,
      buildPurchaseTotals(normalized)
    );
    if (purchase) {
      await this.publish("updated", purchase, databaseName);
      if (
        current.companyId !== purchase.companyId ||
        current.financialYearId !== purchase.financialYearId
      )
        await billingDashboardProjection.project(databaseName, {
          action: "updated",
          companyId: current.companyId,
          documentId: current.id,
          financialYearId: current.financialYearId,
          source: "purchase"
        });
    }
    return purchase;
  }

  async confirm(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft")
      throw AppError.conflict("Only draft purchases can be confirmed.");
    if (!current.items.length)
      throw AppError.conflict("Add at least one purchase item before confirming.");
    const purchase = await this.repository.setStatus(databaseName, id, "confirmed");
    if (purchase) await this.publish("confirmed", purchase, databaseName);
    return purchase;
  }

  async cancel(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status === "cancelled") throw AppError.conflict("Purchase is already cancelled.");
    if (current.generatedSalesInvoiceNo)
      throw AppError.conflict("A converted purchase cannot be cancelled.");
    const purchase = await this.repository.setStatus(databaseName, id, "cancelled");
    if (purchase) await this.publish("cancelled", purchase, databaseName);
    return purchase;
  }

  async revoke(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.generatedSalesInvoiceNo)
      throw AppError.conflict("An invoiced purchase cannot be revoked.");
    if (current.status === "draft")
      throw AppError.conflict("A draft purchase does not need to be revoked.");
    const purchase = await this.repository.setStatus(databaseName, id, "draft");
    if (purchase) await this.publish("updated", purchase, databaseName);
    return purchase;
  }

  async deleteDraft(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft" || current.generatedSalesInvoiceNo)
      throw AppError.conflict("Only draft purchases without an invoice can be force deleted.");
    await this.repository.softDelete(databaseName, id);
    await billingDashboardProjection.project(databaseName, {
      action: "deleted",
      companyId: current.companyId,
      documentId: current.id,
      financialYearId: current.financialYearId,
      source: "purchase"
    });
    return current;
  }

  async convertToSale(databaseName: string, id: string) {
    const purchase = await this.repository.get(databaseName, id);
    if (!purchase) return null;
    this.assertConvertible(purchase);
    const billingSettings = await this.settings.getBillingSettings(
      databaseName,
      purchase.companyId
    );
    const sale = await this.sales.createSale(databaseName, {
      billingAddress: purchase.billingAddress,
      billingAddressId: purchase.billingAddressId,
      companyId: purchase.companyId,
      currencyCode: purchase.currencyCode,
      currencyId: purchase.currencyId,
      customerEmail: purchase.supplierEmail,
      customerId: purchase.supplierId,
      customerName: purchase.supplierName,
      customerPhone: purchase.supplierPhone,
      financialYearId: purchase.financialYearId,
      invoiceNumber: formatBillingDocumentNumber(billingSettings.numbering.sales),
      issuedOn: new Date().toISOString().slice(0, 10),
      items: purchase.items.map(purchaseItemToSaleItem),
      ledgerId: purchase.ledgerId,
      notes: purchase.notes,
      roundOff: purchase.roundOff,
      salesLedger: purchase.salesLedger,
      shippingAddress: purchase.shippingAddress,
      shippingAddressId: purchase.shippingAddressId,
      status: "draft",
      taxType: purchase.taxType,
      terms: purchase.terms,
      workOrderId: purchase.workOrderId,
      workOrderNo: purchase.workOrderNo
    });
    const converted = await this.repository.setGeneratedSalesInvoice(
      databaseName,
      id,
      sale.invoiceNumber
    );
    if (!converted) throw AppError.notFound("Purchase was not found.");
    await this.publish("converted", converted, databaseName, sale.invoiceNumber);
    return { purchase: converted, sale };
  }

  async convertManyToSale(databaseName: string, ids: string[]) {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueIds.length) throw AppError.validation("Select at least one purchase.");
    const records = await Promise.all(uniqueIds.map((id) => this.repository.get(databaseName, id)));
    if (records.some((record) => !record))
      throw AppError.notFound("One or more purchases were not found.");
    const purchases = records.filter((record): record is Purchase => Boolean(record));
    const first = purchases[0]!;
    if (purchases.some((purchase) => purchase.supplierId !== first.supplierId))
      throw AppError.conflict("Selected purchases must belong to the same contact.");
    purchases.forEach((purchase) => this.assertConvertible(purchase));
    const billingSettings = await this.settings.getBillingSettings(databaseName, first.companyId);
    const sale = await this.sales.createSale(databaseName, {
      billingAddress: first.billingAddress,
      billingAddressId: first.billingAddressId,
      companyId: first.companyId,
      currencyCode: first.currencyCode,
      currencyId: first.currencyId,
      customerEmail: first.supplierEmail,
      customerId: first.supplierId,
      customerName: first.supplierName,
      customerPhone: first.supplierPhone,
      financialYearId: first.financialYearId,
      invoiceNumber: formatBillingDocumentNumber(billingSettings.numbering.sales),
      issuedOn: new Date().toISOString().slice(0, 10),
      items: mergePurchaseItems(purchases),
      ledgerId: first.ledgerId,
      notes: purchases
        .map((purchase) => purchase.notes)
        .filter(Boolean)
        .join("\n"),
      roundOff: purchases.reduce((sum, purchase) => sum + purchase.roundOff, 0),
      salesLedger: first.salesLedger,
      shippingAddress: first.shippingAddress,
      shippingAddressId: first.shippingAddressId,
      status: "draft",
      taxType: first.taxType,
      terms: first.terms,
      workOrderId: first.workOrderId,
      workOrderNo: first.workOrderNo
    });
    const converted: Purchase[] = [];
    for (const purchase of purchases) {
      const updated = await this.repository.setGeneratedSalesInvoice(
        databaseName,
        purchase.id,
        sale.invoiceNumber
      );
      if (!updated) throw AppError.notFound(`Purchase ${purchase.invoiceNumber} was not found.`);
      await this.publish("converted", updated, databaseName, sale.invoiceNumber);
      converted.push(updated);
    }
    return { purchases: converted, sale };
  }

  private assertConvertible(purchase: Purchase) {
    if (purchase.status === "cancelled")
      throw AppError.conflict(`Cancelled purchase ${purchase.invoiceNumber} cannot be invoiced.`);
    if (purchase.generatedSalesInvoiceNo)
      throw AppError.conflict(
        `Purchase ${purchase.invoiceNumber} is already invoiced by ${purchase.generatedSalesInvoiceNo}.`
      );
  }

  private async publish(
    action: "created" | "updated" | "confirmed" | "cancelled" | "converted",
    purchase: Pick<Purchase, "companyId" | "financialYearId" | "id" | "status">,
    databaseName: string,
    salesInvoiceNo?: string
  ) {
    const event = createPurchaseEvent(
      action,
      { id: purchase.id, status: purchase.status, ...(salesInvoiceNo ? { salesInvoiceNo } : {}) },
      databaseName
    );
    await this.events.publish(event);
    await this.queue.enqueue("billing.purchase", {
      idempotencyKey: `${event.eventName}:${purchase.id}:${event.occurredAt}`,
      jobName:
        action === "confirmed" || action === "converted"
          ? "purchase.confirmation-sync"
          : "purchase.activity-sync",
      payload: event.payload,
      sourceModule: "billing.purchase",
      tenantId: databaseName
    });
    await billingDashboardProjection.project(databaseName, {
      action:
        action === "created"
          ? "created"
          : action === "confirmed"
            ? "confirmed"
            : action === "cancelled"
              ? "cancelled"
              : "updated",
      companyId: purchase.companyId,
      documentId: purchase.id,
      financialYearId: purchase.financialYearId,
      source: "purchase"
    });
  }

  private async validateReferences(databaseName: string, input: PurchaseSavePayload) {
    const references = await this.repository.referenceState(databaseName, input);
    const failures = [
      !references.company && "Company is inactive or missing.",
      !references.financialYear && "Purchase date is outside the selected active Financial Year.",
      !references.supplier && "Supplier is inactive or missing.",
      !references.billingAddress && "Billing address does not belong to the selected supplier.",
      !references.shippingAddress && "Shipping address does not belong to the selected supplier.",
      !references.workOrder && "Work order is inactive or missing.",
      !references.ledger && "Purchase ledger is inactive or missing.",
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
}

export function normalizePurchaseInput(input: PurchaseSavePayload): PurchaseSavePayload {
  const items = input.items
    .map(normalizePurchaseLineItem)
    .filter((item) => (item.productId || (item.productName?.length ?? 0) > 0) && item.quantity > 0);
  if (!Number.isInteger(input.companyId) || input.companyId <= 0)
    throw AppError.validation("Default Company is required.");
  if (!Number.isInteger(input.financialYearId) || input.financialYearId <= 0)
    throw AppError.validation("Financial Year is required.");
  if (!Number.isInteger(input.supplierId) || input.supplierId <= 0)
    throw AppError.validation("Select a persisted supplier.");
  if (!Number.isInteger(input.billingAddressId) || input.billingAddressId <= 0)
    throw AppError.validation("Select a persisted billing address.");
  if (!Number.isInteger(input.shippingAddressId) || input.shippingAddressId <= 0)
    throw AppError.validation("Select a persisted shipping address.");
  if (!Number.isInteger(input.currencyId) || input.currencyId <= 0)
    throw AppError.validation("Select a persisted currency.");
  if (!input.invoiceNumber.trim()) throw AppError.validation("Purchase number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issuedOn.trim()))
    throw AppError.validation("Purchase date is required.");
  if (input.status !== "draft" && items.length === 0)
    throw AppError.validation("Add at least one purchase item with a persisted unit.");
  if (items.some((item) => !Number.isInteger(item.unitId) || item.unitId <= 0))
    throw AppError.validation("Every purchase item requires a persisted unit.");

  return {
    billingAddress: input.billingAddress.trim(),
    billingAddressId: input.billingAddressId,
    companyId: input.companyId,
    currencyCode: input.currencyCode?.trim().toUpperCase() || "INR",
    currencyId: input.currencyId,
    einvoice: {
      ackDate: input.einvoice?.ackDate.trim() ?? "",
      ackNo: input.einvoice?.ackNo.trim() ?? "",
      irn: input.einvoice?.irn.trim() ?? "",
      signedQr: input.einvoice?.signedQr.trim() ?? ""
    },
    eway: {
      billDate: input.eway?.billDate.trim() ?? "",
      billNo: input.eway?.billNo.trim().toUpperCase() ?? "",
      transport: input.eway?.transport.trim() ?? "",
      vehicleNo: input.eway?.vehicleNo.trim().toUpperCase() ?? ""
    },
    supplierEmail: input.supplierEmail.trim().toLowerCase(),
    supplierId: input.supplierId,
    supplierName: input.supplierName.trim(),
    supplierBillDate: input.supplierBillDate?.trim() ?? "",
    supplierBillNo: input.supplierBillNo?.trim().toUpperCase() ?? "",
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
    supplierPhone: input.supplierPhone.trim()
  };
}

function normalizePurchaseLineItem(item: PurchaseLineItemInput): PurchaseLineItemInput {
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

async function resolveNextPurchaseNumber(
  databaseName: string,
  input: PurchaseSavePayload,
  numbering: Parameters<typeof formatBillingDocumentNumber>[0],
  repository: PurchaseRepository
) {
  const enteredNumber = input.invoiceNumber.trim();
  const configuredNumber = formatBillingDocumentNumber(numbering);
  const generated =
    numbering.automatic &&
    (!enteredNumber || enteredNumber.toUpperCase() === configuredNumber.toUpperCase());
  if (!generated) {
    const duplicate = await repository.findByPurchaseNumber(
      databaseName,
      input.companyId,
      input.financialYearId,
      enteredNumber.toUpperCase()
    );
    if (duplicate)
      throw AppError.conflict("Purchase number already exists for this company and year.");
    return {
      generated: false,
      input,
      nextNumber: nextBillingDocumentNumber(numbering, enteredNumber)
    };
  }
  let nextNumber = Math.max(1, numbering.nextNumber);
  while (true) {
    const invoiceNumber = formatBillingDocumentNumber({ ...numbering, nextNumber });
    const duplicate = await repository.findByPurchaseNumber(
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

export function buildPurchaseTotals(
  input: PurchaseSavePayload
): Pick<Purchase, "amount" | "items" | "subtotal" | "taxAmount"> {
  const items: PurchaseLineItem[] = input.items.map((item, index) => {
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

function purchaseItemToSaleItem(item: PurchaseLineItem): SaleLineItemInput {
  return {
    colour: item.colour,
    colourId: item.colourId,
    dcNo: item.dcNo,
    description: item.description,
    hsnCode: item.hsnCode,
    hsnCodeId: item.hsnCodeId,
    poNo: item.poNo,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    rate: item.rate,
    size: item.size,
    sizeId: item.sizeId,
    taxId: item.taxId,
    taxRate: item.taxRate,
    unit: item.unit,
    unitId: item.unitId
  };
}

function mergePurchaseItems(purchases: Purchase[]): SaleLineItemInput[] {
  const merged = new Map<string, SaleLineItemInput>();
  for (const purchase of purchases) {
    for (const item of purchase.items) {
      const value = purchaseItemToSaleItem(item);
      const key = [
        value.productId,
        value.description,
        value.hsnCodeId,
        value.colourId,
        value.sizeId,
        value.unitId,
        value.rate,
        value.taxId,
        value.taxRate
      ].join("|");
      const current = merged.get(key);
      merged.set(
        key,
        current ? { ...current, quantity: current.quantity + value.quantity } : value
      );
    }
  }
  return [...merged.values()];
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
