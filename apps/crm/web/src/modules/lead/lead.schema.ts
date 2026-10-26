import { z } from "zod";
export const leadSchema = z.strictObject({
  name: z.string().trim().max(160),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number."),
  email: z.union([z.literal(""), z.email().max(254)]),
  message: z.string().trim().max(10000),
  campaignLabel: z.string().trim().max(160),
  contactId: z.number().int().positive().nullable(),
  status: z.enum(["review", "qualified", "lost"]),
  revision: z.number().int().positive().optional()
});
