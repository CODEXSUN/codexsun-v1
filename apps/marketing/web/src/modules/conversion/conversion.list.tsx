import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime, formatMoney } from "@codexsun/ui/workspace/utils";
import type { ConversionColumnFilters, ConversionRecord, ConversionStatus } from "./conversion.types";

const filterColumns: Record<string, { key: keyof ConversionColumnFilters; label: string }> = {
  leadUuid: { key: "leadUuid", label: "Lead reference" },
  status: { key: "status", label: "Status" },
  convertedBy: { key: "convertedBy", label: "Converted by" },
  currency: { key: "currency", label: "Currency" }
};

const statusToneMap: Record<ConversionStatus, "success" | "danger" | "warning"> = {
  converted: "success",
  cancelled: "danger",
  reversed: "warning"
};

const statusLabelMap: Record<ConversionStatus, string> = {
  converted: "Converted",
  cancelled: "Cancelled",
  reversed: "Reversed"
};

export function ConversionList({
  records,
  loading,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  onView,
  onEdit
}: {
  records: ConversionRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: ConversionColumnFilters;
  onColumnFilterChange: (column: keyof ConversionColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: ConversionRecord) => void;
  onEdit: (record: ConversionRecord) => void;
}) {
  const columns: ColumnDef<ConversionRecord>[] = [
    {
      id: "leadUuid",
      accessorKey: "leadUuid",
      header: "LEAD REFERENCE",
      cell: ({ row }) => (
        <button
          className="cursor-pointer font-medium text-foreground hover:underline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(row.original);
          }}
        >
          #{row.original.leadUuid.slice(0, 8)}
        </button>
      )
    },
    {
      id: "declaredValue",
      accessorKey: "declaredValue",
      header: "DECLARED VALUE",
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatMoney(row.original.declaredValue, row.original.currency || "INR")}
        </span>
      )
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
      id: "convertedBy",
      accessorKey: "convertedBy",
      header: "CONVERTED BY",
      cell: ({ row }) => row.original.convertedBy
    },
    {
      id: "convertedAt",
      accessorKey: "convertedAt",
      header: "CONVERTED AT",
      cell: ({ row }) => formatDateTime(row.original.convertedAt)
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
            title={`Conversion #${row.original.uuid.slice(0, 8)}`}
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
      emptyState="No sales conversions recorded."
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
              Lead #{record.leadUuid.slice(0, 8)}
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
                  title={`Conversion #${record.uuid.slice(0, 8)}`}
                  onView={() => onView(record)}
                  onEdit={() => onEdit(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              {formatMoney(record.declaredValue, record.currency || "INR")}
            </p>
            <p className="mt-0.5">By: {record.convertedBy} · At: {formatDateTime(record.convertedAt)}</p>
          </div>
        </article>
      )}
    />
  );
}
