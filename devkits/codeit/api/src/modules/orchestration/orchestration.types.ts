import { z } from "zod";
import { CodeitError } from "../../errors.js";
import { HexUuidSchema, IsoTimestampSchema } from "../conversation/conversation.types.js";

export const ASSIGNMENT_STATES = [
  "assigned",
  "active",
  "completed",
  "failed",
  "cancelled",
  "expired"
] as const;

export type AssignmentState = (typeof ASSIGNMENT_STATES)[number];

export const AssignmentStateSchema = z.enum(ASSIGNMENT_STATES);

export const ALL_ASSIGNMENT_STATES = [
  ...ASSIGNMENT_STATES,
  "accepted",
  "running",
  "interrupted"
] as const;

export function normalizeAssignmentState(state: string): AssignmentState {
  switch (state) {
    case "accepted":
    case "running":
      return "active";
    case "interrupted":
      return "failed";
    case "assigned":
    case "active":
    case "completed":
    case "failed":
    case "cancelled":
    case "expired":
      return state;
    default:
      return "assigned";
  }
}

export const PathLeaseSchema = z.object({
  path_pattern: z.string().min(1),
  assignment_uuid: HexUuidSchema,
  task_id: z.string().min(1),
  worker_id: z.string().min(1),
  run_uuid: HexUuidSchema,
  lease_expiry: IsoTimestampSchema,
  created_at: IsoTimestampSchema.optional()
});
export type PathLease = z.infer<typeof PathLeaseSchema>;

export const AssignmentSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  run_uuid: HexUuidSchema,
  task_id: z.string().min(1),
  worker_id: z.string().min(1),
  dependencies: z.array(z.string()).default([]),
  lease_generation: z.number().int().nonnegative().default(0),
  lease_expiry: IsoTimestampSchema,
  allowed_paths: z.array(z.string()).min(1),
  attempt: z.number().int().positive().default(1),
  state: AssignmentStateSchema.default("assigned"),
  result_payload: z.record(z.string(), z.unknown()).nullable().optional(),
  error_payload: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema
});
export type AssignmentRecord = z.infer<typeof AssignmentSchema>;

export const WorkerHeartbeatSchema = z.object({
  worker_id: z.string().min(1),
  extend_by_ms: z.number().int().positive().optional().default(30000),
  status_message: z.string().optional(),
  metrics: z.record(z.string(), z.unknown()).optional()
});
export type WorkerHeartbeat = z.infer<typeof WorkerHeartbeatSchema>;

export const DispatchRequestSchema = z.object({
  run_uuid: HexUuidSchema,
  task_id: z.string().min(1),
  worker_id: z.string().min(1),
  allowed_paths: z.array(z.string()).min(1),
  dependencies: z.array(z.string()).default([]),
  lease_duration_ms: z.number().int().positive().optional().default(30000),
  caller_role: z.enum(["supervisor", "worker", "integrator"]).optional().default("supervisor"),
  attempt: z.number().int().positive().optional().default(1)
});
export type DispatchRequest = z.infer<typeof DispatchRequestSchema>;

export const DispatchResultSchema = z.object({
  assignment: AssignmentSchema,
  lease_token: z.string(),
  lease_expiry: IsoTimestampSchema,
  active_worker_count: z.number().int().nonnegative(),
  max_concurrency: z.number().int().positive()
});
export type DispatchResult = z.infer<typeof DispatchResultSchema>;

export const CompleteAssignmentRequestSchema = z.object({
  worker_id: z.string().min(1),
  caller_role: z
    .enum(["supervisor", "worker", "reviewer", "integrator"])
    .optional()
    .default("worker"),
  self_approved: z.boolean().optional().default(false),
  result_artifact: z
    .object({
      artifact_type: z
        .enum(["plan", "diff", "test_report", "diagnostic", "evidence"])
        .default("diff"),
      relative_storage_key: z.string().optional(),
      content_hash: z.string().optional(),
      content: z.string().optional(),
      byte_size: z.number().optional(),
      provenance: z.record(z.string(), z.unknown()).optional()
    })
    .optional(),
  diff: z.string().optional(),
  changed_files: z.array(z.string()).optional()
});
export type CompleteAssignmentRequest = z.infer<typeof CompleteAssignmentRequestSchema>;

export const FailAssignmentRequestSchema = z.object({
  worker_id: z.string().min(1),
  error: z.object({
    code: z.string().default("CODEIT_WORKER_FAILED"),
    message: z.string(),
    retryable: z.boolean().default(false),
    details: z.record(z.string(), z.unknown()).optional()
  })
});
export type FailAssignmentRequest = z.infer<typeof FailAssignmentRequestSchema>;

export const IntegrationFilePatchSchema = z.object({
  path: z.string().min(1),
  expected_hash: z.string().min(1),
  new_content: z.string(),
  new_hash: z.string().optional()
});
export type IntegrationFilePatch = z.infer<typeof IntegrationFilePatchSchema>;

export const IntegrationGateInputSchema = z.object({
  run_uuid: HexUuidSchema,
  assignment_uuids: z.array(HexUuidSchema).min(1),
  patches: z.array(IntegrationFilePatchSchema).min(1),
  workspace_files: z.record(z.string(), z.string()).optional()
});
export type IntegrationGateInput = z.infer<typeof IntegrationGateInputSchema>;

export interface IntegrationGateResult {
  run_uuid: string;
  success: boolean;
  integrated_at: string;
  integrated_assignments: string[];
  applied_files: Array<{
    path: string;
    old_hash: string;
    new_hash: string;
  }>;
  combined_hash: string;
  resulting_files: Record<string, string>;
}

// Domain Errors
export class ConcurrencyLimitExceededError extends CodeitError {
  constructor(
    message: string = "Maximum concurrent workers reached",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_CONCURRENCY_EXCEEDED", message, 429, false, details);
  }
}

export class DependencyUnsatisfiedError extends CodeitError {
  constructor(
    message: string = "Prerequisite task is not satisfied",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_DEPENDENCY_UNSATISFIED", message, 409, false, details);
  }
}

export class PathLeaseConflictError extends CodeitError {
  constructor(
    message: string = "Requested path lease conflicts with an active worker lease",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_LEASE_CONFLICT", message, 409, false, details);
  }
}

export class LeaseExpiredError extends CodeitError {
  constructor(
    message: string = "Worker lease has expired or was fenced by newer generation",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_LEASE_EXPIRED", message, 410, false, details);
  }
}

export class WorkerIsolationError extends CodeitError {
  constructor(
    message: string = "Worker isolation violation: unauthorized delegation or self-approval",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_WORKER_ISOLATION_VIOLATION", message, 403, false, details);
  }
}

export class IntegrationConflictError extends CodeitError {
  constructor(
    message: string = "Concurrent integration conflict on shared path",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_INTEGRATION_CONFLICT", message, 409, false, details);
  }
}

export class IntegrationHashMismatchError extends CodeitError {
  constructor(
    message: string = "Pre-apply SHA-256 validation failed",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_HASH_MISMATCH", message, 409, false, details);
  }
}
