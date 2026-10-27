import { z } from "zod";

export const promptPayload = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160),
    category: z.string().trim().max(80),
    content: z.string().trim().min(1, "Prompt is required").max(100_000),
    threadId: z.string().max(160),
    threadName: z.string().max(300),
    active: z.boolean()
  })
  .strict();
export const promptRecord = promptPayload.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export const runRecord = z.object({
  id: z.string().uuid(),
  promptId: z.string().uuid(),
  threadId: z.string(),
  threadName: z.string(),
  turnId: z.string().nullable(),
  content: z.string(),
  status: z.enum(["running", "awaiting-approval", "completed", "failed", "interrupted"]),
  response: z.string(),
  error: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  approval: z.object({ id: z.string(), method: z.string(), description: z.string() }).nullable()
});
export const activityRecord = z.object({
  id: z.number(),
  action: z.string(),
  createdAt: z.string()
});
export const runSummary = runRecord
  .pick({ id: true, promptId: true, status: true, startedAt: true, completedAt: true })
  .extend({ promptTitle: z.string(), threadName: z.string() });
export const promptDetail = z.object({
  prompt: promptRecord,
  runs: z.array(runRecord),
  activity: z.array(activityRecord)
});
export const chatRecord = z.object({
  id: z.string(),
  name: z.string(),
  cwd: z.string(),
  busy: z.boolean()
});
export type PromptPayload = z.infer<typeof promptPayload>;
export type PromptRecord = z.infer<typeof promptRecord>;
export type PromptRun = z.infer<typeof runRecord>;
export type CodexChat = z.infer<typeof chatRecord>;
export type RunApproval = NonNullable<PromptRun["approval"]>;
export interface RunObserver {
  message(text: string): void;
  finished(status: "completed" | "failed" | "interrupted", error?: string): void;
  approval(value: RunApproval): void;
}
export interface CodexGateway {
  listChats(): Promise<CodexChat[]>;
  send(threadId: string, content: string, observer: RunObserver): Promise<string>;
  decide(threadId: string, approvalId: string, decision: "accept" | "decline"): void;
  close(): void;
}
