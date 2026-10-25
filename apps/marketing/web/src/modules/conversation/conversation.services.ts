import type { MarketingTransport } from "../../transport";
import type {
  ConversationActivity,
  MessageRecord,
  NurtureEnrollmentRecord,
  ThreadDetailRecord,
  ThreadInput,
  ThreadRecord,
  ThreadStatus
} from "./conversation.types";

export function createConversationService(transport: MarketingTransport) {
  return {
    async list(
      limit = 20,
      offset = 0,
      filters?: {
        search?: string;
        status?: string;
        channel?: string;
        brandUuid?: string;
      }
    ): Promise<ThreadRecord[]> {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
      });
      if (filters?.search) params.set("search", filters.search);
      if (filters?.status && filters.status !== "all") params.set("status", filters.status);
      if (filters?.channel && filters.channel !== "all") params.set("channel", filters.channel);
      if (filters?.brandUuid && filters.brandUuid !== "all") params.set("brandUuid", filters.brandUuid);

      return transport.get<ThreadRecord[]>(`/marketing/conversations?${params.toString()}`);
    },

    async count(filters?: {
      search?: string;
      status?: string;
      channel?: string;
      brandUuid?: string;
    }): Promise<number> {
      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (filters?.status && filters.status !== "all") params.set("status", filters.status);
      if (filters?.channel && filters.channel !== "all") params.set("channel", filters.channel);
      if (filters?.brandUuid && filters.brandUuid !== "all") params.set("brandUuid", filters.brandUuid);

      const res = await transport.get<{ total: number }>(`/marketing/conversations/count?${params.toString()}`);
      return res.total;
    },

    async get(uuid: string): Promise<ThreadDetailRecord> {
      return transport.get<ThreadDetailRecord>(`/marketing/conversations/${uuid}`);
    },

    async create(input: ThreadInput): Promise<string> {
      const res = await transport.post<{ uuid: string }>("/marketing/conversations", input);
      return res.uuid;
    },

    async sendMessage(
      threadUuid: string,
      content: string,
      templateName?: string | null
    ): Promise<MessageRecord> {
      return transport.post<MessageRecord>(`/marketing/conversations/${threadUuid}/messages`, {
        content,
        templateName: templateName ?? undefined
      });
    },

    async setHumanTakeover(threadUuid: string, enabled: boolean): Promise<void> {
      await transport.post<{ success: boolean }>(`/marketing/conversations/${threadUuid}/takeover`, {
        enabled
      });
    },

    async setStatus(threadUuid: string, status: ThreadStatus): Promise<void> {
      await transport.post<{ success: boolean }>(`/marketing/conversations/${threadUuid}/status`, {
        status
      });
    },

    async getNurtureEnrollment(threadUuid: string): Promise<NurtureEnrollmentRecord | null> {
      return transport.get<NurtureEnrollmentRecord | null>(`/marketing/conversations/${threadUuid}/nurture`);
    },

    async stopNurture(threadUuid: string, reason: string): Promise<void> {
      await transport.post<{ stopped: number }>(`/marketing/conversations/${threadUuid}/nurture/stop`, {
        reason
      });
    },

    async activity(threadUuid: string): Promise<ConversationActivity[]> {
      return transport.get<ConversationActivity[]>(`/marketing/conversations/${threadUuid}/activity`);
    }
  };
}
