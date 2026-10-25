import { z } from "zod";

export const productSpecificationSchema = z.object({
  productInformationId: z.number().int().positive("Choose a product."),
  label: z.string().trim().min(1, "Specification label is required.").max(120),
  value: z.string().trim().min(1, "Specification value is required.").max(500),
  sortOrder: z.number().int().nonnegative(),
  status: z.enum(["active", "inactive"])
});
