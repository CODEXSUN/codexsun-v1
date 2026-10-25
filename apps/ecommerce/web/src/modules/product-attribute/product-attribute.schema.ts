import { z } from "zod";

export const productAttributeSchema = z.object({
  code: z.string().trim().min(1, "Attribute code is required.").max(64),
  name: z.string().trim().min(1, "Attribute name is required.").max(191),
  dataType: z.enum(["text", "number", "boolean", "select", "color"]),
  unit: z.string().trim().max(32),
  isFilterable: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  status: z.enum(["active", "inactive"])
});
