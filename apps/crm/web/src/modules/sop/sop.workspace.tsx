import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { listSopItems, type SopItem } from "./sop.services";
import { SopSimpleForm } from "./sop.simple-form";

export function SopWorkspace() {
  const query = useQuery({
    queryKey: ["crm", "sop-items"],
    queryFn: listSopItems,
    refetchInterval: 15000
  });
  const [editing, setEditing] = useState<SopItem | null | undefined>();
  const [search, setSearch] = useState("");
  const [frequency, setFrequency] = useState("all");
  const items = (query.data ?? []).filter(
    (item) =>
      (frequency === "all" || item.frequency === frequency) &&
      [item.title, item.department, item.currentRevision?.instructions ?? ""].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase())
      )
  );
  if (editing !== undefined)
    return <SopSimpleForm record={editing} onClose={() => setEditing(undefined)} />;
  return (
    <WorkspacePage
      title="SOPs"
      variant="list"
      technicalName="page.crm.sops"
      actions={
        <Button onClick={() => setEditing(null)}>
          <Plus className="size-4" />
          New SOP
        </Button>
      }
    >
      <WorkspaceFilters
        searchValue={search}
        searchPlaceholder="Search SOP name, department, or steps"
        onSearchValueChange={setSearch}
        filterValue={frequency}
        onFilterValueChange={setFrequency}
        filterOptions={[
          { id: "all", label: "All frequencies" },
          { id: "daily", label: "Daily" },
          { id: "weekly", label: "Weekly" },
          { id: "monthly", label: "Monthly" },
          { id: "annually", label: "Yearly" }
        ]}
        toolbarAction={
          <Button
            variant="outline"
            size="sm"
            aria-label="Refresh SOPs"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="size-4" />
          </Button>
        }
      />
      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      <WorkspaceTable<SopItem>
        data={items}
        isLoading={query.isLoading}
        onRowClick={setEditing}
        emptyState="No SOPs found."
        columns={
          [
            {
              id: "name",
              accessorKey: "title",
              header: "SOP name",
              cell: ({ row }) => (
                <button
                  type="button"
                  className="text-left font-medium hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(row.original);
                  }}
                >
                  {row.original.title}
                </button>
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
              id: "steps",
              header: "Steps",
              cell: ({ row }) => (
                <span className="line-clamp-2 max-w-xl whitespace-pre-wrap text-muted-foreground">
                  {row.original.currentRevision?.instructions ?? "�"}
                </span>
              )
            }
          ] satisfies ColumnDef<SopItem>[]
        }
      />
    </WorkspacePage>
  );
}
