import { z } from "zod";
export const submissionSchema = z
  .strictObject({
    captureUuid: z.string().regex(/^[a-f0-9]{8}$/),
    sourceKey: z.string().trim().min(8).max(191),
    name: z.string().trim().min(1).max(160),
    email: z.union([z.literal(""), z.email().max(254)]),
    phone: z.string().trim().max(40),
    message: z.string().max(10000),
    privacyConsent: z.literal(true),
    sourceReference: z.string().max(191).default(""),
    sourceConsentAt: z.union([z.literal(""), z.iso.datetime()]).default(""),
    sourceNoticeVersion: z.string().max(80).default("unknown")
  })
  .refine((row) => Boolean(row.email || row.phone), {
    message: "An email or phone is required.",
    path: ["email"]
  });
