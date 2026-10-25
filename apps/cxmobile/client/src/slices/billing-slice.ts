import type { NativeHttpTransport } from "../native/http.js";
import type { BillingQuotationInput, M2StepResult } from "./types.js";

export interface BillingSliceResult {
  grandTotal: number;
  pdfUrl: string;
  quotationId: string;
  subtotal: number;
  taxTotal: number;
}

/**
 * Executes M2 Billing Quotation step.
 * Computes standard document lines, registers with billing backend,
 * reloads authoritative totals, and requests PDF preview.
 */
export async function executeStep3BillingQuotation(
  transport: NativeHttpTransport,
  input: BillingQuotationInput = {
    customerName: "Acme Industrial Corp",
    items: [
      { description: "Standard Hex Bolts M10", quantity: 100, rate: 12.5, taxRate: 18 },
      { description: "Stainless Steel Brackets", quantity: 20, rate: 150.0, taxRate: 18 }
    ]
  }
): Promise<M2StepResult<BillingSliceResult>> {
  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Map input line items with rounded totals
  const lineItems = input.items.map((it, idx) => {
    const qty = Number(it.quantity) || 1;
    const rate = Number(it.rate) || 0;
    const taxRate = Number(it.taxRate ?? 18);
    const taxableAmount = Math.round((qty * rate + Number.EPSILON) * 100) / 100;
    const taxAmount = Math.round(((taxableAmount * taxRate) / 100 + Number.EPSILON) * 100) / 100;
    return {
      description: it.description,
      lineNumber: idx + 1,
      lineTotal: taxableAmount + taxAmount,
      productName: it.description,
      quantity: qty,
      rate,
      taxableAmount,
      taxAmount,
      taxRate,
      unit: "Nos",
      unitId: 1
    };
  });

  const calculatedSubtotal = lineItems.reduce((acc, it) => acc + it.taxableAmount, 0);
  const calculatedTaxTotal = lineItems.reduce((acc, it) => acc + it.taxAmount, 0);
  const calculatedGrandTotal = calculatedSubtotal + calculatedTaxTotal;

  const createPayload = {
    amount: calculatedGrandTotal,
    customerName: input.customerName,
    date: today,
    grandTotal: calculatedGrandTotal,
    items: lineItems,
    quotationNumber: `QT-${Date.now().toString().slice(-6)}`,
    status: "draft",
    subtotal: calculatedSubtotal,
    taxTotal: calculatedTaxTotal
  };

  const created = await transport.post<{ id: string | number; uuid?: string }>(
    "/billing/quotations",
    createPayload
  );

  const quotationId = String(created.uuid ?? created.id);
  if (!quotationId) {
    throw new Error("Step 3 failed: Created quotation missing ID.");
  }

  // 2. Reload Quotation & Read Authoritative Server Totals
  const reloaded = await transport.get<{
    amount?: number;
    grandTotal?: number;
    id?: string;
    items?: Array<{ quantity: number; rate: number; taxableAmount?: number; taxAmount?: number }>;
    subtotal?: number;
    taxTotal?: number;
    totalAmount?: number;
  }>(`/billing/quotations/${encodeURIComponent(quotationId)}`);

  const grandTotal = Number(
    reloaded.grandTotal ?? reloaded.amount ?? reloaded.totalAmount ?? calculatedGrandTotal
  );
  const subtotal = Number(reloaded.subtotal ?? calculatedSubtotal);
  const taxTotal = Number(reloaded.taxTotal ?? calculatedTaxTotal);

  // 3. PDF Preview / Share Request
  let pdfResult: { pdfUrl?: string; shareableUrl?: string } | string;
  try {
    pdfResult = await transport.get<{ pdfUrl?: string }>(
      `/billing/quotations/${encodeURIComponent(quotationId)}/pdf`
    );
  } catch {
    // Fallback to print endpoint if pdf generator renders HTML print
    pdfResult = { pdfUrl: `/billing/quotations/${encodeURIComponent(quotationId)}/print` };
  }

  const finalPdfUrl =
    typeof pdfResult === "string"
      ? pdfResult
      : pdfResult.pdfUrl ?? pdfResult.shareableUrl ?? `/billing/quotations/${encodeURIComponent(quotationId)}/print`;

  return {
    data: {
      grandTotal,
      pdfUrl: finalPdfUrl,
      quotationId,
      subtotal,
      taxTotal
    },
    durationMs: Date.now() - startTime,
    message: `Quotation ${quotationId} created with total ₹${grandTotal}`,
    step: 3,
    stepName: "Billing Quotation Creation, Server Totals & PDF Sharing",
    success: true
  };
}
