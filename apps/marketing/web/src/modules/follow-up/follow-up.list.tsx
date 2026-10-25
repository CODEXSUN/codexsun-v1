import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type { FollowUpColumnFilters, FollowUpRecord, FollowUpStatus } from "./follow-up.types";

const filterColumns: Record<string, { key: keyof FollowUpColumnFilters; label: string }> = {
  title: { key: "title", label: "Title" },
  leadUuid: { key: "leadUuid", label: "Lead reference" },
  type: { key: "type", label: "Type" },
  status: { key: "status", label: "Status" },
  assignedTo: { key: "assignedTo", label: "Assigned to" }
};

const statusToneMap: Record<FollowUpStatus, "warning" | "success" | "neutral"> = {
  pending: "warning",
  completed: "success",
  cancelled: "neutral"
};

const statusLabelMap: Record<FollowUpStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled"
};

export function FollowUpList({
  records,
  loading,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  onView,
  onEdit,
}: {
  records: FollowUpRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: FollowUpColumnFilters;
  onColumnFilterChange: (column: keyof FollowUpColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: FollowUpRecord) => void;
  onEdit: (record: FollowUpRecord) => void;
  onComplete?: ((record: FollowUpRecord) => void) | undefined;
}) {
  const columns: ColumnDef<FollowUpRecord>[] = [
    {
      id: "title",
      accessorKey: "title",
      header: "TASK TITLE",
      cell: ({ row }) => (
        <button
          className="cursor-pointer font-medium text-foreground hover:underline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(row.original);
          }}
        >
          {row.original.title}
        </button>
      )
    },
    {
      id: "leadUuid",
      accessorKey: "leadUuid",
      header: "LEAD REFERENCE",
      cell: ({ row }) => (
        <span className="text-xs font-mono">#{row.original.leadUuid.slice(0, 8)}</span>
      )
    },
    {
      id: "type",
      accessorKey: "type",
      header: "TYPE",
      cell: ({ row }) => <span className="capitalize text-xs">{row.original.type}</span>
    },
    {
      id: "scheduledAt",
      accessorKey: "scheduledAt",
      header: "SCHEDULED AT",
      cell: ({ row }) => formatDateTime(row.original.scheduledAt)
    },
    {
      id: "status",
      accessorKey: "status",
      header: "STATUS",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={statusLabelMap[row.original.status] ?? row.original.status}
          tone={statusToneMap[row.original.status] ?? "neutral"}
        />
      )
    },
    {
      id: "assignedTo",
      accessorKey: "assignedTo",
      header: "ASSIGNED TO",
      cell: ({ row }) => row.original.assignedTo || "Unassigned"
    },
    {
      id: "actions",
      header: "ACTION",
      enableSorting: false,
      cell: ({ row }) => (
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <WorkspaceRowActions
            title={row.original.title}
            onView={() => onView(row.original)}
            onEdit={() => onEdit(row.original)}
          />
        </div>
      )
    }
  ];

  return (
    <WorkspaceTable
      columns={columns.filter((column) => {
        if (column.id === "actions") return true;
        return visibleColumns[column.id ?? ""] !== false;
      })}
      data={records}
      {...(showInlineFilters
        ? {
            filterRow: (columnId: string) => {
              const filter = filterColumns[columnId];
              return filter ? (
                <WorkspaceColumnFilter
                  label={filter.label}
                  value={columnFilters[filter.key] ?? ""}
                  onChange={(value) => onColumnFilterChange(filter.key, value)}
                  onHide={onHideInlineFilters}
                />
              ) : null;
            }
          }
        : {})}
      isLoading={loading}
      onRowClick={onView}
      emptyState="No follow-up tasks found."
      mobileRow={(record) => (
        <article className="grid min-w-0 gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <button
              className="shrink-0 font-medium text-foreground hover:underline"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onView(record);
              }}
            >
              {record.title}
            </button>
            <div className="flex items-center gap-2">
              <WorkspaceStatusBadge
                label={statusLabelMap[record.status] ?? record.status}
                tone={statusToneMap[record.status] ?? "neutral"}
              />
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <WorkspaceRowActions
                  title={record.title}
                  onView={() => onView(record)}
                  onEdit={() => onEdit(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p>Type: <span className="capitalize">{record.type}</span> · Assigned: {record.assignedTo || "Unassigned"}</p>
            <p className="mt-0.5">Lead: #{record.leadUuid.slice(0, 8)}</p>
            <p className="mt-1">Scheduled: {formatDateTime(record.scheduledAt)}</p>
          </div>
        </article>
      )}
    />
  );
}
