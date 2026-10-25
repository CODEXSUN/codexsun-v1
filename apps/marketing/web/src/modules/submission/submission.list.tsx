import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type { SubmissionColumnFilters, SubmissionRecord } from "./submission.types";

const filterColumns: Record<string, { key: keyof SubmissionColumnFilters; label: string }> = {
  name: { key: "name", label: "Name" },
  campaignLabel: { key: "campaignLabel", label: "Campaign" },
  email: { key: "email", label: "Email" },
  phone: { key: "phone", label: "Phone" },
  status: { key: "status", label: "Status" },
  leadUuid: { key: "leadUuid", label: "Marketing Lead" }
};

export function SubmissionList({
  records,
  loading,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  onView,
  onRetry
}: {
  records: SubmissionRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: SubmissionColumnFilters;
  onColumnFilterChange: (column: keyof SubmissionColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: SubmissionRecord) => void;
  onRetry?: ((record: SubmissionRecord) => void) | undefined;
}) {
  const columns: ColumnDef<SubmissionRecord>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "CONTACT NAME",
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
      id: "campaignLabel",
      accessorKey: "campaignLabel",
      header: "CAMPAIGN",
      cell: ({ row }) => row.original.campaignLabel || "—"
    },
    {
      id: "email",
      accessorKey: "email",
      header: "EMAIL",
      cell: ({ row }) => row.original.email || "—"
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: "PHONE",
      cell: ({ row }) => row.original.phone || "—"
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "CAPTURED AT",
      cell: ({ row }) => formatDateTime(row.original.createdAt)
    },
    {
      id: "status",
      accessorKey: "status",
      header: "HANDOFF",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={row.original.status === "delivered" ? "Delivered" : "Pending"}
          tone={row.original.status === "delivered" ? "success" : "warning"}
        />
      )
    },
    {
      id: "leadUuid",
      accessorKey: "leadUuid",
      header: "MARKETING LEAD",
      cell: ({ row }) =>
        row.original.leadUuid ? (
          <a
            href={"/app/marketing/leads?show=" + row.original.leadUuid}
            className="text-xs text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            #{row.original.leadUuid.slice(0, 8)}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
      emptyState="No submissions found."
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
                label={record.status === "delivered" ? "Delivered" : "Pending"}
                tone={record.status === "delivered" ? "success" : "warning"}
              />
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <WorkspaceRowActions
                  title={record.name}
                  onView={() => onView(record)}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted-foreground">
            <p>{record.email || "No email"} · {record.phone || "No phone"}</p>
            <p className="mt-0.5">Campaign: {record.campaignLabel || "—"}</p>
            <p className="mt-1">Captured {formatDateTime(record.createdAt)}</p>
          </div>
        </article>
      )}
    />
  );
}
