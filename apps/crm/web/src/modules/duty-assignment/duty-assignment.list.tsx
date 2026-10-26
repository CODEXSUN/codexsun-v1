import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";

import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { ScheduleRecordButton } from "../scheduler";

import type { DutyAssignment } from "./duty-assignment.types";
export function DutyAssignmentList({
  items,
  loading,
  onOpen
}: {
  items: DutyAssignment[];
  loading: boolean;
  onOpen: (row: DutyAssignment) => void;
}) {
  return (
    <WorkspaceTable<DutyAssignment>
      data={items}
      isLoading={loading}
      onRowClick={onOpen}
      emptyState="No duties found."
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
          { id: "index", accessorKey: "displayOrder", header: "Index" },
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
            id: "schedule",
            header: "Schedule",
            cell: ({ row }) => (
              <ScheduleRecordButton
                sourceType="duty"
                sourceId={row.original.id}
                sourceLabel={`Duty · ${row.original.itemTitle} · ${row.original.assigneeName}`}
              />
            )
          }
        ] satisfies ColumnDef<DutyAssignment>[]
      }
    />
  );
}
