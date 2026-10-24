import { z } from "zod";

export const HexUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hex string");

export const FactScopeSchema = z.enum(["user", "project", "conversation"]);
export type FactScope = z.infer<typeof FactScopeSchema>;

export const ConfirmationStateSchema = z.enum(["unconfirmed", "confirmed", "rejected", "stale"]);
export type ConfirmationState = z.infer<typeof ConfirmationStateSchema>;

export const PersonalFactSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  scope: FactScopeSchema,
  owner_id: z.string().min(1, "owner_id is required"),
  fact_key: z.string().min(1, "fact_key is required").max(200),
  fact_value: z.string().min(1, "fact_value is required").max(2000),
  source: z.string().min(1).max(500),
  confirmation_state: ConfirmationStateSchema,
  verified_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type PersonalFact = z.infer<typeof PersonalFactSchema>;

export const CreateFactInputSchema = z.object({
  scope: FactScopeSchema,
  owner_id: z.string().min(1, "owner_id is required"),
  fact_key: z.string().min(1, "fact_key is required").max(200),
  fact_value: z.string().min(1, "fact_value is required").max(2000),
  source: z.string().min(1).max(500).optional().default("user_explicit"),
  confirmation_state: ConfirmationStateSchema.optional()
});
export type CreateFactInput = z.input<typeof CreateFactInputSchema>;

export const ConfirmFactInputSchema = z.object({
  decision: z.enum(["confirmed", "rejected"]).optional().default("confirmed")
});
export type ConfirmFactInput = z.input<typeof ConfirmFactInputSchema>;

export const StoredPreferenceSchema = z.object({
  key: z.string(),
  value: z.string(),
  scope: FactScopeSchema,
  owner_id: z.string(),
  source: z.string(),
  confirmed: z.boolean(),
  verified_at: z.string().nullable().optional()
});
export type StoredPreference = z.infer<typeof StoredPreferenceSchema>;

export const FactFilterSchema = z.object({
  scope: FactScopeSchema.optional(),
  owner_id: z.string().optional(),
  confirmation_state: ConfirmationStateSchema.optional(),
  fact_key: z.string().optional()
});
export type FactFilter = z.input<typeof FactFilterSchema>;

export const ContextPreviewInputSchema = z.object({
  project_uuid: HexUuidSchema.optional(),
  conversation_uuid: HexUuidSchema.optional(),
  user_id: z.string().optional().default("default_user"),
  max_tokens: z.number().int().positive().optional().default(1000)
});
export type ContextPreviewInput = z.input<typeof ContextPreviewInputSchema>;

export const ExcludedFactReasonSchema = z.object({
  fact: PersonalFactSchema,
  reason: z.string()
});
export type ExcludedFactReason = z.infer<typeof ExcludedFactReasonSchema>;

export const ContextPreviewSchema = z.object({
  project_uuid: HexUuidSchema.optional(),
  conversation_uuid: HexUuidSchema.optional(),
  assembled_prompt: z.string(),
  included_facts: z.array(PersonalFactSchema),
  excluded_facts: z.array(ExcludedFactReasonSchema),
  token_estimate: z.number().int().nonnegative(),
  token_budget: z.number().int().positive(),
  truncated: z.boolean()
});
export type ContextPreview = z.infer<typeof ContextPreviewSchema>;
