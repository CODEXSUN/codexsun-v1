import { useCrmFrappeSyncEnabled } from "../frappe-sync/frappe-sync.hooks";
import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import { CallLogForm } from "./call-log.form";
import { useCallLogs, useCallLogOptions } from "./call-log.hooks";
import { CallLogList, callLogColumns } from "./call-log.list";
import { createCallLog } from "./call-log.services";
import type { CallLogFilters } from "./call-log.types";
import { getFrappeRecordStatuses } from "../frappe-sync/frappe-sync.indicator";

export function CallLogWorkspace() {
  const frappeSyncEnabled = useCrmFrappeSyncEnabled();
  const client = useQueryClient();
  const [filters, setFilters] = useState<CallLogFilters>({
    page: 1,
    pageSize: 100,
    search: "",
    type: "",
    status: ""
  });
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const query = useCallLogs(useDeferredValue(filters));
  const callLogIds = query.data?.items.map((record) => record.id) ?? [];
  const syncStatuses = useQuery({
    queryKey: ["crm", "frappe-sync", "call-logs", callLogIds],
    queryFn: () => getFrappeRecordStatuses("call-logs", callLogIds),
    enabled: frappeSyncEnabled && callLogIds.length > 0 && visibleColumns.frappeSync !== false,
    staleTime: 15_000
  });
  const options = useCallLogOptions();
  const loadError = query.error ?? options.error;
  const save = useMutation({
    mutationFn: createCallLog,
    onSuccess: async (record) => {
      await client.invalidateQueries({ queryKey: ["crm", "call-logs"] });
      toast.success("Call logged", { description: record.name });
      setOpen(false);
    }
  });
  const update = (patch: Partial<CallLogFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  return (
    <WorkspacePage variant="list" title="" technicalName="page.crm.call-logs.list">
      <WorkspaceFilters
        searchValue={filters.search}
        searchPlaceholder="Search call logs or phone number"
        onSearchValueChange={(search) => update({ search })}
        filterValue={filters.type || "all"}
        onFilterValueChange={(type) => update({ type: type === "all" ? "" : type })}
        filterOptions={[
          { id: "all", label: "All call types" },
          ...(options.data?.types ?? []).map((type) => ({ id: type, label: type }))
        ]}
        columnOptions={callLogColumns
          .filter((column) => column.id !== "frappeSync" || frappeSyncEnabled)
          .map((column) => ({
            ...column,
            checked: visibleColumns[column.id] !== false,
            onCheckedChange: (checked: boolean) =>
              setVisibleColumns((current) => ({ ...current, [column.id]: checked }))
          }))}
        onShowAllColumns={() => setVisibleColumns({})}
        toolbarAction={
          <div className="flex items-center gap-2">
            <div className="w-44">
              <WorkspaceSelect
                ariaLabel="Filter by status"
                value={filters.status || "all"}
                options={[
                  { value: "all", label: "All statuses" },
                  ...(options.data?.statuses ?? []).map((status) => ({
                    value: status,
                    label: status
                  }))
                ]}
                onValueChange={(status) => update({ status: status === "all" ? "" : status })}
              />
            </div>
            <Button
              type="button"
              className="h-8"
              disabled={!options.data}
              onClick={() => setOpen(true)}
            >
              <Plus className="size-4" /> Log a Call
            </Button>
          </div>
        }
      />
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError.message}
        </p>
      ) : null}
      <CallLogList
        records={query.data?.items ?? []}
        loading={query.isLoading}
        visibleColumns={{
          ...visibleColumns,
          frappeSync: frappeSyncEnabled && visibleColumns.frappeSync !== false
        }}
        frappeSyncStatuses={syncStatuses.data ?? {}}
      />
      <div className="flex items-center justify-end gap-3 text-sm">
        <span>Page {filters.page}</span>
        <Button
          type="button"
          variant="outline"
          disabled={filters.page === 1}
          onClick={() => update({ page: filters.page - 1 })}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!query.data?.hasMore}
          onClick={() => update({ page: filters.page + 1 })}
        >
          Next
        </Button>
      </div>
      <CallLogForm
        open={open}
        loading={save.isPending}
        error={save.error?.message ?? ""}
        types={options.data?.types ?? []}
        statuses={options.data?.statuses ?? []}
        onCancel={() => {
          save.reset();
          setOpen(false);
        }}
        onSubmit={(value) => save.mutate(value)}
      />
    </WorkspacePage>
  );
}
