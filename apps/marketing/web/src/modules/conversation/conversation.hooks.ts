import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMarketingTransport } from "../../transport";
import { listBrands } from "../brand/brand.services";
import { createConversationService } from "./conversation.services";
import type { ThreadInput, ThreadStatus } from "./conversation.types";

export function useConversationBrandOptions() {
  const api = useMarketingTransport();
  return useQuery({
    queryKey: ["marketing", api.scopeKey, "brands-lookup"],
    queryFn: () => listBrands(api, "", 0, "active", 100)
  });
}

export function useConversationService() {
  const transport = useMarketingTransport();
  return createConversationService(transport);
}

export function useConversationList(
  page: number,
  pageSize: number,
  filters?: {
    search?: string;
    status?: string;
    channel?: string;
    brandUuid?: string;
  }
) {
  const service = useConversationService();
  const offset = (page - 1) * pageSize;

  const query = useQuery({
    queryKey: ["marketing", "conversations", "list", page, pageSize, filters],
    queryFn: () => service.list(pageSize, offset, filters)
  });

  const countQuery = useQuery({
    queryKey: ["marketing", "conversations", "count", filters],
    queryFn: () => service.count(filters)
  });

  return {
    threads: query.data ?? [],
    totalCount: countQuery.data ?? 0,
    loading: query.isLoading || countQuery.isLoading,
    error: query.error || countQuery.error,
    refetch: () => {
      query.refetch();
      countQuery.refetch();
    }
  };
}

export function useConversationDetail(uuid: string | null) {
  const service = useConversationService();

  return useQuery({
    queryKey: ["marketing", "conversations", "detail", uuid],
    queryFn: () => (uuid ? service.get(uuid) : null),
    enabled: Boolean(uuid)
  });
}

export function useCreateConversation() {
  const service = useConversationService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ThreadInput) => service.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations"] });
    }
  });
}

export function useSendMessage() {
  const service = useConversationService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadUuid,
      content,
      templateName
    }: {
      threadUuid: string;
      content: string;
      templateName?: string | null | undefined;
    }) => service.sendMessage(threadUuid, content, templateName),
    onSuccess: (_, { threadUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations", "detail", threadUuid] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations", "list"] });
    }
  });
}

export function useToggleHumanTakeover() {
  const service = useConversationService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadUuid, enabled }: { threadUuid: string; enabled: boolean }) =>
      service.setHumanTakeover(threadUuid, enabled),
    onSuccess: (_, { threadUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations", "detail", threadUuid] });
    }
  });
}

export function useUpdateConversationStatus() {
  const service = useConversationService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadUuid, status }: { threadUuid: string; status: ThreadStatus }) =>
      service.setStatus(threadUuid, status),
    onSuccess: (_, { threadUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations", "detail", threadUuid] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations", "list"] });
    }
  });
}

export function useNurtureEnrollment(threadUuid: string | null) {
  const service = useConversationService();

  return useQuery({
    queryKey: ["marketing", "conversations", "nurture", threadUuid],
    queryFn: () => (threadUuid ? service.getNurtureEnrollment(threadUuid) : null),
    enabled: Boolean(threadUuid)
  });
}

export function useStopNurture() {
  const service = useConversationService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadUuid, reason }: { threadUuid: string; reason: string }) =>
      service.stopNurture(threadUuid, reason),
    onSuccess: (_, { threadUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations", "nurture", threadUuid] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "conversations", "detail", threadUuid] });
    }
  });
}

export function useConversationActivity(threadUuid: string | null) {
  const service = useConversationService();

  return useQuery({
    queryKey: ["marketing", "conversations", "activity", threadUuid],
    queryFn: () => (threadUuid ? service.activity(threadUuid) : []),
    enabled: Boolean(threadUuid)
  });
}
