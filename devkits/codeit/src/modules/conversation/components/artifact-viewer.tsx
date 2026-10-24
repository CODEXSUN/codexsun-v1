/**
 * Artifact Viewer Component
 * Renders plan revisions, diff previews, test reports, diagnostics, and evidence.
 */

import { useState } from "react";
import {
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  FileCodeIcon,
  FileTextIcon,
  GitCompareIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  XIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";
import { Artifact, formatByteSize, formatCodeitDateTime } from "../conversation.types";
import { PatchReview } from "./patch-review";

interface ArtifactViewerProps {
  artifact: Artifact | null;
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}

export function ArtifactViewer({ artifact, onClose, className = "" }: ArtifactViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!artifact) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground ${className}`}
      >
        <FileCodeIcon className="size-10 stroke-1 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">No artifact selected</p>
        <p className="text-xs text-muted-foreground/80">
          Select an artifact chip from the conversation to inspect details.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    if (artifact.content) {
      navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getArtifactIcon = () => {
    switch (artifact.artifact_type) {
      case "plan":
        return <FileTextIcon className="size-4 text-blue-500" />;
      case "diff":
        return <GitCompareIcon className="size-4 text-emerald-500" />;
      case "test_report":
        return <CheckCircle2Icon className="size-4 text-green-500" />;
      case "diagnostic":
        return <StethoscopeIcon className="size-4 text-amber-500" />;
      case "evidence":
        return <ShieldCheckIcon className="size-4 text-purple-500" />;
    }
  };

  const renderContent = () => {
    const raw = artifact.content || "";

    if (artifact.artifact_type === "diff") {
      const prov = (artifact.provenance ?? {}) as Record<string, unknown>;
      return (
        <PatchReview
          patch={{
            path: (prov.path as string) || artifact.relative_storage_key || "file.diff",
            unified_diff: raw,
            previous_hash: prov.previous_hash as string | undefined,
            new_hash: artifact.content_hash,
            lines_added: prov.lines_added as number | undefined,
            lines_deleted: prov.lines_deleted as number | undefined,
            status: "applied"
          }}
          className="border-none shadow-none"
        />
      );
    }

    if (artifact.artifact_type === "plan") {
      return (
        <div className="space-y-3 font-sans text-xs leading-relaxed text-foreground">
          {raw.split("\n").map((line, i) => {
            if (line.startsWith("# ")) {
              return (
                <h2 key={i} className="text-base font-bold text-foreground">
                  {line.substring(2)}
                </h2>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <h3 key={i} className="pt-2 text-sm font-semibold text-foreground">
                  {line.substring(3)}
                </h3>
              );
            }
            if (line.startsWith("### ")) {
              return (
                <h4 key={i} className="text-xs font-semibold text-foreground">
                  {line.substring(4)}
                </h4>
              );
            }
            if (line.startsWith("- [x] ")) {
              return (
                <div key={i} className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2Icon className="size-3.5" />
                  <span>{line.substring(6)}</span>
                </div>
              );
            }
            if (line.startsWith("- [ ] ")) {
              return (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <div className="size-3.5 rounded-xs border border-border" />
                  <span>{line.substring(6)}</span>
                </div>
              );
            }
            if (line.startsWith("- ")) {
              return (
                <li key={i} className="ml-4 list-disc text-muted-foreground">
                  {line.substring(2)}
                </li>
              );
            }
            return (
              <p key={i} className="text-muted-foreground">
                {line}
              </p>
            );
          })}
        </div>
      );
    }

    // Default formatted code or JSON
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground">
        {raw}
      </pre>
    );
  };

  return (
    <div className={`flex h-full flex-col bg-card ${className}`}>
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          {getArtifactIcon()}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold">
                {artifact.relative_storage_key}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {artifact.artifact_type}
              </Badge>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              SHA: {artifact.content_hash.substring(0, 12)}... ·{" "}
              {formatByteSize(artifact.byte_size)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {artifact.content ? (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={handleCopy}
              title="Copy artifact content"
              aria-label="Copy artifact content"
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-green-500" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
          ) : null}
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={onClose}
              title="Close inspector"
              aria-label="Close inspector"
            >
              <XIcon className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Provenance Metadata Strip */}
      <div className="border-b border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium text-foreground">Creator: </span>
            {artifact.provenance.creator || "System"}
          </div>
          <div>
            <span className="font-medium text-foreground">Recorded: </span>
            {formatCodeitDateTime(artifact.created_at)}
          </div>
          {artifact.provenance.task_id ? (
            <div>
              <span className="font-medium text-foreground">Task: </span>
              {String(artifact.provenance.task_id)}
            </div>
          ) : null}
          {artifact.provenance.revision ? (
            <div>
              <span className="font-medium text-foreground">Revision: </span>
              {String(artifact.provenance.revision)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderContent()}</div>
    </div>
  );
}
