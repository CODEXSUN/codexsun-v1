import { z } from "zod";

const codePointLimit = (maximum: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => Array.from(value).length <= maximum, {
      message: `${label} must be at most ${maximum} characters.`
    });

export const productVariantSchema = z.object({
  productInformationId: z.number().int().positive("Select a product."),
  sku: z.string().trim().min(1, "SKU is required.").max(120),
  title: z.string().trim().max(191),
  barcode: z.string().trim().max(120),
  option1Name: codePointLimit(80, "Option name"),
  option1Value: codePointLimit(120, "Option value"),
  option2Name: codePointLimit(80, "Option name"),
  option2Value: codePointLimit(120, "Option value"),
  option3Name: codePointLimit(80, "Option name"),
  option3Value: codePointLimit(120, "Option value"),
  priceAdjustment: z.number(),
  compareAtAdjustment: z.number(),
  costAdjustment: z.number(),
  weight: z.number().nonnegative(),
  sortOrder: z.number().int().nonnegative(),
  status: z.enum(["active", "inactive"])
});
