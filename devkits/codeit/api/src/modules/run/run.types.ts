import { z } from "zod";
import {
  ConversationModeSchema,
  HexUuidSchema,
  IsoTimestampSchema
} from "../conversation/conversation.types.js";

export const RUN_STATES = [
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
] as const;

export type RunState = (typeof RUN_STATES)[number];
export const RunStateSchema = z.enum(RUN_STATES);

export const TERMINAL_STATES: readonly RunState[] = ["succeeded", "failed", "cancelled"] as const;

export const VALID_RUN_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  queued: ["planning", "running", "cancelling", "failed"],
  planning: ["waiting", "running", "verifying", "cancelling", "failed"],
  waiting: ["queued", "planning", "running", "cancelling", "failed"],
  running: ["waiting", "paused", "blocked", "verifying", "cancelling", "failed", "succeeded"],
  paused: ["queued", "cancelling"],
  blocked: ["queued", "cancelling", "failed"],
  verifying: ["running", "waiting", "succeeded", "cancelling", "failed"],
  cancelling: ["cancelled", "failed"],
  succeeded: [],
  failed: [],
  cancelled: []
};

export const BudgetSchema = z.object({
  max_duration_seconds: z.number().positive().default(600),
  max_output_bytes: z
    .number()
    .positive()
    .default(10 * 1024 * 1024),
  max_tool_invocations: z.number().positive().default(50),
  max_repair_attempts: z.number().positive().default(3)
});
export type Budget = z.infer<typeof BudgetSchema>;

export const DEFAULT_BUDGET: Budget = {
  max_duration_seconds: 600,
  max_output_bytes: 10 * 1024 * 1024,
  max_tool_invocations: 50,
  max_repair_attempts: 3
};

export const RunSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  project_uuid: HexUuidSchema,
  conversation_uuid: HexUuidSchema,
  mode: ConversationModeSchema,
  state: RunStateSchema,
  cancellation_generation: z.number().int().nonnegative().default(0),
  budget: BudgetSchema,
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema
});
export type RunRecord = z.infer<typeof RunSchema>;

export const RunEventSchema = z.object({
  id: z.number().int().positive().optional(),
  run_uuid: HexUuidSchema,
  seq: z.number().int().positive(),
  event_type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  correlation_id: z.string().nullable().optional(),
  created_at: IsoTimestampSchema
});
export type RunEvent = z.infer<typeof RunEventSchema>;

export const CreateRunInputSchema = z.object({
  conversation_uuid: HexUuidSchema,
  project_uuid: HexUuidSchema.optional(),
  mode: ConversationModeSchema.optional(),
  budget: BudgetSchema.partial().optional()
});
export type CreateRunInput = z.infer<typeof CreateRunInputSchema>;
