import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useConsents, useConsentDetail } from "./consent.hooks";
import { appendConsent } from "./consent.services";
import { ConsentList } from "./consent.list";
import { ConsentForm } from "./consent.form";
import { ConsentShow } from "./consent.show";
import type { ConsentColumnFilters, ConsentInput } from "./consent.types";

const columnOptions = [
  { id: "recipient", label: "Recipient" },
  { id: "brandUuid", label: "Brand" },
  { id: "action", label: "Evidence action" },
  { id: "noticeVersion", label: "Notice version" },
  { id: "createdBy", label: "Recorded by" },
  { id: "createdAt", label: "Recorded at" }
];

export function ConsentWorkspace() {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    action: "all",
    page: 1,
    pageSize: 50,
    fromDate: "",
    toDate: ""
  });

  const { search, action, page, pageSize, fromDate, toDate } = queryParams;

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

  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ConsentColumnFilters>({});
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const { list, count } = useConsents(deferredSearch.trim(), action, page, pageSize);

  const detail = useConsentDetail(showKey || null);
  const [showingLocal, setShowingLocal] = useState<string | null>(null);
  const showing: string | null = showKey || showingLocal;

  const save = useMutation({
    mutationFn: (input: ConsentInput) => appendConsent(api, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      setFormMode("");
      toast.success("Consent evidence recorded successfully.");
    },
    onError: (error) => toast.error("Unable to record consent", { description: error.message })
  });

  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;

  const filteredRecords = useMemo(() => {
    let items = list.data ?? [];
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
        if (deferredColumnFilters.recipient && !item.recipient.toLowerCase().includes(deferredColumnFilters.recipient.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.brandUuid && !item.brandUuid.toLowerCase().includes(deferredColumnFilters.brandUuid.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.action && !item.action.toLowerCase().includes(deferredColumnFilters.action.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.noticeVersion && !item.noticeVersion.toLowerCase().includes(deferredColumnFilters.noticeVersion.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.createdBy && !(item.createdBy || "").toLowerCase().includes(deferredColumnFilters.createdBy.toLowerCase())) {
          return false;
        }
        return true;
      });
    }
    return items;
  }, [list.data, fromDate, toDate, activeColumnFilters, deferredColumnFilters]);

  const total = count.data?.total ?? filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  if (formMode === "new") {
    return (
      <ConsentForm
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
      <ConsentShow
        uuid={showing}
        initialRecord={detail.data}
        onBack={() => {
          setShowingLocal(null);
          setShowKey("");
        }}
      />
    );
  }

  return (
    <WorkspacePage
      variant="list"
      title=""
      technicalName="page.marketing.consent.list"
      actions={
        <Button
          onClick={() => {
            save.reset();
            setFormMode("new");
          }}
        >
          Record Consent
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
                delete next[column.id as keyof ConsentColumnFilters];
                return next;
              });
              setQueryParams((prev) => ({ ...prev, page: 1 }));
            }
          }
        }))}
        onShowAllColumns={() => setHiddenColumnKeys("")}
        searchPlaceholder="Search recipient email"
        searchValue={search}
        onSearchValueChange={(value) => {
          setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
        }}
        filterValue={action}
        showSelectedFilterChip={true}
        onFilterValueChange={(nextAction) => {
          setQueryParams((prev) => ({ ...prev, action: nextAction, page: 1 }));
        }}
        filterOptions={[
          { id: "all", label: "All evidence" },
          { id: "grant", label: "Grants (Opt-in)" },
          { id: "withdraw", label: "Withdrawals (Opt-out)" }
        ]}
      />

      {list.error ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error.message}
        </p>
      ) : null}

      <ConsentList
        records={filteredRecords}
        loading={list.isLoading}
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
      />

      <WorkspacePagination
        page={currentPage}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[20, 50, 100]}
        showingLabel={buildShowingLabel(currentPage, pageSize, total)}
        singularLabel="consent record"
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
