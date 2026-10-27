import { Button } from "@codexsun/ui/components/button";
import { WorkspaceFormBanner } from "@codexsun/ui/workspace/upsert";
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
import type { PromptRecord } from "./prompt-manager.types";

export function PromptManagerConnectionError({
  message,
  busy,
  onReconnect
}: {
  message: string;
  busy: boolean;
  onReconnect: () => void;
}) {
  return (
    <div className="mx-auto w-[calc(100%-2rem)] max-w-[92rem] pt-4 lg:w-[calc(100%-3rem)]">
      <WorkspaceFormBanner tone="warning" title="Codex connection unavailable">
        {message} You can still save and edit prompts.{" "}
        <Button variant="outline" size="sm" disabled={busy} onClick={onReconnect}>
          Reconnect
        </Button>
      </WorkspaceFormBanner>
    </div>
  );
}

export function PromptManagerDeleteDialog({
  record,
  busy,
  onCancel,
  onDelete
}: {
  record: PromptRecord | null;
  busy: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <AlertDialog open={Boolean(record)} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{record?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the saved prompt. Prompts with run history must be suspended to
            preserve their results.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={onDelete}>
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
