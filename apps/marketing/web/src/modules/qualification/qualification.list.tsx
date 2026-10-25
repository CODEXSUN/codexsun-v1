import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type { QualificationColumnFilters, QualificationRecord, QualificationDecision } from "./qualification.types";

const filterColumns: Record<string, { key: keyof QualificationColumnFilters; label: string }> = {
  leadUuid: { key: "leadUuid", label: "Lead reference" },
  decision: { key: "decision", label: "Decision" },
  criteria: { key: "criteria", label: "Criteria" },
  reviewer: { key: "reviewer", label: "Reviewer" },
  reason: { key: "reason", label: "Reason" }
};

const decisionToneMap: Record<QualificationDecision, "success" | "danger" | "warning"> = {
  qualified: "success",
  disqualified: "danger",
  deferred: "warning"
};

const decisionLabelMap: Record<QualificationDecision, string> = {
  qualified: "Qualified",
  disqualified: "Disqualified",
  deferred: "Deferred"
};

export function QualificationList({
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
  records: QualificationRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: QualificationColumnFilters;
  onColumnFilterChange: (column: keyof QualificationColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: QualificationRecord) => void;
  onEdit: (record: QualificationRecord) => void;
}) {
  const columns: ColumnDef<QualificationRecord>[] = [
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
      id: "decision",
      accessorKey: "decision",
      header: "DECISION",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={decisionLabelMap[row.original.decision] ?? row.original.decision}
          tone={decisionToneMap[row.original.decision] ?? "neutral"}
        />
      )
    },
    {
      id: "criteria",
      accessorKey: "criteria",
      header: "CRITERIA",
      cell: ({ row }) => row.original.criteria
    },
    {
      id: "score",
      accessorKey: "score",
      header: "SCORE",
      cell: ({ row }) =>
        row.original.score !== undefined ? (
          <span className="font-mono text-xs font-semibold">{row.original.score}</span>
        ) : (
          "—"
        )
    },
    {
      id: "reviewer",
      accessorKey: "reviewer",
      header: "REVIEWER",
      cell: ({ row }) => row.original.reviewer
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
      id: "createdAt",
      accessorKey: "createdAt",
      header: "EVALUATED AT",
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
            title={`Lead #${row.original.leadUuid.slice(0, 8)}`}
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
      emptyState="No qualifications recorded."
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
                label={decisionLabelMap[record.decision] ?? record.decision}
                tone={decisionToneMap[record.decision] ?? "neutral"}
              />
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <WorkspaceRowActions
                  title={`Lead #${record.leadUuid.slice(0, 8)}`}
                  onView={() => onView(record)}
                  onEdit={() => onEdit(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p>Criteria: {record.criteria} · Reviewer: {record.reviewer}</p>
            <p className="line-clamp-2 mt-0.5">{record.reason}</p>
            <p className="mt-1">Evaluated {formatDateTime(record.createdAt)}</p>
          </div>
        </article>
      )}
    />
  );
}
