import { z } from "zod";

export const HexUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hex string");

export const TrustStateSchema = z.enum(["untrusted", "trusted", "archived"]);
export type TrustState = z.infer<typeof TrustStateSchema>;

export const ProjectSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  name: z.string().min(1).max(100),
  root_path: z.string().min(1),
  trust_state: TrustStateSchema,
  policy_revision: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ProjectRecord = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  root_path: z.string().min(1, "Project root path is required"),
  trust_state: TrustStateSchema.optional()
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
