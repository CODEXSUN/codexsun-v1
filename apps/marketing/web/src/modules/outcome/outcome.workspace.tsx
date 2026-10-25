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
import { useOutcomes, useOutcomeDetail } from "./outcome.hooks";
import { createOutcome, updateOutcome, countOutcomes } from "./outcome.services";
import { OutcomeList } from "./outcome.list";
import { OutcomeForm } from "./outcome.form";
import { OutcomeShow } from "./outcome.show";
import type { OutcomeColumnFilters, OutcomeInput, OutcomeRecord } from "./outcome.types";

const columnOptions = [
  { id: "leadUuid", label: "Lead reference" },
  { id: "status", label: "Outcome" },
  { id: "reason", label: "Reason" },
  { id: "declaredValue", label: "Declared value" },
  { id: "effectiveDate", label: "Effective date" }
];

export function OutcomeWorkspace() {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    status: "all",
    page: 1,
    pageSize: 50,
    fromDate: "",
    toDate: ""
  });

  const { search, status, page, pageSize, fromDate, toDate } = queryParams;

  const [showKey, setShowKey] = useWorkspaceQueryValue("show", "");
  const [formMode, setFormMode] = useWorkspaceQueryValue("form", "");
  const [recordKey, setRecordKey] = useWorkspaceQueryValue("record", "");
  const [leadUuidParam] = useWorkspaceQueryValue("leadUuid", "");
  const [conversionUuidParam] = useWorkspaceQueryValue("conversionUuid", "");
  const [previousOutcomeUuidParam] = useWorkspaceQueryValue("previousOutcomeUuid", "");
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
  const [columnFilters, setColumnFilters] = useState<OutcomeColumnFilters>({});
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const query = useOutcomes(deferredSearch.trim(), status, page, pageSize);
  const count = useQuery({
    queryKey: ["marketing", api.scopeKey, "outcome-count", deferredSearch.trim(), status],
    queryFn: () => countOutcomes(api, deferredSearch.trim(), status)
  });

  const detail = useOutcomeDetail(showKey || recordKey || null);

  const [editingLocal, setEditingLocal] = useState<OutcomeRecord | null | undefined>(undefined);
  const [showingLocal, setShowingLocal] = useState<string | null>(null);

  const editing: OutcomeRecord | null | undefined =
    formMode === "new"
      ? null
      : formMode === "edit"
        ? (editingLocal ?? detail.data ?? null)
        : editingLocal;

  const showing: string | null = showKey || showingLocal;

  const save = useMutation({
    mutationFn: (input: OutcomeInput) =>
      editing
        ? updateOutcome(api, editing.uuid, { ...input, expectedRevision: editing.revision })
        : createOutcome(api, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      setEditingLocal(undefined);
      setFormMode("");
      setRecordKey("");
      toast.success(editing ? "Outcome record updated." : "Terminal outcome recorded.");
    },
    onError: (error) => toast.error("Unable to save outcome", { description: error.message })
  });

  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;

  const filteredRecords = useMemo(() => {
    let items = query.data ?? [];
    if (fromDate || toDate) {
      items = items.filter((item) => {
        const itemDate = item.effectiveDate;
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        return true;
      });
    }
    if (activeColumnFilters > 0) {
      items = items.filter((item) => {
        if (deferredColumnFilters.leadUuid && !item.leadUuid.toLowerCase().includes(deferredColumnFilters.leadUuid.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.status && !item.status.toLowerCase().includes(deferredColumnFilters.status.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.reason && !item.reason.toLowerCase().includes(deferredColumnFilters.reason.toLowerCase())) {
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
      <OutcomeForm
        key={editing?.uuid ?? "new"}
        record={editing}
        initialLeadUuid={leadUuidParam || undefined}
        initialConversionUuid={conversionUuidParam || undefined}
        onCancel={() => {
          save.reset();
          setEditingLocal(undefined);
          setFormMode("");
          setRecordKey("");
        }}
        onSubmit={(value) => save.mutate(value)}
        pending={save.isPending}
        error={save.error?.message ?? ""}
      />
    );
  }

  if (showing !== null) {
    return (
      <OutcomeShow
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
      />
    );
  }

  return (
    <WorkspacePage
      variant="list"
      title=""
      technicalName="page.marketing.outcome.list"
      actions={
        <Button
          onClick={() => {
            save.reset();
            setEditingLocal(null);
            setFormMode("new");
          }}
        >
          Record Outcome
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
                delete next[column.id as keyof OutcomeColumnFilters];
                return next;
              });
              setQueryParams((prev) => ({ ...prev, page: 1 }));
            }
          }
        }))}
        onShowAllColumns={() => setHiddenColumnKeys("")}
        searchPlaceholder="Search outcomes by reason or lead"
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
          { id: "all", label: "All outcomes" },
          { id: "won", label: "Won" },
          { id: "lost", label: "Lost" },
          { id: "nurture", label: "Nurture" },
          { id: "unresponsive", label: "Unresponsive" },
          { id: "withdrawn", label: "Withdrawn" }
        ]}
      />

      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}

      <OutcomeList
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
      />

      <WorkspacePagination
        page={currentPage}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[20, 50, 100]}
        showingLabel={buildShowingLabel(currentPage, pageSize, total)}
        singularLabel="outcome"
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
