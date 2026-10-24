import { z } from "zod";

/**
 * Strict schema for provider configuration and model parameters.
 */
export const ProviderSettingsSchema = z.object({
  providerId: z.string().min(1, "Provider ID is required"),
  model: z.string().min(1, "Model selection is required"),
  temperature: z
    .number()
    .min(0, "Temperature must be at least 0.0")
    .max(2, "Temperature cannot exceed 2.0"),
  maxTokens: z
    .number()
    .int("Max tokens must be an integer")
    .min(1, "Max tokens must be at least 1")
    .max(32768, "Max tokens cannot exceed 32768")
});

export const ProviderTestRequestSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional()
});

export type ProviderSettingsInput = z.infer<typeof ProviderSettingsSchema>;
