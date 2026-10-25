import type { NativeHttpTransport } from "../../native/http.js";
import type { SessionRecord } from "../../session/session-types.js";
import {
  calculateDocumentTotals,
  calculateExportCurrencyTotals,
  formatDocumentNumber
} from "./calculations.js";
import { classifyOpeningBalance } from "./opening-balance.js";
import { assertAdminPermission } from "./permissions.js";
import type {
  BillingDashboardData,
  BillingSettings,
  CustomerStatementReport,
  CustomerSummaryReport,
  ExportSale,
  ExportSaleSavePayload,
  GstFilingPayload,
  GstStatementSummary,
  OpenBillCandidate,
  OpenInvoiceCandidate,
  OpeningBalance,
  OpeningBalanceInput,
  Payment,
  PaymentSavePayload,
  PurchaseBill,
  PurchaseBillSavePayload,
  Quotation,
  QuotationConversionResult,
  QuotationPdfResult,
  QuotationSavePayload,
  Receipt,
  ReceiptSavePayload,
  ReportFilterBase,
  SalesInvoice,
  SalesInvoiceSavePayload,
  StockStatementReport,
  SupplierStatementReport,
  SupplierSummaryReport
} from "./types.js";

// ==========================================
// 1. Dashboard
// ==========================================

export async function getBillingDashboard(
  transport: NativeHttpTransport
): Promise<BillingDashboardData> {
  return transport.get<BillingDashboardData>("/billing/dashboard");
}

// ==========================================
// 2. Quotations
// ==========================================

export async function listQuotations(transport: NativeHttpTransport): Promise<Quotation[]> {
  const result = await transport.get<Quotation[] | { items: Quotation[] }>("/billing/quotations");
  return Array.isArray(result) ? result : (result.items ?? []);
}

export async function getQuotation(
  transport: NativeHttpTransport,
  id: string
): Promise<Quotation> {
  return transport.get<Quotation>(`/billing/quotations/${encodeURIComponent(id)}`);
}

export async function createQuotation(
  transport: NativeHttpTransport,
  payload: QuotationSavePayload
): Promise<Quotation> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const body = {
    ...payload,
    amount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.post<Quotation>("/billing/quotations", body);
}

export async function updateQuotation(
  transport: NativeHttpTransport,
  id: string,
  payload: QuotationSavePayload
): Promise<Quotation> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const body = {
    ...payload,
    amount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.put<Quotation>(`/billing/quotations/${encodeURIComponent(id)}`, body);
}

export async function deleteQuotation(
  transport: NativeHttpTransport,
  id: string
): Promise<void> {
  await transport.delete(`/billing/quotations/${encodeURIComponent(id)}`);
}

export async function confirmQuotation(
  transport: NativeHttpTransport,
  id: string
): Promise<Quotation> {
  return transport.post<Quotation>(`/billing/quotations/${encodeURIComponent(id)}/confirm`);
}

export async function cancelQuotation(
  transport: NativeHttpTransport,
  id: string
): Promise<Quotation> {
  return transport.post<Quotation>(`/billing/quotations/${encodeURIComponent(id)}/cancel`);
}

export async function revokeQuotation(
  transport: NativeHttpTransport,
  id: string
): Promise<Quotation> {
  return transport.post<Quotation>(`/billing/quotations/${encodeURIComponent(id)}/revoke`);
}

export async function convertQuotationToSale(
  transport: NativeHttpTransport,
  id: string
): Promise<QuotationConversionResult> {
  return transport.post<QuotationConversionResult>(
    `/billing/quotations/${encodeURIComponent(id)}/convert-to-sale`
  );
}

export async function convertQuotationsToSale(
  transport: NativeHttpTransport,
  quotationIds: string[]
): Promise<{ quotations: Quotation[]; sale: { id?: string; invoiceNumber: string } }> {
  return transport.post("/billing/quotations/convert-to-sale", { quotationIds });
}

export async function getQuotationPdf(
  transport: NativeHttpTransport,
  id: string
): Promise<QuotationPdfResult> {
  return transport.get<QuotationPdfResult>(
    `/billing/quotations/${encodeURIComponent(id)}/pdf`
  );
}

