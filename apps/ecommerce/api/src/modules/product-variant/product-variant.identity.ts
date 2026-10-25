import { createHash } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";

export const PRODUCT_VARIANT_OPTION_NAME_MAX_LENGTH = 80;
export const PRODUCT_VARIANT_OPTION_VALUE_MAX_LENGTH = 120;
export const PRODUCT_VARIANT_OPTION_SIGNATURE_LENGTH = 64;

export type ProductVariantOptionColumns = {
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  option3Name: string;
  option3Value: string;
};

export type CanonicalOptionPair = readonly [name: string, value: string];

export type CanonicalOptionIdentityRow = ProductVariantOptionColumns & {
  id?: number | string;
  productInformationId: number | string;
  sku: string;
};

export type CanonicalOptionDuplicateGroup = {
  productInformationId: number;
  optionSignature: string;
  rows: CanonicalOptionIdentityRow[];
};

const OPTION_COLUMNS = [
  ["option1Name", "option1Value"],
  ["option2Name", "option2Value"],
  ["option3Name", "option3Value"]
] as const;

export function normalizeVariantOptionPart(value: string): string {
  return value.trim().toLowerCase();
}

function unicodeLength(value: string): number {
  return Array.from(value).length;
}

export function canonicalOptionPairs(input: ProductVariantOptionColumns): CanonicalOptionPair[] {
  const pairs: [string, string][] = [];
  const names = new Set<string>();
  for (const [nameKey, valueKey] of OPTION_COLUMNS) {
    const name = normalizeVariantOptionPart(String(input[nameKey] ?? ""));
    const value = normalizeVariantOptionPart(String(input[valueKey] ?? ""));
    if (!name && !value) continue;
    if (!name || !value) {
      throw AppError.validation("Each product option needs both a name and a value.");
    }
    if (unicodeLength(name) > PRODUCT_VARIANT_OPTION_NAME_MAX_LENGTH) {
      throw AppError.validation(
        `Option names must be at most ${PRODUCT_VARIANT_OPTION_NAME_MAX_LENGTH} characters.`
      );
    }
    if (unicodeLength(value) > PRODUCT_VARIANT_OPTION_VALUE_MAX_LENGTH) {
      throw AppError.validation(
        `Option values must be at most ${PRODUCT_VARIANT_OPTION_VALUE_MAX_LENGTH} characters.`
      );
    }
    if (names.has(name)) {
      throw AppError.validation("Option names must be unique within a variant.");
    }
    names.add(name);
    pairs.push([name, value]);
  }
  return sortOptionPairs(pairs);
}

export function canonicalOptionSignature(pairs: readonly CanonicalOptionPair[]): string {
  // JSON encodes commas, quotes, "=", and "|" unambiguously, unlike delimiter concatenation.
  return createHash("sha256").update(JSON.stringify(pairs), "utf8").digest("hex");
}

export function canonicalOptionSignatureFor(input: ProductVariantOptionColumns): string {
  return canonicalOptionSignature(canonicalOptionPairs(input));
}

export function normalizeVariantOptions(input: ProductVariantOptionColumns) {
  const pairs = canonicalOptionPairs(input);
  return {
    option1Name: String(input.option1Name ?? "").trim(),
    option1Value: String(input.option1Value ?? "").trim(),
    option2Name: String(input.option2Name ?? "").trim(),
    option2Value: String(input.option2Value ?? "").trim(),
    option3Name: String(input.option3Name ?? "").trim(),
    option3Value: String(input.option3Value ?? "").trim(),
    optionSignature: canonicalOptionSignature(pairs)
  };
}

// Migration callers read legacy rows that may contain partial or duplicate option names.
// Stored identity must still be stable, so normalization is lenient and never throws here.
export function canonicalStoredOptionSignature(input: ProductVariantOptionColumns): string {
  const pairs: [string, string][] = [];
  for (const [nameKey, valueKey] of OPTION_COLUMNS) {
    const name = normalizeVariantOptionPart(String(input[nameKey] ?? ""));
    const value = normalizeVariantOptionPart(String(input[valueKey] ?? ""));
    if (!name && !value) continue;
    pairs.push([name, value]);
  }
  return canonicalOptionSignature(sortOptionPairs(pairs));
}

export function findCanonicalOptionDuplicateGroups(
  rows: readonly CanonicalOptionIdentityRow[]
): CanonicalOptionDuplicateGroup[] {
  const groups = new Map<string, CanonicalOptionDuplicateGroup>();
  for (const row of rows) {
    const optionSignature = canonicalStoredOptionSignature(row);
    const productInformationId = Number(row.productInformationId);
    const key = `${productInformationId}\u0000${optionSignature}`;
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { productInformationId, optionSignature, rows: [row] });
  }
  return [...groups.values()].filter((group) => group.rows.length > 1);
}

function sortOptionPairs(pairs: [string, string][]): CanonicalOptionPair[] {
  return pairs.sort(
    ([leftName, leftValue], [rightName, rightValue]) =>
      compare(leftName, rightName) || compare(leftValue, rightValue)
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
