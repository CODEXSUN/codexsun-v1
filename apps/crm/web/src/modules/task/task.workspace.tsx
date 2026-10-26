import { countTaskStatuses } from "./task.filters";
import { enquiryContactsQueryKey } from "../enquiry";
import { contactsQueryKey } from "../contact";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { taskOptionsQueryKey, taskQueryKey, useTaskOptions, useTasks } from "./task.hooks";
import { TaskForm } from "./task.form";
import { TaskList } from "./task.list";
import { TaskShow } from "./task.show";
import { createTask, updateTask } from "./task.services";
import type { TaskColumnFilters, TaskPayload, TaskRecord } from "./task.types";

const columns = [
  { id: "task", label: "Task" },
  { id: "list", label: "List in" },
  { id: "due", label: "Due date" },
  { id: "priority", label: "Priority" },
  { id: "creator", label: "Creator" },
  { id: "assignee", label: "Assigned to" },
  { id: "status", label: "Status" }
];

export function TaskWorkspace({
  initialRecordKey,
  initialCreate = false,
  onOpenRecord,
  onCloseCreate,
  onCancelCreate,
  onEditActionChange
}: {
  initialRecordKey?: string | undefined;
  initialCreate?: boolean;
  onOpenRecord?: (key: string) => void;
  onCloseCreate?: () => void;
  onCancelCreate?: () => void;
  onEditActionChange?: (action: { run: () => void } | null) => void;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [columnFilters, setColumnFilters] = useState<TaskColumnFilters>({
    title: "",
    listIn: "",
    dueDate: "",
    priority: "",
    creator: "",
    assignedTo: "",
    status: ""
  });
  const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });
  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [editing, setEditing] = useState<TaskRecord | null | undefined>(
    initialCreate ? null : undefined
  );
  const [showing, setShowing] = useState<string | null>(initialRecordKey ?? null);
  const deferredSearch = useDeferredValue(search);
  const deferredFilters = useDeferredValue(columnFilters);
  const options = useTaskOptions();
  const query = useTasks(
    deferredSearch.trim(),
    page,
    rowsPerPage,
    filter,
    deferredFilters,
    dateRange
  );
  const open = (record: TaskRecord) => {
    setShowing(String(record.id));
    onOpenRecord?.(String(record.id));
  };
  const openTaskFromCreate = (id: string) => {
    if (initialCreate && onOpenRecord) {
      onOpenRecord(id);
      return;
    }
    setEditing(undefined);
    setShowing(id);
    onOpenRecord?.(id);
  };
  const editTask = useCallback((row: TaskRecord) => setEditing(row), []);
  const save = useMutation({
    mutationFn: (payload: TaskPayload) =>
      editing ? updateTask(editing.id, payload) : createTask(payload),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: taskQueryKey }),
        client.invalidateQueries({ queryKey: taskOptionsQueryKey }),
        client.invalidateQueries({ queryKey: enquiryContactsQueryKey }),
        client.invalidateQueries({ queryKey: contactsQueryKey })
      ]);
      toast.success(editing ? "Task updated" : "Task created");
      setEditing(undefined);
      if (initialCreate) onCloseCreate?.();
    },
    onError: (error) => toast.error("Unable to save task", { description: error.message })
  });
  useEffect(() => {
    if (query.data && page > Math.max(1, Math.ceil(query.data.total / rowsPerPage)))
      setPage(Math.max(1, Math.ceil(query.data.total / rowsPerPage)));
  }, [query.data, page, rowsPerPage]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = Math.min(page, totalPages);

  if (editing !== undefined) {
    if (!options.data)
      return (
        <WorkspacePage title="Tasks" technicalName="page.crm.tasks.upsert">
          <p role="alert" className="text-sm text-destructive">
            {options.error?.message ?? "Task options are unavailable."}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              setEditing(undefined);
              if (initialCreate) (onCancelCreate ?? onCloseCreate)?.();
            }}
          >
            Back to tasks
          </Button>
        </WorkspacePage>
      );
    return (
      <TaskForm
        record={editing}
        options={options.data}
        saving={save.isPending}
        error={save.error?.message ?? ""}
        onOpenTask={openTaskFromCreate}
        onSeeAll={() => {
          setSearch("");
          setFilter("all");
          setColumnFilters({});
          setPage(1);
          if (initialCreate) (onCancelCreate ?? onCloseCreate)?.();
          else setEditing(undefined);
        }}
        onCancel={() => {
          setEditing(undefined);
          if (initialCreate) (onCancelCreate ?? onCloseCreate)?.();
        }}
        onSave={(payload) => save.mutate(payload)}
      />
    );
  }
  if (showing !== null)
    return (
      <TaskShow
        id={showing}
        onEdit={editTask}
        {...(onEditActionChange ? { onEditActionChange } : {})}
      />
    );

  const activeFilters = Object.values(columnFilters).filter(Boolean).length;
  const filterOptions = [
    { id: "all", label: "All tasks" },
    { id: "active", label: "Active (except won and lost)" },
    { id: "hold", label: "Hold" },
    { id: "pending-group", label: "Pending" },
    { id: "other", label: "Other" },
    ...(options.data?.statuses ?? []).map((status) => ({
      id: status.code ?? String(status.id),
      label: status.name
    }))
  ];
  return (
    <WorkspacePage variant="list" title="" technicalName="page.crm.tasks.list">
      <WorkspaceFilters
        toolbarAction={
          <>
            <WorkspaceDateRangePicker
              fromDate={dateRange.fromDate}
              toDate={dateRange.toDate}
              onValueChange={(value) => {
                setDateRange(value);
                setPage(1);
              }}
            />
            <Button
              aria-label="Toggle column search filters"
              aria-pressed={showInlineFilters}
              className="h-8 min-w-8 gap-1 px-2"
              title="Toggle column search filters"
              type="button"
              variant={showInlineFilters ? "default" : "outline"}
              onClick={() => setShowInlineFilters((value) => !value)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeFilters ? <span className="text-xs">{activeFilters}</span> : null}
            </Button>
          </>
        }
        columnOptions={columns.map((column) => ({
          ...column,
          checked: visibleColumns[column.id] !== false,
          onCheckedChange: (checked: boolean) => {
            setVisibleColumns((current) => ({ ...current, [column.id]: checked }));
            if (!checked) {
              const key = filterKey(column.id);
              setColumnFilters((current) => ({ ...current, [key]: "" }));
              setPage(1);
            }
          }
        }))}
        onShowAllColumns={() => setVisibleColumns({})}
        searchPlaceholder="Search task, list, assignee, or details"
        searchValue={search}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filterOptions={filterOptions.map((option) => ({
          ...option,
          count: countTaskStatuses(query.data?.statusCounts ?? [], option.id)
        }))}
        filterValue={filter}
        showSelectedFilterChip
        onFilterValueChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
      />
      {query.error || options.error ? (
        <p role="alert" className="text-sm text-destructive">
          {(query.error ?? options.error)?.message}
        </p>
      ) : null}
      <TaskList
        items={query.data?.items ?? []}
        loading={query.isLoading}
        onOpen={open}
        onEdit={setEditing}
        canEdit={Boolean(options.data?.capabilities.update)}
        visibleColumns={visibleColumns}
        showInlineFilters={showInlineFilters}
        columnFilters={columnFilters}
        onColumnFilterChange={(column, value) => {
          setColumnFilters((current) => ({ ...current, [column]: value }));
          setPage(1);
        }}
        onHideInlineFilters={() => setShowInlineFilters(false)}
      />
      {totalPages > 1 ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[20, 50, 100]}
          totalCount={total}
          totalPages={totalPages}
          showingLabel={buildShowingLabel(currentPage, rowsPerPage, total)}
          singularLabel="task"
          onPageChange={setPage}
          onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
          onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
          onRowsPerPageChange={(size) => {
            setRowsPerPage(size);
            setPage(1);
          }}
        />
      ) : null}
    </WorkspacePage>
  );
}

function filterKey(column: string): keyof TaskColumnFilters {
  return (
    {
      task: "title",
      list: "listIn",
      due: "dueDate",
      priority: "priority",
      creator: "creator",
      assignee: "assignedTo",
      status: "status"
    } as const
  )[column as "task" | "list" | "due" | "priority" | "creator" | "assignee" | "status"];
}
