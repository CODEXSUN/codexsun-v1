/**
 * Codeit Conversation Client Services
 *
 * Provides typed HTTP operations targeting `/api/codeit` routes
 * and real SSE event stream subscription.
 *
 * Per finding A2, in-memory fixtures and silent fake fallbacks
 * have been removed from production services; real backend API
 * responses and errors are returned.
 */

import {
  Approval,
  ApprovalDecision,
  Artifact,
  Conversation,
  ConversationFilters,
  ConversationMode,
  Message,
  MessageRole,
  Run,
  RunEvent
} from "./conversation.types";
import {
  AppendMessageSchema,
  CreateConversationSchema,
  SubmitApprovalSchema
} from "./conversation.schema";

const API_BASE = "/api/codeit";

export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/codexsun_codeit_csrf=([^;]+)/);
  if (match && match[1]) return match[1];
  return "";
}

function getAuthHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { "x-codeit-csrf": token } : {})
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  } | null;
  correlation_id: string;
}

export class ConversationService {
  /**
   * List conversations for a project
   */
  async listConversations(filters?: ConversationFilters): Promise<Conversation[]> {
    const query = new URLSearchParams();
    if (filters?.project_uuid) query.set("project_uuid", filters.project_uuid);
    if (filters?.archived !== undefined) query.set("archived", String(filters.archived));
    if (filters?.search) query.set("search", filters.search);
    if (filters?.limit !== undefined) query.set("limit", String(filters.limit));
    if (filters?.cursor) query.set("cursor", filters.cursor);

    const qs = query.toString();
    const url = `${API_BASE}/conversations${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(
        errBody?.error?.message ?? `HTTP ${res.status}: Failed to list conversations`
      );
    }

    const json = (await res.json()) as ApiResponse<{ items: Conversation[] }>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Failed to list conversations");
    }

    return json.data.items ?? [];
  }

  /**
   * Get single conversation by UUID
   */
  async getConversation(uuid: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(uuid)}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}: Failed to get conversation`);
    }

    const json = (await res.json()) as ApiResponse<Conversation>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? `Conversation not found: ${uuid}`);
    }

    return json.data;
  }

  /**
   * Create a new conversation
   */
  async createConversation(input: {
    project_uuid: string;
    title: string;
    mode: ConversationMode;
  }): Promise<Conversation> {
    const validated = CreateConversationSchema.parse(input);

    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(validated)
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(
        errBody?.error?.message ?? `HTTP ${res.status}: Failed to create conversation`
      );
    }

    const json = (await res.json()) as ApiResponse<Conversation>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Failed to create conversation");
    }

    return json.data;
  }

  /**
   * List messages in a conversation
   */
  async listMessages(
    conversationUuid: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<Message[]> {
    const query = new URLSearchParams();
    if (options?.limit) query.set("limit", String(options.limit));
    if (options?.cursor) query.set("cursor", options.cursor);
    const qs = query.toString();

    const res = await fetch(
      `${API_BASE}/conversations/${encodeURIComponent(conversationUuid)}/messages${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: { Accept: "application/json" }
      }
    );

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}: Failed to list messages`);
    }

    const json = (await res.json()) as ApiResponse<{ items: Message[] }>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Failed to list messages");
    }

    return json.data.items ?? [];
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    conversationUuid: string,
    input: {
      role: MessageRole;
      content: string;
      request_key?: string;
      contextReferences?: { path: string; type: "file" | "symbol" | "directory" }[];
    }
  ): Promise<Message> {
    const requestKey = input.request_key || `req_${Date.now()}`;
    const validated = AppendMessageSchema.parse({
      role: input.role,
      content: input.content,
      request_key: requestKey
    });

    const bodyPayload = {
      ...validated,
      ...(input.contextReferences && input.contextReferences.length > 0
        ? { context_references: input.contextReferences }
        : {})
    };

    const res = await fetch(
      `${API_BASE}/conversations/${encodeURIComponent(conversationUuid)}/messages`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(bodyPayload)
      }
    );

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}: Failed to send message`);
    }

    const json = (await res.json()) as ApiResponse<Message>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Failed to send message");
    }

    return json.data;
  }

  /**
   * Create / start a run on the backend
   */
  async createRun(input: {
    conversation_uuid: string;
    mode?: ConversationMode;
    project_uuid?: string;
    auto_execute?: boolean;
  }): Promise<Run> {
    const res = await fetch(`${API_BASE}/runs`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}: Failed to create run`);
    }

    const json = (await res.json()) as ApiResponse<Run>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Failed to create run");
    }

    return json.data;
  }

  /**
   * Get active or specific run details
   */
  async getRun(runUuid: string): Promise<Run> {
    const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(runUuid)}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}: Failed to get run`);
    }

    const json = (await res.json()) as ApiResponse<Run>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? `Run not found: ${runUuid}`);
    }

    return json.data;
  }

  /**
   * Cancel an active run
   */
  async cancelRun(
    runUuid: string,
    reason?: string
  ): Promise<{ cancelled: boolean; generation?: number }> {
    const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(runUuid)}/cancel`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason: reason || "User cancelled run" })
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}: Failed to cancel run`);
    }

    const json = (await res.json()) as ApiResponse<{ cancelled: boolean; generation?: number }>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Failed to cancel run");
    }

    return json.data;
  }

  /**
   * Submit tool approval decision
   */
  async submitApproval(input: {
    approval_uuid: string;
    decision: ApprovalDecision;
  }): Promise<Approval> {
    const validated = SubmitApprovalSchema.parse(input);

    const res = await fetch(`${API_BASE}/tools/approve`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(validated)
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}: Failed to submit approval`);
    }

    const json = (await res.json()) as ApiResponse<Approval>;
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Failed to submit approval");
    }

    return json.data;
  }

  /**
   * Retrieve artifact by UUID
   */
  async getArtifact(artifactUuid: string): Promise<Artifact> {
    const res = await fetch(`${API_BASE}/artifacts/${encodeURIComponent(artifactUuid)}`, {
      method: "GET",
      headers: { Accept: "*/*" }
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let msg = `HTTP ${res.status}: Failed to get artifact ${artifactUuid}`;
      try {
        const parsed = JSON.parse(errText) as ApiResponse<unknown>;
        if (parsed.error?.message) msg = parsed.error.message;
      } catch {
        // Keep fallback status message
      }
      throw new Error(msg);
    }

    const mediaType = res.headers.get("content-type") || "text/plain";
    const contentHash = res.headers.get("x-content-hash") || "";
    const byteSize = Number(res.headers.get("content-length")) || 0;
    const content = await res.text();

    let artifactType: Artifact["artifact_type"] = "evidence";
    if (
      mediaType.includes("diff") ||
      artifactUuid.includes("patch") ||
      content.startsWith("--- ")
    ) {
      artifactType = "diff";
    } else if (mediaType.includes("json")) {
      artifactType = "test_report";
    } else if (mediaType.includes("markdown") || content.startsWith("# ")) {
      artifactType = "plan";
    }

    return {
      uuid: artifactUuid,
      run_uuid: "",
      artifact_type: artifactType,
      content_hash: contentHash,
      relative_storage_key: `artifacts/${artifactUuid}`,
      byte_size: byteSize || content.length,
      media_type: mediaType,
      provenance: { summary: `Artifact ${artifactUuid}` },
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Subscribe to real SSE event stream for a run
   * Supports:
   * - Streaming fetch with text/event-stream parsing
   * - Fallback handling for unit tests / test harnesses returning JSON { items: [...] }
   * - Dispatches events: run.started, state_changed, text_delta, tool.invocation,
   *   tool.completed, message_completed, run.completed, run.succeeded, run.failed, run.cancelled
   */
  subscribeRunEvents(
    runUuid: string,
    onEvent: (event: RunEvent) => void,
    onError?: (err: Error) => void,
    onComplete?: () => void,
    cursor?: number
  ): () => void {
    const controller = new AbortController();
    const cursorParam = cursor !== undefined ? `?cursor=${cursor}` : "";
    const url = `${API_BASE}/runs/${encodeURIComponent(runUuid)}/events${cursorParam}`;

    (async () => {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "text/event-stream" },
          signal: controller.signal
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          let msg = `HTTP ${res.status}: Failed to subscribe to events`;
          try {
            const parsed = JSON.parse(errText) as ApiResponse<unknown>;
            if (parsed.error?.message) msg = parsed.error.message;
          } catch {
            // Keep default msg
          }
          throw new Error(msg);
        }

        // Handle JSON response fallback (e.g. test environments without streaming HTTP)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = (await res.json()) as
            { items?: RunEvent[] } | ApiResponse<{ items: RunEvent[] }>;
          const items =
            ("items" in json
              ? json.items
              : (json as ApiResponse<{ items: RunEvent[] }>).data?.items) ?? [];
          for (const ev of items) {
            onEvent(ev);
          }
          onComplete?.();
          return;
        }

        if (!res.body) {
          onComplete?.();
          return;
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        const processLines = (lines: string[]) => {
          let currentEvent = "message";
          let currentId = 0;
          let currentData = "";

          for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("id: ")) {
              currentId = Number(line.slice(4).trim()) || 0;
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            } else if (line === "") {
              if (currentData) {
                try {
                  const payload = JSON.parse(currentData) as RunEvent["payload"];
                  onEvent({
                    run_uuid: runUuid,
                    seq: currentId,
                    event_type: currentEvent,
                    payload,
                    created_at: new Date().toISOString()
                  });
                } catch {
                  onEvent({
                    run_uuid: runUuid,
                    seq: currentId,
                    event_type: currentEvent,
                    payload: { raw: currentData },
                    created_at: new Date().toISOString()
                  });
                }
              }
              currentEvent = "message";
              currentData = "";
            }
          }
        };

        if (typeof res.body.getReader === "function") {
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            processLines(lines);
          }
        } else if (Symbol.asyncIterator in res.body) {
          for await (const chunk of res.body as AsyncIterable<Uint8Array | string>) {
            const strChunk =
              typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
            buffer += strChunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            processLines(lines);
          }
        }

        // Process any trailing line in buffer
        if (buffer.trim()) {
          processLines([buffer, ""]);
        }

        onComplete?.();
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }
}

export const conversationService = new ConversationService();
