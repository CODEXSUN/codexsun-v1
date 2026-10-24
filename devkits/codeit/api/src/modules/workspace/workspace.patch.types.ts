import { z } from "zod";
import { HexUuidSchema } from "../project/project.types.js";

/**
 * Structured diff hunk representing a single contiguous change block.
 */
export const DiffHunkSchema = z.object({
  oldStart: z.number().int().nonnegative(),
  oldLines: z.number().int().nonnegative(),
  newStart: z.number().int().nonnegative(),
  newLines: z.number().int().nonnegative(),
  header: z.string(),
  lines: z.array(z.string())
});
export type DiffHunk = z.infer<typeof DiffHunkSchema>;

/**
 * Structured file diff representing changes between two file revisions.
 */
export const FileDiffSchema = z.object({
  path: z.string().min(1, "File path is required"),
  old_path: z.string().optional(),
  new_path: z.string().optional(),
  previous_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex digest"),
  new_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex digest"),
  lines_added: z.number().int().nonnegative(),
  lines_deleted: z.number().int().nonnegative(),
  unified_diff: z.string(),
  hunks: z.array(DiffHunkSchema).optional()
});
export type FileDiff = z.infer<typeof FileDiffSchema>;

/**
 * Patch proposal presented for review or approval.
 */
export const PatchProposalSchema = z.object({
  run_uuid: HexUuidSchema,
  path: z.string().min(1, "Path is required"),
  expected_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex digest"),
  patch: z.string().min(1, "Patch content is required"),
  description: z.string().optional(),
  action_digest: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex digest")
    .optional(),
  created_at: z.string().datetime().optional()
});
export type PatchProposal = z.infer<typeof PatchProposalSchema>;

/**
 * Input payload for applying an exact patch per CONTRACTS.md.
 */
export const ApplyPatchInputSchema = z.object({
  run_uuid: HexUuidSchema,
  path: z.string().min(1, "Path is required"),
  expected_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex digest"),
  patch: z.string().min(1, "Patch content is required"),
  expected_generation: z.number().int().nonnegative().optional()
});
export type ApplyPatchInput = z.infer<typeof ApplyPatchInputSchema>;

/**
 * Result returned upon successful patch application per CONTRACTS.md.
 */
export const PatchResultSchema = z.object({
  applied: z.boolean(),
  new_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex digest"),
  path: z.string().optional(),
  previous_hash: z.string().optional(),
  byte_size: z.number().int().nonnegative().optional(),
  lines_added: z.number().int().nonnegative().optional(),
  lines_deleted: z.number().int().nonnegative().optional(),
  diff_artifact_uuid: HexUuidSchema.nullable().optional(),
  backup_path: z.string().nullable().optional()
});
export type PatchResult = z.infer<typeof PatchResultSchema>;
