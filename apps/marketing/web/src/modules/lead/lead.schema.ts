import { z } from "zod";

export const leadSchema = z
  .strictObject({
    brandUuid: z.string().optional(),
    campaignUuid: z.string().optional(),
    name: z.string().trim().min(1, "Name is required.").max(160),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.").max(254)]).default(""),
    phone: z.string().trim().max(40).default(""),
    companyName: z.string().trim().max(160).optional(),
    status: z.enum(["new", "contacted", "qualified", "disqualified", "deferred"]).default("new"),
    score: z.coerce.number().min(0).max(100).optional(),
    source: z.string().trim().min(1, "Source is required.").max(80).default("website"),
    assignedTo: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .refine((val) => Boolean(val.email || val.phone), {
    message: "Either an email address or a phone number is required.",
    path: ["email"]
  });
