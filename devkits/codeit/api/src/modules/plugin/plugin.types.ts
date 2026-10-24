import { createHash } from "node:crypto";
import { z } from "zod";
import { CodeitError } from "../../errors.js";

export const HexUuidSchema = z
  .string()
  .length(8)
  .regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hexadecimal string");

export const PluginEnabledStateSchema = z.enum(["installed", "enabled", "disabled", "revoked"]);
export type PluginEnabledState = z.infer<typeof PluginEnabledStateSchema>;

export const AdvertisedToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  inputSchema: z.record(z.string(), z.unknown()).optional().default({}),
  required_grants: z.array(z.string()).optional().default([])
});
export type AdvertisedTool = z.infer<typeof AdvertisedToolSchema>;

export const PluginAuthorSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional()
  })
]);

export const PluginEntrypointSchema = z.union([
  z.string(),
  z.object({
    command: z.string().min(1),
    args: z.array(z.string()).optional().default([])
  })
]);
export type PluginEntrypoint = z.infer<typeof PluginEntrypointSchema>;

export const PluginManifestSchema = z.object({
  plugin_id: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9_-]+$/,
      "plugin_id must consist of lowercase letters, digits, underscores, or hyphens"
    ),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+.*$/, "Must be a valid semver string"),
  description: z.string().default(""),
  entrypoint: PluginEntrypointSchema,
  manifest_digest: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/, "Must be a 64-character SHA-256 hex string"),
  capabilities: z.array(z.string()).default([]),
  advertised_tools: z.array(AdvertisedToolSchema).default([]),
  requested_grants: z.array(z.string()).default([]),
  author: PluginAuthorSchema.default("unknown")
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export const PluginInstallRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  uuid: HexUuidSchema,
  plugin_id: z.string().min(1),
  version: z.string().min(1),
  manifest_digest: z.string().length(64),
  enabled_state: PluginEnabledStateSchema,
  grants: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type PluginInstallRecord = z.infer<typeof PluginInstallRecordSchema>;

// -------------------------------------------------------------
// MCP (Model Context Protocol) 2024-11-05 JSON-RPC 2.0 Schemas
// -------------------------------------------------------------

export const McpMessageSchema = z.object({
  jsonrpc: z.literal("2.0")
});
export type McpMessage = z.infer<typeof McpMessageSchema>;

export const McpRequestSchema = McpMessageSchema.extend({
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional()
});
export type McpRequest = z.infer<typeof McpRequestSchema>;

export const McpResponseSchema = McpMessageSchema.extend({
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional()
    })
    .optional()
});
export type McpResponse = z.infer<typeof McpResponseSchema>;

export const McpNotificationSchema = McpMessageSchema.extend({
  method: z.string(),
  params: z.unknown().optional()
});
export type McpNotification = z.infer<typeof McpNotificationSchema>;

export const McpToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional()
});
export type McpToolDefinition = z.infer<typeof McpToolDefinitionSchema>;

export const McpCallToolResultContentSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  data: z.string().optional(),
  mimeType: z.string().optional()
});

export const McpCallToolResultSchema = z.object({
  content: z.array(McpCallToolResultContentSchema),
  isError: z.boolean().optional(),
  truncated: z.boolean().optional()
});
export type McpCallToolResult = z.infer<typeof McpCallToolResultSchema>;

// -------------------------------------------------------------
// Plugin Specific Error Types
// -------------------------------------------------------------

export class PluginIntegrityError extends CodeitError {
  constructor(
    message = "Plugin manifest integrity violation: hash mismatch or tampered package",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_PLUGIN_INTEGRITY_VIOLATION", message, 400, false, details);
    this.name = "PluginIntegrityError";
  }
}

export class PluginStateError extends CodeitError {
  constructor(
    message = "Plugin is not in a valid state for this operation",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_PLUGIN_STATE_ERROR", message, 409, false, details);
    this.name = "PluginStateError";
  }
}

export class PluginRevokedError extends CodeitError {
  constructor(
    message = "Plugin has been revoked and all operations are fenced",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_PLUGIN_REVOKED", message, 403, false, details);
    this.name = "PluginRevokedError";
  }
}

export class McpProtocolError extends CodeitError {
  constructor(
    message = "MCP protocol violation or unexpected peer response",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_MCP_PROTOCOL_ERROR", message, 502, false, details);
    this.name = "McpProtocolError";
  }
}

// -------------------------------------------------------------
// Canonical Digest Computation
// -------------------------------------------------------------

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalStringify((obj as Record<string, unknown>)[k])
  );
  return "{" + parts.join(",") + "}";
}

/**
 * Computes a deterministic SHA-256 digest of a manifest excluding its `manifest_digest` property.
 */
export function computeManifestDigest(manifest: Record<string, unknown>): string {
  const { manifest_digest: _digest, ...rest } = manifest;
  const canonical = canonicalStringify(rest);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
