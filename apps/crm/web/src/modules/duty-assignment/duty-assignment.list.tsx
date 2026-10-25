import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { useCrmFrappeSyncEnabled } from "../frappe-sync/frappe-sync.hooks";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { ScheduleRecordButton } from "../scheduler";
import { FrappeSyncIndicator, type FrappeSyncStatus } from "../frappe-sync/frappe-sync.indicator";
import type { DutyAssignment } from "./duty-assignment.types";
export function DutyAssignmentList({
  items,
  loading,
  onOpen,
  onVerify
}: {
  items: DutyAssignment[];
  loading: boolean;
  onOpen: (row: DutyAssignment) => void;
  onVerify: (row: DutyAssignment) => Promise<FrappeSyncStatus>;
}) {
  const frappeSyncEnabled = useCrmFrappeSyncEnabled();
  return (
    <WorkspaceTable<DutyAssignment>
      data={items}
      isLoading={loading}
      onRowClick={onOpen}
      emptyState="No duties found."
      columns={(
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
          },
          {
            id: "frappeSync",
            header: "Frappe sync",
            cell: ({ row }) => (
              <FrappeSyncIndicator
                status={row.original.frappeSyncStatus}
                error={row.original.frappeSyncError}
                onVerify={() => onVerify(row.original)}
              />
            )
          }
        ] satisfies ColumnDef<DutyAssignment>[]
      ).filter((column) => column.id !== "frappeSync" || frappeSyncEnabled)}
    />
  );
}
