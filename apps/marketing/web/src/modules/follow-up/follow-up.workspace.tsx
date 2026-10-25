import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import {
  useWorkspaceQueryState,
  useWorkspaceQueryValue
} from "@codexsun/ui/workspace/navigation";
import { useMarketingTransport } from "../../transport";
import { useFollowUps, useFollowUpDetail } from "./follow-up.hooks";
import { createFollowUp, updateFollowUp, countFollowUps } from "./follow-up.services";
import { FollowUpList } from "./follow-up.list";
import { FollowUpForm } from "./follow-up.form";
import { FollowUpShow } from "./follow-up.show";
import type { FollowUpColumnFilters, FollowUpInput, FollowUpRecord } from "./follow-up.types";

const columnOptions = [
  { id: "title", label: "Task title" },
  { id: "leadUuid", label: "Lead reference" },
  { id: "type", label: "Type" },
  { id: "scheduledAt", label: "Scheduled at" },
  { id: "status", label: "Status" },
  { id: "assignedTo", label: "Assigned to" }
];

export function FollowUpWorkspace() {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    status: "all",
    type: "all",
    page: 1,
    pageSize: 50,
    fromDate: "",
    toDate: ""
  });

  const { search, status, type, page, pageSize, fromDate, toDate } = queryParams;

  const [showKey, setShowKey] = useWorkspaceQueryValue("show", "");
  const [formMode, setFormMode] = useWorkspaceQueryValue("form", "");
  const [recordKey, setRecordKey] = useWorkspaceQueryValue("record", "");
  const [leadUuidParam] = useWorkspaceQueryValue("leadUuid", "");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useWorkspaceQueryValue("hiddenColumns", "");

  const hiddenColumns = useMemo(
    () => hiddenColumnKeys.split(",").filter(Boolean),
    [hiddenColumnKeys]
  );
  const visibleColumns = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const opt of columnOptions) {
      map[opt.id] = !hiddenColumns.includes(opt.id);
    }
    return map;
  }, [hiddenColumns]);

  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<FollowUpColumnFilters>({});
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const query = useFollowUps(deferredSearch.trim(), status, type, page, pageSize);
  const count = useQuery({
    queryKey: ["marketing", api.scopeKey, "follow-up-count", deferredSearch.trim(), status, type],
    queryFn: () => countFollowUps(api, deferredSearch.trim(), status, type)
  });

  const detail = useFollowUpDetail(showKey || recordKey || null);

  const [editingLocal, setEditingLocal] = useState<FollowUpRecord | null | undefined>(undefined);
  const [showingLocal, setShowingLocal] = useState<string | null>(null);

  const editing: FollowUpRecord | null | undefined =
    formMode === "new"
      ? null
      : formMode === "edit"
        ? (editingLocal ?? detail.data ?? null)
        : editingLocal;

  const showing: string | null = showKey || showingLocal;

  const save = useMutation({
    mutationFn: (input: FollowUpInput) =>
      editing
        ? updateFollowUp(api, editing.uuid, { ...input, expectedRevision: editing.revision })
        : createFollowUp(api, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      setEditingLocal(undefined);
      setFormMode("");
      setRecordKey("");
      toast.success(editing ? "Follow-up task updated." : "Follow-up task scheduled.");
    },
    onError: (error) => toast.error("Unable to save follow-up task", { description: error.message })
  });

  const complete = useMutation({
    mutationFn: (record: FollowUpRecord) =>
      updateFollowUp(api, record.uuid, {
        ...record,
        status: "completed",
        completedAt: new Date().toISOString(),
        expectedRevision: record.revision
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      toast.success("Follow-up task marked as complete.");
    },
    onError: (error) => toast.error("Unable to complete follow-up task", { description: error.message })
  });

  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;

  const filteredRecords = useMemo(() => {
    let items = query.data ?? [];
    if (fromDate || toDate) {
      items = items.filter((item) => {
        const itemDate = item.scheduledAt.slice(0, 10);
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        return true;
      });
    }
    if (activeColumnFilters > 0) {
      items = items.filter((item) => {
        if (deferredColumnFilters.title && !item.title.toLowerCase().includes(deferredColumnFilters.title.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.leadUuid && !item.leadUuid.toLowerCase().includes(deferredColumnFilters.leadUuid.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.type && !item.type.toLowerCase().includes(deferredColumnFilters.type.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.status && !item.status.toLowerCase().includes(deferredColumnFilters.status.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.assignedTo && !(item.assignedTo ?? "").toLowerCase().includes(deferredColumnFilters.assignedTo.toLowerCase())) {
          return false;
        }
        return true;
      });
    }
    return items;
  }, [query.data, fromDate, toDate, activeColumnFilters, deferredColumnFilters]);

  const total = count.data?.total ?? filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  if (editing !== undefined) {
    return (
      <FollowUpForm
        key={editing?.uuid ?? "new"}
        record={editing}
        initialLeadUuid={leadUuidParam || undefined}
        pending={save.isPending}
        error={save.error?.message ?? ""}
        onCancel={() => {
          save.reset();
          setEditingLocal(undefined);
          setFormMode("");
          setRecordKey("");
        }}
        onSubmit={(value) => save.mutate(value)}
      />
    );
  }

  if (showing !== null) {
    return (
      <FollowUpShow
        uuid={showing}
        initialRecord={detail.data}
        onBack={() => {
          setShowingLocal(null);
          setShowKey("");
        }}
        onEdit={(record) => {
          setShowingLocal(null);
          setShowKey("");
          setEditingLocal(record);
          setFormMode("edit");
          setRecordKey(record.uuid);
        }}
        onComplete={(record) => complete.mutate(record)}
      />
    );
  }

  return (
    <WorkspacePage
      variant="list"
      title=""
      technicalName="page.marketing.follow-up.list"
      actions={
        <Button
          onClick={() => {
            save.reset();
            setEditingLocal(null);
            setFormMode("new");
          }}
        >
          New Follow-Up
        </Button>
      }
    >
      <WorkspaceFilters
        toolbarAction={
          <>
            <WorkspaceDateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onValueChange={(val) => {
                setQueryParams((prev) => ({ ...prev, fromDate: val.fromDate, toDate: val.toDate, page: 1 }));
              }}
            />
            <Button
              aria-label="Toggle column search filters"
              aria-pressed={showInlineFilters}
              className="h-8 min-w-8 gap-1 px-2"
              title="Toggle column search filters"
              type="button"
              variant={showInlineFilters ? "default" : "outline"}
              onClick={() => setShowInlineFilters((prev) => !prev)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeColumnFilters > 0 ? (
                <span className="text-xs">{activeColumnFilters}</span>
              ) : null}
            </Button>
          </>
        }
        columnOptions={columnOptions.map((column) => ({
          ...column,
          checked: visibleColumns[column.id] !== false,
          onCheckedChange: (checked) => {
            setHiddenColumnKeys((prev) => {
              const current = prev.split(",").filter(Boolean);
              const next = checked ? current.filter((id) => id !== column.id) : [...current, column.id];
              return next.join(",");
            });
            if (!checked) {
              setColumnFilters((prev) => {
                const next = { ...prev };
                delete next[column.id as keyof FollowUpColumnFilters];
                return next;
              });
              setQueryParams((prev) => ({ ...prev, page: 1 }));
            }
          }
        }))}
        onShowAllColumns={() => setHiddenColumnKeys("")}
        searchPlaceholder="Search tasks by title, lead, type, or assignee"
        searchValue={search}
        onSearchValueChange={(value) => {
          setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
        }}
        filterValue={status}
        showSelectedFilterChip={true}
        onFilterValueChange={(nextStatus) => {
          setQueryParams((prev) => ({ ...prev, status: nextStatus, page: 1 }));
        }}
        filterOptions={[
          { id: "all", label: "All follow-ups" },
          { id: "pending", label: "Pending" },
          { id: "completed", label: "Completed" },
          { id: "cancelled", label: "Cancelled" }
        ]}
      />

      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}

      <FollowUpList
        records={filteredRecords}
        loading={query.isLoading}
        visibleColumns={visibleColumns}
        showInlineFilters={showInlineFilters}
        columnFilters={columnFilters}
        onColumnFilterChange={(col, val) => {
          setColumnFilters((prev) => ({ ...prev, [col]: val }));
          setQueryParams((prev) => ({ ...prev, page: 1 }));
        }}
        onHideInlineFilters={() => setShowInlineFilters(false)}
        onView={(record) => {
          setShowingLocal(record.uuid);
          setShowKey(record.uuid);
        }}
        onEdit={(record) => {
          save.reset();
          setEditingLocal(record);
          setFormMode("edit");
          setRecordKey(record.uuid);
        }}
        onComplete={(record) => complete.mutate(record)}
      />

      <WorkspacePagination
        page={currentPage}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[20, 50, 100]}
        showingLabel={buildShowingLabel(currentPage, pageSize, total)}
        singularLabel="task"
        totalCount={total}
        totalPages={totalPages}
        onNextPage={() => setQueryParams((prev) => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))}
        onPageChange={(next) => setQueryParams((prev) => ({ ...prev, page: next }))}
        onPreviousPage={() => setQueryParams((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))}
        onRowsPerPageChange={(nextSize) => {
          setQueryParams((prev) => ({ ...prev, pageSize: nextSize, page: 1 }));
        }}
      />
    </WorkspacePage>
  );
}
