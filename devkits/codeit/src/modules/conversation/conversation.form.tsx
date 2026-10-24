/**
 * Codeit Conversation Form (Composer)
 *
 * Mode selector (Ask, Plan, Work, Review), multiline input,
 * context reference attachments, keyboard submit (Enter/Shift+Enter),
 * and dynamic Send / Stop controls.
 */

import React, { useState, useRef } from "react";
import {
  ArrowUpIcon,
  FileCodeIcon,
  FileTextIcon,
  HammerIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PlusIcon,
  SearchCheckIcon,
  SquareIcon,
  XIcon
} from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { ComposerInput, ContextReference, ConversationMode } from "./conversation.types";

export interface ConversationFormProps {
  mode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
  onSubmit: (input: ComposerInput) => Promise<void> | void;
  onStop?: (() => void) | undefined;
  isStreaming?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  projectName?: string | undefined;
}

const MODE_OPTIONS: {
  mode: ConversationMode;
  label: string;
  icon: typeof MessageSquareIcon;
  hint: string;
}[] = [
  {
    mode: "ask",
    label: "Ask",
    icon: MessageSquareIcon,
    hint: "Read-only: explains context without source mutations"
  },
  {
    mode: "plan",
    label: "Plan",
    icon: FileTextIcon,
    hint: "Produces versioned plan artifacts and task breakdown"
  },
  {
    mode: "work",
    label: "Work",
    icon: HammerIcon,
    hint: "Bounded execution with authorized runner and checks"
  },
  {
    mode: "review",
    label: "Review",
    icon: SearchCheckIcon,
    hint: "Inspects changes, diffs, and verification evidence"
  }
];

export function ConversationForm({
  mode,
  onModeChange,
  onSubmit,
  onStop,
  isStreaming = false,
  disabled = false,
  className = "",
  projectName = "Codexsun Workspace"
}: ConversationFormProps) {
  const [content, setContent] = useState("");
  const [contextReferences, setContextReferences] = useState<ContextReference[]>([]);
  const [isAddingRef, setIsAddingRef] = useState(false);
  const [refPathInput, setRefPathInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isStreaming || disabled) return;

    const payload: ComposerInput = {
      content: trimmed,
      mode,
      contextReferences
    };

    setContent("");
    await onSubmit(payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape" && isStreaming && onStop) {
      e.preventDefault();
      onStop();
    }
  };

  const handleAddReference = () => {
    const trimmed = refPathInput.trim();
    if (!trimmed) return;

    if (!contextReferences.some((r) => r.path === trimmed)) {
      setContextReferences((prev) => [
        ...prev,
        {
          path: trimmed,
          type: trimmed.includes(".") ? "file" : "directory"
        }
      ]);
    }

    setRefPathInput("");
    setIsAddingRef(false);
  };

  const handleRemoveReference = (path: string) => {
    setContextReferences((prev) => prev.filter((r) => r.path !== path));
  };

  const getPlaceholder = () => {
    switch (mode) {
      case "ask":
        return "Ask a question about the repository or code (Enter to send, Shift+Enter for newline)...";
      case "plan":
        return "Describe the goal to produce tasks, dependencies, and test conditions...";
      case "work":
        return "Describe code implementation or checks to execute with bounded tools...";
      case "review":
        return "Request a review of changes, diffs, or verification evidence...";
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-xl border border-border bg-card p-3 shadow-sm transition-all focus-within:border-ring/80 focus-within:ring-2 focus-within:ring-ring/20 ${className}`}
    >
      {/* Mode Selector Pill Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[11px] font-medium text-muted-foreground">Mode:</span>
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = mode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onModeChange(opt.mode)}
                title={opt.hint}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] text-muted-foreground/80">
          Scope: <strong className="font-semibold text-foreground">{projectName}</strong>
        </span>
      </div>

      {/* Context References Chips */}
      {contextReferences.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {contextReferences.map((ref) => (
            <span
              key={ref.path}
              className="flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              <FileCodeIcon className="size-3 text-primary" />
              <span>{ref.path}</span>
              <button
                type="button"
                onClick={() => handleRemoveReference(ref.path)}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove reference ${ref.path}`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Add Reference Quick Input Form */}
      {isAddingRef ? (
        <div className="flex items-center gap-2 pt-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs">
            <PaperclipIcon className="size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={refPathInput}
              onChange={(e) => setRefPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddReference();
                } else if (e.key === "Escape") {
                  setIsAddingRef(false);
                }
              }}
              placeholder="e.g. devkits/codeit/src/modules/conversation"
              className="flex-1 bg-transparent font-mono text-xs focus:outline-hidden"
              autoFocus
            />
          </div>
          <Button type="button" size="sm" className="h-7 text-xs" onClick={handleAddReference}>
            Attach
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => setIsAddingRef(false)}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      ) : null}

      {/* Composer Multiline Textarea */}
      <div className="relative pt-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={disabled || isStreaming}
          rows={3}
          aria-label="Codeit request prompt"
          className="w-full resize-none bg-transparent font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden disabled:opacity-50"
        />
      </div>

      {/* Composer Action Toolbar */}
      <div className="flex items-center justify-between border-t border-border/40 pt-2">
        <div className="flex items-center gap-2">
          {!isAddingRef ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsAddingRef(true)}
            >
              <PlusIcon className="size-3.5" />
              <span>Reference Context</span>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-destructive/40 bg-destructive/10 text-xs font-medium text-destructive hover:bg-destructive/20"
              onClick={onStop}
            >
              <SquareIcon className="size-3 fill-current" />
              <span>Stop</span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={!content.trim() || disabled}
              className="h-8 gap-1.5 px-3 text-xs font-medium shadow-xs"
            >
              <span>Send</span>
              <ArrowUpIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
