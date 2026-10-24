import { z } from "zod";
import { HexUuidSchema } from "../project/project.types.js";

export const ArtifactTypeSchema = z.enum(["plan", "diff", "test_report", "diagnostic", "evidence"]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ArtifactSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  run_uuid: HexUuidSchema.nullable().optional(),
  artifact_type: ArtifactTypeSchema,
  content_hash: z.string().regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex digest"),
  relative_storage_key: z.string().min(1),
  byte_size: z.number().int().nonnegative(),
  media_type: z.string().min(1),
  provenance: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ArtifactRecord = z.infer<typeof ArtifactSchema>;

export const StoreArtifactInputSchema = z.object({
  run_uuid: HexUuidSchema.nullable().optional(),
  artifact_type: ArtifactTypeSchema,
  content: z.union([z.string(), z.instanceof(Buffer)]),
  media_type: z.string().optional(),
  provenance: z.record(z.string(), z.unknown()).optional()
});

export type StoreArtifactInput = z.infer<typeof StoreArtifactInputSchema>;
