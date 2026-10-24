/**
 * Tool Card Component
 * Displays tool capability invocation, state, arguments, execution time, and failure details.
 */

import { useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  FileCodeIcon,
  Loader2Icon,
  ShieldAlertIcon,
  WrenchIcon,
  XCircleIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";
import { ToolInvocation } from "../conversation.types";

interface ToolCardProps {
  tool: ToolInvocation;
  onInspect?: ((tool: ToolInvocation) => void) | undefined;
  className?: string | undefined;
}

export function ToolCard({ tool, onInspect, className = "" }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);

  const renderStatusBadge = () => {
    switch (tool.state) {
      case "running":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
          >
            <Loader2Icon className="size-3 animate-spin" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
          >
            <CheckCircle2Icon className="size-3" />
            Completed
          </Badge>
        );
      case "denied":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
          >
            <ShieldAlertIcon className="size-3" />
            Policy Denied
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
          >
            <XCircleIcon className="size-3" />
            Failed
          </Badge>
        );
      case "proposed":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <ClockIcon className="size-3" />
            Proposed
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400"
          >
            <CheckCircle2Icon className="size-3" />
            Approved
          </Badge>
        );
    }
  };

  return (
    <div
      className={`rounded-lg border border-border bg-card/60 p-3 shadow-xs transition-colors hover:border-border/80 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <WrenchIcon className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
              <span>{tool.tool_name}</span>
              <span className="text-[10px] text-muted-foreground">v{tool.tool_version}</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              hash: {tool.arguments_hash.substring(0, 10)}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tool.execution_time_ms !== undefined ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              {tool.execution_time_ms}ms
            </span>
          ) : null}
          {renderStatusBadge()}
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Hide arguments" : "Show arguments"}
          >
            {expanded ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {tool.failure_reason ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{tool.failure_reason}</span>
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-2.5 space-y-2 border-t border-border pt-2 text-xs">
          <div>
            <span className="font-medium text-muted-foreground">Arguments:</span>
            <pre className="mt-1 max-h-40 overflow-x-auto rounded-md bg-muted/70 p-2 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(tool.arguments_payload, null, 2)}
            </pre>
          </div>

          {tool.result_artifact_uuid ? (
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <FileCodeIcon className="size-3" />
                Output Artifact: {tool.result_artifact_uuid}
              </span>
              {onInspect ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => onInspect(tool)}
                >
                  Inspect
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
