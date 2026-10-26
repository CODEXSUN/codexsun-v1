import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { BellRing } from "lucide-react";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { CrmStatusBadge, prioritySwatch } from "../../crm-colors";
import { EnquiryInlineFilter } from "./enquiry.inline-filter";
import { enquiryTableText } from "./enquiry.table-text";
import { formatListDueDate } from "./enquiry.view-utils";
import type { EnquiryColumnFilters, EnquiryLookup, EnquiryRecord } from "./enquiry.types";

const filterColumns: Record<string, { key: keyof EnquiryColumnFilters; label: string }> = {
  customer: { key: "customer", label: "Customer" },
  details: { key: "details", label: "Enquiry details" },
  listIn: { key: "listIn", label: "List in" },
  dueDate: { key: "dueDate", label: "Due date" },
  priority: { key: "priority", label: "Priority" },
  creator: { key: "creator", label: "Creator" },
  assignedTo: { key: "assignedTo", label: "Assigned to" },
  status: { key: "status", label: "Status" }
};

export function EnquiryList({
  records,
  users,
  userColumnMode,
  showActions = true,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  loading,
  onShow,
  onEdit,
  onOpenCall,
  showViewAction = false,
  emptyState = "No enquiries found.",
  openingCallId,
  panelClassName
}: {
  records: EnquiryRecord[];
  users: EnquiryLookup[];
  userColumnMode: "creator" | "allocatedTo" | "both";
  showActions?: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: EnquiryColumnFilters;
  onColumnFilterChange: (column: keyof EnquiryColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  loading: boolean;
  onShow: (record: EnquiryRecord) => void;
  onEdit?: (record: EnquiryRecord) => void;
  onOpenCall?: (record: EnquiryRecord) => void;
  showViewAction?: boolean;
  emptyState?: string;
  openingCallId: string | null;
  panelClassName?: string;
}) {
  const userNames = new Map(users.map((user) => [String(user.id), user.name]));
  const creatorNames = new Map<string, string>();
  for (const user of users) {
    if (user.email) creatorNames.set(user.email.toLowerCase(), user.name);
  }
  const creatorName = (record: EnquiryRecord) =>
    record.createdByName ?? creatorNames.get(record.createdBy.toLowerCase()) ?? record.createdBy;
  const columns: ColumnDef<EnquiryRecord>[] = [
    {
      id: "enquiryNo",
      accessorKey: "enquiryNo",
      header: "ID",
      cell: ({ row }) => (
        <button
          className="cursor-pointer font-medium text-foreground hover:underline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onShow(row.original);
          }}
        >
          #{row.original.enquiryNo}
        </button>
      )
    },
    {
      id: "customer",
      header: "Customer",
      accessorFn: (record) => record.contactName ?? record.capturedName ?? "",
      cell: ({ row }) => row.original.contactName ?? row.original.capturedName ?? "—"
    },
    {
      id: "details",
      accessorKey: "title",
      header: "Enquiry details",
      cell: ({ row }) =>
        row.original.closurePending ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
            <BellRing className="size-3.5" /> Closure pending
          </span>
        ) : row.original.status === "new" ? (
          onOpenCall ? (
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-wait"
              disabled={openingCallId === row.original.id}
              onClick={(event) => {
                event.stopPropagation();
                onOpenCall(row.original);
              }}
              title="Open this new call"
              type="button"
            >
              <BellRing className="size-3.5" /> New call
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              <BellRing className="size-3.5" /> New call
            </span>
          )
        ) : (
          <button
            className="block max-w-80 cursor-pointer truncate text-left font-medium text-foreground hover:underline"
            title={enquiryTableText(row.original.description ?? row.original.title)}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onShow(row.original);
            }}
          >
            {enquiryTableText(row.original.title) || "—"}
          </button>
        )
    },
    {
      id: "listIn",
      accessorKey: "listIn",
      header: "List in",
      cell: ({ row }) => row.original.listIn || "Unlisted"
    },
    {
      id: "dueDate",
      accessorKey: "dueDate",
      header: "Due date",
      cell: ({ row }) => formatListDueDate(row.original.dueDate)
    },
    {
      id: "priority",
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <span
          className={`inline-block size-3 rounded-full ${prioritySwatch(row.original.priority)}`}
          title={`${row.original.priorityName} priority`}
        >
          <span className="sr-only">{row.original.priorityName} priority</span>
        </span>
      )
    },

    {
      id: "creator",
      header: "Creator",
      accessorFn: creatorName,
      cell: ({ row }) => creatorName(row.original)
    },
    {
      id: "assignedTo",
      header: userColumnMode === "allocatedTo" ? "Allocated to" : "Assigned to",
      accessorFn: (record) =>
        record.assignedUserId
          ? (userNames.get(record.assignedUserId) ?? record.assignedToName ?? "")
          : "",
      cell: ({ row }) =>
        row.original.assignedUserId
          ? (userNames.get(row.original.assignedUserId) ??
            row.original.assignedToName ??
            `#${row.original.assignedUserId}`)
          : "—"
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <CrmStatusBadge code={row.original.status} label={row.original.statusName} />
      )
    },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => (
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <WorkspaceRowActions
            title={`Enquiry #${row.original.enquiryNo}`}
            {...(showViewAction ? { onView: () => onShow(row.original) } : {})}
            {...(onEdit ? { onEdit: () => onEdit(row.original) } : {})}
          />
        </div>
      )
    }
  ];

  return (
    <WorkspaceTable
      columns={columns.filter((column) => {
        if (column.id === "creator" && userColumnMode === "allocatedTo") return false;
        if (column.id === "assignedTo" && userColumnMode === "creator") return false;
        if (column.id === "actions") return showActions;
        return column.id === "enquiryNo" || visibleColumns[column.id ?? ""] !== false;
      })}
      data={records}
      {...(showInlineFilters
        ? {
            filterRow: (columnId: string) => {
              const filter = filterColumns[columnId];
              return filter ? (
                <EnquiryInlineFilter
                  label={filter.label}
                  value={columnFilters[filter.key] ?? ""}
                  onChange={(value) => onColumnFilterChange(filter.key, value)}
                  onHide={onHideInlineFilters}
                />
              ) : null;
            }
          }
        : {})}
      emptyState={emptyState}
      isLoading={loading}
      minWidth="1020px"
      mobileRow={(record) => (
        <article className="grid min-w-0 gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              className="shrink-0 font-medium text-foreground hover:underline"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onShow(record);
              }}
            >
              #{record.enquiryNo}
            </button>
            <CrmStatusBadge code={record.status} label={record.statusName} />
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <span className={`size-2 shrink-0 rounded-full ${prioritySwatch(record.priority)}`} />
              <span className="truncate">{record.priorityName}</span>
            </span>
            <span className="max-w-28 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {record.assignedToName || "Unassigned"}
            </span>
            {showActions ? (
              <div
                className="ml-auto shrink-0"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <WorkspaceRowActions
                  title={`Enquiry #${record.enquiryNo}`}
                  {...(showViewAction ? { onView: () => onShow(record) } : {})}
                  {...(onEdit ? { onEdit: () => onEdit(record) } : {})}
                />
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <button
              className="block max-w-full break-words text-left font-medium text-foreground hover:underline [overflow-wrap:anywhere]"
              title={enquiryTableText(record.description ?? record.title)}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onShow(record);
              }}
            >
              {enquiryTableText(record.title) || "Untitled enquiry"}
            </button>
            {record.closurePending ? (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
                <BellRing className="size-3.5" /> Closure pending
              </span>
            ) : null}
            {record.status === "new" && onOpenCall ? (
              <button
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-wait"
                disabled={openingCallId === record.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenCall(record);
                }}
                type="button"
              >
                <BellRing className="size-3.5" /> New call
              </button>
            ) : null}
            <p className="mt-0.5 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {record.contactName ?? record.capturedName ?? "No customer"}
              {record.capturedPhone ? ` · ${record.capturedPhone}` : ""}
            </p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Created by {creatorName(record)} · {formatListDueDate(record.createdAt.slice(0, 10))}
          </p>
          <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
            <span>List in · {record.listIn || "Unlisted"}</span>
            <span>Due · {formatListDueDate(record.dueDate)}</span>
          </div>
        </article>
      )}
      {...(panelClassName ? { panelClassName } : {})}
      onRowClick={onShow}
    />
  );
}
