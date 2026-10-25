import { z } from "zod";

export const qualificationSchema = z.strictObject({
  leadUuid: z.string().trim().min(1, "Lead is required."),
  decision: z.enum(["qualified", "disqualified", "deferred"]),
  criteria: z.string().trim().min(1, "Criteria is required.").max(255),
  reason: z.string().trim().min(1, "Reason is required.").max(500),
  score: z.coerce.number().min(0).max(100).optional(),
  reviewer: z.string().trim().min(1, "Reviewer name is required.").max(160),
  notes: z.string().trim().max(2000).optional()
});
