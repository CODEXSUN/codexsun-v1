import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { leadStatusLabels, type LeadRecord, type LeadColumnFilters } from "./lead.types";
import { isLeadFilterColumn, leadFilterLabels } from "./lead.filters";
import { LeadInlineFilter } from "./lead.inline-filter";

export function LeadList({
  records,
  loading,
  visibleColumns,
  showColumnFilters,
  columnFilters,
  onColumnFilterChange,
  onHideColumnFilters,
  canEdit,
  canConvert,
  converting,
  onView,
  onEdit,
  onConvert
}: {
  records: LeadRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showColumnFilters: boolean;
  columnFilters: LeadColumnFilters;
  onColumnFilterChange: (key: keyof LeadColumnFilters, value: string) => void;
  onHideColumnFilters: () => void;
  canEdit: boolean;
  canConvert: boolean;
  converting: boolean;
  onView: (row: LeadRecord) => void;
  onEdit: (row: LeadRecord) => void;
  onConvert: (row: LeadRecord) => void;
}) {
  const conversion = (row: LeadRecord) =>
    row.enquiryId ? (
      <a
        className="underline"
        href={`/app/crm/enquiries/${row.enquiryId}`}
        onClick={(event) => event.stopPropagation()}
      >
        Open enquiry
      </a>
    ) : canConvert && row.status !== "lost" ? (
      <Button
        variant="outline"
        size="sm"
        disabled={converting}
        onClick={(event) => {
          event.stopPropagation();
          onConvert(row);
        }}
      >
        Convert to enquiry
      </Button>
    ) : (
      "—"
    );
  const columns: ColumnDef<LeadRecord>[] = [
    { id: "name", accessorKey: "name", header: "Contact" },
    {
      id: "phone",
      accessorKey: "phone",
      header: "Mobile",
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.phone || "—"}</span>
    },
    {
      id: "message",
      accessorKey: "message",
      header: "Enquiry details",
      cell: ({ row }) => (
        <button
          type="button"
          className="block max-w-80 truncate text-left font-medium hover:underline"
          title={row.original.message}
          onClick={() => onView(row.original)}
        >
          {row.original.message || "—"}
        </button>
      )
    },
    {
      id: "campaignLabel",
      accessorKey: "campaignLabel",
      header: "Campaign",
      cell: ({ row }) => row.original.campaignLabel || "—"
    },
    { id: "conversion", header: "Convert to enquiry", cell: ({ row }) => conversion(row.original) },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={leadStatusLabels[row.original.status]}
          tone={
            row.original.status === "converted"
              ? "success"
              : row.original.status === "lost"
                ? "danger"
                : "warning"
          }
        />
      )
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div onClick={(event) => event.stopPropagation()}>
          <WorkspaceRowActions
            title={row.original.name}
            onView={() => onView(row.original)}
            {...(canEdit && !row.original.enquiryId ? { onEdit: () => onEdit(row.original) } : {})}
          />
        </div>
      )
    }
  ];
  return (
    <div>
      <WorkspaceTable
        columns={columns.filter((column) => visibleColumns[column.id ?? ""] !== false)}
        data={records}
        isLoading={loading}
        onRowClick={onView}
        emptyState="No leads match these filters."
        {...(showColumnFilters
          ? {
              filterRow: (key: string) =>
                isLeadFilterColumn(key) ? (
                  <LeadInlineFilter
                    label={leadFilterLabels[key]}
                    value={columnFilters[key] ?? ""}
                    onChange={(value) => onColumnFilterChange(key, value)}
                    onHide={onHideColumnFilters}
                  />
                ) : null
            }
          : {})}
        mobileRow={(row) => (
          <article className="space-y-2 p-4" onClick={() => onView(row)}>
            <div className="flex items-start justify-between gap-2">
              {visibleColumns.name !== false ? (
                <button
                  type="button"
                  className="min-w-0 flex-1 break-words text-left font-semibold hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onView(row);
                  }}
                >
                  {row.name}
                </button>
              ) : null}
              {visibleColumns.status !== false ? (
                <WorkspaceStatusBadge
                  label={leadStatusLabels[row.status]}
                  tone={
                    row.status === "converted"
                      ? "success"
                      : row.status === "lost"
                        ? "danger"
                        : "warning"
                  }
                />
              ) : null}
              <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                <WorkspaceRowActions
                  title={row.name}
                  onView={() => onView(row)}
                  {...(canEdit && !row.enquiryId ? { onEdit: () => onEdit(row) } : {})}
                />
              </div>
            </div>
            {visibleColumns.phone !== false ? <p>{row.phone}</p> : null}
            {visibleColumns.message !== false ? (
              <p className="line-clamp-2">{row.message}</p>
            ) : null}
            {visibleColumns.campaignLabel !== false ? (
              <p className="text-sm text-muted-foreground">{row.campaignLabel || "No campaign"}</p>
            ) : null}
            {visibleColumns.conversion !== false ? conversion(row) : null}
          </article>
        )}
      />
    </div>
  );
}
