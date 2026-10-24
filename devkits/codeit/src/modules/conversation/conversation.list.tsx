/**
 * Codeit Conversation List Component
 *
 * Renders user and assistant message bubbles, streaming cursor indicator,
 * tool invocation cards, artifact chips, and operator approval cards.
 */

import { useEffect, useRef } from "react";
import {
  BotIcon,
  CheckCircle2Icon,
  Code2Icon,
  FileCodeIcon,
  FileTextIcon,
  GitCompareIcon,
  HammerIcon,
  MessageSquareIcon,
  SearchCheckIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UserIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Skeleton } from "@codexsun/ui/components/skeleton";
import {
  ApprovalDecision,
  Artifact,
  ConversationMode,
  formatByteSize,
  formatCodeitDateTime,
  Message,
  ToolInvocation
} from "./conversation.types";
import { ToolCard } from "./components/tool-card";
import { ApprovalCard } from "./components/approval-card";

export interface ConversationListProps {
  messages: Message[];
  isStreaming?: boolean | undefined;
  streamingContent?: string | undefined;
  isLoading?: boolean | undefined;
  onSelectArtifact?: ((artifact: Artifact) => void) | undefined;
  onSelectTool?: ((tool: ToolInvocation) => void) | undefined;
  onApprove?:
    ((approvalUuid: string, decision: ApprovalDecision) => Promise<void> | void) | undefined;
  onSelectStarterPrompt?: ((prompt: string, mode: ConversationMode) => void) | undefined;
  className?: string | undefined;
}

const STARTER_PROMPTS: {
  title: string;
  prompt: string;
  mode: ConversationMode;
  icon: typeof MessageSquareIcon;
}[] = [
  {
    title: "Ask: Workspace architecture",
    prompt: "Explain how this repository implements the leaf CRUD module architecture.",
    mode: "ask",
    icon: MessageSquareIcon
  },
  {
    title: "Plan: Authentication & Pairing",
    prompt: "Generate an execution plan to verify loopback pairing tokens and origin security.",
    mode: "plan",
    icon: FileTextIcon
  },
  {
    title: "Work: Contract Verification",
    prompt: "Execute TypeScript typecheck and Oxlint verification across all Codeit modules.",
    mode: "work",
    icon: HammerIcon
  },
  {
    title: "Review: Changes & Evidence",
    prompt:
      "Inspect changed conversation files and review verification evidence against CONTRACTS.md.",
    mode: "review",
    icon: SearchCheckIcon
  }
];

export function ConversationList({
  messages,
  isStreaming = false,
  streamingContent = "",
  isLoading = false,
  onSelectArtifact,
  onSelectTool,
  onApprove,
  onSelectStarterPrompt,
  className = ""
}: ConversationListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const renderArtifactIcon = (type: Artifact["artifact_type"]) => {
    switch (type) {
      case "plan":
        return <FileTextIcon className="size-3 text-blue-500" />;
      case "diff":
        return <GitCompareIcon className="size-3 text-emerald-500" />;
      case "test_report":
        return <CheckCircle2Icon className="size-3 text-green-500" />;
      case "diagnostic":
        return <StethoscopeIcon className="size-3 text-amber-500" />;
      case "evidence":
        return <ShieldCheckIcon className="size-3 text-purple-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-3/4 rounded-lg" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-24 w-5/6 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !isStreaming) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center p-6 text-center ${className}`}
      >
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Code2Icon className="size-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Welcome to Codeit</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Your AI coding pair for bounded implementation, verifiable plans, and safe execution.
          Select a starter prompt below or enter instructions.
        </p>

        <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
          {STARTER_PROMPTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectStarterPrompt?.(item.prompt, item.mode)}
                className="flex flex-col items-start rounded-lg border border-border bg-card/60 p-3 text-left transition-all hover:border-primary/40 hover:bg-card hover:shadow-xs"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Icon className="size-3.5 text-primary" />
                  <span>{item.title}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.prompt}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 p-4 ${className}`}>
      {messages.map((message) => {
        const isUser = message.role === "user";

        return (
          <div
            key={message.uuid}
            className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isUser
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-foreground border border-border"
              }`}
            >
              {isUser ? (
                <UserIcon className="size-4" />
              ) : (
                <BotIcon className="size-4 text-primary" />
              )}
            </div>

            {/* Message Body */}
            <div
              className={`flex max-w-[85%] flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}
            >
              {/* Header with Role and Timestamp */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {isUser ? "You" : "Codeit Assistant"}
                </span>
                <span>•</span>
                <span>{formatCodeitDateTime(message.created_at)}</span>
              </div>

              {/* Message Content Bubble */}
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                  isUser
                    ? "rounded-tr-xs bg-primary text-primary-foreground"
                    : "rounded-tl-xs border border-border bg-card text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
              </div>

              {/* Context Reference Chips on User Message */}
              {message.context_references && message.context_references.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {message.context_references.map((ref, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      <FileCodeIcon className="size-3 text-primary" />
                      <span>{ref.path}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Tool Invocations */}
              {message.tool_invocations && message.tool_invocations.length > 0 ? (
                <div className="w-full space-y-2 pt-1">
                  {message.tool_invocations.map((tool) => (
                    <ToolCard key={tool.uuid} tool={tool} onInspect={onSelectTool} />
                  ))}
                </div>
              ) : null}

              {/* Artifact Chips */}
              {message.artifacts && message.artifacts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {message.artifacts.map((art) => (
                    <button
                      key={art.uuid}
                      type="button"
                      onClick={() => onSelectArtifact?.(art)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left text-xs shadow-xs transition-all hover:border-primary/50 hover:bg-muted/50"
                    >
                      {renderArtifactIcon(art.artifact_type)}
                      <div className="flex flex-col">
                        <span className="font-mono text-[11px] font-semibold text-foreground">
                          {art.relative_storage_key.split("/").pop()}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {formatByteSize(art.byte_size)}
                        </span>
                      </div>
                      <Badge variant="outline" className="ml-1 text-[9px] uppercase">
                        {art.artifact_type}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Approval Request Cards */}
              {message.approvals && message.approvals.length > 0 ? (
                <div className="w-full space-y-2 pt-1">
                  {message.approvals.map((app) => (
                    <ApprovalCard key={app.uuid} approval={app} onDecide={onApprove} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* In-Flight Streaming Message */}
      {isStreaming ? (
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
            <BotIcon className="size-4 text-primary" />
          </div>
          <div className="flex max-w-[85%] flex-col items-start gap-1.5">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Codeit Assistant</span>
              <span className="flex items-center gap-1 text-primary">
                <span className="size-1.5 animate-ping rounded-full bg-primary" />
                {streamingContent ? "streaming" : "running"}
              </span>
            </div>
            <div className="rounded-2xl rounded-tl-xs border border-border bg-card px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-xs">
              {streamingContent ? (
                <div className="whitespace-pre-wrap break-words">
                  {streamingContent}
                  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-primary align-middle" />
                </div>
              ) : (
                <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:200ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:400ms]" />
                  <span className="ml-1">Executing run...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
