import { useDutyOptions, useDutyAssignments } from "./duty-assignment.hooks";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { DutyAssignmentList } from "./duty-assignment.list";
import { listSopItems } from "../sop";
import { DutyAssignmentForm } from "./duty-assignment.form";
import { listDutyUsers, saveDuty, type DutyAssignment } from "./duty-assignment.services";

export function DutyAssignmentWorkspace() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<DutyAssignment | null | undefined>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const options = useDutyOptions();
  const query = useDutyAssignments(options.data?.canViewAll);
  const sops = useQuery({
    queryKey: ["crm", "sop-items"],
    queryFn: listSopItems,
    enabled: editing !== undefined && !!(options.data?.canCreate || options.data?.canEdit)
  });
  const users = useQuery({
    queryKey: ["crm", "duties", "users"],
    queryFn: listDutyUsers,
    enabled: editing !== undefined && !!options.data?.canCreate
  });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof saveDuty>[1]) => saveDuty(editing?.id, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["crm", "duties"] });
      setEditing(undefined);
    }
  });
  const items = (query.data ?? []).filter(
    (row) =>
      (filter === "all" || row.frequency === filter) &&
      [row.itemTitle, row.assigneeName, row.department].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase())
      )
  );
  if (editing !== undefined)
    return (
      <DutyAssignmentForm
        record={editing}
        items={sops.data ?? []}
        users={
          users.data ??
          (editing ? [{ id: editing.assigneeUserId, name: editing.assigneeName }] : [])
        }
        readOnly={!(editing ? options.data?.canEdit : options.data?.canCreate)}
        busy={save.isPending}
        error={save.error?.message ?? sops.error?.message ?? users.error?.message ?? ""}
        onSave={(input) => save.mutate(input)}
        onClose={() => {
          setEditing(undefined);
          save.reset();
        }}
      />
    );
  return (
    <WorkspacePage
      title="Duties"
      variant="list"
      technicalName="page.crm.duties"
      actions={
        options.data?.canCreate ? (
          <Button
            onClick={() => {
              save.reset();
              setEditing(null);
            }}
          >
            <Plus className="size-4" />
            New duty
          </Button>
        ) : null
      }
    >
      <WorkspaceFilters
        searchValue={search}
        onSearchValueChange={setSearch}
        searchPlaceholder="Search SOP, user, or department"
        filterValue={filter}
        onFilterValueChange={setFilter}
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
            aria-label="Refresh duties"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="size-4" />
          </Button>
        }
      />
      {query.error || options.error ? (
        <p role="alert" className="text-sm text-destructive">
          {(query.error ?? options.error)?.message}
        </p>
      ) : null}
      <DutyAssignmentList
        items={items}
        loading={query.isLoading || options.isLoading}

        onOpen={(row) => {
          save.reset();
          setEditing(row);
        }}
      />
    </WorkspacePage>
  );
}
