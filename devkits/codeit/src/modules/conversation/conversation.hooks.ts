/**
 * Codeit Conversation React State Hooks
 *
 * Real state management for Codeit chat interface wired to backend HTTP & SSE:
 * - Real conversation and message list fetching
 * - Real message submission (POST /api/codeit/conversations/:uuid/messages)
 * - Real run creation (POST /api/codeit/runs)
 * - Real Server-Sent Events stream subscription with event routing
 * - Real cancellation and approval workflows
 * - Real error reporting without fake success masks
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Approval,
  ApprovalDecision,
  Artifact,
  ComposerInput,
  ConnectionState,
  Conversation,
  ConversationMode,
  Message,
  Run,
  RunEvent,
  RunState,
  ToolInvocation
} from "./conversation.types";
import { conversationService } from "./conversation.services";

export interface UseConversationOptions {
  projectUuid?: string | undefined;
  initialConversationUuid?: string | undefined;
}

export function useConversation(options: UseConversationOptions = {}) {
  const { projectUuid = "c0de1700", initialConversationUuid } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [mode, setMode] = useState<ConversationMode>("work");
  const [activeWorkerCount, setActiveWorkerCount] = useState<number>(1);

  // Inspector drawer states
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolInvocation | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [drawerTab, setDrawerTab] = useState<"artifact" | "tool" | "approval">("artifact");

  const streamAbortRef = useRef<(() => void) | null>(null);

  // Load conversations on mount or when projectUuid changes
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setConnectionState("connecting");
    try {
      const list = await conversationService.listConversations({
        project_uuid: projectUuid
      });
      setConversations(list);

      const target = initialConversationUuid
        ? list.find((c) => c.uuid === initialConversationUuid) || list[0] || null
        : list[0] || null;

      setActiveConversation(target);
      if (target) {
        setMode(target.selected_mode);
        const msgs = await conversationService.listMessages(target.uuid);
        setMessages(msgs);
        setActiveRun(null);
      } else {
        setMessages([]);
        setActiveRun(null);
      }
      setConnectionState("connected");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to load conversations";
      setError(errMsg);
      if (
        errMsg.toLowerCase().includes("unauthorized") ||
        errMsg.includes("401") ||
        errMsg.includes("403")
      ) {
        setConnectionState("denied");
      } else {
        setConnectionState("disconnected");
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectUuid, initialConversationUuid]);

  useEffect(() => {
    loadConversations();
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current();
        streamAbortRef.current = null;
      }
    };
  }, [loadConversations]);

  // Select a different conversation
  const selectConversation = useCallback(
    async (uuid: string) => {
      if (activeConversation?.uuid === uuid) return;
      setError(null);
      try {
        const target = conversations.find((c) => c.uuid === uuid);
        if (target) {
          setActiveConversation(target);
          setMode(target.selected_mode);
          const msgs = await conversationService.listMessages(target.uuid);
          setMessages(msgs);
          setActiveRun(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to switch conversation");
      }
    },
    [activeConversation, conversations]
  );

  // Create a new conversation
  const createConversation = useCallback(
    async (title: string, targetMode: ConversationMode): Promise<Conversation> => {
      setError(null);
      try {
        const created = await conversationService.createConversation({
          project_uuid: projectUuid,
          title,
          mode: targetMode
        });
        setConversations((prev) => [created, ...prev]);
        setActiveConversation(created);
        setMode(created.selected_mode);
        setMessages([]);
        setActiveRun(null);
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create conversation";
        setError(msg);
        throw err;
      }
    },
    [projectUuid]
  );

  // Send a message and stream assistant response from real backend SSE
  const sendMessage = useCallback(
    async (input: ComposerInput) => {
      let targetConv = activeConversation;
      if (!targetConv) {
        if (conversations.length > 0 && conversations[0]) {
          targetConv = conversations[0];
          setActiveConversation(targetConv);
        } else {
          try {
            const title = input.content.slice(0, 40).trim() || "New Conversation";
            targetConv = await conversationService.createConversation({
              project_uuid: projectUuid,
              title,
              mode: input.mode
            });
            setConversations([targetConv]);
            setActiveConversation(targetConv);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create conversation");
            return;
          }
        }
      }

      setIsSending(true);
      setError(null);

      // Clean up any ongoing stream
      if (streamAbortRef.current) {
        streamAbortRef.current();
        streamAbortRef.current = null;
      }

      try {
        // 1. Submit user message to backend
        const userMsg = await conversationService.sendMessage(targetConv.uuid, {
          role: "user",
          content: input.content,
          contextReferences: input.contextReferences
        });
        setMessages((prev) => [...prev, userMsg]);

        // 2. Start run on real backend API
        const run = await conversationService.createRun({
          conversation_uuid: targetConv.uuid,
          mode: input.mode,
          project_uuid: targetConv.project_uuid,
          auto_execute: true
        });
        setActiveRun(run);
        setIsStreaming(true);
        setStreamingContent("");

        let accumulated = "";

        // 3. Subscribe to real Server-Sent Events stream
        const unsubscribe = conversationService.subscribeRunEvents(
          run.uuid,
          (event: RunEvent) => {
            // Delta text chunk from LLM provider
            if (event.event_type === "text_delta" && typeof event.payload?.delta === "string") {
              accumulated += event.payload.delta;
              setStreamingContent(accumulated);
            }
            // Monotonic state change event
            else if (event.event_type === "state_changed" && event.payload?.to_state) {
              const toState = event.payload.to_state as RunState;
              setActiveRun((prev) => (prev ? { ...prev, state: toState } : null));
            }
            // Run error or failure
            else if (event.event_type === "run.error" || event.event_type === "run.failed") {
              const errPayload = event.payload?.error as { message?: string } | undefined;
              const reason = (errPayload?.message ?? event.payload?.reason) as string | undefined;
              setError(reason || "Run execution failed on backend");
              setActiveRun((prev) => (prev ? { ...prev, state: "failed" } : null));
            }
            // Run cancelled
            else if (event.event_type === "run.cancelled") {
              setActiveRun((prev) => (prev ? { ...prev, state: "cancelled" } : null));
            }
            // Run completed / succeeded
            else if (event.event_type === "run.completed" || event.event_type === "run.succeeded") {
              setActiveRun((prev) => (prev ? { ...prev, state: "succeeded" } : null));
            }
          },
          (streamError: Error) => {
            setError(streamError.message);
            setIsStreaming(false);
            setStreamingContent("");
            setIsSending(false);
          },
          async () => {
            // Stream completed: reload finalized messages and run state from server
            try {
              const latestMsgs = await conversationService.listMessages(targetConv.uuid);
              setMessages(latestMsgs);
              const latestRun = await conversationService.getRun(run.uuid);
              setActiveRun(latestRun);
            } catch {
              // Best-effort refresh; keep current state
            } finally {
              setIsStreaming(false);
              setStreamingContent("");
              setIsSending(false);
            }
          }
        );

        streamAbortRef.current = unsubscribe;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to send message";
        setError(errorMsg);
        setIsStreaming(false);
        setStreamingContent("");
        setIsSending(false);
      }
    },
    [activeConversation]
  );

  // Cancel active run
  const cancelActiveRun = useCallback(async () => {
    if (streamAbortRef.current) {
      streamAbortRef.current();
      streamAbortRef.current = null;
    }
    setIsStreaming(false);
    setStreamingContent("");
    setIsSending(false);

    try {
      if (activeRun) {
        await conversationService.cancelRun(activeRun.uuid);
        setActiveRun((prev) =>
          prev
            ? {
                ...prev,
                state: "cancelled",
                cancellation_generation: prev.cancellation_generation + 1
              }
            : null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel run");
    }
  }, [activeRun]);

  // Submit approval decision
  const approveTool = useCallback(
    async (approvalUuid: string, decision: ApprovalDecision) => {
      try {
        const updated = await conversationService.submitApproval({
          approval_uuid: approvalUuid,
          decision
        });

        // Update approval in messages state
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.approvals) return m;
            return {
              ...m,
              approvals: m.approvals.map((app) =>
                app.uuid === approvalUuid ? { ...app, decision: updated.decision } : app
              )
            };
          })
        );

        if (selectedApproval?.uuid === approvalUuid) {
          setSelectedApproval((prev) => (prev ? { ...prev, decision: updated.decision } : null));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit approval");
      }
    },
    [selectedApproval]
  );

  const openArtifactInspector = useCallback(async (artifact: Artifact) => {
    // If artifact does not have content loaded, fetch it live
    if (!artifact.content) {
      try {
        const fullArtifact = await conversationService.getArtifact(artifact.uuid);
        setSelectedArtifact(fullArtifact);
      } catch {
        setSelectedArtifact(artifact);
      }
    } else {
      setSelectedArtifact(artifact);
    }
    setDrawerTab("artifact");
    setInspectorOpen(true);
  }, []);

  const openToolInspector = useCallback((tool: ToolInvocation) => {
    setSelectedTool(tool);
    setDrawerTab("tool");
    setInspectorOpen(true);
  }, []);

  const openApprovalInspector = useCallback((approval: Approval) => {
    setSelectedApproval(approval);
    setDrawerTab("approval");
    setInspectorOpen(true);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    conversations,
    activeConversation,
    activeRun,
    messages,
    isLoading,
    isSending,
    streamingContent,
    isStreaming,
    error,
    connectionState,
    mode,
    activeWorkerCount,
    setActiveWorkerCount,
    setMode,
    inspectorOpen,
    setInspectorOpen,
    selectedArtifact,
    setSelectedArtifact: openArtifactInspector,
    selectedTool,
    setSelectedTool: openToolInspector,
    selectedApproval,
    setSelectedApproval: openApprovalInspector,
    drawerTab,
    setDrawerTab,
    selectConversation,
    createConversation,
    sendMessage,
    cancelActiveRun,
    approveTool,
    dismissError,
    refresh: loadConversations
  };
}
