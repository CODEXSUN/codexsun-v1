import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import { cn } from "@codexsun/ui/lib/utils";
import type { ContentColumnFilters, ContentRecord, ContentStatus } from "./content.types";

const filterColumns: Record<string, { key: keyof ContentColumnFilters; label: string }> = {
  title: { key: "title", label: "Title" },
  channel: { key: "channel", label: "Channel" },
  publishMode: { key: "publishMode", label: "Publish Mode" },
  brandUuid: { key: "brandUuid", label: "Brand" },
  campaignUuid: { key: "campaignUuid", label: "Campaign" },
  status: { key: "status", label: "Status" },
  updatedBy: { key: "updatedBy", label: "Updated by" }
};

export function renderContentStatusBadge(status: ContentStatus) {
  switch (status) {
    case "draft":
      return <WorkspaceStatusBadge label="Draft" tone="neutral" />;
    case "pending_approval":
      return <WorkspaceStatusBadge label="Pending Approval" tone="warning" />;
    case "approved":
      return <WorkspaceStatusBadge label="Approved" tone="info" />;
    case "scheduled":
      return (
        <WorkspaceStatusBadge
          label="Scheduled"
          tone="info"
          className="border-indigo-200 bg-indigo-50 text-indigo-700"
        />
      );
    case "published":
      return <WorkspaceStatusBadge label="Published" tone="success" />;
    case "rejected":
      return <WorkspaceStatusBadge label="Rejected" tone="danger" />;
    case "cancelled":
      return <WorkspaceStatusBadge label="Cancelled" tone="neutral" />;
    default:
      return <WorkspaceStatusBadge label={status} tone="neutral" />;
  }
}

export function renderChannelBadge(channel: string) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
      {channel}
    </span>
  );
}

export function renderPublishModeBadge(publishMode: "api" | "manual") {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        publishMode === "api"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      {publishMode === "api" ? "API Auto" : "Manual"}
    </span>
  );
}

export function ContentList({
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
  records: ContentRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: ContentColumnFilters;
  onColumnFilterChange: (column: keyof ContentColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView: (record: ContentRecord) => void;
  onEdit: (record: ContentRecord) => void;
}) {
  const columns: ColumnDef<ContentRecord>[] = [
    {
      id: "title",
      accessorKey: "title",
      header: "TITLE",
      cell: ({ row }) => (
        <button
          className="cursor-pointer text-left font-medium text-foreground hover:underline"
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
      id: "channel",
      accessorKey: "channel",
      header: "CHANNEL",
      cell: ({ row }) => renderChannelBadge(row.original.channel)
    },
    {
      id: "publishMode",
      accessorKey: "publishMode",
      header: "PUBLISH MODE",
      cell: ({ row }) => renderPublishModeBadge(row.original.publishMode)
    },
    {
      id: "brandUuid",
      accessorKey: "brandUuid",
      header: "BRAND",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.brandUuid}</span>
      )
    },
    {
      id: "scheduledAt",
      accessorKey: "scheduledAt",
      header: "SCHEDULED AT",
      cell: ({ row }) =>
        row.original.scheduledAt ? formatDateTime(row.original.scheduledAt) : "—"
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
      cell: ({ row }) => renderContentStatusBadge(row.original.status)
    },
    {
      id: "actions",
      header: "ACTION",
      enableSorting: false,
      cell: ({ row }) => {
        const canEdit = row.original.status === "draft" || row.original.status === "rejected";
        return (
          <div
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <WorkspaceRowActions
              title={row.original.title}
              onView={() => onView(row.original)}
              {...(canEdit ? { onEdit: () => onEdit(row.original) } : {})}
            />
          </div>
        );
      }
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
      emptyState="No marketing content found."
      mobileRow={(record) => {
        const canEdit = record.status === "draft" || record.status === "rejected";
        return (
          <article className="grid min-w-0 gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <button
                className="shrink-0 text-left font-medium text-foreground hover:underline"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(record);
                }}
              >
                {record.title}
              </button>
              <div className="flex items-center gap-2">
                {renderContentStatusBadge(record.status)}
                <div
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <WorkspaceRowActions
                    title={record.title}
                    onView={() => onView(record)}
                    {...(canEdit ? { onEdit: () => onEdit(record) } : {})}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderChannelBadge(record.channel)}
              {renderPublishModeBadge(record.publishMode)}
            </div>
            <div className="min-w-0 text-xs text-muted-foreground">
              <p className="line-clamp-2">{record.body}</p>
              <p className="mt-1">
                Brand: {record.brandUuid}
                {record.scheduledAt ? ` · Scheduled: ${formatDateTime(record.scheduledAt)}` : ""}
                {` · Updated ${formatDateTime(record.updatedAt)}`}
              </p>
            </div>
          </article>
        );
      }}
    />
  );
}
