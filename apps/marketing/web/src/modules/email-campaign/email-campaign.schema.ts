import { z } from "zod";

export const emailCampaignSchema = z.strictObject({
  brandUuid: z.string().trim().min(1, "Brand is required"),
  campaignUuid: z.string().trim().optional().nullable(),
  senderUuid: z.string().trim().min(1, "Verified sender is required"),
  name: z.string().trim().min(1, "Campaign name is required").max(160),
  subject: z.string().trim().min(1, "Subject line is required").max(255),
  preheader: z.string().trim().max(255).optional().default(""),
  bodyHtml: z.string().trim().min(1, "HTML body content is required").max(65535),
  bodyText: z.string().trim().min(1, "Plain text content is required").max(65535),
  scheduledAt: z.string().optional().nullable(),
  expectedRevision: z.number().int().positive().optional()
});
