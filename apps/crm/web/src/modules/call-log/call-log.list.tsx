import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";

import type { CallLogRecord } from "./call-log.types";

export const callLogColumns = [
  { id: "name", label: "ID" },
  { id: "createdAt", label: "Date" },
  { id: "type", label: "Type" },
  { id: "from", label: "From" },
  { id: "to", label: "To" },
  { id: "status", label: "Status" },
  { id: "duration", label: "Duration" },
  { id: "receiver", label: "Call received by" },
  { id: "caller", label: "Caller" }
] as const;

type CallLogCell = { row: { original: CallLogRecord } };

export function CallLogList({
  records,
  loading,
  visibleColumns
}: {
  records: CallLogRecord[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
}) {
  const columns: ColumnDef<CallLogRecord>[] = [
    { id: "name", accessorKey: "name", header: "ID" },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "DATE",
      cell: ({ row }: CallLogCell) => formatCallDate(row.original.createdAt)
    },
    { id: "type", accessorKey: "type", header: "TYPE" },
    { id: "from", accessorKey: "from", header: "FROM" },
    { id: "to", accessorKey: "to", header: "TO" },
    {
      id: "status",
      accessorKey: "status",
      header: "STATUS",
      cell: ({ row }: CallLogCell) => (
        <WorkspaceStatusBadge
          label={row.original.status || "—"}
          tone={row.original.status === "Completed" ? "success" : "neutral"}
        />
      )
    },
    {
      id: "duration",
      accessorKey: "duration",
      header: "DURATION",
      cell: ({ row }: CallLogCell) => `${row.original.duration} sec`
    },
    {
      id: "receiver",
      accessorKey: "receiver",
      header: "CALL RECEIVED BY",
      cell: ({ row }: CallLogCell) => row.original.receiver || "—"
    },
    {
      id: "caller",
      accessorKey: "caller",
      header: "CALLER",
      cell: ({ row }: CallLogCell) => row.original.caller || "—"
    }
  ].filter((column) => visibleColumns[column.id] !== false);
  return (
    <WorkspaceTable
      columns={columns}
      data={records}
      emptyState="No call logs match the current filters."
      isLoading={loading}
      minWidth="900px"
    />
  );
}

function formatCallDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hour = String(date.getHours() % 12 || 12).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()} - ${hour}:${minute} ${date.getHours() < 12 ? "am" : "pm"}`;
}
