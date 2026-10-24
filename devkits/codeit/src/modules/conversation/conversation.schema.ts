/**
 * Codeit Conversation Module Schemas
 * Strict executable Zod validation matching frozen CONTRACTS.md
 */

import { z } from "zod";

export const HexUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hex string");

export const IsoTimestampSchema = z.string().datetime();

export const ConversationModeSchema = z.enum(["ask", "plan", "work", "review"]);

export const RunStateSchema = z.enum([
  "queued",
  "planning",
  "waiting",
  "running",
  "paused",
  "blocked",
  "verifying",
  "cancelling",
  "succeeded",
  "failed",
  "cancelled"
]);

export const MessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);

export const CompletionStateSchema = z.enum(["draft", "streaming", "final", "failed"]);

export const ToolInvocationStateSchema = z.enum([
  "proposed",
  "approved",
  "denied",
  "running",
  "completed",
  "failed"
]);

export const ArtifactTypeSchema = z.enum(["plan", "diff", "test_report", "diagnostic", "evidence"]);

export const ApprovalDecisionSchema = z.enum(["approved", "denied"]);

export const ContextReferenceSchema = z
  .object({
    path: z.string().trim().min(1, "Path cannot be empty"),
    type: z.enum(["file", "symbol", "directory"]),
    lineRange: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional()
  })
  .strict();

export const ComposerInputSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Message content cannot be empty")
      .max(10000, "Message content exceeds maximum character limit"),
    mode: ConversationModeSchema,
    contextReferences: z.array(ContextReferenceSchema).default([])
  })
  .strict();

export const CreateConversationSchema = z
  .object({
    project_uuid: HexUuidSchema,
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
    mode: ConversationModeSchema
  })
  .strict();

export const AppendMessageSchema = z
  .object({
    role: MessageRoleSchema,
    content: z.string().trim().min(1, "Content cannot be empty"),
    request_key: z.string().min(1, "Request key is required")
  })
  .strict();

export const StartRunSchema = z
  .object({
    conversation_uuid: HexUuidSchema,
    mode: ConversationModeSchema
  })
  .strict();

export const SubmitApprovalSchema = z
  .object({
    approval_uuid: HexUuidSchema,
    decision: ApprovalDecisionSchema
  })
  .strict();

export const RunBudgetSchema = z
  .object({
    max_duration_seconds: z.number().positive(),
    max_output_bytes: z.number().positive(),
    max_tool_invocations: z.number().positive(),
    max_repair_attempts: z.number().positive(),
    consumed_duration_seconds: z.number().nonnegative().optional(),
    consumed_output_bytes: z.number().nonnegative().optional(),
    consumed_tool_invocations: z.number().nonnegative().optional()
  })
  .strict();

export const ToolInvocationSchema = z
  .object({
    id: z.number().int().positive().optional(),
    uuid: HexUuidSchema,
    run_uuid: HexUuidSchema,
    assignment_uuid: HexUuidSchema.nullable().optional(),
    tool_name: z.string().min(1),
    tool_version: z.string().min(1),
    arguments_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be sha256 hex"),
    arguments_payload: z.record(z.string(), z.unknown()),
    grant_uuid: HexUuidSchema.nullable().optional(),
    state: ToolInvocationStateSchema,
    result_artifact_uuid: HexUuidSchema.nullable().optional(),
    execution_time_ms: z.number().nonnegative().optional(),
    failure_reason: z.string().optional(),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema
  })
  .strict();

export const ArtifactSchema = z
  .object({
    id: z.number().int().positive().optional(),
    uuid: HexUuidSchema,
    run_uuid: HexUuidSchema,
    artifact_type: ArtifactTypeSchema,
    content_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be sha256 hex"),
    relative_storage_key: z.string().min(1),
    byte_size: z.number().int().nonnegative(),
    media_type: z.string().min(1),
    provenance: z.record(z.string(), z.unknown()),
    content: z.string().optional(),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema
  })
  .strict();

export const ApprovalSchema = z
  .object({
    id: z.number().int().positive().optional(),
    uuid: HexUuidSchema,
    action_digest: z.string().regex(/^[0-9a-f]{64}$/, "Must be sha256 hex"),
    project_uuid: HexUuidSchema,
    run_uuid: HexUuidSchema,
    expiry: IsoTimestampSchema,
    actor: z.string().min(1),
    decision: ApprovalDecisionSchema,
    constraints: z.record(z.string(), z.unknown()),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema
  })
  .strict();

export const MessageSchema = z
  .object({
    id: z.number().int().positive().optional(),
    uuid: HexUuidSchema,
    conversation_uuid: HexUuidSchema,
    role: MessageRoleSchema,
    content: z.string(),
    request_key: z.string().min(1),
    completion_state: CompletionStateSchema,
    tool_invocations: z.array(ToolInvocationSchema).optional(),
    artifacts: z.array(ArtifactSchema).optional(),
    approvals: z.array(ApprovalSchema).optional(),
    context_references: z.array(ContextReferenceSchema).optional(),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema
  })
  .strict();

export const ConversationSchema = z
  .object({
    id: z.number().int().positive().optional(),
    uuid: HexUuidSchema,
    project_uuid: HexUuidSchema,
    title: z.string().min(1).max(200),
    selected_mode: ConversationModeSchema,
    archived: z.boolean().default(false),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema
  })
  .strict();

export const RunSchema = z
  .object({
    id: z.number().int().positive().optional(),
    uuid: HexUuidSchema,
    project_uuid: HexUuidSchema,
    conversation_uuid: HexUuidSchema,
    mode: ConversationModeSchema,
    state: RunStateSchema,
    cancellation_generation: z.number().int().nonnegative().default(0),
    budget: RunBudgetSchema,
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema
  })
  .strict();

export const RunEventSchema = z
  .object({
    id: z.number().int().positive().optional(),
    run_uuid: HexUuidSchema,
    seq: z.number().int().positive(),
    event_type: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    correlation_id: z.string().nullable().optional(),
    created_at: IsoTimestampSchema
  })
  .strict();
