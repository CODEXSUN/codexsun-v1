import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { useWorkspaceQueryState, useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { useMarketingTransport } from "../../transport";
import { useSubmissions, useSubmissionDetail } from "./submission.hooks";
import { saveSubmission, handoffSubmission, countSubmissions } from "./submission.services";
import { SubmissionList } from "./submission.list";
import { SubmissionForm } from "./submission.form";
import { SubmissionShow } from "./submission.show";
import { SubmissionImport } from "./submission.import";
import type { SubmissionColumnFilters, SubmissionInput } from "./submission.types";

const columnOptions = [
  { id: "name", label: "Contact name" },
  { id: "campaignLabel", label: "Campaign" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "createdAt", label: "Captured at" },
  { id: "status", label: "Handoff status" },
  { id: "leadUuid", label: "Marketing Lead" }
];

export function SubmissionWorkspace() {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    status: "all",
    page: 1,
    pageSize: 50,
    fromDate: "",
    toDate: "",
    filterName: "",
    filterCampaign: "",
    filterEmail: "",
    filterPhone: "",
    filterStatus: "",
    filterLead: "",
    columnSearch: ""
  });

  const { search, status, page, pageSize, fromDate, toDate } = queryParams;

  const [showKey, setShowKey] = useWorkspaceQueryValue("show", "");
  const [formMode, setFormMode] = useWorkspaceQueryValue("form", "");
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

  const [isImporting, setIsImporting] = useState(false);
  const showInlineFilters = queryParams.columnSearch === "1";
  const setShowInlineFilters = (value: boolean) =>
    setQueryParams((prev) => ({ ...prev, columnSearch: value ? "1" : "" }));
  const columnFilters: SubmissionColumnFilters = {
    name: queryParams.filterName,
    campaignLabel: queryParams.filterCampaign,
    email: queryParams.filterEmail,
    phone: queryParams.filterPhone,
    status: queryParams.filterStatus,
    leadUuid: queryParams.filterLead
  };
  const filterKeys: Record<
    keyof SubmissionColumnFilters,
    "filterName" | "filterCampaign" | "filterEmail" | "filterPhone" | "filterStatus" | "filterLead"
  > = {
    name: "filterName",
    campaignLabel: "filterCampaign",
    email: "filterEmail",
    phone: "filterPhone",
    status: "filterStatus",
    leadUuid: "filterLead"
  };
  function setColumnFilter(column: keyof SubmissionColumnFilters, value: string) {
    setQueryParams((prev) => ({ ...prev, [filterKeys[column]]: value, page: 1 }));
  }
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const filters = {
    ...deferredColumnFilters,
    search: deferredSearch.trim(),
    status,
    columnStatus: deferredColumnFilters.status ?? "",
    fromDate,
    toDate
  };
  const query = useSubmissions(page, filters, pageSize);
  const count = useQuery({
    queryKey: ["marketing", api.scopeKey, "submission-count", filters],
    queryFn: () => countSubmissions(api, filters)
  });

  const detail = useSubmissionDetail(showKey || null);
  const [showingLocal, setShowingLocal] = useState<string | null>(null);
  const showing: string | null = showKey || showingLocal;

  const save = useMutation({
    mutationFn: (input: SubmissionInput) => saveSubmission(api, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      setFormMode("");
      toast.success("Submission recorded. Open it to create a lead if it remains pending.");
    },
    onError: (error) => toast.error("Unable to save submission", { description: error.message })
  });

  const retry = useMutation({
    mutationFn: (uuid: string) => handoffSubmission(api, uuid),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      toast.success("Submission delivered to Marketing Leads.");
    },
    onError: (error) => toast.error("Handoff retry failed", { description: error.message })
  });

  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;

  const filteredRecords = query.data ?? [];
  const total = count.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  if (isImporting) {
    return (
      <WorkspacePage
        title="Import Submissions"
        description="Preview, map, and import submissions from CSV or JSON sources."
        technicalName="page.marketing.submission.import"
      >
        <SubmissionImport
          onClose={() => setIsImporting(false)}
          onSaved={async () => {
            await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
            setIsImporting(false);
          }}
        />
      </WorkspacePage>
    );
  }

  if (formMode === "new") {
    return (
      <SubmissionForm
        pending={save.isPending}
        error={save.error?.message ?? ""}
        onCancel={() => {
          save.reset();
          setFormMode("");
        }}
        onSubmit={(value) => save.mutate(value)}
      />
    );
  }

  if (showing !== null) {
    return (
      <SubmissionShow
        uuid={showing}
        initialRecord={detail.data}
        onBack={() => {
          setShowingLocal(null);
          setShowKey("");
        }}
        onRetry={() => retry.mutate(showing)}
        retryPending={retry.isPending}
      />
    );
  }

  return (
    <WorkspacePage
      variant="list"
      title=""
      technicalName="page.marketing.submission.list"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImporting(true)}>
            <Upload className="mr-1 size-4" />
            Import
          </Button>
          <Button
            onClick={() => {
              save.reset();
              setFormMode("new");
            }}
          >
            New Submission
          </Button>
        </div>
      }
    >
      <WorkspaceFilters
        toolbarAction={
          <>
            <WorkspaceDateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onValueChange={(val) => {
                setQueryParams((prev) => ({
                  ...prev,
                  fromDate: val.fromDate,
                  toDate: val.toDate,
                  page: 1
                }));
              }}
            />
            <Button
              aria-label="Toggle column search filters"
              aria-pressed={showInlineFilters}
              className="h-8 min-w-8 gap-1 px-2"
              title="Toggle column search filters"
              type="button"
              variant={showInlineFilters ? "default" : "outline"}
              onClick={() => setShowInlineFilters(!showInlineFilters)}
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
              const next = checked
                ? current.filter((id) => id !== column.id)
                : [...current, column.id];
              return next.join(",");
            });
            if (!checked) {
              if (column.id in filterKeys)
                setColumnFilter(column.id as keyof SubmissionColumnFilters, "");
            }
          }
        }))}
        onShowAllColumns={() => setHiddenColumnKeys("")}
        searchPlaceholder="Search submissions by contact, email, or campaign"
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
          { id: "all", label: "All submissions" },
          { id: "delivered", label: "Delivered" },
          { id: "pending", label: "Pending" }
        ]}
      />

      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {count.error ? (
        <p role="alert" className="text-sm text-destructive">
          Unable to load submission count.
        </p>
      ) : null}

      <SubmissionList
        records={filteredRecords}
        loading={query.isLoading}
        visibleColumns={visibleColumns}
        showInlineFilters={showInlineFilters}
        columnFilters={columnFilters}
        onColumnFilterChange={(col, val) => {
          setColumnFilter(col, val);
        }}
        onHideInlineFilters={() => setShowInlineFilters(false)}
        onView={(record) => {
          setShowingLocal(record.uuid);
          setShowKey(record.uuid);
        }}
      />

      {count.data ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[20, 50, 100]}
          showingLabel={buildShowingLabel(currentPage, pageSize, total)}
          singularLabel="submission"
          totalCount={total}
          totalPages={totalPages}
          onNextPage={() =>
            setQueryParams((prev) => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))
          }
          onPageChange={(next) => setQueryParams((prev) => ({ ...prev, page: next }))}
          onPreviousPage={() =>
            setQueryParams((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))
          }
          onRowsPerPageChange={(nextSize) => {
            setQueryParams((prev) => ({ ...prev, pageSize: nextSize, page: 1 }));
          }}
        />
      ) : null}
    </WorkspacePage>
  );
}
