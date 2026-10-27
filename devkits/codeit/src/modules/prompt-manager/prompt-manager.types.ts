export type PromptPayload = {
  title: string;
  category: string;
  content: string;
  threadId: string;
  threadName: string;
  active: boolean;
};
export type PromptRecord = PromptPayload & { id: string; createdAt: string; updatedAt: string };
export type CodexChat = { id: string; name: string; cwd: string; busy: boolean };
export type PromptRun = {
  id: string;
  promptId: string;
  threadId: string;
  threadName: string;
  turnId: string | null;
  content: string;
  status: "running" | "awaiting-approval" | "completed" | "failed" | "interrupted";
  response: string;
  error: string;
  startedAt: string;
  completedAt: string | null;
  approval: { id: string; method: string; description: string } | null;
};
export type PromptDetail = {
  prompt: PromptRecord;
  runs: PromptRun[];
  activity: { id: number; action: string; createdAt: string }[];
};
export type PromptRunSummary = Pick<
  PromptRun,
  "id" | "promptId" | "status" | "threadName" | "startedAt" | "completedAt"
> & { promptTitle: string };
