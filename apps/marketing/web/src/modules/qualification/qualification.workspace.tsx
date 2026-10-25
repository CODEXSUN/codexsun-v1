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
import { useQualifications, useQualificationDetail } from "./qualification.hooks";
import { createQualification, updateQualification, countQualifications } from "./qualification.services";
import { QualificationList } from "./qualification.list";
import { QualificationForm } from "./qualification.form";
import { QualificationShow } from "./qualification.show";
import type { QualificationColumnFilters, QualificationInput, QualificationRecord } from "./qualification.types";

const columnOptions = [
  { id: "leadUuid", label: "Lead reference" },
  { id: "decision", label: "Decision" },
  { id: "criteria", label: "Criteria" },
  { id: "score", label: "Score" },
  { id: "reviewer", label: "Reviewer" },
  { id: "reason", label: "Reason" },
  { id: "createdAt", label: "Evaluated at" }
];

export function QualificationWorkspace() {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    decision: "all",
    page: 1,
    pageSize: 50,
    fromDate: "",
    toDate: ""
  });

  const { search, decision, page, pageSize, fromDate, toDate } = queryParams;

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
  const [columnFilters, setColumnFilters] = useState<QualificationColumnFilters>({});
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const query = useQualifications(deferredSearch.trim(), decision, page, pageSize);
  const count = useQuery({
    queryKey: ["marketing", api.scopeKey, "qualification-count", deferredSearch.trim(), decision],
    queryFn: () => countQualifications(api, deferredSearch.trim(), decision)
  });

  const detail = useQualificationDetail(showKey || recordKey || null);

  const [editingLocal, setEditingLocal] = useState<QualificationRecord | null | undefined>(undefined);
  const [showingLocal, setShowingLocal] = useState<string | null>(null);

  const editing: QualificationRecord | null | undefined =
    formMode === "new"
      ? null
      : formMode === "edit"
        ? (editingLocal ?? detail.data ?? null)
        : editingLocal;

  const showing: string | null = showKey || showingLocal;

  const save = useMutation({
    mutationFn: (input: QualificationInput) =>
      editing
        ? updateQualification(api, editing.uuid, { ...input, expectedRevision: editing.revision })
        : createQualification(api, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      setEditingLocal(undefined);
      setFormMode("");
      setRecordKey("");
      toast.success(editing ? "Qualification updated." : "Qualification evaluation recorded.");
    },
    onError: (error) => toast.error("Unable to save qualification", { description: error.message })
  });

  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;

  const filteredRecords = useMemo(() => {
    let items = query.data ?? [];
    if (fromDate || toDate) {
      items = items.filter((item) => {
        const itemDate = item.createdAt.slice(0, 10);
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
        if (deferredColumnFilters.decision && !item.decision.toLowerCase().includes(deferredColumnFilters.decision.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.criteria && !item.criteria.toLowerCase().includes(deferredColumnFilters.criteria.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.reviewer && !item.reviewer.toLowerCase().includes(deferredColumnFilters.reviewer.toLowerCase())) {
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
      <QualificationForm
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
      <QualificationShow
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
      technicalName="page.marketing.qualification.list"
      actions={
        <Button
          onClick={() => {
            save.reset();
            setEditingLocal(null);
            setFormMode("new");
          }}
        >
          New Qualification
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
                delete next[column.id as keyof QualificationColumnFilters];
                return next;
              });
              setQueryParams((prev) => ({ ...prev, page: 1 }));
            }
          }
        }))}
        onShowAllColumns={() => setHiddenColumnKeys("")}
        searchPlaceholder="Search qualifications by criteria, reviewer, or reason"
        searchValue={search}
        onSearchValueChange={(value) => {
          setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
        }}
        filterValue={decision}
        showSelectedFilterChip={true}
        onFilterValueChange={(nextDecision) => {
          setQueryParams((prev) => ({ ...prev, decision: nextDecision, page: 1 }));
        }}
        filterOptions={[
          { id: "all", label: "All evaluations" },
          { id: "qualified", label: "Qualified" },
          { id: "disqualified", label: "Disqualified" },
          { id: "deferred", label: "Deferred" }
        ]}
      />

      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}

      <QualificationList
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
        singularLabel="qualification"
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