export async function downloadQuotationPdf(
  transport: NativeHttpTransport,
  id: string
): Promise<ArrayBuffer> {
  return transport.downloadBinary(`/billing/quotations/${encodeURIComponent(id)}/pdf`);
}

// ==========================================
// 3. Sales Invoices
// ==========================================

export async function listSales(transport: NativeHttpTransport): Promise<SalesInvoice[]> {
  const result = await transport.get<SalesInvoice[] | { items: SalesInvoice[] }>("/billing/sales");
  return Array.isArray(result) ? result : (result.items ?? []);
}

export async function getSale(
  transport: NativeHttpTransport,
  id: string
): Promise<SalesInvoice> {
  return transport.get<SalesInvoice>(`/billing/sales/${encodeURIComponent(id)}`);
}

export async function createSale(
  transport: NativeHttpTransport,
  payload: SalesInvoiceSavePayload
): Promise<SalesInvoice> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const body = {
    ...payload,
    amount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.post<SalesInvoice>("/billing/sales", body);
}

export async function updateSale(
  transport: NativeHttpTransport,
  id: string,
  payload: SalesInvoiceSavePayload
): Promise<SalesInvoice> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const body = {
    ...payload,
    amount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.put<SalesInvoice>(`/billing/sales/${encodeURIComponent(id)}`, body);
}

export async function deleteSale(
  transport: NativeHttpTransport,
  id: string
): Promise<void> {
  await transport.delete(`/billing/sales/${encodeURIComponent(id)}`);
}

/**
 * Posting a sales invoice transitions status from draft to confirmed/posted.
 * Enforces role permissions: requires administrator privileges.
 */
