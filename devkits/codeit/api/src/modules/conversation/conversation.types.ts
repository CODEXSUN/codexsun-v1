import { z } from "zod";

export const HexUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hex string");

export const IsoTimestampSchema = z.string().datetime();

export const ConversationModeSchema = z.enum(["ask", "plan", "work", "review"]);
export type ConversationMode = z.infer<typeof ConversationModeSchema>;

export const MessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageCompletionStateSchema = z.enum(["draft", "streaming", "final", "failed"]);
export type MessageCompletionState = z.infer<typeof MessageCompletionStateSchema>;

export const ConversationSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  project_uuid: HexUuidSchema,
  title: z.string().min(1).max(200),
  selected_mode: ConversationModeSchema.default("plan"),
  archived: z.boolean().default(false),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema
});
export type ConversationRecord = z.infer<typeof ConversationSchema>;

export const CreateConversationInputSchema = z.object({
  project_uuid: HexUuidSchema,
  title: z.string().min(1).max(200),
  mode: ConversationModeSchema.optional(),
  selected_mode: ConversationModeSchema.optional()
});
export type CreateConversationInput = z.infer<typeof CreateConversationInputSchema>;

export const MessageSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  conversation_uuid: HexUuidSchema,
  role: MessageRoleSchema,
  content: z.string(),
  request_key: z.string().nullable().optional(),
  completion_state: MessageCompletionStateSchema.default("final"),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema
});
export type MessageRecord = z.infer<typeof MessageSchema>;

export const AppendMessageInputSchema = z.object({
  role: MessageRoleSchema.default("user"),
  content: z.string(),
  request_key: z.string().min(1).nullable().optional(),
  completion_state: MessageCompletionStateSchema.optional()
});
export type AppendMessageInput = z.infer<typeof AppendMessageInputSchema>;

export interface ListMessagesOptions {
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface ListMessagesResult {
  items: MessageRecord[];
  next_cursor: string | null;
}
