import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type { CampaignColumnFilters, CampaignRecord } from "./campaign.types";

const filterColumns: Record<string, { key: keyof CampaignColumnFilters; label: string }> = {
  name: { key: "name", label: "Name" },
  brandUuid: { key: "brandUuid", label: "Brand" },
  channel: { key: "channel", label: "Channel" },
  objective: { key: "objective", label: "Objective" },
  updatedBy: { key: "updatedBy", label: "Updated by" },
  status: { key: "status", label: "Status" }
};

export function CampaignList({
  records,
  loading,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  onView,
  onEdit,
  onToggle,
  onDuplicate
}: {
  records: CampaignRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: CampaignColumnFilters;
  onColumnFilterChange: (column: keyof CampaignColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: CampaignRecord) => void;
  onEdit: (record: CampaignRecord) => void;
  onToggle: (record: CampaignRecord) => void;
  onDuplicate?: ((record: CampaignRecord) => void) | undefined;
}) {
  const columns: ColumnDef<CampaignRecord>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "NAME",
      cell: ({ row }) => (
        <button
          className="cursor-pointer font-medium text-foreground hover:underline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(row.original);
          }}
        >
          {row.original.name}
        </button>
      )
    },
    {
      id: "brandUuid",
      accessorKey: "brandUuid",
      header: "BRAND",
      cell: ({ row }) => row.original.brandUuid
    },
    {
      id: "channel",
      accessorKey: "channel",
      header: "CHANNEL",
      cell: ({ row }) => <span className="capitalize">{row.original.channel}</span>
    },
    {
      id: "objective",
      accessorKey: "objective",
      header: "OBJECTIVE",
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground" title={row.original.objective}>
          {row.original.objective}
        </span>
      )
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: "UPDATED AT",
      cell: ({ row }) => formatDateTime(row.original.updatedAt)
    },
    {
      id: "status",
      accessorKey: "status",
      header: "STATUS",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={row.original.status === "active" ? "Active" : "Inactive"}
          tone={row.original.status === "active" ? "success" : "neutral"}
        />
      )
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
            title={row.original.name}
            onView={() => onView(row.original)}
            onEdit={() => onEdit(row.original)}
            isSuspended={row.original.status === "inactive"}
            onDelete={() => onToggle(row.original)}
            onRestore={() => onToggle(row.original)}
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
      emptyState="No campaigns found."
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
              {record.name}
            </button>
            <div className="flex items-center gap-2">
              <WorkspaceStatusBadge
                label={record.status === "active" ? "Active" : "Inactive"}
                tone={record.status === "active" ? "success" : "neutral"}
              />
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <WorkspaceRowActions
                  title={record.name}
                  onView={() => onView(record)}
                  onEdit={() => onEdit(record)}
                  isSuspended={record.status === "inactive"}
                  onDelete={() => onToggle(record)}
                  onRestore={() => onToggle(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p>Channel: <span className="capitalize">{record.channel}</span> · Brand: {record.brandUuid}</p>
            <p className="line-clamp-2 mt-0.5">{record.objective}</p>
            <p className="mt-1">Updated {formatDateTime(record.updatedAt)}</p>
          </div>
        </article>
      )}
    />
  );
}
