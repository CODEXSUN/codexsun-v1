import { z } from "zod";

export const WorkspaceReadFileOptionsSchema = z.object({
  maxBytes: z.number().int().positive().optional()
});
export type WorkspaceReadFileOptions = z.infer<typeof WorkspaceReadFileOptionsSchema>;

export const WorkspaceReadFileResultSchema = z.object({
  content: z.string(),
  hash: z.string().length(64),
  byte_size: z.number().int().nonnegative(),
  truncated: z.boolean()
});
export type WorkspaceReadFileResult = z.infer<typeof WorkspaceReadFileResultSchema>;

export const WorkspaceDirectoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory"]),
  size: z.number().int().nonnegative().optional()
});
export type WorkspaceDirectoryEntry = z.infer<typeof WorkspaceDirectoryEntrySchema>;

export const WorkspaceListDirectoryResultSchema = z.object({
  entries: z.array(WorkspaceDirectoryEntrySchema),
  total: z.number().int().nonnegative(),
  truncated: z.boolean()
});
export type WorkspaceListDirectoryResult = z.infer<typeof WorkspaceListDirectoryResultSchema>;

export const WorkspaceSearchOptionsSchema = z.object({
  maxResults: z.number().int().positive().optional(),
  maxFileSize: z.number().int().positive().optional(),
  caseSensitive: z.boolean().optional()
});
export type WorkspaceSearchOptions = z.infer<typeof WorkspaceSearchOptionsSchema>;

export const WorkspaceSearchMatchSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive().optional(),
  text: z.string()
});
export type WorkspaceSearchMatch = z.infer<typeof WorkspaceSearchMatchSchema>;

export const WorkspaceSearchResultSchema = z.object({
  query: z.string(),
  matches: z.array(WorkspaceSearchMatchSchema),
  totalMatches: z.number().int().nonnegative(),
  truncated: z.boolean()
});
export type WorkspaceSearchResult = z.infer<typeof WorkspaceSearchResultSchema>;

export const GitStatusFileSchema = z.object({
  path: z.string(),
  indexStatus: z.string(),
  workTreeStatus: z.string()
});
export type GitStatusFile = z.infer<typeof GitStatusFileSchema>;

export const GitStatusResultSchema = z.object({
  isGitRepo: z.boolean(),
  branch: z.string(),
  clean: z.boolean(),
  files: z.array(GitStatusFileSchema),
  raw: z.string()
});
export type GitStatusResult = z.infer<typeof GitStatusResultSchema>;

export const GitDiffResultSchema = z.object({
  isGitRepo: z.boolean(),
  diff: z.string(),
  staged: z.boolean(),
  truncated: z.boolean()
});
export type GitDiffResult = z.infer<typeof GitDiffResultSchema>;
