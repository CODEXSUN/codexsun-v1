import { AppError } from "@codexsun/framework/errors";
import { hasBillingTransaction, withBillingTransaction } from "../../database/billing-database.js";
import { assertBillingEntryEditable } from "../../auth/billing-scope.js";
import type { EventPublisher } from "@codexsun/framework/events";
import type { QueueAdapter } from "@codexsun/framework/queue";
import { SalesService } from "../sales/index.js";
import type { Sale, SaleLineItemInput } from "../sales/index.js";
import { BillingSettingsRepository } from "../settings/settings.repository.js";
import {
  formatBillingDocumentNumber,
  nextBillingDocumentNumber
} from "../settings/settings.types.js";
import { QuotationRepository } from "./quotation.repository.js";
import type {
  Quotation,
  QuotationLineItem,
  QuotationLineItemInput,
  QuotationSavePayload
} from "./quotation.types.js";
import { createQuotationEvent } from "./quotation.events.js";
import {
  BillingDatabaseEventPublisher,
  BillingDatabaseQueueAdapter
} from "../runtime-persistence/runtime-persistence.repository.js";

export class QuotationService {
  async existingInvoiceCandidates(databaseName: string, id: string, search: string) {
    const quotation = await this.repository.get(databaseName, id);
    if (!quotation) throw AppError.notFound("Quotation was not found.");
    return this.sales.quotationLinkCandidates(
      databaseName,
      quotation.customerId,
      quotation.currencyId,
      search.trim()
    );
  }

