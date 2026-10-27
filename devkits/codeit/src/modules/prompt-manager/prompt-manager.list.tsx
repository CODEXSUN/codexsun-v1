import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import type { PromptRecord } from "./prompt-manager.types";

export const promptColumns = {
  title: "Prompt",
  category: "Category",
  threadName: "Default chat",
  updatedAt: "Updated",
  active: "Status"
};
export function PromptManagerList({
  records,
  loading,
  tools,
  onShow,
  onEdit,
  onToggle,
  onDelete
}: {
  records: PromptRecord[];
  loading: boolean;
  tools: WorkspaceListTools;
  onShow: (record: PromptRecord) => void;
  onEdit: (record: PromptRecord) => void;
  onToggle: (record: PromptRecord) => void;
  onDelete: (record: PromptRecord) => void;
}) {
  const columns: LegacyColumnDef<PromptRecord>[] = [
    {
      id: "title",
      header: "Prompt",
      accessorKey: "title",
      size: 340,
      cell: ({ row }) => (
        <div className="grid gap-1 py-1">
          <span className="font-medium">{row.original.title}</span>
          <span className="line-clamp-1 text-xs text-muted-foreground">{row.original.content}</span>
        </div>
      )
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      size: 140,
      cell: ({ row }) => row.original.category || "—"
    },
    {
      id: "threadName",
      header: "Default chat",
      accessorKey: "threadName",
      size: 220,
      cell: ({ row }) => (
        <span className="block max-w-56 truncate">
          {row.original.threadName || "Choose when sending"}
        </span>
      )
    },
    {
      id: "updatedAt",
      header: "Updated",
      accessorKey: "updatedAt",
      size: 170,
      cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString()
    },
    {
      id: "active",
      header: "Status",
      accessorKey: "active",
      size: 100,
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={row.original.active ? "Active" : "Inactive"}
          tone={row.original.active ? "success" : "neutral"}
        />
      )
    },
    {
      id: "actions",
      header: "",
      size: 64,
      cell: ({ row }) => (
        <div onClick={(event) => event.stopPropagation()}>
          <WorkspaceRowActions
            title={row.original.title}
            onView={() => onShow(row.original)}
            onEdit={() => onEdit(row.original)}
            isSuspended={!row.original.active}
            onDelete={() => onToggle(row.original)}
            onRestore={() => onToggle(row.original)}
            actions={[
              {
                id: "delete",
                label: "Delete permanently",
                tone: "destructive",
                onSelect: () => onDelete(row.original)
              }
            ]}
          />
        </div>
      )
    }
  ];
  return (
    <WorkspaceTable
      columns={columns.filter((column) => !tools.hidden.includes(String(column.id)))}
      data={records}
      isLoading={loading}
      onRowClick={onShow}
      emptyState="No saved prompts found. Create a prompt to reuse it in a Codex chat."
      {...(tools.showFilters ? { filterRow: tools.filterRow } : {})}
    />
  );
}
