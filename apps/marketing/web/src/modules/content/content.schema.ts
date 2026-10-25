import { z } from "zod";

export const contentChannels = [
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "threads",
  "pinterest",
  "youtube",
  "google-business",
  "telegram",
  "website",
  "email"
] as const;

export const contentPublishModes = ["api", "manual"] as const;

export const contentStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "cancelled"
] as const;

export const contentSchema = z.strictObject({
  brandUuid: z.string().min(1, "Brand is required"),
  campaignUuid: z.string().default(""),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  channel: z.enum([
    "facebook",
    "instagram",
    "linkedin",
    "x",
    "threads",
    "pinterest",
    "youtube",
    "google-business",
    "telegram",
    "website",
    "email"
  ]),
  publishMode: z.enum(["api", "manual"]).default("api"),
  body: z
    .string()
    .trim()
    .min(1, "Body content is required")
    .max(5000, "Body cannot exceed 5000 characters"),
  mediaUrl: z
    .union([
      z.literal(""),
      z.string().url("Enter a valid URL").startsWith("http", "URL must start with http or https")
    ])
    .default(""),
  scheduledAt: z.union([z.literal(""), z.string()]).default("")
});
