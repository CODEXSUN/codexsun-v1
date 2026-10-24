import { z } from "zod";

export const HexUuidSchema = z
  .string()
  .length(8)
  .regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hexadecimal string");

export const PermittedExecutableSchema = z.enum(["node", "npm", "git", "npx"]);
export type PermittedExecutable = z.infer<typeof PermittedExecutableSchema>;

export const ExecuteCommandInputSchema = z.object({
  run_uuid: HexUuidSchema,
  executable: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().min(1),
  timeout_ms: z.number().int().positive().optional(),
  max_output_bytes: z.number().int().positive().optional()
});
export type ExecuteCommandInput = z.infer<typeof ExecuteCommandInputSchema>;

export const CommandOutputChunkSchema = z.object({
  stream: z.enum(["stdout", "stderr"]),
  chunk: z.string(),
  timestamp: z.string().datetime().optional()
});
export type CommandOutputChunk = z.infer<typeof CommandOutputChunkSchema>;

export const CommandResultSchema = z.object({
  exit_code: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  duration_ms: z.number().nonnegative(),
  truncated: z.boolean(),
  timed_out: z.boolean().default(false),
  error: z.string().nullable().optional()
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

export interface CommandRunnerOptions {
  signal?: AbortSignal | undefined;
  onChunk?: ((chunk: CommandOutputChunk) => void) | undefined;
  projectRoot?: string | undefined;
  defaultTimeoutMs?: number | undefined;
  defaultMaxOutputBytes?: number | undefined;
  env?: Record<string, string> | undefined;
}
