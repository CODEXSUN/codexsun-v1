import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDate, formatMoney } from "@codexsun/ui/workspace/utils";
import type { OutcomeColumnFilters, OutcomeRecord, OutcomeStatus } from "./outcome.types";

const filterColumns: Record<string, { key: keyof OutcomeColumnFilters; label: string }> = {
  leadUuid: { key: "leadUuid", label: "Lead reference" },
  status: { key: "status", label: "Status" },
  reason: { key: "reason", label: "Reason" }
};

const statusToneMap: Record<OutcomeStatus, "success" | "danger" | "warning" | "neutral"> = {
  won: "success",
  lost: "danger",
  nurture: "warning",
  unresponsive: "neutral",
  withdrawn: "neutral"
};

const statusLabelMap: Record<OutcomeStatus, string> = {
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
  unresponsive: "Unresponsive",
  withdrawn: "Withdrawn"
};

export function OutcomeList({
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
  records: OutcomeRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: OutcomeColumnFilters;
  onColumnFilterChange: (column: keyof OutcomeColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: OutcomeRecord) => void;
  onEdit: (record: OutcomeRecord) => void;
}) {
  const columns: ColumnDef<OutcomeRecord>[] = [
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
      id: "status",
      accessorKey: "status",
      header: "OUTCOME",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={statusLabelMap[row.original.status] ?? row.original.status}
          tone={statusToneMap[row.original.status] ?? "neutral"}
        />
      )
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: "REASON",
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground" title={row.original.reason}>
          {row.original.reason}
        </span>
      )
    },
    {
      id: "declaredValue",
      accessorKey: "declaredValue",
      header: "DECLARED VALUE",
      cell: ({ row }) =>
        row.original.declaredValue !== undefined ? (
          <span className="font-semibold tabular-nums">
            {formatMoney(row.original.declaredValue, row.original.currency || "INR")}
          </span>
        ) : (
          "—"
        )
    },
    {
      id: "effectiveDate",
      accessorKey: "effectiveDate",
      header: "EFFECTIVE DATE",
      cell: ({ row }) => formatDate(row.original.effectiveDate)
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
            title={`Outcome #${row.original.uuid.slice(0, 8)}`}
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
      emptyState="No outcomes recorded."
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
                  title={`Outcome #${record.uuid.slice(0, 8)}`}
                  onView={() => onView(record)}
                  onEdit={() => onEdit(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p className="line-clamp-2">{record.reason}</p>
            <p className="mt-1">
              Effective: {formatDate(record.effectiveDate)}
              {record.declaredValue ? ` · Value: ${formatMoney(record.declaredValue, record.currency || "INR")}` : ""}
            </p>
          </div>
        </article>
      )}
    />
  );
}
