/**
 * Codeit Conversation Workspace Component
 *
 * Primary work surface composing:
 * - App Header with active project, conversation title, run status badge, and inspector toggle
 * - Central Chat Canvas (Messages timeline + Composer)
 * - Error / Policy Denied Banner
 * - Collapsible Inspector Drawer (Artifacts, Diff Previews, Tool Executions, Approvals)
 * - Responsive desktop (split canvas) and narrow screen (overlay sheet) layouts
 * - Conversation Status Bar (Active mode, connection health, resource meters, worker count)
 */

import { useState } from "react";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  FolderGit2Icon,
  MessageSquarePlusIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  RefreshCwIcon,
  XIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";
import { ConversationMode, ConversationWorkspaceProps } from "./conversation.types";
import { useConversation } from "./conversation.hooks";
import { ConversationList } from "./conversation.list";
import { ConversationForm } from "./conversation.form";
import { ArtifactViewer } from "./components/artifact-viewer";
import { ToolCard } from "./components/tool-card";
import { ApprovalCard } from "./components/approval-card";
import { ConversationStatusBar } from "./components/status-bar";

export function ConversationWorkspace({
  projectUuid = "c0de1700",
  initialConversationUuid,
  className = ""
}: ConversationWorkspaceProps) {
  const {
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
    setMode,
    inspectorOpen,
    setInspectorOpen,
    selectedArtifact,
    setSelectedArtifact,
    selectedTool,
    setSelectedTool,
    selectedApproval,
    drawerTab,
    setDrawerTab,
    selectConversation,
    createConversation,
    sendMessage,
    cancelActiveRun,
    approveTool,
    dismissError,
    refresh
  } = useConversation({ projectUuid, initialConversationUuid });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleCreateConversation = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    try {
      await createConversation(trimmed, mode);
      setNewTitle("");
      setIsCreatingNew(false);
      setIsDropdownOpen(false);
    } catch {
      // Handled by hook error state
    }
  };

  const handleStarterPrompt = (prompt: string, targetMode: ConversationMode) => {
    setMode(targetMode);
    sendMessage({
      content: prompt,
      mode: targetMode,
      contextReferences: []
    });
  };

  const renderRunStateBadge = () => {
    if (!activeRun) return null;
    let badgeClass = "border-border bg-muted text-muted-foreground";
    if (activeRun.state === "running") {
      badgeClass =
        "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse";
    } else if (activeRun.state === "succeeded") {
      badgeClass = "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400";
    } else if (activeRun.state === "failed" || activeRun.state === "cancelled") {
      badgeClass = "border-destructive/40 bg-destructive/10 text-destructive";
    } else if (activeRun.state === "waiting") {
      badgeClass = "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    }

    return (
      <Badge variant="outline" className={`font-mono text-[10px] uppercase ${badgeClass}`}>
        Run: {activeRun.state}
      </Badge>
    );
  };

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden bg-background text-foreground ${className}`}
    >
      {/* Top Header / Context Navigation Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <FolderGit2Icon className="size-4 text-primary" />
            <span className="hidden sm:inline">Project:</span>
            <span className="text-foreground">Codexsun</span>
          </div>

          <span className="text-muted-foreground/40">•</span>

          {/* Conversation Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              aria-label="Switch conversation"
            >
              <span className="max-w-[160px] truncate sm:max-w-xs">
                {activeConversation?.title || "Select conversation"}
              </span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>

            {isDropdownOpen ? (
              <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-card p-1 shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  <span>Conversations</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(true)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <MessageSquarePlusIcon className="size-3" />
                    New
                  </button>
                </div>

                {isCreatingNew ? (
                  <div className="p-2">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Conversation title..."
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-hidden"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateConversation();
                        if (e.key === "Escape") setIsCreatingNew(false);
                      }}
                    />
                    <div className="mt-2 flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => setIsCreatingNew(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 text-[11px]"
                        onClick={handleCreateConversation}
                        disabled={!newTitle.trim()}
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto py-1">
                    {conversations.map((c) => (
                      <button
                        key={c.uuid}
                        type="button"
                        onClick={() => {
                          selectConversation(c.uuid);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs ${
                          c.uuid === activeConversation?.uuid
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="truncate">{c.title}</span>
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {c.selected_mode}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {renderRunStateBadge()}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => refresh()}
            title="Refresh conversations"
            aria-label="Refresh conversations"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>

          {/* Inspector Panel Toggle Button */}
          <Button
            variant={inspectorOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className="gap-1.5 text-xs"
            aria-label={inspectorOpen ? "Close inspector" : "Open inspector"}
          >
            {inspectorOpen ? (
              <>
                <PanelRightCloseIcon className="size-3.5" />
                <span className="hidden sm:inline">Hide Inspector</span>
              </>
            ) : (
              <>
                <PanelRightOpenIcon className="size-3.5" />
                <span className="hidden sm:inline">Inspector</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Error / Denied / Alert Banner */}
      {error ? (
        <div className="flex items-center justify-between bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => refresh()}
            >
              Retry
            </Button>
            <button
              type="button"
              onClick={dismissError}
              className="text-destructive/80 hover:text-destructive"
              aria-label="Dismiss error"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Body: Chat Canvas and Inspector Drawer */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Central Chat Work Canvas */}
        <main
          aria-label="Conversation Chat"
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          {/* Scrollable Message List */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              isLoading={isLoading}
              onSelectArtifact={setSelectedArtifact}
              onSelectTool={setSelectedTool}
              onApprove={approveTool}
              onSelectStarterPrompt={handleStarterPrompt}
            />
          </div>

          {/* Bottom Composer Form */}
          <div className="border-t border-border/80 bg-background/80 p-3 backdrop-blur-xs">
            <ConversationForm
              mode={mode}
              onModeChange={setMode}
              onSubmit={sendMessage}
              onStop={cancelActiveRun}
              isStreaming={isStreaming || isSending}
              disabled={isLoading}
              projectName="Codexsun Workspace"
            />
          </div>
        </main>

        {/* Inspector Drawer Panel */}
        {inspectorOpen ? (
          <>
            {/* Narrow viewport backdrop overlay */}
            <div
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-xs lg:hidden"
              onClick={() => setInspectorOpen(false)}
              aria-hidden="true"
            />

            <aside
              aria-label="Artifact Inspector"
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-all lg:static lg:z-10 lg:w-96 lg:shadow-none"
            >
              {/* Drawer Tabs Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDrawerTab("artifact")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      drawerTab === "artifact"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Artifact
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab("tool")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      drawerTab === "tool"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Tool Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab("approval")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      drawerTab === "approval"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Approval
                  </button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  onClick={() => setInspectorOpen(false)}
                  aria-label="Close inspector"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>

              {/* Drawer Content */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {drawerTab === "artifact" ? (
                  <ArtifactViewer
                    artifact={selectedArtifact}
                    onClose={() => setInspectorOpen(false)}
                  />
                ) : null}

                {drawerTab === "tool" ? (
                  <div className="p-4">
                    {selectedTool ? (
                      <ToolCard tool={selectedTool} />
                    ) : (
                      <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                        <p>No tool invocation selected</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          Click inspect on a tool card in the timeline to view details.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {drawerTab === "approval" ? (
                  <div className="p-4">
                    {selectedApproval ? (
                      <ApprovalCard approval={selectedApproval} onDecide={approveTool} />
                    ) : (
                      <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                        <p>No approval action selected</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          Pending and decided approvals will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </aside>
          </>
        ) : null}
      </div>

      {/* Bottom Status Bar */}
      <ConversationStatusBar
        mode={mode}
        connectionState={connectionState}
        activeRun={activeRun}
        activeWorkerCount={activeWorkerCount}
      />
    </div>
  );
}
