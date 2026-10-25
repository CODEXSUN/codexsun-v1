import { z } from "zod";

export const outcomeSchema = z.strictObject({
  leadUuid: z.string().trim().min(1, "Lead reference is required."),
  conversionUuid: z.string().optional(),
  status: z.enum(["won", "lost", "nurture", "unresponsive", "withdrawn"]),
  reason: z.string().trim().min(1, "Outcome reason is required.").max(500),
  declaredValue: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(3).max(3).default("INR"),
  effectiveDate: z.string().min(1, "Effective date is required."),
  previousOutcomeUuid: z.string().optional(),
  notes: z.string().trim().max(2000).optional()
});
