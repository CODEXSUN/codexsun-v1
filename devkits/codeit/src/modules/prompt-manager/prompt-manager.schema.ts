import { z } from "zod";

export const promptManagerSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter a title")
      .max(160, "Keep the title within 160 characters"),
    category: z.string().trim().max(80, "Keep the category within 80 characters"),
    content: z
      .string()
      .trim()
      .min(1, "Enter the prompt to save")
      .max(100_000, "Keep the prompt within 100,000 characters"),
    threadId: z.string().max(160),
    threadName: z.string().max(300),
    active: z.boolean()
  })
  .strict();
