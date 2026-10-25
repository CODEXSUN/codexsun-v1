import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type { ConsentColumnFilters, ConsentRecord } from "./consent.types";

const filterColumns: Record<string, { key: keyof ConsentColumnFilters; label: string }> = {
  recipient: { key: "recipient", label: "Recipient" },
  brandUuid: { key: "brandUuid", label: "Brand" },
  action: { key: "action", label: "Action" },
  noticeVersion: { key: "noticeVersion", label: "Notice version" },
  createdBy: { key: "createdBy", label: "Recorded by" }
};

export function ConsentList({
  records,
  loading,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  onView
}: {
  records: ConsentRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: ConsentColumnFilters;
  onColumnFilterChange: (column: keyof ConsentColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: ConsentRecord) => void;
}) {
  const columns: ColumnDef<ConsentRecord>[] = [
    {
      id: "recipient",
      accessorKey: "recipient",
      header: "RECIPIENT",
      cell: ({ row }) => (
        <button
          className="cursor-pointer font-medium text-foreground hover:underline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(row.original);
          }}
        >
          {row.original.recipient}
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
      id: "action",
      accessorKey: "action",
      header: "EVIDENCE ACTION",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={row.original.action === "grant" ? "Grant" : "Withdraw"}
          tone={row.original.action === "grant" ? "success" : "neutral"}
        />
      )
    },
    {
      id: "noticeVersion",
      accessorKey: "noticeVersion",
      header: "NOTICE VERSION",
      cell: ({ row }) => row.original.noticeVersion
    },
    {
      id: "createdBy",
      accessorKey: "createdBy",
      header: "RECORDED BY",
      cell: ({ row }) => row.original.createdBy || "System"
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "RECORDED AT",
      cell: ({ row }) => formatDateTime(row.original.createdAt)
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
            title={row.original.recipient}
            onView={() => onView(row.original)}
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
      emptyState="No consent evidence found."
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
              {record.recipient}
            </button>
            <div className="flex items-center gap-2">
              <WorkspaceStatusBadge
                label={record.action === "grant" ? "Grant" : "Withdraw"}
                tone={record.action === "grant" ? "success" : "neutral"}
              />
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <WorkspaceRowActions
                  title={record.recipient}
                  onView={() => onView(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p>Brand: {record.brandUuid} · Version: {record.noticeVersion}</p>
            <p className="mt-1">Recorded {formatDateTime(record.createdAt)} by {record.createdBy || "System"}</p>
          </div>
        </article>
      )}
    />
  );
}
