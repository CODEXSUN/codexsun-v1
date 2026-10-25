import { z } from "zod";

export const productCollectionSchema = z.object({
  slug: z.string().trim().min(1, "Collection slug is required.").max(191),
  title: z.string().trim().min(1, "Collection title is required.").max(191),
  description: z.string().max(2000),
  heroImageUrl: z.string().max(1000),
  publicationStatus: z.enum(["draft", "published", "archived"]),
  sortOrder: z.number().int().nonnegative()
});
