import type {
  CodexChat,
  PromptDetail,
  PromptPayload,
  PromptRecord,
  PromptRun,
  PromptRunSummary
} from "./prompt-manager.types";

const base = "/api/codeit/prompt-manager";
async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "X-Codeit-Request": "1",
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const envelope = await response.json();
  if (!response.ok || !envelope.success)
    throw new Error(envelope.error?.message ?? "CodeIt could not complete this request");
  return envelope.data;
}
export const listPrompts = () => request<PromptRecord[]>(base);
export const getPrompt = (id: string) => request<PromptDetail>(`${base}/${encodeURIComponent(id)}`);
export const listCodexChats = () => request<CodexChat[]>(`${base}/chats`);
export const listPromptRuns = () => request<PromptRunSummary[]>(`${base}/runs`);
export const createPrompt = (value: PromptPayload) => request<PromptRecord>(base, "POST", value);
export const updatePrompt = (id: string, value: PromptPayload) =>
  request<PromptRecord>(`${base}/${encodeURIComponent(id)}`, "PUT", value);
export const deletePrompt = (id: string) =>
  request<{ deleted: boolean }>(`${base}/${encodeURIComponent(id)}`, "DELETE");
export const sendPrompt = (id: string, threadId: string, expectedUpdatedAt: string) =>
  request<PromptRun>(`${base}/${encodeURIComponent(id)}/runs`, "POST", {
    threadId,
    expectedUpdatedAt
  });
export const decidePromptRun = (id: string, approvalId: string, decision: "accept" | "decline") =>
  request<PromptRun>(`${base}/runs/${encodeURIComponent(id)}/approval`, "POST", {
    approvalId,
    decision
  });
