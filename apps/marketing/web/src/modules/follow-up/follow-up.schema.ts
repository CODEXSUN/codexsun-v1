import { z } from "zod";

export const followUpSchema = z.strictObject({
  leadUuid: z.string().trim().min(1, "Lead reference is required."),
  type: z.enum(["call", "email", "meeting", "review"]),
  title: z.string().trim().min(1, "Title is required.").max(255),
  scheduledAt: z.string().min(1, "Scheduled timestamp is required."),
  dueAt: z.string().optional(),
  status: z.enum(["pending", "completed", "cancelled"]).default("pending"),
  assignedTo: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
  completedAt: z.string().optional()
});
