import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { promptManagerKeys, usePromptRuns } from "./prompt-manager.hooks";
import type { PromptRun } from "./prompt-manager.types";

export function PromptManagerNotifications({ onOpen }: { onOpen: (id: string) => void }) {
  const runs = usePromptRuns();
  const client = useQueryClient();
  const observed = useRef(new Map<string, PromptRun["status"]>());
  const initialized = useRef(false);
  useEffect(() => {
    if (!runs.data) return;
    for (const run of runs.data) {
      const previous = observed.current.get(run.id);
      const changed = initialized.current && previous !== run.status;
      if (changed && ["completed", "failed", "interrupted"].includes(run.status))
        void client.invalidateQueries({ queryKey: promptManagerKeys.chats });
      const options = {
        description: run.threadName,
        action: { label: "View result", onClick: () => onOpen(run.promptId) }
      };
      if (changed && run.status === "completed")
        toast.success(`Completed: ${run.promptTitle}`, options);
      else if (changed && (run.status === "failed" || run.status === "interrupted"))
        toast.error(`Run ${run.status}: ${run.promptTitle}`, options);
      else if (changed && run.status === "awaiting-approval")
        toast.warning(`Approval needed: ${run.promptTitle}`, options);
      observed.current.set(run.id, run.status);
    }
    initialized.current = true;
  }, [runs.data, onOpen, client]);
  return null;
}
