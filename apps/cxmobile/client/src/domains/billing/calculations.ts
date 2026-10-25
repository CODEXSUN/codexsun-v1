import type {
  BillingLineItemCalculated,
  BillingLineItemInput,
  DocumentNumberSettings,
  TaxType
} from "./types.js";

/**
 * Rounds a number to exactly two decimal places (currency cents/paise).
 * Protects against IEEE-754 precision drift.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates authoritative values for a single line item:
 * handles quantity, rate, discount (percentage or fixed amount),
 * taxable amount, tax amount, and the split between CGST+SGST (intra-state) or IGST (inter-state).
 */
export function calculateLineItem(
  item: BillingLineItemInput,
  taxType: TaxType = "cgst-sgst",
  lineNumber = 1
): BillingLineItemCalculated {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const taxRate = Number(item.taxRate) || 0;

  const grossAmount = roundMoney(qty * rate);

  let discount = 0;
  if (item.discountAmount !== undefined && Number.isFinite(item.discountAmount)) {
    discount = roundMoney(Math.max(0, Number(item.discountAmount)));
  } else if (item.discountPercent !== undefined && Number.isFinite(item.discountPercent)) {
    discount = roundMoney((grossAmount * Math.max(0, Number(item.discountPercent))) / 100);
  }

  const taxableAmount = roundMoney(Math.max(0, grossAmount - discount));
  const taxAmount = roundMoney((taxableAmount * taxRate) / 100);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxType === "igst") {
    igstAmount = taxAmount;
  } else {
    // Intra-state split: half to CGST, half to SGST.
    // Ensure sum matches taxAmount exactly down to the penny.
    cgstAmount = roundMoney(taxAmount / 2);
    sgstAmount = roundMoney(taxAmount - cgstAmount);
  }

  const lineTotal = roundMoney(taxableAmount + taxAmount);

  return {
    ...item,
    cgstAmount,
    discountAmount: discount,
    id: item.productId ? `item-${item.productId}` : `item-${lineNumber}`,
    igstAmount,
    lineNumber,
    lineTotal,
    quantity: qty,
    rate,
    sgstAmount,
    taxableAmount,
    taxAmount,
    taxRate
  };
}

export interface DocumentTotalsResult {
  amount: number;
  cgstTotal: number;
  igstTotal: number;
  items: BillingLineItemCalculated[];
  roundOff: number;
  sgstTotal: number;
  subtotal: number;
  taxAmount: number;
}

/**
 * Authoritative document totals calculator for Quotations, Sales Invoices, and Purchase Bills.
 */
export function calculateDocumentTotals(options: {
  items: BillingLineItemInput[];
  roundOff?: number | undefined;
  taxType?: TaxType | undefined;
}): DocumentTotalsResult {
  const taxType = options.taxType ?? "cgst-sgst";
  const rawRoundOff = Number(options.roundOff ?? 0);
  const roundOff = Number.isFinite(rawRoundOff) ? roundMoney(rawRoundOff) : 0;

  const calculatedItems = options.items.map((it, idx) =>
    calculateLineItem(it, taxType, idx + 1)
  );

  const subtotal = roundMoney(
    calculatedItems.reduce((acc, it) => acc + it.taxableAmount, 0)
  );
  const taxAmount = roundMoney(
    calculatedItems.reduce((acc, it) => acc + it.taxAmount, 0)
  );
  const cgstTotal = roundMoney(
    calculatedItems.reduce((acc, it) => acc + it.cgstAmount, 0)
  );
  const sgstTotal = roundMoney(
    calculatedItems.reduce((acc, it) => acc + it.sgstAmount, 0)
  );
  const igstTotal = roundMoney(
    calculatedItems.reduce((acc, it) => acc + it.igstAmount, 0)
  );

  const amount = roundMoney(subtotal + taxAmount + roundOff);

  return {
    amount,
    cgstTotal,
    igstTotal,
    items: calculatedItems,
    roundOff,
    sgstTotal,
    subtotal,
    taxAmount
  };
}

/**
 * Handles currency conversion for Export Sales.
 * Converts foreign currency amount to base INR amount using exchange rate.
 */
export function calculateExportCurrencyTotals(options: {
  exchangeRate: number;
  foreignAmount: number;
  foreignCurrencyCode: string;
}): {
  baseAmountInInr: number;
  exchangeRate: number;
  foreignAmount: number;
  foreignCurrencyCode: string;
} {
  const foreignAmount = roundMoney(options.foreignAmount);
  const exchangeRate = Number(options.exchangeRate) || 1;
  const baseAmountInInr = roundMoney(foreignAmount * exchangeRate);

  return {
    baseAmountInInr,
    exchangeRate,
    foreignAmount,
    foreignCurrencyCode: options.foreignCurrencyCode.toUpperCase()
  };
}

/**
 * Formats a monetary number in standard Indian or international notation.
 */
export function formatMoney(amount: number, currencyCode = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      currency: currencyCode,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency"
    }).format(amount);
  } catch {
    return `${currencyCode} ${roundMoney(amount).toFixed(2)}`;
  }
}

/**
 * Generates the formatted document number using document number settings.
 * Example: prefix "INV", separator "-", nextNumber 5, padding 4 -> "INV-0005"
 */
export function formatDocumentNumber(settings: DocumentNumberSettings): string {
  const numVal = Math.max(1, settings.nextNumber || 1);
  const padLen = Math.max(1, settings.padding || 1);
  const padded = String(numVal).padStart(padLen, "0");

  const prefix = settings.usePrefix ? (settings.prefix ?? "") : "";
  const sep = settings.useSeparator ? (settings.separator ?? "") : "";
  const suffix = settings.useSuffix ? (settings.suffix ?? "") : "";

  return `${prefix}${sep}${padded}${suffix}`;
}
