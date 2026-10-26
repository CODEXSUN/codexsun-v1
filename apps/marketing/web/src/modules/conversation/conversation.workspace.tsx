import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import {
  useWorkspaceQueryState,
  useWorkspaceQueryValue
} from "@codexsun/ui/workspace/navigation";
import {
  useConversationActivity,
  useConversationDetail,
  useConversationList,
  useCreateConversation,
  useNurtureEnrollment,
  useSendMessage,
  useStopNurture,
  useToggleHumanTakeover,
  useUpdateConversationStatus
} from "./conversation.hooks";
import { ConversationList } from "./conversation.list";
import { ConversationForm } from "./conversation.form";
import { ConversationShow } from "./conversation.show";
import type { ThreadInput, ThreadRecord } from "./conversation.types";

export function ConversationWorkspace() {
  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    status: "all",
    channel: "all",
    page: 1,
    pageSize: 50
  });

  const { search, status, channel, page, pageSize } = queryParams;

  const [showKey, setShowKey] = useWorkspaceQueryValue("show", "");
  const [formMode, setFormMode] = useWorkspaceQueryValue("form", "");

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const deferredSearch = useDeferredValue(search);

  // 1. List data
  const { threads, totalCount } = useConversationList(page, pageSize, {
    search: deferredSearch.trim(),
    status,
    channel,
    ...(columnFilters.contactIdentifier ? { search: columnFilters.contactIdentifier } : {})
  });

  // 2. Detail data
  const detailQuery = useConversationDetail(showKey || null);
  const activityQuery = useConversationActivity(showKey || null);
  const nurtureQuery = useNurtureEnrollment(showKey || null);

  // 3. Mutations
  const createMutation = useCreateConversation();
  const sendMessageMutation = useSendMessage();
  const takeoverMutation = useToggleHumanTakeover();
  const statusMutation = useUpdateConversationStatus();
  const stopNurtureMutation = useStopNurture();

  // Handlers
  const handleSelectRecord = (record: ThreadRecord) => {
    setShowKey(record.uuid);
    setFormMode("");
  };

  const handleNew = () => {
    setFormMode("new");
    setShowKey("");
  };

  const handleBackToList = () => {
    setShowKey("");
    setFormMode("");
  };

  const handleCreateSubmit = async (data: ThreadInput) => {
    try {
      const uuid = await createMutation.mutateAsync(data);
      toast.success("Conversation started");
      setShowKey(uuid);
      setFormMode("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start conversation");
      throw err;
    }
  };

  const handleSendMessage = async (content: string, templateName?: string | null) => {
    if (!showKey) return;
    try {
      await sendMessageMutation.mutateAsync({
        threadUuid: showKey,
        content,
        templateName
      });
      toast.success("Message sent");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      throw err;
    }
  };

  const handleToggleTakeover = async (enabled: boolean) => {
    if (!showKey) return;
    try {
      await takeoverMutation.mutateAsync({ threadUuid: showKey, enabled });
      toast.success(enabled ? "Human takeover enabled (Bot paused)" : "Bot reactivated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle takeover");
    }
  };

  const handleUpdateStatus = async (newStatus: "open" | "resolved" | "closed") => {
    if (!showKey) return;
    try {
      await statusMutation.mutateAsync({ threadUuid: showKey, status: newStatus });
      toast.success(`Conversation marked as ${newStatus}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleStopNurture = async (reason: string) => {
    if (!showKey) return;
    try {
      await stopNurtureMutation.mutateAsync({ threadUuid: showKey, reason });
      toast.success("Automation halted for this contact");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to halt automation");
    }
  };

  // 1. Upsert Page View
  if (formMode === "new") {
    return (
      <ConversationForm
        onSubmit={handleCreateSubmit}
        onCancel={handleBackToList}
        pending={createMutation.isPending}
      />
    );
  }

  // 2. Show Page View
  if (showKey) {
    if (detailQuery.isLoading) {
      return (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Loading conversation...
        </div>
      );
    }

    if (!detailQuery.data) {
      return (
        <div className="p-8 text-center">
          <p className="text-destructive mb-4">Conversation thread was not found.</p>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={handleBackToList}
          >
            Return to conversations
          </button>
        </div>
      );
    }

    return (
      <ConversationShow
        record={detailQuery.data}
        activity={activityQuery.data ?? []}
        nurtureEnrollment={nurtureQuery.data ?? null}
        onBack={handleBackToList}
        onSendMessage={handleSendMessage}
        onToggleTakeover={handleToggleTakeover}
        onUpdateStatus={handleUpdateStatus}
        onStopNurture={handleStopNurture}
        sending={sendMessageMutation.isPending}
      />
    );
  }

  // 3. List Page View
  return (
    <ConversationList
      items={threads}
      totalCount={totalCount}
      search={search}
      onSearchChange={(val) => setQueryParams((prev) => ({ ...prev, search: val, page: 1 }))}
      status={status}
      onStatusChange={(val) => setQueryParams((prev) => ({ ...prev, status: val, page: 1 }))}
      page={page}
      pageSize={pageSize}
      onPageChange={(p) => setQueryParams((prev) => ({ ...prev, page: p }))}
      onPageSizeChange={(s) => setQueryParams((prev) => ({ ...prev, pageSize: s, page: 1 }))}
      columnFilters={columnFilters}
      onColumnFilterChange={(col, val) =>
        setColumnFilters((prev) => ({ ...prev, [col]: val }))
      }
      onClearColumnFilters={() => setColumnFilters({})}
      onSelectRecord={handleSelectRecord}
      onNew={handleNew}
    />
  );
}