export async function postSale(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<SalesInvoice> {
  assertAdminPermission(session, "Posting");
  try {
    return await transport.post<SalesInvoice>(`/billing/sales/${encodeURIComponent(id)}/confirm`);
  } catch (err: unknown) {
    // Also try /post route if backend exposes /post
    try {
      return await transport.post<SalesInvoice>(`/billing/sales/${encodeURIComponent(id)}/post`);
    } catch {
      throw err;
    }
  }
}

/**
 * Cancelling a sales invoice requires administrator privileges.
 */
export async function cancelSale(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<SalesInvoice> {
  assertAdminPermission(session, "Cancelling");
  return transport.post<SalesInvoice>(`/billing/sales/${encodeURIComponent(id)}/cancel`);
}

export async function revokeSale(
  transport: NativeHttpTransport,
  id: string
): Promise<SalesInvoice> {
  return transport.post<SalesInvoice>(`/billing/sales/${encodeURIComponent(id)}/revoke`);
}

export async function getSalePdf(
  transport: NativeHttpTransport,
  id: string
): Promise<{ pdfUrl: string; shareableUrl?: string }> {
  return transport.get<{ pdfUrl: string; shareableUrl?: string }>(
    `/billing/sales/${encodeURIComponent(id)}/pdf`
  );
}

export async function downloadSalePdf(
  transport: NativeHttpTransport,
  id: string
): Promise<ArrayBuffer> {
  return transport.downloadBinary(`/billing/sales/${encodeURIComponent(id)}/pdf`);
}

// ==========================================
// 4. Purchase Bills
// ==========================================

export async function listPurchases(transport: NativeHttpTransport): Promise<PurchaseBill[]> {
  const result = await transport.get<PurchaseBill[] | { items: PurchaseBill[] }>("/billing/purchases");
  return Array.isArray(result) ? result : (result.items ?? []);
}

export async function getPurchase(
  transport: NativeHttpTransport,
  id: string
): Promise<PurchaseBill> {
  return transport.get<PurchaseBill>(`/billing/purchases/${encodeURIComponent(id)}`);
}

export async function createPurchase(
  transport: NativeHttpTransport,
  payload: PurchaseBillSavePayload
): Promise<PurchaseBill> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const body = {
    ...payload,
    amount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.post<PurchaseBill>("/billing/purchases", body);
}

export async function updatePurchase(
  transport: NativeHttpTransport,
  id: string,
  payload: PurchaseBillSavePayload
): Promise<PurchaseBill> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const body = {
    ...payload,
    amount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.put<PurchaseBill>(`/billing/purchases/${encodeURIComponent(id)}`, body);
}

export async function deletePurchase(
  transport: NativeHttpTransport,
  id: string
): Promise<void> {
  await transport.delete(`/billing/purchases/${encodeURIComponent(id)}`);
}

/**
 * Posting a purchase bill requires administrator privileges.
 */
export async function postPurchase(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<PurchaseBill> {
  assertAdminPermission(session, "Posting");
  try {
    return await transport.post<PurchaseBill>(`/billing/purchases/${encodeURIComponent(id)}/confirm`);
  } catch (err: unknown) {
    try {
      return await transport.post<PurchaseBill>(`/billing/purchases/${encodeURIComponent(id)}/post`);
    } catch {
      throw err;
    }
  }
}

/**
 * Cancelling a purchase bill requires administrator privileges.
 */
export async function cancelPurchase(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<PurchaseBill> {
  assertAdminPermission(session, "Cancelling");
  return transport.post<PurchaseBill>(`/billing/purchases/${encodeURIComponent(id)}/cancel`);
}

export async function revokePurchase(
  transport: NativeHttpTransport,
  id: string
): Promise<PurchaseBill> {
  return transport.post<PurchaseBill>(`/billing/purchases/${encodeURIComponent(id)}/revoke`);
}

// ==========================================
// 5. Export Sales
// ==========================================

export async function listExportSales(transport: NativeHttpTransport): Promise<ExportSale[]> {
  const result = await transport.get<ExportSale[] | { items: ExportSale[] }>("/billing/export-sales");
  return Array.isArray(result) ? result : (result.items ?? []);
}

export async function getExportSale(
  transport: NativeHttpTransport,
  id: string
): Promise<ExportSale> {
  return transport.get<ExportSale>(`/billing/export-sales/${encodeURIComponent(id)}`);
}

export async function createExportSale(
  transport: NativeHttpTransport,
  payload: ExportSaleSavePayload
): Promise<ExportSale> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const exchangeRate = payload.exchangeRate ?? 1;
  const currencyConversion = calculateExportCurrencyTotals({
    exchangeRate,
    foreignAmount: totals.amount,
    foreignCurrencyCode: payload.currencyCode
  });

  const body = {
    ...payload,
    amount: totals.amount,
    amountInBaseCurrency: currencyConversion.baseAmountInInr,
    exchangeRate,
    foreignAmount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.post<ExportSale>("/billing/export-sales", body);
}

export async function updateExportSale(
  transport: NativeHttpTransport,
  id: string,
  payload: ExportSaleSavePayload
): Promise<ExportSale> {
  const totals = calculateDocumentTotals({
    items: payload.items,
    roundOff: payload.roundOff,
    taxType: payload.taxType
  });

  const exchangeRate = payload.exchangeRate ?? 1;
  const currencyConversion = calculateExportCurrencyTotals({
    exchangeRate,
    foreignAmount: totals.amount,
    foreignCurrencyCode: payload.currencyCode
  });

  const body = {
    ...payload,
    amount: totals.amount,
    amountInBaseCurrency: currencyConversion.baseAmountInInr,
    exchangeRate,
    foreignAmount: totals.amount,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount
  };

  return transport.put<ExportSale>(`/billing/export-sales/${encodeURIComponent(id)}`, body);
}

export async function deleteExportSale(
  transport: NativeHttpTransport,
  id: string
): Promise<void> {
  await transport.delete(`/billing/export-sales/${encodeURIComponent(id)}`);
}

export async function postExportSale(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<ExportSale> {
  assertAdminPermission(session, "Posting");
  try {
    return await transport.post<ExportSale>(`/billing/export-sales/${encodeURIComponent(id)}/confirm`);
  } catch (err: unknown) {
    try {
      return await transport.post<ExportSale>(`/billing/export-sales/${encodeURIComponent(id)}/post`);
    } catch {
      throw err;
    }
  }
}

export async function cancelExportSale(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<ExportSale> {
  assertAdminPermission(session, "Cancelling");
  return transport.post<ExportSale>(`/billing/export-sales/${encodeURIComponent(id)}/cancel`);
}

// ==========================================
// 6. Payments
// ==========================================

export async function listPayments(transport: NativeHttpTransport): Promise<Payment[]> {
  const result = await transport.get<Payment[] | { items: Payment[] }>("/billing/payments");
  return Array.isArray(result) ? result : (result.items ?? []);
}

export async function getPayment(
  transport: NativeHttpTransport,
  id: string
): Promise<Payment> {
  return transport.get<Payment>(`/billing/payments/${encodeURIComponent(id)}`);
}

export async function createPayment(
  transport: NativeHttpTransport,
  payload: PaymentSavePayload
): Promise<Payment> {
  return transport.post<Payment>("/billing/payments", payload);
}

export async function updatePayment(
  transport: NativeHttpTransport,
  id: string,
  payload: PaymentSavePayload
): Promise<Payment> {
  return transport.put<Payment>(`/billing/payments/${encodeURIComponent(id)}`, payload);
}

export async function deletePayment(
  transport: NativeHttpTransport,
  id: string
): Promise<void> {
  await transport.delete(`/billing/payments/${encodeURIComponent(id)}`);
}

/**
 * Posting a payment voucher requires administrator privileges.
 */
export async function postPayment(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<Payment> {
  assertAdminPermission(session, "Posting");
  return transport.post<Payment>(`/billing/payments/${encodeURIComponent(id)}/post`);
}

/**
 * Cancelling a payment voucher requires administrator privileges.
 */
export async function cancelPayment(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<Payment> {
  assertAdminPermission(session, "Cancelling");
  return transport.post<Payment>(`/billing/payments/${encodeURIComponent(id)}/cancel`);
}

/**
 * Lists candidate purchase bills available for payment allocation.
 */
export async function listPaymentAllocations(
  transport: NativeHttpTransport,
  supplierId: number
): Promise<OpenBillCandidate[]> {
  return transport.get<OpenBillCandidate[]>(
    `/billing/payments/allocations?supplierId=${encodeURIComponent(supplierId)}`
  );
}

// ==========================================
// 7. Receipts
// ==========================================

export async function listReceipts(transport: NativeHttpTransport): Promise<Receipt[]> {
  const result = await transport.get<Receipt[] | { items: Receipt[] }>("/billing/receipts");
  return Array.isArray(result) ? result : (result.items ?? []);
}

export async function getReceipt(
  transport: NativeHttpTransport,
  id: string
): Promise<Receipt> {
  return transport.get<Receipt>(`/billing/receipts/${encodeURIComponent(id)}`);
}

export async function createReceipt(
  transport: NativeHttpTransport,
  payload: ReceiptSavePayload
): Promise<Receipt> {
  return transport.post<Receipt>("/billing/receipts", payload);
}

export async function updateReceipt(
  transport: NativeHttpTransport,
  id: string,
  payload: ReceiptSavePayload
): Promise<Receipt> {
  return transport.put<Receipt>(`/billing/receipts/${encodeURIComponent(id)}`, payload);
}

export async function deleteReceipt(
  transport: NativeHttpTransport,
  id: string
): Promise<void> {
  await transport.delete(`/billing/receipts/${encodeURIComponent(id)}`);
}

/**
 * Posting a receipt voucher requires administrator privileges.
 */
export async function postReceipt(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<Receipt> {
  assertAdminPermission(session, "Posting");
  return transport.post<Receipt>(`/billing/receipts/${encodeURIComponent(id)}/post`);
}

/**
 * Cancelling a receipt voucher requires administrator privileges.
 */
export async function cancelReceipt(
  transport: NativeHttpTransport,
  id: string,
  session?: SessionRecord | null
): Promise<Receipt> {
  assertAdminPermission(session, "Cancelling");
  return transport.post<Receipt>(`/billing/receipts/${encodeURIComponent(id)}/cancel`);
}

/**
 * Lists candidate sales invoices available for receipt allocation.
 */
export async function listReceiptAllocations(
  transport: NativeHttpTransport,
  customerId: number
): Promise<OpenInvoiceCandidate[]> {
  return transport.get<OpenInvoiceCandidate[]>(
    `/billing/receipts/allocations?customerId=${encodeURIComponent(customerId)}`
  );
}

// ==========================================
// 8. Reports (All 6 Supported)
// ==========================================

export async function getCustomerStatement(
  transport: NativeHttpTransport,
  filters: ReportFilterBase = {}
): Promise<CustomerStatementReport> {
  const query = new URLSearchParams();
  if (filters.contactId) query.set("contactId", String(filters.contactId));
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("pageSize", String(filters.pageSize));

  const qs = query.toString();
  return transport.get<CustomerStatementReport>(
    `/billing/reports/customer-statement${qs ? `?${qs}` : ""}`
  );
}

export async function getCustomerSummary(
  transport: NativeHttpTransport
): Promise<CustomerSummaryReport> {
  return transport.get<CustomerSummaryReport>("/billing/reports/customer-summary");
}

export async function getSupplierStatement(
  transport: NativeHttpTransport,
  filters: ReportFilterBase = {}
): Promise<SupplierStatementReport> {
  const query = new URLSearchParams();
  if (filters.contactId) query.set("contactId", String(filters.contactId));
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("pageSize", String(filters.pageSize));

  const qs = query.toString();
  return transport.get<SupplierStatementReport>(
    `/billing/reports/supplier-statement${qs ? `?${qs}` : ""}`
  );
}

export async function getSupplierSummary(
  transport: NativeHttpTransport
): Promise<SupplierSummaryReport> {
  return transport.get<SupplierSummaryReport>("/billing/reports/supplier-summary");
}

export async function getStockStatement(
  transport: NativeHttpTransport,
  filters: { from?: string; page?: number; pageSize?: number; search?: string; to?: string } = {}
): Promise<StockStatementReport> {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("pageSize", String(filters.pageSize));

  const qs = query.toString();
  return transport.get<StockStatementReport>(
    `/billing/reports/stock-statement${qs ? `?${qs}` : ""}`
  );
}

export async function getGstStatement(
  transport: NativeHttpTransport,
  filters: { month?: number; year?: number } = {}
): Promise<GstStatementSummary> {
  const query = new URLSearchParams();
  if (filters.month) query.set("month", String(filters.month));
  if (filters.year) query.set("year", String(filters.year));

  const qs = query.toString();
  return transport.get<GstStatementSummary>(
    `/billing/reports/gst-statement${qs ? `?${qs}` : ""}`
  );
}

export async function saveGstStatementFiling(
  transport: NativeHttpTransport,
  payload: GstFilingPayload
): Promise<{ filingStatus: string; success: boolean }> {
  return transport.put<{ filingStatus: string; success: boolean }>(
    "/billing/reports/gst-statement/filing",
    payload
  );
}

// ==========================================
// 9. Settings & Document Numbering
// ==========================================

export async function getBillingSettings(
  transport: NativeHttpTransport
): Promise<BillingSettings> {
  return transport.get<BillingSettings>("/billing/settings");
}

export async function saveBillingSettings(
  transport: NativeHttpTransport,
  settings: BillingSettings
): Promise<BillingSettings> {
  return transport.put<BillingSettings>("/billing/settings", settings);
}

export function generateNextDocumentNumber(
  settings: BillingSettings,
  kind: keyof BillingSettings["numbering"]
): string {
  const numConfig = settings.numbering[kind];
  if (!numConfig) return "";
  return formatDocumentNumber(numConfig);
}

// ==========================================
// 10. Opening Balances
// ==========================================

export async function getOpeningBalances(
  transport: NativeHttpTransport
): Promise<{ items: OpeningBalance[] }> {
  return transport.get<{ items: OpeningBalance[] }>("/billing/opening-balances");
}

export async function saveOpeningBalance(
  transport: NativeHttpTransport,
  input: OpeningBalanceInput,
  session?: SessionRecord | null
): Promise<OpeningBalance> {
  assertAdminPermission(session, "Saving opening balance");

  const classification = classifyOpeningBalance(input.partyRole);
  const payload = {
    ...input,
    classification
  };

  return transport.put<OpeningBalance>("/billing/opening-balances", payload);
}
