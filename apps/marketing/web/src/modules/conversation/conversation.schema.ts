import { z } from "zod";

export const conversationThreadSchema = z.strictObject({
  brandUuid: z.string().trim().min(1, "Brand is required"),
  channel: z.enum(["whatsapp", "sms", "chat"]).default("whatsapp"),
  contactIdentifier: z.string().trim().min(1, "Phone number is required"),
  contactName: z.string().trim().optional().default(""),
  leadUuid: z.string().trim().optional().nullable(),
  assignedTo: z.string().trim().optional().nullable()
});

export const conversationMessageSchema = z.strictObject({
  content: z.string().trim().min(1, "Message content is required"),
  templateName: z.string().trim().optional().nullable()
});
