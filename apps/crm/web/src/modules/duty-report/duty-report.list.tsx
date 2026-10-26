import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";

import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import type { DutyReport } from "./duty-report.types";

export function DutyReportList({
  items,
  loading,
  onOpen
}: {
  items: DutyReport[];
  loading: boolean;
  onOpen: (row: DutyReport) => void;
}) {
  return (
    <WorkspaceTable<DutyReport>
      data={items}
      isLoading={loading}
      onRowClick={onOpen}
      emptyState="No duty reports found."
      columns={
        [
          {
            id: "sop",
            accessorKey: "itemTitle",
            header: "SOP",
            cell: ({ row }) => (
              <button
                className="text-left font-medium hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(row.original);
                }}
              >
                {row.original.itemTitle}
              </button>
            )
          },
          { id: "user", accessorKey: "assigneeName", header: "User" },
          {
            id: "date",
            accessorKey: "performedDate",
            header: "Date",
            cell: ({ row }) => (
              <span className="whitespace-nowrap">
                {row.original.performedDate.split("-").reverse().join("-")}
              </span>
            )
          },
          { id: "department", accessorKey: "department", header: "Department" },
          {
            id: "frequency",
            accessorKey: "frequency",
            header: "Frequency",
            cell: ({ row }) =>
              row.original.frequency === "annually"
                ? "Yearly"
                : row.original.frequency.charAt(0).toUpperCase() + row.original.frequency.slice(1)
          },
          {
            id: "actions",
            accessorKey: "actions",
            header: "Actions",
            cell: ({ row }) => (
              <span className="line-clamp-2 max-w-lg whitespace-pre-wrap">
                {row.original.actions}
              </span>
            )
          }
        ] satisfies ColumnDef<DutyReport>[]
      }
    />
  );
}
