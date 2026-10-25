import { z } from "zod";

export const conversionSchema = z
  .strictObject({
    leadUuid: z.string().trim().min(1, "Lead reference is required."),
    qualificationUuid: z.string().optional(),
    status: z.enum(["converted", "cancelled", "reversed"]).default("converted"),
    declaredValue: z.coerce.number().min(0, "Declared value must be non-negative."),
    currency: z.string().trim().min(3).max(3).default("INR"),
    cancellationReason: z.string().trim().max(500).optional(),
    convertedBy: z.string().trim().min(1, "Converter name is required.").max(160),
    convertedAt: z.string().min(1, "Conversion timestamp is required."),
    notes: z.string().trim().max(2000).optional()
  })
  .refine(
    (data) => {
      if ((data.status === "cancelled" || data.status === "reversed") && !data.cancellationReason?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: "Cancellation or reversal reason is required when status is not converted.",
      path: ["cancellationReason"]
    }
  );
