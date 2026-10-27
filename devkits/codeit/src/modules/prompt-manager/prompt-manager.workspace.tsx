import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { Skeleton } from "@codexsun/ui/components/skeleton";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceFormBanner } from "@codexsun/ui/workspace/upsert";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { useWorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { useWorkspaceQueryState } from "@codexsun/ui/workspace/navigation";
import { PromptManagerNavigation, promptManagerPath as base } from "./prompt-manager.navigation";
import { PromptManagerConnectionError, PromptManagerDeleteDialog } from "./prompt-manager.feedback";
import { promptManagerKeys, useCodexChats, usePrompt, usePrompts } from "./prompt-manager.hooks";
import {
  createPrompt,
  updatePrompt,
  deletePrompt,
  sendPrompt,
  decidePromptRun
} from "./prompt-manager.services";
import { PromptManagerForm } from "./prompt-manager.form";
import { PromptManagerShow } from "./prompt-manager.show";
import { PromptManagerList, promptColumns } from "./prompt-manager.list";
import type { PromptPayload, PromptRecord, PromptRun } from "./prompt-manager.types";

export function PromptManagerWorkspace({ headerTarget }: { headerTarget: HTMLElement | null }) {
  return (
    <PromptManagerNavigation headerTarget={headerTarget}>
      {(path, navigate) => <PromptManagerContent path={path} navigate={navigate} />}
    </PromptManagerNavigation>
  );
}

function PromptManagerContent({
  path,
  navigate
}: {
  path: string;
  navigate: (path: string) => void;
}) {
  const parts = path.slice(base.length).split("/").filter(Boolean);
  const creating = parts[0] === "new";
  const id = creating ? "" : (parts[0] ?? "");
  const editing = parts[1] === "edit";
  const client = useQueryClient();
  const prompts = usePrompts();
  const detail = usePrompt(id);
  const chats = useCodexChats();
  const [deleting, setDeleting] = useState<PromptRecord | null>(null);
  const [query, setQuery] = useWorkspaceQueryState({
    search: "",
    status: "active",
    page: 1,
    rows: 20,
    fromDate: "",
    toDate: ""
  });
  const tools = useWorkspaceListTools(promptColumns);
  async function refresh() {
    await client.invalidateQueries({ queryKey: promptManagerKeys.all });
    await client.invalidateQueries({ queryKey: promptManagerKeys.chats });
  }
  const save = useMutation({
    mutationFn: (value: PromptPayload) => (id ? updatePrompt(id, value) : createPrompt(value)),
    onSuccess: async (record) => {
      await refresh();
      toast.success(id ? "Prompt updated" : "Prompt saved");
      navigate(`${base}/${record.id}`);
    }
  });
  const action = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });
  function toggle(record: PromptRecord) {
    action.mutate(async () => {
      await updatePrompt(record.id, payload(record, !record.active));
      toast.success(record.active ? "Prompt suspended" : "Prompt restored");
    });
  }
  function send(threadId: string) {
    action.mutate(async () => {
      const run = await sendPrompt(id, threadId, detail.data!.prompt.updatedAt);
      if (run.status === "failed") toast.error(run.error);
      else toast.success("Prompt sent to Codex");
    });
  }
  function decide(run: PromptRun, decision: "accept" | "decline") {
    if (run.approval) action.mutate(() => decidePromptRun(run.id, run.approval!.id, decision));
  }
  const records = (prompts.data ?? []).filter((record) => {
    const date = record.updatedAt.slice(0, 10);
    return (
      (query.status === "all" || (query.status === "active") === record.active) &&
      `${record.title} ${record.category} ${record.content} ${record.threadName}`
        .toLowerCase()
        .includes(query.search.toLowerCase()) &&
      (!query.fromDate || date >= query.fromDate) &&
      (!query.toDate || date <= query.toDate) &&
      tools.matches({
        ...record,
        active: record.active ? "Active" : "Inactive",
        updatedAt: new Date(record.updatedAt).toLocaleString()
      })
    );
  });
  const totalPages = Math.max(1, Math.ceil(records.length / query.rows));
  const page = Math.max(1, Math.min(query.page, totalPages));
  const busy = save.isPending || action.isPending;
  let content;
  if (creating || (editing && detail.data))
    content = (
      <PromptManagerForm
        key={id || "new"}
        record={detail.data?.prompt ?? null}
        chats={chats.data ?? []}
        busy={busy}
        error={save.error?.message ?? ""}
        onSave={(value) => save.mutate(value)}
        onCancel={() => navigate(id ? `${base}/${id}` : base)}
      />
    );
  else if (id && detail.data)
    content = (
      <PromptManagerShow
        key={id}
        detail={detail.data}
        chats={chats.data ?? []}
        busy={busy}
        onBack={() => navigate(base)}
        onEdit={() => {
          save.reset();
          navigate(`${base}/${id}/edit`);
        }}
        onToggle={() => toggle(detail.data!.prompt)}
        onSend={send}
        onDecide={decide}
      />
    );
  else if (id)
    content = (
      <WorkspacePage
        title="Prompt"
        actions={
          <Button variant="outline" onClick={() => navigate(base)}>
            Back to prompts
          </Button>
        }
      >
        {detail.error ? (
          <WorkspaceFormBanner title="Unable to open prompt">
            {detail.error.message}
          </WorkspaceFormBanner>
        ) : (
          <Skeleton className="h-72 w-full" />
        )}
      </WorkspacePage>
    );
  else
    content = (
      <WorkspacePage
        title=""
        variant="list"
        className="pt-3 lg:pt-3"
        actions={
          <>
            <Button
              className="h-8 px-2.5"
              aria-label={chats.data ? "Refresh chats" : "Connect Codex"}
              title={chats.data ? "Refresh chats" : "Connect Codex"}
              variant="outline"
              disabled={chats.isFetching}
              onClick={() => void chats.refetch()}
            >
              <RefreshCw className={`size-4 ${chats.isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">
                {chats.data ? "Refresh chats" : "Connect Codex"}
              </span>
            </Button>
            <Button
              className="h-8 px-2.5"
              aria-label="New prompt"
              onClick={() => {
                save.reset();
                navigate(`${base}/new`);
              }}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New prompt</span>
              <span className="sm:hidden">New</span>
            </Button>
          </>
        }
      >
        {prompts.error && (
          <WorkspaceFormBanner title="Unable to load prompts">
            {prompts.error.message}
            <Button variant="outline" onClick={() => void prompts.refetch()}>
              Retry
            </Button>
          </WorkspaceFormBanner>
        )}
        <WorkspaceFilters
          searchValue={query.search}
          onSearchValueChange={(search) => setQuery({ ...query, search, page: 1 })}
          searchPlaceholder="Search saved prompts…"
          filterValue={query.status}
          onFilterValueChange={(status) => setQuery({ ...query, status, page: 1 })}
          filterOptions={[
            { id: "active", label: "Active" },
            { id: "inactive", label: "Inactive" },
            { id: "all", label: "All prompts" }
          ]}
          columnOptions={tools.columnOptions}
          onShowAllColumns={tools.onShowAllColumns}
          toolbarAction={
            <>
              <WorkspaceDateRangePicker
                fromDate={query.fromDate}
                toDate={query.toDate}
                onValueChange={(range) => setQuery({ ...query, ...range, page: 1 })}
              />
              {tools.toolbarAction}
            </>
          }
        />
        <PromptManagerList
          records={records.slice((page - 1) * query.rows, page * query.rows)}
          loading={prompts.isPending}
          tools={tools}
          onShow={(record) => navigate(`${base}/${record.id}`)}
          onEdit={(record) => {
            save.reset();
            navigate(`${base}/${record.id}/edit`);
          }}
          onToggle={toggle}
          onDelete={setDeleting}
        />
        <WorkspacePagination
          page={page}
          rowsPerPage={query.rows}
          totalCount={records.length}
          totalPages={totalPages}
          singularLabel="prompts"
          showingLabel={
            records.length
              ? `${(page - 1) * query.rows + 1}–${Math.min(page * query.rows, records.length)} of ${records.length}`
              : "No prompts"
          }
          onPageChange={(page) => setQuery({ ...query, page })}
          onPreviousPage={() => setQuery({ ...query, page: page - 1 })}
          onNextPage={() => setQuery({ ...query, page: page + 1 })}
          onRowsPerPageChange={(rows) => setQuery({ ...query, rows, page: 1 })}
        />
      </WorkspacePage>
    );
  return (
    <>
      {chats.error && (
        <PromptManagerConnectionError
          message={chats.error.message}
          busy={chats.isFetching}
          onReconnect={() => void chats.refetch()}
        />
      )}
      {content}
      <PromptManagerDeleteDialog
        record={deleting}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onDelete={() => {
          if (deleting)
            action.mutate(async () => {
              await deletePrompt(deleting.id);
              toast.success("Prompt deleted");
              setDeleting(null);
            });
        }}
      />
    </>
  );
}

function payload(record: PromptRecord, active: boolean): PromptPayload {
  return {
    title: record.title,
    category: record.category,
    content: record.content,
    threadId: record.threadId,
    threadName: record.threadName,
    active
  };
}