  async linkExistingInvoice(databaseName: string, id: string, invoiceId: string) {
    return withBillingTransaction(databaseName, async () => {
      await this.repository.lockForConversion(databaseName, [id]);
      const quotation = await this.repository.get(databaseName, id);
      if (!quotation) throw AppError.notFound("Quotation was not found.");
      assertBillingEntryEditable(quotation.status, "quotations");
      const sale = await this.sales.lockForQuotationLink(databaseName, invoiceId);
      if (!sale)
        throw AppError.notFound("Sales invoice was not found in this company and financial year.");
      if (quotation.generatedSalesInvoiceNo === sale.invoiceNumber) return quotation;
      this.assertConvertible(quotation);
      if (sale.status === "cancelled")
        throw AppError.conflict("A cancelled invoice cannot be linked.");
      if (
        quotation.companyId !== sale.companyId ||
        quotation.financialYearId !== sale.financialYearId ||
        quotation.customerId !== sale.customerId ||
        quotation.currencyId !== sale.currencyId
      ) {
        throw AppError.conflict(
          "Quotation and invoice must have the same company, financial year, customer, and currency."
        );
      }
      const linked = await this.repository.setGeneratedSalesInvoice(
        databaseName,
        id,
        sale.invoiceNumber,
        "link-existing-invoice"
      );
      if (!linked) throw AppError.notFound("Quotation was not found.");
      await this.publish("converted", linked, databaseName, sale.invoiceNumber);
      return linked;
    });
  }
  constructor(
    private readonly repository = new QuotationRepository(),
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
        "Configure an active Default Company, Financial Year, and INR currency before creating quotations."
      );
    }
    return context;
  }

  async create(databaseName: string, input: QuotationSavePayload) {
    assertBillingEntryEditable("draft", "quotations", input.status);
    const normalized = normalizeQuotationInput(
      await this.repository.resolveMissingReferences(databaseName, input)
    );
    await this.validateReferences(databaseName, normalized);
    const billingSettings = await this.settings.getBillingSettings(
      databaseName,
      normalized.companyId
    );
    const numbering = billingSettings.numbering.quotation;
    const numbered = await resolveNextQuotationNumber(
      databaseName,
      normalized,
      numbering,
      this.repository
    );
    const totals = buildQuotationTotals(numbered.input);
    const quotation = await this.repository.create(databaseName, numbered.input, totals);
    if (!quotation) throw AppError.validation("Quotation could not be created.");
    if (numbering.automatic && (numbered.generated || numbered.nextNumber > numbering.nextNumber)) {
      await this.settings.advanceNextNumber(
        databaseName,
        normalized.companyId,
        "quotation",
        numbered.nextNumber
      );
    }
    await this.publish("created", quotation, databaseName);
    return quotation;
  }

  async update(databaseName: string, id: string, input: QuotationSavePayload) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    assertBillingEntryEditable(current.status, "quotations", input.status);
    if (current.generatedSalesInvoiceNo)
      throw AppError.conflict("This quotation is linked to an invoice and cannot be changed.");
    const normalized = normalizeQuotationInput({ ...input, status: current.status });
    await this.validateReferences(databaseName, normalized);
    const duplicateId = await this.repository.findByQuotationNumber(
      databaseName,
      normalized.companyId,
      normalized.financialYearId,
      normalized.quotationNumber
    );
    if (duplicateId && duplicateId !== id)
      throw AppError.conflict("Quotation number already exists for this company and year.");
    const quotation = await this.repository.update(
      databaseName,
      id,
      normalized,
      buildQuotationTotals(normalized)
    );
    if (quotation) await this.publish("updated", quotation, databaseName);
    return quotation;
  }

  async confirm(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft")
      throw AppError.conflict("Only draft quotations can be confirmed.");
    if (!current.items.length)
      throw AppError.conflict("Add at least one quotation item before confirming.");
    const quotation = await this.repository.setStatus(databaseName, id, "confirmed");
    if (quotation) await this.publish("confirmed", quotation, databaseName);
    return quotation;
  }

  async cancel(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status === "cancelled") throw AppError.conflict("Quotation is already cancelled.");
    if (current.generatedSalesInvoiceNo)
      throw AppError.conflict("A converted quotation cannot be cancelled.");
    const quotation = await this.repository.setStatus(databaseName, id, "cancelled");
    if (quotation) await this.publish("cancelled", quotation, databaseName);
    return quotation;
  }

  async revoke(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.generatedSalesInvoiceNo)
      throw AppError.conflict("An invoiced quotation cannot be revoked.");
    if (current.status === "draft")
      throw AppError.conflict("A draft quotation does not need to be revoked.");
    const quotation = await this.repository.setStatus(databaseName, id, "draft");
    if (quotation) await this.publish("updated", quotation, databaseName);
    return quotation;
  }

  async deleteDraft(databaseName: string, id: string) {
    const current = await this.repository.get(databaseName, id);
    if (!current) return null;
    if (current.status !== "draft" || current.generatedSalesInvoiceNo)
      throw AppError.conflict("Only draft quotations without an invoice can be force deleted.");
    await this.repository.softDelete(databaseName, id);
    return current;
  }

  async convertToSale(
    databaseName: string,
    id: string
  ): Promise<{ quotation: Quotation; sale: Sale } | null> {
    if (!hasBillingTransaction(databaseName)) {
      return withBillingTransaction(databaseName, async () => {
        await this.repository.lockForConversion(databaseName, [id]);
        return this.convertToSale(databaseName, id);
      });
    }
    const quotation = await this.repository.get(databaseName, id);
    if (!quotation) return null;
    this.assertConvertible(quotation);
    const sale = await this.sales.createSale(databaseName, {
      billingAddress: quotation.billingAddress,
      billingAddressId: quotation.billingAddressId,
      companyId: quotation.companyId,
      currencyCode: quotation.currencyCode,
      currencyId: quotation.currencyId,
      customerEmail: quotation.customerEmail,
      customerId: quotation.customerId,
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone,
      financialYearId: quotation.financialYearId,
      // Let Sales own reservation and allocation so conversion cannot reuse a
      // stale or manually entered number from the quotation flow.
      invoiceNumber: "",
      issuedOn: new Date().toISOString().slice(0, 10),
      items: quotation.items.map(quotationItemToSaleItem),
      ledgerId: quotation.ledgerId,
      notes: quotation.notes,
      roundOff: quotation.roundOff,
      salesLedger: quotation.salesLedger,
      shippingAddress: quotation.shippingAddress,
      shippingAddressId: quotation.shippingAddressId,
      status: "draft",
      taxType: quotation.taxType,
      terms: quotation.terms,
      workOrderId: quotation.workOrderId,
      workOrderNo: quotation.workOrderNo
    });
    const converted = await this.repository.setGeneratedSalesInvoice(
      databaseName,
      id,
      sale.invoiceNumber
    );
    if (!converted) throw AppError.notFound("Quotation was not found.");
    await this.publish("converted", converted, databaseName, sale.invoiceNumber);
    return { quotation: converted, sale };
  }

  async convertManyToSale(
    databaseName: string,
    ids: string[]
  ): Promise<{ quotations: Quotation[]; sale: Sale }> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueIds.length) throw AppError.validation("Select at least one quotation.");
    const records = await Promise.all(uniqueIds.map((id) => this.repository.get(databaseName, id)));
    if (records.some((record) => !record))
      throw AppError.notFound("One or more quotations were not found.");
    const quotations = records.filter((record): record is Quotation => Boolean(record));
    const first = quotations[0]!;
    if (quotations.some((quotation) => quotation.customerId !== first.customerId))
      throw AppError.conflict("Selected quotations must belong to the same contact.");
    const invoiceFields = [
      "companyId",
      "financialYearId",
      "currencyId",
      "currencyCode",
      "taxType",
      "billingAddressId",
      "billingAddress",
      "shippingAddressId",
      "shippingAddress",
      "ledgerId",
      "salesLedger",
      "terms",
      "workOrderId",
      "workOrderNo"
    ] as const;
    if (
      quotations.some((quotation) =>
        invoiceFields.some((field) => quotation[field] !== first[field])
      )
    )
      throw AppError.conflict(
        "Selected quotations must have matching company, financial year, currency, tax type, addresses, ledger, terms, and work order. Convert differing quotations separately."
      );
    quotations.forEach((quotation) => this.assertConvertible(quotation));
    if (!hasBillingTransaction(databaseName)) {
      return withBillingTransaction(databaseName, async () => {
        await this.repository.lockForConversion(databaseName, uniqueIds);
        return this.convertManyToSale(databaseName, uniqueIds);
      });
    }
    const sale = await this.sales.createSale(databaseName, {
      billingAddress: first.billingAddress,
      billingAddressId: first.billingAddressId,
      companyId: first.companyId,
      currencyCode: first.currencyCode,
      currencyId: first.currencyId,
      customerEmail: first.customerEmail,
      customerId: first.customerId,
      customerName: first.customerName,
      customerPhone: first.customerPhone,
      financialYearId: first.financialYearId,
      // Let Sales own reservation and allocation so conversion cannot reuse a
      // stale or manually entered number from the quotation flow.
      invoiceNumber: "",
      issuedOn: new Date().toISOString().slice(0, 10),
      items: mergeQuotationItems(quotations),
      ledgerId: first.ledgerId,
      notes: quotations
        .map((quotation) => quotation.notes)
        .filter(Boolean)
        .join("\n"),
      roundOff: quotations.reduce((sum, quotation) => sum + quotation.roundOff, 0),
      salesLedger: first.salesLedger,
      shippingAddress: first.shippingAddress,
      shippingAddressId: first.shippingAddressId,
      status: "draft",
      taxType: first.taxType,
      terms: first.terms,
      workOrderId: first.workOrderId,
      workOrderNo: first.workOrderNo
    });
    const converted: Quotation[] = [];
    for (const quotation of quotations) {
      const updated = await this.repository.setGeneratedSalesInvoice(
        databaseName,
        quotation.id,
        sale.invoiceNumber
      );
      if (!updated)
        throw AppError.notFound(`Quotation ${quotation.quotationNumber} was not found.`);
      await this.publish("converted", updated, databaseName, sale.invoiceNumber);
      converted.push(updated);
    }
    return { quotations: converted, sale };
  }

  private assertConvertible(quotation: Quotation) {
    if (quotation.status === "cancelled")
      throw AppError.conflict(
        `Cancelled quotation ${quotation.quotationNumber} cannot be invoiced.`
      );
    if (quotation.generatedSalesInvoiceNo)
      throw AppError.conflict(
        `Quotation ${quotation.quotationNumber} is already invoiced by ${quotation.generatedSalesInvoiceNo}.`
      );
  }

  private async publish(
    action: "created" | "updated" | "confirmed" | "cancelled" | "converted",
    quotation: Pick<Quotation, "id" | "status">,
    databaseName: string,
    salesInvoiceNo?: string
  ) {
    const event = createQuotationEvent(
      action,
      { id: quotation.id, status: quotation.status, ...(salesInvoiceNo ? { salesInvoiceNo } : {}) },
      databaseName
    );
    await this.events.publish(event);
    await this.queue.enqueue("billing.quotation", {
      idempotencyKey: `${event.eventName}:${quotation.id}:${event.occurredAt}`,
      jobName:
        action === "confirmed" || action === "converted"
          ? "quotation.confirmation-sync"
          : "quotation.activity-sync",
      payload: event.payload,
      sourceModule: "billing.quotation",
      tenantId: databaseName
    });
  }

  private async validateReferences(databaseName: string, input: QuotationSavePayload) {
    const references = await this.repository.referenceState(databaseName, input);
    const failures = [
      !references.company && "Company is inactive or missing.",
      !references.financialYear && "Invoice date is outside the selected active Financial Year.",
      !references.customer && "Customer is inactive or missing.",
      !references.billingAddress && "Billing address does not belong to the selected customer.",
      !references.shippingAddress && "Shipping address does not belong to the selected customer.",
      !references.workOrder && "Work order is inactive or missing.",
      !references.ledger && "Sales ledger is inactive or missing.",
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

export function normalizeQuotationInput(input: QuotationSavePayload): QuotationSavePayload {
  const items = input.items
    .map(normalizeQuotationLineItem)
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
  if (!input.quotationNumber.trim()) throw AppError.validation("Quotation number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()))
    throw AppError.validation("Quotation date is required.");
  if (input.status !== "draft" && items.length === 0)
    throw AppError.validation("Add at least one quotation item with a persisted unit.");
  if (items.some((item) => !Number.isInteger(item.unitId) || item.unitId <= 0))
    throw AppError.validation("Every quotation item requires a persisted unit.");

  return {
    billingAddress: input.billingAddress.trim(),
    billingAddressId: input.billingAddressId,
    companyId: input.companyId,
    currencyCode: input.currencyCode?.trim().toUpperCase() || "INR",
    currencyId: input.currencyId,
    customerEmail: input.customerEmail.trim().toLowerCase(),
    customerId: input.customerId,
    customerName: input.customerName.trim(),
    financialYearId: input.financialYearId,
    quotationNumber: input.quotationNumber.trim().toUpperCase(),
    date: input.date.trim(),
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

function normalizeQuotationLineItem(item: QuotationLineItemInput): QuotationLineItemInput {
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

async function resolveNextQuotationNumber(
  databaseName: string,
  input: QuotationSavePayload,
  numbering: Parameters<typeof formatBillingDocumentNumber>[0],
  repository: QuotationRepository
) {
  const enteredNumber = input.quotationNumber.trim();
  const configuredNumber = formatBillingDocumentNumber(numbering);
  const generated =
    numbering.automatic &&
    (!enteredNumber || enteredNumber.toUpperCase() === configuredNumber.toUpperCase());
  if (!generated) {
    const duplicate = await repository.findByQuotationNumber(
      databaseName,
      input.companyId,
      input.financialYearId,
      enteredNumber.toUpperCase()
    );
    if (duplicate)
      throw AppError.conflict("Quotation number already exists for this company and year.");
    return {
      generated: false,
      input,
      nextNumber: nextBillingDocumentNumber(numbering, enteredNumber)
    };
  }
  let nextNumber = Math.max(1, numbering.nextNumber);
  while (true) {
    const quotationNumber = formatBillingDocumentNumber({ ...numbering, nextNumber });
    const duplicate = await repository.findByQuotationNumber(
      databaseName,
      input.companyId,
      input.financialYearId,
      quotationNumber
    );
    if (!duplicate)
      return { generated: true, input: { ...input, quotationNumber }, nextNumber: nextNumber + 1 };
    nextNumber += 1;
  }
}

export function buildQuotationTotals(
  input: QuotationSavePayload
): Pick<Quotation, "amount" | "items" | "subtotal" | "taxAmount"> {
  const items: QuotationLineItem[] = input.items.map((item, index) => {
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

function quotationItemToSaleItem(item: QuotationLineItem): SaleLineItemInput {
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

function mergeQuotationItems(quotations: Quotation[]): SaleLineItemInput[] {
  const merged = new Map<string, SaleLineItemInput>();
  for (const quotation of quotations) {
    for (const item of quotation.items) {
      const value = quotationItemToSaleItem(item);
      const itemIdentity =
        value.productId ?? `name:${(value.productName ?? "").trim().toLowerCase()}`;
      const key = [itemIdentity, value.rate, value.description.trim()].join("|");
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
