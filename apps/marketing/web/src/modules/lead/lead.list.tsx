import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type { LeadColumnFilters, LeadRecord, LeadStatus } from "./lead.types";

const filterColumns: Record<string, { key: keyof LeadColumnFilters; label: string }> = {
  name: { key: "name", label: "Name" },
  companyName: { key: "companyName", label: "Company" },
  email: { key: "email", label: "Email" },
  phone: { key: "phone", label: "Phone" },
  source: { key: "source", label: "Source" },
  status: { key: "status", label: "Status" },
  assignedTo: { key: "assignedTo", label: "Assigned to" }
};

const statusToneMap: Record<LeadStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  new: "info",
  contacted: "neutral",
  qualified: "success",
  disqualified: "danger",
  deferred: "warning"
};

const statusLabelMap: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  disqualified: "Disqualified",
  deferred: "Deferred"
};

export function LeadList({
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
  records: LeadRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: LeadColumnFilters;
  onColumnFilterChange: (column: keyof LeadColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: LeadRecord) => void;
  onEdit: (record: LeadRecord) => void;
}) {
  const columns: ColumnDef<LeadRecord>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "LEAD NAME",
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
      id: "companyName",
      accessorKey: "companyName",
      header: "COMPANY",
      cell: ({ row }) => row.original.companyName || "—"
    },
    {
      id: "contact",
      header: "CONTACT",
      accessorFn: (r) => `${r.email} ${r.phone}`,
      cell: ({ row }) => (
        <div className="text-xs">
          {row.original.email ? <p className="truncate">{row.original.email}</p> : null}
          {row.original.phone ? <p className="text-muted-foreground">{row.original.phone}</p> : null}
          {!row.original.email && !row.original.phone ? "—" : null}
        </div>
      )
    },
    {
      id: "source",
      accessorKey: "source",
      header: "SOURCE",
      cell: ({ row }) => <span className="capitalize text-xs">{row.original.source}</span>
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
      id: "assignedTo",
      accessorKey: "assignedTo",
      header: "ASSIGNED TO",
      cell: ({ row }) => row.original.assignedTo || "Unassigned"
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
      id: "createdAt",
      accessorKey: "createdAt",
      header: "CREATED AT",
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
            title={row.original.name}
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
      emptyState="No marketing leads found."
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
                label={statusLabelMap[record.status] ?? record.status}
                tone={statusToneMap[record.status] ?? "neutral"}
              />
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <WorkspaceRowActions
                  title={record.name}
                  onView={() => onView(record)}
                  onEdit={() => onEdit(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p>{record.companyName ? `${record.companyName} · ` : ""}{record.email || record.phone || "No contact info"}</p>
            <p className="mt-0.5">Source: {record.source} · Assigned: {record.assignedTo || "Unassigned"}</p>
            <p className="mt-1">Created {formatDateTime(record.createdAt)}</p>
          </div>
        </article>
      )}
    />
  );
}
