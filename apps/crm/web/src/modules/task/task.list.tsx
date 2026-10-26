import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { formatDate as formatWorkspaceDate } from "@codexsun/ui/workspace/utils";
import { CrmStatusBadge } from "../../crm-colors";
import { TaskInlineFilter } from "./task.inline-filter";
import type { TaskColumnFilters, TaskRecord } from "./task.types";

const filters: Record<string, { key: keyof TaskColumnFilters; label: string }> = {
  task: { key: "title", label: "Task" },
  list: { key: "listIn", label: "List in" },
  due: { key: "dueDate", label: "Due date" },
  priority: { key: "priority", label: "Priority" },
  creator: { key: "creator", label: "Creator" },
  assignee: { key: "assignedTo", label: "Assigned to" },
  status: { key: "status", label: "Status" }
};

export function TaskList({
  items,
  loading,
  onOpen,
  onEdit,
  canEdit,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters
}: {
  items: TaskRecord[];
  loading: boolean;
  onOpen: (item: TaskRecord) => void;
  onEdit: (item: TaskRecord) => void;
  canEdit: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: TaskColumnFilters;
  onColumnFilterChange: (column: keyof TaskColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
}) {
  const columns: ColumnDef<TaskRecord>[] = [
    {
      id: "id",
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <button
          className="cursor-pointer font-medium hover:underline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(row.original);
          }}
        >
          #{row.original.id}
        </button>
      )
    },
    {
      id: "task",
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => (
        <div className="max-w-96">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{row.original.title}</span>
            {row.original.closurePending ? (
              <span className="shrink-0 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-900">
                Closure pending
              </span>
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">{row.original.description}</div>
        </div>
      )
    },
    {
      id: "list",
      accessorKey: "listIn",
      header: "List in",
      cell: ({ row }) => row.original.listIn ?? "—"
    },
    {
      id: "due",
      accessorKey: "dueDate",
      header: "Due date",
      cell: ({ row }) => (row.original.dueDate ? formatWorkspaceDate(row.original.dueDate) : "—")
    },
    {
      id: "priority",
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <span
          className={`inline-block size-3 rounded-full ${priorityTone(row.original.priority)}`}
          title={row.original.priorityName}
        />
      )
    },
    { id: "creator", accessorKey: "creatorName", header: "Creator" },
    {
      id: "assignee",
      accessorKey: "assignedTo",
      header: "Assigned to",
      cell: ({ row }) => row.original.assignedTo ?? "—"
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <CrmStatusBadge code={row.original.status} label={row.original.statusName} />
      )
    },

    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => (
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <WorkspaceRowActions
            title={`Task ${row.original.title}`}
            onView={() => onOpen(row.original)}
            {...(canEdit ? { onEdit: () => onEdit(row.original) } : {})}
          />
        </div>
      )
    }
  ];
  return (
    <WorkspaceTable
      columns={columns.filter(
        (column) =>
          column.id === "id" || column.id === "actions" || visibleColumns[column.id ?? ""] !== false
      )}
      data={items}
      {...(showInlineFilters
        ? {
            filterRow: (columnId: string) => {
              const filter = filters[columnId];
              return filter ? (
                <TaskInlineFilter
                  label={filter.label}
                  value={columnFilters[filter.key] ?? ""}
                  onChange={(value) => onColumnFilterChange(filter.key, value)}
                  onHide={onHideInlineFilters}
                />
              ) : null;
            }
          }
        : {})}
      emptyState="No tasks found."
      isLoading={loading}
      minWidth="1020px"
      mobileRow={(item) => (
        <article className="grid min-w-0 gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              className="shrink-0 font-medium text-foreground hover:underline"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
            >
              #{item.id}
            </button>
            <CrmStatusBadge code={item.status} label={item.statusName} />
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <span className={`size-2 shrink-0 rounded-full ${priorityTone(item.priority)}`} />
              <span className="truncate">{item.priorityName}</span>
            </span>
            <span className="max-w-28 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.assignedTo || "Unassigned"}
            </span>
            <div
              className="ml-auto shrink-0"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <WorkspaceRowActions
                title={`Task ${item.title}`}
                onView={() => onOpen(item)}
                {...(canEdit ? { onEdit: () => onEdit(item) } : {})}
              />
            </div>
          </div>
          <div className="min-w-0">
            <button
              className="block max-w-full break-words text-left font-medium text-foreground hover:underline [overflow-wrap:anywhere]"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
            >
              {item.title || "Untitled task"}
            </button>
            {item.description ? (
              <p className="mt-0.5 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {item.description}
              </p>
            ) : null}
            <p className="mt-0.5 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {item.contactName || "No contact"}
              {item.contactPhone ? ` · ${item.contactPhone}` : ""}
            </p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Created by {item.creatorName || item.createdBy} · {formatWorkspaceDate(item.createdAt)}
          </p>
          <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
            <span>List in · {item.listIn || "Unlisted"}</span>
            <span>Due · {item.dueDate ? formatWorkspaceDate(item.dueDate) : "—"}</span>
          </div>
          {item.closurePending ? (
            <span className="w-fit rounded-full border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900">
              Closure pending
            </span>
          ) : null}
        </article>
      )}
      onRowClick={onOpen}
    />
  );
}
function priorityTone(code: string) {
  return code === "urgent" || code === "high"
    ? "bg-orange-500"
    : code === "low"
      ? "bg-sky-500"
      : "bg-teal-500";
}
