import { useQuery } from "@tanstack/react-query";
import { getPrompt, listCodexChats, listPrompts, listPromptRuns } from "./prompt-manager.services";

export const promptManagerKeys = {
  all: ["codeit", "prompt-manager"] as const,
  detail: (id: string) => ["codeit", "prompt-manager", "detail", id] as const,
  chats: ["codeit", "codex-chats"] as const
};
export function usePrompts() {
  return useQuery({ queryKey: promptManagerKeys.all, queryFn: listPrompts });
}
export function usePrompt(id: string) {
  return useQuery({
    queryKey: promptManagerKeys.detail(id),
    queryFn: () => getPrompt(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => ["running", "awaiting-approval"].includes(run.status))
        ? 2000
        : false,
    refetchIntervalInBackground: true
  });
}
export function useCodexChats() {
  return useQuery({
    queryKey: promptManagerKeys.chats,
    queryFn: listCodexChats,
    retry: false,
    staleTime: 30_000
  });
}
export function usePromptRuns() {
  return useQuery({
    queryKey: [...promptManagerKeys.all, "runs"],
    queryFn: listPromptRuns,
    refetchInterval: 3000,
    refetchIntervalInBackground: true
  });
}
