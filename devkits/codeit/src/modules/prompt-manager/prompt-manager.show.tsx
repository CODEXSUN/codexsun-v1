import { useState } from "react";
import { ArrowLeft, Pencil, Send } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import {
  WorkspaceShowLayout,
  WorkspaceShowCard,
  WorkspaceDetailTable
} from "@codexsun/ui/workspace/show";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "@codexsun/ui/components/alert-dialog";
import { PromptManagerRuns } from "./prompt-manager.runs";
import type { CodexChat, PromptDetail, PromptRun } from "./prompt-manager.types";

export function PromptManagerShow({
  detail,
  chats,
  busy,
  onBack,
  onEdit,
  onToggle,
  onSend,
  onDecide
}: {
  detail: PromptDetail;
  chats: CodexChat[];
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onSend: (threadId: string) => void;
  onDecide: (run: PromptRun, decision: "accept" | "decline") => void;
}) {
  const { prompt, runs, activity } = detail;
  const [threadId, setThreadId] = useState(prompt.threadId);
  const [confirm, setConfirm] = useState(false);
  const chat = chats.find((chat) => chat.id === threadId);
  const options = chats.map((chat) => ({
    value: chat.id,
    label: chat.name,
    description: chat.cwd,
    meta: chat.busy ? "Working" : ""
  }));
  if (prompt.threadId && !options.some((option) => option.value === prompt.threadId))
    options.push({
      value: prompt.threadId,
      label: prompt.threadName,
      description: "Saved chat",
      meta: ""
    });
  const working = runs.some((run) => ["running", "awaiting-approval"].includes(run.status));
  return (
    <WorkspacePage
      title={prompt.title}
      description="Saved prompt · review, send, and follow the result"
      actions={
        <>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button variant="outline" disabled={busy || working} onClick={onToggle}>
            {prompt.active ? "Suspend" : "Restore"}
          </Button>
        </>
      }
    >
      <WorkspaceShowLayout>
        <div className="grid content-start gap-4">
          <WorkspaceShowCard title="Prompt">
            <div className="whitespace-pre-wrap break-words p-4 text-sm leading-6">
              {prompt.content}
            </div>
          </WorkspaceShowCard>
          <PromptManagerRuns runs={runs} busy={busy} onDecide={onDecide} />
        </div>
        <div className="grid content-start gap-4">
          <WorkspaceShowCard title="Send to Codex">
            <div className="grid gap-3 p-4">
              <WorkspaceLookup
                ariaLabel="Destination Codex chat"
                allowTextValue={false}
                value={threadId}
                options={options}
                placeholder="Choose a chat"
                onValueChange={setThreadId}
              />
              <Button
                className="w-full"
                disabled={busy || working || !prompt.active || !chat || chat.busy}
                onClick={() => setConfirm(true)}
              >
                <Send className="size-4" />
                {working ? "Run in progress" : "Send prompt"}
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                {!prompt.active
                  ? "Restore this prompt to send it."
                  : chat?.busy
                    ? "This chat is already working."
                    : "The saved prompt will be sent exactly as shown. Each send keeps its own response."}
              </p>
            </div>
          </WorkspaceShowCard>
          <WorkspaceShowCard title="Details">
            <WorkspaceDetailTable
              rows={[
                [
                  "Status",
                  <WorkspaceStatusBadge
                    label={prompt.active ? "Active" : "Inactive"}
                    tone={prompt.active ? "success" : "neutral"}
                  />
                ],
                ["Category", prompt.category || "—"],
                ["Default chat", prompt.threadName || "Choose when sending"],
                ["Created", new Date(prompt.createdAt).toLocaleString()],
                ["Updated", new Date(prompt.updatedAt).toLocaleString()]
              ]}
            />
          </WorkspaceShowCard>
          <WorkspaceShowCard title="Activity">
            <ol className="grid gap-4 p-4">
              {activity.map((entry) => (
                <li key={entry.id} className="grid gap-1 border-l-2 border-primary/20 pl-3 text-sm">
                  <span>{entry.action}</span>
                  <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          </WorkspaceShowCard>
        </div>
      </WorkspaceShowLayout>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send “{prompt.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Destination: {chat?.name}. This starts work in that Codex chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm">
            {prompt.content}
          </pre>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onSend(threadId)}>Send prompt</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspacePage>
  );
}
