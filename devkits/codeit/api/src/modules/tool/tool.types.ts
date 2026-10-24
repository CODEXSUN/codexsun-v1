import { z } from "zod";

export const HexUuidSchema = z
  .string()
  .length(8)
  .regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hexadecimal string");

export const ToolCategorySchema = z.enum([
  "read",
  "mutation",
  "command",
  "network",
  "diagnostic",
  "browser",
  "mcp"
]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1).default("1.0.0"),
  description: z.string(),
  category: ToolCategorySchema,
  capability: z.string().min(1),
  dangerous: z.boolean().default(false),
  schema: z.record(z.string(), z.unknown()).optional()
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ToolInvocationStateSchema = z.enum([
  "proposed",
  "approved",
  "denied",
  "running",
  "completed",
  "failed"
]);
export type ToolInvocationState = z.infer<typeof ToolInvocationStateSchema>;

export const ToolInvocationRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  run_uuid: HexUuidSchema,
  assignment_uuid: HexUuidSchema.nullable().optional(),
  tool_name: z.string().min(1),
  tool_version: z.string().min(1),
  arguments_hash: z.string().length(64),
  arguments_payload: z.record(z.string(), z.unknown()),
  grant_uuid: HexUuidSchema.nullable().optional(),
  state: ToolInvocationStateSchema,
  result_artifact_uuid: HexUuidSchema.nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type ToolInvocationRecord = z.infer<typeof ToolInvocationRecordSchema>;

export const ApprovalDecisionSchema = z.enum(["approved", "denied", "pending"]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const ApprovalRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  action_digest: z.string().length(64),
  project_uuid: HexUuidSchema,
  run_uuid: HexUuidSchema,
  expiry: z.string().datetime(),
  actor: z.string().min(1),
  decision: ApprovalDecisionSchema,
  constraints: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export const PolicyDecisionSchema = z.enum(["allow", "require_approval", "deny"]);
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export const RunModeSchema = z.enum(["ask", "plan", "work", "review"]);
export type RunMode = z.infer<typeof RunModeSchema>;

export const ProjectTrustSchema = z.enum(["untrusted", "trusted", "archived"]);
export type ProjectTrust = z.infer<typeof ProjectTrustSchema>;

export interface GrantRecord {
  uuid: string;
  capability: string;
  project_uuid?: string | undefined;
  run_uuid?: string | undefined;
  revoked?: boolean | undefined;
  expiry?: string | undefined;
}

export interface PolicyEvaluationContext {
  actor: string;
  projectTrust: ProjectTrust;
  mode: RunMode;
  tool: ToolDefinition;
  argumentsPayload?: Record<string, unknown> | undefined;
  grants?: GrantRecord[] | undefined;
  approval?: ApprovalRecord | null | undefined;
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  reason: string;
  actionDigest: string;
  requiresApproval: boolean;
}

export const ApproveToolInputSchema = z.object({
  approval_uuid: HexUuidSchema,
  decision: z.enum(["approved", "denied"])
});
export type ApproveToolInput = z.infer<typeof ApproveToolInputSchema>;

export const CreateApprovalInputSchema = z.object({
  project_uuid: HexUuidSchema,
  run_uuid: HexUuidSchema,
  action_digest: z.string().length(64),
  actor: z.string().min(1).default("operator"),
  expiry: z.string().datetime().optional(),
  decision: ApprovalDecisionSchema.default("pending"),
  constraints: z.record(z.string(), z.unknown()).default({})
});
export type CreateApprovalInput = z.infer<typeof CreateApprovalInputSchema>;

export const CreateToolInvocationInputSchema = z.object({
  run_uuid: HexUuidSchema,
  assignment_uuid: HexUuidSchema.nullable().optional(),
  tool_name: z.string().min(1),
  tool_version: z.string().min(1).default("1.0.0"),
  arguments_payload: z.record(z.string(), z.unknown()).default({}),
  grant_uuid: HexUuidSchema.nullable().optional()
});
export type CreateToolInvocationInput = z.infer<typeof CreateToolInvocationInputSchema>;
