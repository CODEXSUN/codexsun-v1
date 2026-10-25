import { roundMoney } from "./calculations.js";
import type { OpeningBalanceClassification, OpeningBalanceRole } from "./types.js";

/**
 * Classifies an opening balance by party role according to standard double-entry principles:
 * - Customer opening balances represent Debits (Receivables from customers)
 * - Supplier opening balances represent Credits (Payables to suppliers)
 */
export function classifyOpeningBalance(
  partyRole: OpeningBalanceRole
): OpeningBalanceClassification {
  return partyRole === "customer" ? "debit" : "credit";
}

/**
 * Calculates running closing balance respecting opening balance classification.
 */
export function calculateClosingBalance(options: {
  credit: number;
  debit: number;
  openingBalance: number;
  role: OpeningBalanceRole;
}): number {
  const opening = Number(options.openingBalance) || 0;
  const debit = Number(options.debit) || 0;
  const credit = Number(options.credit) || 0;

  if (options.role === "customer") {
    // Customer Statement: Closing = Opening (Debit) + New Invoices (Debit) - Receipts (Credit)
    return roundMoney(opening + debit - credit);
  }

  // Supplier Statement: Closing = Opening (Credit) + New Bills (Credit) - Payments (Debit)
  return roundMoney(opening + credit - debit);
}

/**
 * Provides a human-readable ledger summary for an opening balance.
 */
export function formatOpeningBalanceDescriptor(
  partyRole: OpeningBalanceRole,
  amount: number
): string {
  const classification = classifyOpeningBalance(partyRole);
  const rounded = roundMoney(amount);
  if (partyRole === "customer") {
    return `Customer Opening Balance: ₹${rounded.toFixed(2)} (${classification.toUpperCase()} / Receivable)`;
  }
  return `Supplier Opening Balance: ₹${rounded.toFixed(2)} (${classification.toUpperCase()} / Payable)`;
}
