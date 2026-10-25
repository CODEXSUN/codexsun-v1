import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type { CaptureColumnFilters, CaptureRecord } from "./capture.types";

const filterColumns: Record<string, { key: keyof CaptureColumnFilters; label: string }> = {
  name: { key: "name", label: "Name" },
  brandUuid: { key: "brandUuid", label: "Brand" },
  campaignUuid: { key: "campaignUuid", label: "Campaign" },
  allowedOrigin: { key: "allowedOrigin", label: "Allowed origin" },
  noticeVersion: { key: "noticeVersion", label: "Notice version" },
  status: { key: "status", label: "Status" }
};

export function CaptureList({
  records,
  loading,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  onView,
  onEdit,
  onToggle
}: {
  records: CaptureRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: CaptureColumnFilters;
  onColumnFilterChange: (column: keyof CaptureColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: CaptureRecord) => void;
  onEdit: (record: CaptureRecord) => void;
  onToggle: (record: CaptureRecord) => void;
}) {
  const columns: ColumnDef<CaptureRecord>[] = [
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
      id: "campaignUuid",
      accessorKey: "campaignUuid",
      header: "CAMPAIGN",
      cell: ({ row }) => row.original.campaignUuid
    },
    {
      id: "allowedOrigin",
      accessorKey: "allowedOrigin",
      header: "ALLOWED ORIGIN",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.allowedOrigin}</span>
      )
    },
    {
      id: "noticeVersion",
      accessorKey: "noticeVersion",
      header: "NOTICE VERSION",
      cell: ({ row }) => row.original.noticeVersion
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
      emptyState="No captures found."
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
            <p>Origin: {record.allowedOrigin} · Version: {record.noticeVersion}</p>
            <p className="mt-1">Updated {formatDateTime(record.updatedAt)}</p>
          </div>
        </article>
      )}
    />
  );
}
