import type { LegacyRecord } from "./legacy-cxapp.types.js";

export function decimalUnits(value: unknown, scale: number): bigint {
  const text = String(value ?? "").trim();
  if (!/^[+-]?\d+(?:\.\d*)?$/.test(text)) throw new Error("Not a complete decimal value.");
  const negative = text.startsWith("-");
  const [integer, fraction = ""] = text.replace(/^[+-]/, "").split(".");
  if (integer!.replace(/^0+/, "").length > 18 - scale)
    throw new Error("Decimal magnitude exceeds the destination precision.");
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale)))
    throw new Error("Decimal precision exceeds the destination scale.");
  const result =
    BigInt(integer!) * 10n ** BigInt(scale) +
    BigInt(fraction.slice(0, scale).padEnd(scale, "0") || "0");
  return negative ? -result : result;
}

export function decimalText(value: bigint, scale: number) {
  const absolute = value < 0n ? -value : value;
  const digits = absolute.toString().padStart(scale + 1, "0");
  return `${value < 0n ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function roundedDivide(value: bigint, divisor: bigint) {
  const sign = value < 0n ? -1n : 1n;
  const absolute = value < 0n ? -value : value;
  return sign * ((absolute + divisor / 2n) / divisor);
}

export function legacyLineAmounts(source: LegacyRecord) {
  const quantity = decimalUnits(source.QTY, 4),
    rate = decimalUnits(source.PRICE, 4);
  if (quantity <= 0n || rate < 0n)
    throw new Error("Invoice quantity must be positive and rate nonnegative.");
  const percentages = [source.CGST_PERCENT, source.SGST_PERCENT, source.IGST_PERCENT].map((v) =>
    decimalUnits(v, 4)
  );
  if (percentages.some((v) => v < 0n)) throw new Error("Negative tax percentage.");
  if (percentages[0] !== percentages[1] || (percentages[2]! > 0n && percentages[0]! > 0n))
    throw new Error("Conflicting CGST/SGST and IGST paths.");
  const taxable = roundedDivide(quantity * rate, 1_000_000n);
  const [cgst, sgst, igst] = percentages.map((p) => roundedDivide(taxable * p, 1_000_000n));
  const tax = cgst! + sgst! + igst!;
  return {
    quantity: decimalText(quantity, 4),
    rate: decimalText(rate, 4),
    tax_rate: decimalText(
      percentages.reduce((sum, p) => sum + p, 0n),
      4
    ),
    taxable_amount: decimalText(taxable, 2),
    cgst_amount: decimalText(cgst!, 2),
    sgst_amount: decimalText(sgst!, 2),
    igst_amount: decimalText(igst!, 2),
    tax_amount: decimalText(tax, 2),
    line_total: decimalText(taxable + tax, 2)
  };
}

export function productTaxRate(source: LegacyRecord): number | null {
  const values = [source.CGST_PERCENT, source.SGST_PERCENT, source.IGST_PERCENT].map((v) =>
    String(v ?? "").trim()
  );
  if (values.every((v) => !v)) return null;
  const [cgst, sgst, igst] = values.map((v) => decimalUnits(v || "0", 4));
  if (cgst !== sgst || (igst! > 0n && cgst! > 0n))
    throw new Error("Incomplete or conflicting product tax path.");
  return Number(decimalText(cgst! + sgst! + igst!, 4));
}
