/**
 * Patch Review Component
 * Accessible unified diff viewer with SHA-256 hash badges, line metrics,
 * keyboard navigation, and operator accept/reject approval triggers.
 */

import { useCallback, useId, useState } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  FileCodeIcon,
  GitCommitIcon,
  GitCompareIcon,
  ShieldAlertIcon,
  XCircleIcon,
  XIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";

export interface PatchReviewData {
  path: string;
  previous_hash?: string | undefined;
  new_hash?: string | undefined;
  expected_hash?: string | undefined;
  unified_diff?: string | undefined;
  patch?: string | undefined;
  lines_added?: number | undefined;
  lines_deleted?: number | undefined;
  description?: string | undefined;
  action_digest?: string | undefined;
  status?: "proposed" | "approved" | "applied" | "rejected" | "conflict" | undefined;
}

export interface PatchReviewProps {
  patch: PatchReviewData;
  onAccept?: (() => Promise<void> | void) | undefined;
  onReject?: (() => Promise<void> | void) | undefined;
  className?: string | undefined;
}

interface ParsedDiffLine {
  type: "header" | "add" | "delete" | "context" | "meta";
  text: string;
  oldNum?: number | undefined;
  newNum?: number | undefined;
}

export function PatchReview({ patch, onAccept, onReject, className = "" }: PatchReviewProps) {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const regionId = useId();

  const rawDiff = patch.unified_diff || patch.patch || "";

  // Parse diff lines into structured display elements with line numbers
  const parseDiffLines = useCallback((diffText: string): ParsedDiffLine[] => {
    if (!diffText) return [];
    const rawLines = diffText.split(/\r?\n/);
    const parsed: ParsedDiffLine[] = [];

    let curOld = 0;
    let curNew = 0;

    for (const line of rawLines) {
      if (line.startsWith("---") || line.startsWith("+++")) {
        parsed.push({ type: "meta", text: line });
        continue;
      }

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch && hunkMatch[1] && hunkMatch[3]) {
        curOld = Number.parseInt(hunkMatch[1], 10);
        curNew = Number.parseInt(hunkMatch[3], 10);
        parsed.push({ type: "header", text: line });
        continue;
      }

      if (line.startsWith("+")) {
        parsed.push({
          type: "add",
          text: line.slice(1),
          newNum: curNew++
        });
      } else if (line.startsWith("-")) {
        parsed.push({
          type: "delete",
          text: line.slice(1),
          oldNum: curOld++
        });
      } else if (line.startsWith(" ")) {
        parsed.push({
          type: "context",
          text: line.slice(1),
          oldNum: curOld++,
          newNum: curNew++
        });
      } else if (line.trim().length > 0) {
        // Plain text fallback or other annotations
        parsed.push({
          type: "context",
          text: line,
          oldNum: curOld++,
          newNum: curNew++
        });
      }
    }

    return parsed;
  }, []);

  const diffLines = parseDiffLines(rawDiff);

  // Compute metrics if not pre-calculated
  const calculatedAdded = patch.lines_added ?? diffLines.filter((l) => l.type === "add").length;
  const calculatedDeleted =
    patch.lines_deleted ?? diffLines.filter((l) => l.type === "delete").length;

  const prevHashShort = (patch.previous_hash || patch.expected_hash || "").slice(0, 8);
  const newHashShort = (patch.new_hash || "").slice(0, 8);

  const handleCopy = async () => {
    if (!rawDiff) return;
    try {
      await navigator.clipboard.writeText(rawDiff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAccept = async () => {
    if (!onAccept || submitting) return;
    setSubmitting(true);
    try {
      await onAccept();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || submitting) return;
    setSubmitting(true);
    try {
      await onReject();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if ((e.key === "a" || e.key === "A") && onAccept && !submitting) {
      e.preventDefault();
      void handleAccept();
    } else if ((e.key === "r" || e.key === "R") && onReject && !submitting) {
      e.preventDefault();
      void handleReject();
    }
  };

  const renderStatusBadge = () => {
    switch (patch.status) {
      case "applied":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
          >
            <CheckCircle2Icon className="size-3" />
            Applied
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400"
          >
            <CheckIcon className="size-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
          >
            <XCircleIcon className="size-3" />
            Rejected
          </Badge>
        );
      case "conflict":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          >
            <ShieldAlertIcon className="size-3" />
            Hash Conflict
          </Badge>
        );
      case "proposed":
      default:
        return (
          <Badge
            variant="outline"
            className="gap-1 border-muted-foreground/30 bg-muted/40 text-muted-foreground"
          >
            <GitCompareIcon className="size-3" />
            Proposed
          </Badge>
        );
    }
  };

  return (
    <section
      role="region"
      aria-label={`Diff review for ${patch.path}`}
      aria-describedby={`${regionId}-desc`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`rounded-lg border border-border bg-card shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileCodeIcon className="size-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-foreground">{patch.path}</span>

          {/* Line delta badges */}
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 px-1.5 py-0 font-mono text-green-700 dark:text-green-400"
            >
              +{calculatedAdded}
            </Badge>
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/10 px-1.5 py-0 font-mono text-red-700 dark:text-red-400"
            >
              -{calculatedDeleted}
            </Badge>
          </div>

          {/* SHA-256 Short Hash Badges */}
          {prevHashShort || newHashShort ? (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {prevHashShort ? (
                <Badge variant="outline" className="gap-0.5 px-1.5 py-0 font-mono text-[10px]">
                  <GitCommitIcon className="size-2.5 text-muted-foreground/70" />
                  prev: {prevHashShort}
                </Badge>
              ) : null}
              {prevHashShort && newHashShort ? (
                <ArrowRightIcon className="size-2.5 text-muted-foreground/50" />
              ) : null}
              {newHashShort ? (
                <Badge variant="outline" className="gap-0.5 px-1.5 py-0 font-mono text-[10px]">
                  <GitCommitIcon className="size-2.5 text-primary/70" />
                  new: {newHashShort}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {renderStatusBadge()}

          {rawDiff ? (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={handleCopy}
              title="Copy diff to clipboard"
              aria-label="Copy diff to clipboard"
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Description / Summary if present */}
      {patch.description ? (
        <div
          id={`${regionId}-desc`}
          className="border-b border-border bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground"
        >
          {patch.description}
        </div>
      ) : null}

      {/* Diff content view */}
      <div className="max-h-96 overflow-x-auto overflow-y-auto font-mono text-xs leading-relaxed">
        {diffLines.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No line changes in this patch.
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {diffLines.map((line, idx) => {
              if (line.type === "meta") {
                return (
                  <div
                    key={idx}
                    className="bg-muted/40 px-3 py-1 text-[11px] font-semibold text-muted-foreground"
                  >
                    {line.text}
                  </div>
                );
              }

              if (line.type === "header") {
                return (
                  <div
                    key={idx}
                    className="border-y border-blue-500/20 bg-blue-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-400"
                  >
                    {line.text}
                  </div>
                );
              }

              let rowClass = "hover:bg-muted/30 text-foreground";
              let marker = " ";
              let markerClass = "text-muted-foreground/40";
              let srLabel = "Unchanged line";

              if (line.type === "add") {
                rowClass =
                  "bg-green-500/10 text-green-800 dark:text-green-300 border-l-2 border-green-500";
                marker = "+";
                markerClass = "text-green-600 dark:text-green-400 font-bold";
                srLabel = "Added line";
              } else if (line.type === "delete") {
                rowClass = "bg-red-500/10 text-red-800 dark:text-red-300 border-l-2 border-red-500";
                marker = "-";
                markerClass = "text-red-600 dark:text-red-400 font-bold";
                srLabel = "Deleted line";
              }

              return (
                <div key={idx} className={`flex items-start px-2 py-0.5 ${rowClass}`}>
                  {/* Line numbers */}
                  <span
                    aria-hidden="true"
                    className="w-8 shrink-0 select-none text-right font-mono text-[10px] text-muted-foreground/50"
                  >
                    {line.oldNum ?? ""}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-8 shrink-0 select-none text-right font-mono text-[10px] text-muted-foreground/50"
                  >
                    {line.newNum ?? ""}
                  </span>

                  {/* Marker */}
                  <span
                    aria-hidden="true"
                    className={`w-5 shrink-0 select-none text-center ${markerClass}`}
                  >
                    {marker}
                  </span>

                  {/* Screen reader announcement */}
                  <span className="sr-only">{srLabel}: </span>

                  {/* Content */}
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{line.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Footer triggers (if triggers provided and not yet decided) */}
      {(onAccept || onReject) && patch.status !== "applied" && patch.status !== "rejected" ? (
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            Press{" "}
            <kbd className="rounded-xs border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              A
            </kbd>{" "}
            to accept,{" "}
            <kbd className="rounded-xs border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              R
            </kbd>{" "}
            to reject
          </span>
          <div className="flex items-center gap-2">
            {onReject ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleReject}
                disabled={submitting}
              >
                <XIcon className="size-3" />
                Reject Patch
              </Button>
            ) : null}
            {onAccept ? (
              <Button
                size="sm"
                className="h-7 gap-1 bg-green-600 text-xs text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                onClick={handleAccept}
                disabled={submitting}
              >
                <CheckIcon className="size-3" />
                Accept Patch
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
