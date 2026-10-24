/**
 * Conversation Status Bar Component
 * Displays model/provider, runtime state, active mode, connection health, and resource budgets.
 */

import {
  ActivityIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuIcon,
  FileTextIcon,
  HammerIcon,
  MessageSquareIcon,
  SearchCheckIcon,
  UsersIcon,
  WrenchIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { ConnectionState, ConversationMode, formatByteSize, Run } from "../conversation.types";

interface ConversationStatusBarProps {
  mode: ConversationMode;
  connectionState: ConnectionState;
  activeRun?: Run | null | undefined;
  activeWorkerCount?: number | undefined;
  className?: string | undefined;
}

export function ConversationStatusBar({
  mode,
  connectionState,
  activeRun,
  activeWorkerCount = 1,
  className = ""
}: ConversationStatusBarProps) {
  const renderModeBadge = () => {
    switch (mode) {
      case "ask":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
          >
            <MessageSquareIcon className="size-3" />
            Ask (Read-Only)
          </Badge>
        );
      case "plan":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <FileTextIcon className="size-3" />
            Plan (Artifacts Only)
          </Badge>
        );
      case "work":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <HammerIcon className="size-3" />
            Work (Bounded Execution)
          </Badge>
        );
      case "review":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400"
          >
            <SearchCheckIcon className="size-3" />
            Review (Inspection Only)
          </Badge>
        );
    }
  };

  const renderConnectionBadge = () => {
    switch (connectionState) {
      case "connected":
        return (
          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <span className="size-2 rounded-full bg-green-500" />
            Connected
          </span>
        );
      case "connecting":
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <span className="size-2 animate-ping rounded-full bg-amber-500" />
            Connecting
          </span>
        );
      case "disconnected":
        return (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <span className="size-2 rounded-full bg-destructive" />
            Disconnected
          </span>
        );
      case "denied":
        return (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <span className="size-2 rounded-full bg-destructive" />
            Access Denied
          </span>
        );
    }
  };

  const budget = activeRun?.budget;

  return (
    <footer
      aria-label="Workspace Status"
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {renderModeBadge()}
        {renderConnectionBadge()}

        <span className="hidden items-center gap-1 text-[11px] sm:flex">
          <CpuIcon className="size-3.5" />
          gemini-2.5-pro · local runner
        </span>

        <span className="flex items-center gap-1 text-[11px]">
          <UsersIcon className="size-3.5" />
          Workers: {activeWorkerCount}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {activeRun ? (
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="flex items-center gap-1" title="Duration budget">
              <ClockIcon className="size-3 text-muted-foreground" />
              {budget?.consumed_duration_seconds ?? 0}s / {budget?.max_duration_seconds ?? 300}s
            </span>
            <span className="hidden items-center gap-1 sm:flex" title="Tool calls budget">
              <WrenchIcon className="size-3 text-muted-foreground" />
              {budget?.consumed_tool_invocations ?? 0} / {budget?.max_tool_invocations ?? 50}
            </span>
            <span className="hidden items-center gap-1 md:flex" title="Output size budget">
              <ActivityIcon className="size-3 text-muted-foreground" />
              {formatByteSize(budget?.consumed_output_bytes ?? 0)} /{" "}
              {formatByteSize(budget?.max_output_bytes ?? 5242880)}
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase font-mono">
              {activeRun.state}
            </Badge>
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[11px]">
            <CheckCircleIcon className="size-3 text-green-500" />
            Ready for input
          </span>
        )}
      </div>
    </footer>
  );
}
